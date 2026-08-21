# Pullpage Catalog

A server-rendered Catalog of Pullpage extended-art products backed by Supabase PostgreSQL. Trusted editors maintain Catalog Products directly in Supabase; the Next.js application only reads active products through Prisma.

## Runtime configuration

The application needs one server-only environment variable for the Catalog:

```dotenv
CATALOG_DATABASE_URL="postgresql://catalog_runtime.<project-ref>:<password>@<session-pooler-host>:5432/postgres?sslmode=require"
```

Use the Supabase **Session pooler** connection for the dedicated `catalog_runtime` role. The role has `SELECT` only, and row-level security exposes only rows whose `is_active` value is true.

Set only `CATALOG_DATABASE_URL` in the Vercel Production and Preview scopes. Never expose it through a `NEXT_PUBLIC_` variable or browser code. A production build deliberately succeeds without this variable; database access starts when a request renders a Catalog route.

The application also reads one public environment variable for the optional WhatsApp sales CTA on the Catalog Product detail dialog:

```dotenv
NEXT_PUBLIC_WHATSAPP_NUMBER="6281234567890"
```

Format: digits only, no `+`, no spaces, no separators (international dialing form). When unset, the `Order via WhatsApp` button is not rendered and a single boot-time warning is logged in production. The number is treated as a non-secret business contact channel — it appears in the catalog markup and is therefore visible to crawlers.

For local application development, save the same read-only value in the ignored `.env.local`, then run:

```sh
npm install
npm run dev
```

Open <http://localhost:3000>.

## Catalog editing

Trusted non-developers follow [Edit the Pullpage Catalog in Supabase](docs/catalog-editor-guide.md). The guide covers creating and editing rows, Catalog Visibility, permanent deletion, Product Preview uploads, field constraints, and public verification.

Public Catalog responses use ordinary framework caching. A healthy saved change becomes visible in approximately 60 seconds without a deployment. Existing public HTTPS Cloudinary images and new public Supabase Storage images are both supported.

## Developer database maintenance

Database-owner access is developer-only and must not be configured in Vercel or application runtime environments. Put the Supabase owner **Session pooler** URL in the ignored `.env.migration.local` file:

```dotenv
CATALOG_MIGRATION_DATABASE_URL="postgresql://postgres.<project-ref>:<password>@<session-pooler-host>:5432/postgres?sslmode=require"
```

Apply committed immutable migrations and verify the resulting contract:

```sh
npm run db:migrate
npm run db:verify-catalog
```

To install or rotate the dedicated read-only login, run:

```sh
npm run db:provision-runtime
```

This reads `CATALOG_MIGRATION_DATABASE_URL` from `.env.migration.local`, changes only the `catalog_runtime` password, and writes read-only `CATALOG_DATABASE_URL` and `TEST_CATALOG_DATABASE_URL` values to `.env.local`. It does not print credentials.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Install Playwright Chromium once with `npx playwright install chromium`. Browser and PostgreSQL integration suites additionally require disposable local Supabase:

```sh
npm run db:start
LOCAL_MIGRATION_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run db:reset
LOCAL_MIGRATION_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run db:provision-runtime
npm run build
LOCAL_MIGRATION_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run test:integration
LOCAL_MIGRATION_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run test:e2e
npm run db:stop
```

The local Supabase commands require Docker. They never target the hosted Catalog. Pull-request CI uses only this disposable local stack and requires no hosted Supabase credential.
