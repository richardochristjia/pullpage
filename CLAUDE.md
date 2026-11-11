@AGENTS.md

## Run the browser tests before opening or updating a pull request

CI (`.github/workflows/catalog-ci.yml`) runs `npm run test:e2e` against a local Supabase in Docker. Lint, typecheck, unit tests and build never open a browser, so they cannot catch layout, overflow, focus or Playwright failures. Passing them alone is not enough to open a pull request.

Before opening or pushing to a pull request, run the same sequence CI does, with Docker running:

1. `npx supabase start`
2. `npm run db:reset`
3. `npm run db:provision-runtime` (this overwrites `.env.local` with only the local read-only runtime credentials, so copy the existing `.env.local` aside first and restore it afterwards)
4. `LOCAL_MIGRATION_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:e2e` (`CATALOG_DATABASE_URL` is read from the `.env.local` that step 3 wrote)

Treat "e2e not run" as a blocker, not a footnote: if Docker or Supabase cannot start, say so and stop instead of opening the pull request. Never tick a verification item on "code read" alone when a browser test covers it. A new or edited e2e spec must have been executed at least once before it is committed.
