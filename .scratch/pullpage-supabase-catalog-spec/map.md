Label: wayfinder:map

# Replace the static publishing specification with a dynamic Supabase catalog specification

## Destination

An approved, implementation-ready replacement specification for Pullpage’s dynamic catalog using Supabase Postgres, Supabase Dashboard administration, server-side Prisma access, and public updates within 60 seconds, while preserving accepted customer, image, legal, discoverability, accessibility, and performance requirements unless the new architecture requires an explicit revision.

## Notes

- This effort is planning-only: stop at the replacement specification; do not provision Supabase, implement Prisma, migrate data, or deploy.
- Baseline: [`../pullpage-static-catalog-spec/spec.md`](../pullpage-static-catalog-spec/spec.md). It remains historical and approved for its original architecture until this effort approves a replacement.
- Read `CONTEXT.md`; use domain-modeling and grilling for domain decisions, research for Supabase/Prisma/Next.js facts, and the repository’s local Next.js 16.2.10 documentation before framework recommendations.
- Supabase Postgres is the new Catalog Product source of truth. Supabase Dashboard is the initial administration interface; there is no custom Pullpage `/admin` application.
- Saved valid Dashboard changes become public automatically within a 60-second cache window; there is no Draft/Publish workflow.
- The public application accesses the database server-side only through Prisma using a restricted read-only runtime role. Browsers receive no Supabase client or anonymous database/API access.
- Catalog Products use reversible `archived_at` catalog exclusion; hard deletion is exceptional maintenance. Archival is not stock availability.
- Keep one database row per Catalog Product with `format_code`, Binder Sleeve price, and Toploader price; Prisma derives Format Options.
- Carry forward the accepted Catalog Product language/content behavior, dark Catalog shelf, Cloudinary Product Preview policy, product paths and canonical origin, legal launch gates, and accessibility/performance criteria unless a ticket records a necessary change.
- Initial production origin remains `https://pullpage.vercel.app`.

## Decisions so far

- Production catalog reads use a private `catalog` schema, disabled Supabase Data API, a custom read-only/RLS-constrained runtime role over Supavisor transaction mode, and a server-only Prisma DAL. Prisma migrations use a separate privileged credential over a direct or session connection outside Vercel; Vercel receives only the production runtime secret and starts with one pooled connection per process. ([ticket 01](issues/01-select-supabase-prisma-connection-security-topology.md))
- Catalog data remains runtime-dynamic: one serializable Prisma DAL projection is shared through Next.js 16 remote Cache Components with a global tag, 30-second stale/revalidation and 60-second expiry values, React request deduplication, Supabase webhook invalidation, last-known-good failure handling, and runtime-discoverable intercepted product routes. The 60-second promise is a healthy-operation target and is intentionally relaxed during database failure. ([ticket 03](issues/03-select-nextjs-dynamic-data-and-cache-strategy.md))
- Production recovery requires Supabase Team with at least 14 days of explicitly enabled PITR, scheduled backups, Platform Audit Logs, focused `pgaudit`, an append-only row-change journal, and independently stored encrypted daily logical exports. Archival is normal; hard deletion requires two-person approval, verified recovery points, a retained before-image, controlled execution, and end-to-end public verification. ([ticket 04](issues/04-evaluate-supabase-backup-audit-and-recovery.md))
- The Catalog Product database contract is one row per product with an internal UUID, immutable database-generated slug, nullable exact supplied text, configurable Rarity relation, fixed format code and conditional positive whole-IDR prices, exact Cloudinary rights linkage, database-owned timestamps, and reversible `archived_at` exclusion. Postgres constraints and triggers reject invalid Dashboard saves; a restricted active-catalog view keeps Prisma reads simple and suppresses archived products, private rights data, and previews whose approval later expires. ([ticket 02](issues/02-define-supabase-catalog-schema-and-constraints.md))
- Environments are isolated as local Supabase, a persistent synthetic-data Preview project, and a dedicated Production project. Reviewed immutable Prisma migrations promote local/CI → Preview → Production through protected direct/session migration jobs; runtime URLs remain pooled and environment-specific. Production is never reset or fixture-seeded, destructive changes use expand/contract plus two-person backup/rollback gates, and named migration, deployment, and recovery owners control releases. ([ticket 07](issues/07-define-environments-migrations-and-seeding.md))
- Keep `/`, immutable `/products/<slug>` canonicals, and the intercepted modal, but resolve slugs, product metadata, and the sitemap from the shared runtime projection rather than `generateStaticParams` or deployment snapshots. Pullpage responses normally refresh within 60 seconds; crawler indexing, removal, and social-preview refresh have no 60-second guarantee. Streamed missing products may return HTTP 200 with automatic `noindex`; database failures remain errors, never mass not-found/empty-sitemap responses. ([ticket 06](issues/06-revise-dynamic-routing-seo-and-freshness-contract.md))
- Non-developer catalog administration uses a direct Edit → Save → Verify Supabase Dashboard workflow: valid active saves publish automatically through global cache invalidation, rejected saves remain atomic, image rights are prepared before product linkage, normal removal/restoration changes only `archived_at`, and diagnosis/recovery escalates from row/audit evidence to targeted correction before PITR. Editors never use Draft/Publish, DELETE, SQL, CSV import, or speculative retries; protected configuration, bulk repair, and hard deletion remain maintainer operations. ([ticket 05](issues/05-define-dashboard-editing-and-archive-workflow.md))
- All approved WCAG, responsive-browser, image, client-interaction, Lighthouse, transfer, and field Core Web Vitals gates remain. Dynamic release evidence additionally requires ≤60-second healthy commit-to-public convergence, warm/cold shared-cache performance, bounded DAL latency and connection use, stampede and outage tests, last-known-good/cold-failure correctness, coherent archive/metadata/sitemap behavior, atomic Dashboard validation, and freshness/pool observability. Availability intentionally outranks the 60-second target during database failure. ([ticket 08](issues/08-revise-dynamic-quality-and-failure-criteria.md))
- The consolidated [dynamic Supabase catalog specification](spec.md) is approved for implementation handoff. It reconciles safe-view runtime grants, all public-projection invalidation dependencies, archive-only failure safety, dynamic not-found semantics, availability-over-freshness behavior, Prisma 7, and Singapore Supabase/Vercel colocation. The static specification remains historical; Production launch still requires its explicit provisioning, legal, recovery, canonical-origin, and quality evidence. ([ticket 09](issues/09-approve-supabase-catalog-specification.md))

## Not yet specified

- None. Implementation and release gates remain, but no architecture decision is open.

## Out of scope

- A custom Pullpage admin/CRUD application; Supabase Dashboard is the administration interface for this effort.
- Google Sheets, published CSV, Apps Script validation/publishing, and Vercel Deploy Hooks as catalog-data mechanisms.
- Real-time subscriptions; the freshness target is within 60 seconds.
- Supabase provisioning, Prisma implementation, production migration, deployment, and production data entry.
- Purchasing, orders, checkout, payment, inventory, stock, or availability.
- Redesigning the accepted customer experience, logo, or broader brand without a demonstrated architectural conflict.
