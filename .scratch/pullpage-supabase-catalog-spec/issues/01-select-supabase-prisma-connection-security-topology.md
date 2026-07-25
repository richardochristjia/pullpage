# Select the Supabase–Prisma connection and security topology

Type: research
Status: resolved
Blocked by:

## Question

Which documented Supabase connection modes, database roles, Prisma runtime/migration URLs, pooling settings, Vercel environment controls, and server-only boundaries should implement secure read-only production catalog access without browser Supabase credentials or connection exhaustion?

## Answer

Use a private Postgres schema, a custom least-privilege runtime role, Supavisor transaction pooling for Vercel runtime traffic, and a separate direct/session connection and role for Prisma migrations. Disable Supabase's Data API. Deploy only the runtime credential to Vercel and confine Prisma to a `server-only` Data Access Layer (DAL).

### Selected topology

| Concern | Decision |
| --- | --- |
| Catalog location | Put catalog tables in a non-exposed `catalog` schema, not `public`. Supabase Dashboard remains the administration interface. |
| Browser/API access | Disable the Supabase Data API in project API settings. Do not install or initialize `supabase-js` in the public app and do not define a Supabase URL, publishable/anonymous key, service-role key, or database URL with a `NEXT_PUBLIC_` prefix. |
| Production runtime | Connect Prisma with a custom read-only login through the Dashboard-generated Supavisor **transaction-mode** URL on port `6543`. This is Supabase's serverless connection mode and multiplexes short transactions onto a bounded database pool. |
| Migrations | Run `prisma migrate deploy` outside the Vercel application build with a distinct migration/owner login. Use the direct database URL on port `5432` when the trusted runner has IPv6, otherwise the Supavisor **session-mode** URL on port `5432`. Never migrate through transaction mode. |
| Local migration development | Run `prisma migrate dev` only against an isolated non-production database and shadow database. It is not a production command. |
| TLS | Enable Supabase SSL enforcement and include at least the SSL option prescribed by the Dashboard-generated connection string (normally `sslmode=require`). Use Supabase's CA with full certificate verification when the selected adapter supports it; never use `sslmode=disable` or an adapter `rejectUnauthorized: false` override. |
| Next.js runtime | Use the Node.js runtime. The selected database adapter, client, and TCP connection must not be imported into Edge Proxy/Middleware or Client Components. |

Copy connection strings from Supabase's **Connect** panel rather than constructing pooler hostnames or usernames manually. URL-encode generated passwords before placing them in a URI.

### Database roles and grants

Use separate privilege and login roles so credentials can be replaced without redesigning grants:

- `catalog_reader`: `NOLOGIN`; owns no objects. It receives only database `CONNECT`, schema `USAGE`, and `SELECT` on the catalog tables Prisma needs.
- `pullpage_runtime`: `LOGIN`, non-superuser, no create-database/create-role/replication/BYPASSRLS attributes; member only of `catalog_reader`. This is the Vercel credential. A replacement login can be created and swapped during rotation before the old login is dropped.
- `catalog_migrator`: a separate non-superuser login that owns the `catalog` schema and Prisma-created objects and can perform DDL there. It is available only to the trusted migration job/operator, never to the deployed application.
- Supabase's `postgres`/Dashboard administration identity remains operationally separate. Do not use `postgres`, `anon`, `authenticated`, `service_role`, or a role with `BYPASSRLS` as the Prisma runtime role.

Provisioning must establish these invariants:

```sql
REVOKE ALL ON SCHEMA catalog FROM PUBLIC;
GRANT CONNECT ON DATABASE postgres TO catalog_reader;
GRANT USAGE ON SCHEMA catalog TO catalog_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO catalog_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE catalog_migrator IN SCHEMA catalog
  GRANT SELECT ON TABLES TO catalog_reader;
```

The runtime role receives no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, sequence, function-execution, schema-creation, or DDL grant. Set `default_transaction_read_only = on` as defense in depth, but treat grants—not that default—as the security boundary. Set a narrow `search_path` (`catalog, pg_catalog`) and a finite `statement_timeout` for the runtime login.

Enable Row Level Security on the Catalog Product table and grant `catalog_reader` a SELECT policy limited to `archived_at IS NULL`. This makes reversible catalog exclusion a database-enforced runtime invariant while the Dashboard owner can still administer archived rows. Apply explicit read policies to every other runtime-readable table; an enabled table with no applicable policy must return no rows. The Data API remains disabled even with RLS: RLS is defense in depth, not a reason to expose browser access.

Review grants after every migration. The `ALTER DEFAULT PRIVILEGES` statement must name the role that actually creates future tables; running it as another role does not affect `catalog_migrator`'s future objects.

### Prisma URL and process separation

Use intentionally different secret names:

- `DATABASE_URL`: runtime login + transaction pooler `:6543` + `catalog` schema + TLS. This is the only database secret in the Vercel production deployment.
- `MIGRATION_DATABASE_URL`: migration login + direct or session `:5432` + `catalog` schema + TLS. This exists only in the migration environment.
- `SHADOW_DATABASE_URL`: isolated non-production shadow database used only by `prisma migrate dev`, if the selected Prisma version/configuration requires an explicit shadow URL.

The repository has not selected or installed a Prisma version yet. At implementation, pin one supported major and follow that major's current configuration model rather than copying an older schema example:

- Prisma 7 places the CLI datasource URL in `prisma.config.ts` and uses a driver adapter at runtime. Point the CLI config at `MIGRATION_DATABASE_URL`; construct the runtime adapter from `DATABASE_URL`.
- If an earlier supported Prisma version is deliberately selected, its `url`/`directUrl` schema fields may represent the same separation. The privilege and connection-mode split is mandatory regardless of syntax.

For transaction pooling, apply the selected Prisma version's documented PgBouncer/Supavisor compatibility setting. If that version requires `pgbouncer=true`, retain it on `DATABASE_URL`; do not add it to the migration URL. Do not assume transaction mode supports arbitrary session state or named prepared statements.

### Pool limits and failure bounds

- Instantiate one Prisma client/driver pool per warm Node.js process and reuse it; do not create a client per request or query. Use the standard development `globalThis` guard to survive hot reloads.
- Start the runtime driver pool at **one connection per process** (`max: 1` for Prisma 7's `@prisma/adapter-pg`, or the pinned version's equivalent such as `connection_limit=1`). This read-only catalog performs short queries and is cached; increase the limit only from measured concurrency evidence.
- Use finite acquisition/connect and statement timeouts so a saturated database fails promptly instead of consuming the entire Vercel function duration. An implementation starting point is a 5-second connection timeout and 10-second database statement timeout; validate these under load.
- Do not use long or idle interactive transactions, session-level state, LISTEN/NOTIFY, or advisory-lock-dependent runtime behavior through transaction mode.
- Before launch, compare Supavisor's configured database pool size and the Supabase plan's connection allowance, leaving headroom for Dashboard administration, migrations, and incident access. Load-test Vercel concurrency and confirm observed database connections remain within that budget. Do not raise per-process limits as the first response to pool timeouts.
- If fixed-egress network allowlisting is later required, first provision supported fixed egress for Vercel and then restrict Supabase to it. Ordinary Vercel function egress is not a stable narrow CIDR and must not be guessed into an allowlist.

Caching is additional load protection, not a database security or connection-management boundary. The separate cache/freshness decision must account for Next.js 16's warning that ordinary runtime `use cache` storage may be instance-local in serverless environments.

### Vercel secret controls

- Add only `DATABASE_URL` to the **Production** environment, mark it Sensitive where the Vercel plan supports that control, and restrict who can change production environment variables or redeploy.
- Preview and Development must use separate non-production databases and credentials, or have no database credential. Never expose the production reader to untrusted preview branches.
- Keep `MIGRATION_DATABASE_URL` and `SHADOW_DATABASE_URL` out of Vercel project settings. Migrations are an explicit trusted release step, not a `next build` side effect.
- Environment-variable changes affect new deployments; rotate by creating a replacement runtime login, updating the production secret, redeploying and verifying, then revoking the old login.
- Never print connection strings or whole environment objects to build/runtime logs. Keep committed `.env` files credential-free.

### Enforceable server-only boundary

Create one DAL module that:

1. begins with `import 'server-only'`;
2. is the only application module allowed to read `DATABASE_URL` or import/instantiate Prisma and its driver adapter;
3. exposes narrow read functions returning validated, minimal Catalog Product DTOs rather than raw Prisma records; and
4. is called from Server Components/cached server functions only.

Do not mark read functions with top-level `'use server'` merely to make them server-only: exported Server Functions can become externally callable POST entry points. `server-only` provides the desired client-import build error. Client Components may receive the intentionally public Catalog Product DTO fields, but never a Prisma object, adapter, environment value, or database error containing connection details.

### Acceptance evidence

Before implementation handoff is considered complete, verify all of the following:

- The runtime login can select active Catalog Products but cannot observe archived rows or insert, update, delete, truncate, create, alter, or drop objects.
- An anonymous request to Supabase's database API is unavailable because the Data API is disabled; no Supabase API/database credential or client library appears in browser bundles or browser network requests.
- Production and Preview deployments have the intended disjoint environment-variable scopes, and the migration URL is absent from Vercel.
- A production-like concurrency test shows one reused client pool per process, bounded connection counts, prompt timeout behavior, and recovery after pressure is removed.
- A build-time boundary test/lint rule fails if a Client Component imports the DAL, and representative DTO tests show only public catalog fields cross into client code.

### Primary sources

- Supabase, [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — direct, session-pooler, and transaction-pooler use cases and ports.
- Supabase, [Prisma integration](https://supabase.com/docs/guides/database/prisma) — Prisma pooler/direct URL split and migration guidance.
- Supabase, [Hardening the Data API](https://supabase.com/docs/guides/database/hardening-data-api) — default schema exposure, private schemas, and disabling the Data API.
- Supabase, [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Managing database passwords](https://supabase.com/docs/guides/database/managing-passwords) — policy behavior and credential handling.
- Supabase, [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement) and [Network restrictions](https://supabase.com/docs/guides/platform/network-restrictions) — transport and network controls.
- Prisma, [Supabase database connector guide](https://www.prisma.io/docs/orm/overview/databases/supabase), [Connection management](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-management), and [PgBouncer](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer) — serverless pooling and compatibility.
- Prisma, [`prisma.config.ts` reference](https://www.prisma.io/docs/orm/reference/prisma-config-reference) and [Deploying database changes](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production) — current datasource and migration command separation.
- Vercel, [Environment variables](https://vercel.com/docs/environment-variables), [Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables), and [Connection pooling with Vercel Functions](https://vercel.com/guides/connection-pooling-with-serverless-functions) — environment scopes, secret controls, and client reuse.
- Repository-pinned Next.js 16.2.10 docs: [Data Security](../../../node_modules/next/dist/docs/01-app/02-guides/data-security.md), [`use server`](../../../node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md), [Environment Variables](../../../node_modules/next/dist/docs/01-app/02-guides/environment-variables.md), [`use cache`](../../../node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md), and [`cacheLife`](../../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md).
