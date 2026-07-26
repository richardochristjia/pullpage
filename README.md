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

The complete public projection uses one shared remote `catalog` cache generation with 30-second stale/revalidation and 60-second expiry values. Configure the fixed-scope Supabase Database Webhooks described in [the Catalog Editor guide](docs/catalog-editor-guide.md) to expire it immediately after accepted product, rights, or preview-configuration changes.

## Catalog editing

Follow [Catalog Editor: Edit → Save → Verify](docs/catalog-editor-guide.md). The guide covers fields, actionable database errors, generated slugs, public verification, ambiguous saves, and the required non-developer rehearsal.

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
