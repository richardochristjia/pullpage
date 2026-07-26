# Pullpage Catalog

A server-rendered Catalog of Pullpage extended-art products backed by hosted Supabase PostgreSQL.

## Hosted Supabase setup

Use a dedicated development/test Supabase project, not a database containing production customer data.

Requirements: Node.js and npm. Docker is not required.

```sh
npm install
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push:dry-run
npm run db:push
npm run prisma:generate
```

`db:push` applies pending migrations and the deterministic synthetic seed. It does not reset or delete the hosted database.

Copy the project's **Session pooler** connection string into `.env.local` as the admin connection, replacing the password placeholder locally:

```dotenv
SUPABASE_ADMIN_DATABASE_URL="postgresql://postgres.<project-ref>:<url-encoded-database-password>@<pooler-host>:5432/postgres"
```

Provision the least-privilege runtime login:

```sh
npm run db:provision-runtime
```

This generates and installs a random password for `catalog_runtime`, then writes `CATALOG_DATABASE_URL` and `TEST_CATALOG_DATABASE_URL` to the ignored `.env.local`. It also creates `CATALOG_REVALIDATE_SECRET` when absent. It never prints either secret. Run it again to rotate the runtime credential.

Start the application with `npm run dev` and open <http://localhost:3000>.

The runtime identity can select only from `catalog_public.active_catalog_products` and `catalog_public.catalog_rarities`; it cannot read or write Catalog Product, Product Preview rights, or environment configuration tables in `catalog_private`.

The complete public projection uses one shared remote current `catalog` generation with 30-second stale/revalidation and 60-second idle-expiry values. Metadata and the runtime sitemap consume that same generation. A separately retained whole-generation safety copy prevents a failed refresh from becoming empty, partial, mixed, or mass not-found output. Configure the fixed-scope Supabase Database Webhooks described in [the Catalog Editor guide](docs/catalog-editor-guide.md) to expire the current generation immediately after accepted product, rights, or preview-configuration changes.

Canonical and shared links always use `https://pullpage.vercel.app`, including Preview deployments. Vercel Production (`VERCEL_ENV=production`) permits indexing; Preview, development, and other environments emit `noindex, nofollow` and disallow crawling. Search-engine recrawl and third-party social-card cache timing are external and have no 60-second guarantee.

## Catalog editing

Follow [Catalog Editor: Edit → Save → Verify](docs/catalog-editor-guide.md). The guide covers fields, actionable database errors, generated slugs, reversible archive/restore, public verification, ambiguous saves, and the required non-developer rehearsals. Routine Catalog Editors never hard-delete Catalog Products.

## Environment promotion

Follow the [Catalog environment promotion and release runbook](docs/catalog-promotion-runbook.md). It defines isolated local/Preview/Production identities, immutable migrations, deterministic synthetic fixtures, credential-free pull-request CI, protected Preview promotion, Production release gates, and rollback/repair procedures.

## Recovery operations

Every successful Catalog Product mutation has a transactionally consistent private before/after journal entry. Follow the [Catalog audit and recovery runbook](docs/catalog-recovery-runbook.md) for targeted correction, exceptional controlled deletion, encrypted independent exports, isolated restore verification, approvals, and evidence. Paid Supabase PITR and Platform Audit Logs remain deferred on the free plan.

## Resilience operations

Follow the [Catalog resilience runbook](docs/catalog-resilience-runbook.md) for bounded connection settings, structured telemetry, alert rules, database/cache incidents, manual recovery, and retained fault/load/freshness qualification.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:production
```

Install Playwright's Chromium once with `npx playwright install chromium` before running browser tests.

`npm run build` deliberately needs no database credential. Database access begins only when a request dynamically renders the Catalog route.

## Optional local Supabase

The `db:start`, `db:reset`, `db:lint`, and `db:stop` scripts use the local Supabase stack and therefore require Docker. They are not needed for the hosted workflow above.
