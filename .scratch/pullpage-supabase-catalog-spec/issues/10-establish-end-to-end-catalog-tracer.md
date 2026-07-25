# Establish the end-to-end Catalog tracer

Label: ready-for-agent
Type: task
Status: open
Blocked by:

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Replace the throwaway prototype architecture with the smallest production-shaped Catalog path: one synthetic active Catalog Product stored in local Supabase, read through Prisma and the deep server-only Catalog module, transformed into a public DTO with a Binder Sleeve Format Option, and rendered as a production Catalog shelf row.

This slice establishes the migration, security, module, fixture, and test seams that every later slice extends. It must not preserve prototype variant switching, inline product data, query-selected product state, generated SVG previews, or browser database access.

## Acceptance criteria

- [ ] Prisma 7 and its PostgreSQL driver adapter are pinned with a committed lockfile and configured for local development without exposing credentials to browser code.
- [ ] A reproducible migration creates the private Catalog schema, the minimum Catalog Product structures needed by this tracer, required extensions, a safe active public projection, and least-privilege read-only runtime roles/grants.
- [ ] A deterministic synthetic seed inserts one active Binder Sleeve Catalog Product without a Product Preview and retrieves its database-generated immutable slug.
- [ ] One deep server-only Catalog module is the only application module that reads the runtime database URL or imports Prisma.
- [ ] The Catalog module returns a plain serializable public DTO and derives one Binder Sleeve Format Option with an IDR integer price.
- [ ] The production shelf route renders the seeded Catalog Product from Supabase with Pullpage branding, customer-facing facts, formatted IDR price, and branded missing-preview placeholder.
- [ ] The production route contains no inline Catalog Product source data, prototype variant switcher, prototype query controls, generated data-URI image, or prototype-only instrumentation.
- [ ] Application build succeeds without a Production database credential and does not query Production.
- [ ] Browser bundles and browser network activity contain no Supabase client, database URL, anonymous key, service-role key, Prisma object, or database request.
- [ ] Vitest, local Supabase/Postgres integration testing, Playwright, accessibility automation, and production-mode test commands are established for later slices.
- [ ] A clean-database integration test proves migration, seed, read-only projection, DTO transformation, and denial of runtime writes.
- [ ] A browser test proves the synthetic Catalog Product is rendered through the complete database-to-shelf path.

## Blocked by

None - can start immediately
