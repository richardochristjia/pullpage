# Approve the implementation-ready Supabase catalog specification

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08

## Question

Do the inherited decisions and resolved Supabase revisions form one coherent replacement specification for implementation handoff, with no unresolved data, runtime, security, administration, recovery, discoverability, migration, or quality decisions?

## Answer

### Decision

**Yes. Approve [`../spec.md`](../spec.md) for implementation handoff.**

The consolidated specification preserves the accepted Catalog Product/customer experience, Cloudinary/legal, canonical URL, accessibility, browser, image, interaction, and performance contracts while replacing the Google Sheets/build-snapshot mechanism with one coherent Supabase runtime architecture.

### Approval review

| Area | Approved resolution |
| --- | --- |
| Domain/data | One Postgres row per Catalog Product; private UUID, immutable generated slug, exact nullable text, configured Rarity, fixed format/conditional whole-IDR prices, exact Product Preview rights linkage, timestamps, and reversible archival. |
| Validation | Postgres checks, foreign keys, expression indexes, and triggers atomically reject invalid Dashboard saves; Prisma validates the complete public projection again and never silently omits rows. |
| Security | Private schemas, disabled Data API, no browser Supabase client/keys, safe runtime views, read-only non-bypass role, server-only Prisma DAL, TLS, separate migration role/URL, and environment-scoped secrets. |
| Runtime | Prisma 7 PostgreSQL adapter through Supavisor transaction mode, one connection per process, Singapore Supabase/Vercel colocation, one serializable projection, one shared remote cache/tag, and runtime-discoverable slugs. |
| Freshness/failure | 30-second stale/revalidation and 60-second expiry, dependent-table webhooks, time fallback, last-known-good retention, cold-cache temporary-unavailable behavior, and no empty/mass-not-found failure mode. |
| Administration | Direct Edit → Save → Verify in Supabase Dashboard; no Draft/Publish or deploy; rights prepared before linkage; normal removal/restoration uses only `archived_at`; stable error guidance and escalation. |
| Audit/recovery | Team Audit Logs, focused `pgaudit`, append-only row journal, Team plus explicitly enabled 14-day PITR, independent encrypted exports, targeted correction, tested whole restore, and exceptional two-person hard deletion. |
| Routes/discoverability | Existing shelf, immutable canonicals, intercepted modal, sharing, metadata formulas, robots, and sitemap remain; runtime projection replaces `generateStaticParams` publication; streamed misses may be HTTP 200 with `noindex`. |
| Environments/migrations | Local/Preview/Production isolation, committed reviewed Prisma migrations with hand-written SQL, protected direct/session deployment, synthetic non-production seed, expand/contract changes, and no Production reset/seed. |
| Quality | All inherited WCAG/performance gates plus measurable cache freshness, DAL latency, pool/stampede, outage/stale, archive, metadata consistency, Dashboard validation, and observability tests. |

### Reconciliations applied in the final specification

Later resolved tickets refine earlier general recommendations as follows:

1. The runtime role reads only the safe active Catalog/Rarity projections, superseding ticket 01's illustrative broad `SELECT ON ALL TABLES` bootstrap. Base-table RLS remains defense in depth.
2. Cache invalidation covers qualifying Catalog Product, Rarity, rights, and Cloudinary-configuration changes, not only the Catalog Product table mentioned in ticket 03's initial sketch.
3. An archival-only update is allowed even when preview rights/configuration has become invalid; restoration still requires complete current validation.
4. Dynamic product routes do not use deployment-time slug enumeration. A streamed missing product is judged by branded not-found plus `noindex`, not an unconditional wire-level 404.
5. The 60-second promise applies to healthy Pullpage-controlled responses. During database failure, coherent last-known-good availability explicitly outranks freshness; external indexing/social caches have no 60-second promise.
6. The internal UUID is a private database key and does not revise the customer content contract's prohibition on a public Product ID.
7. Prisma 7 and Singapore Supabase/Vercel runtime colocation are selected; exact patch, credentials, project references, Cloudinary cloud name, and named human owners are controlled provisioning values rather than unresolved architecture.

### Remaining gates, not unresolved design

Implementation may begin, but Production content/indexing/launch remains blocked until the specification's evidence exists: infrastructure provisioning, exact dependency lockfile, migrations, Preview tests, Team/PITR/audit/export verification, named owners, Cloudinary configuration/capacity monitoring, legal/rights approval, canonical-origin verification, and all accessibility/performance/failure acceptance gates.

Those are execution and release gates with specified outcomes and owners; they do not require another architecture decision.

### Approval effect

[`../spec.md`](../spec.md) is now the authoritative implementation specification for the dynamic catalog. The prior [static specification](../../pullpage-static-catalog-spec/spec.md) remains a historical record of the Google Sheets/build-snapshot architecture and is not the implementation target for future work.
