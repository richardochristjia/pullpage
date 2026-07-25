# Keep the Catalog safe during database and cache failure

Label: ready-for-agent
Type: task
Status: open
Blocked by: 11, 12, 13, 14, 15

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Make the complete Catalog resilient across cache invalidation, missed webhooks, database latency, connection pressure, invalid projection data, and database outage. Healthy changes must converge within 60 seconds, while failures retain one coherent last-known-good shelf/product/metadata/sitemap generation or show an accessible temporary-unavailable error when no valid generation exists.

Deliver the behavior together with bounded pooling, structured telemetry, alerts, manual recovery, and production-like fault tests. Never translate a database or validation failure into an empty Catalog, partial rows, successful empty sitemap, or mass not-found response.

## Acceptance criteria

- [ ] The production Catalog uses one shared remote cache entry and global tag across shelf, product lookup, modal, metadata, sitemap, Rarity, rights, and preview configuration dependencies.
- [ ] Twenty representative valid insert/edit/format/Rarity/rights/preview/archive/restore transactions each converge across affected Pullpage-controlled outputs within 60 seconds under healthy production-like conditions, with p50, p95, and maximum recorded.
- [ ] A missed webhook converges through the approved time policy under polling, and an idle entry older than expiry blocks for fresh data on its next request.
- [ ] Date-only rights expiry converges without requiring a write event.
- [ ] Shared-cache behavior is demonstrated across multiple warm application instances rather than relying on process memory.
- [ ] Whole-projection validation occurs before cache replacement; one invalid row rejects the generation and is never omitted or partially cached.
- [ ] Failed background refresh preserves one internally consistent last-known-good shelf, product body, metadata, sitemap, Rarity order, and preview eligibility.
- [ ] A 15-minute database/pooler outage with last-known-good data never produces an empty Catalog, mass not-found, mixed projection, or successful empty sitemap, even when staleness exceeds 60 seconds.
- [ ] With no usable cache, shelf/product responses use an accessible branded temporary-unavailable 5xx with safe generic `noindex`; sitemap returns an error rather than successful empty content.
- [ ] Error output exposes no database host, SQL, Prisma details, credentials, stack trace, or private rights evidence and Retry does not create a client loop or steal focus.
- [ ] Connection acquisition and statement delays fail within their configured bounds plus two seconds and never cache an error/partial value.
- [ ] One Prisma/driver pool is reused per warm process with one connection maximum per process and no long/session-dependent runtime behavior.
- [ ] Ten minutes at 50 requests per second plus a 100-concurrent post-invalidation burst produces no pool exhaustion, database-caused 5xx, leaks, or acquisition timeout, preserves at least 30% Supavisor headroom, and executes no more than two projection queries for one successful generation.
- [ ] Removal of forced pool pressure restores successful refresh without process restart or manual connection cleanup.
- [ ] Telemetry records projection and acquisition duration, cache state/age/generation/result, query count, webhook acceptance/lag, connection use/headroom/timeouts, validation failure, and correlation IDs without secrets/private evidence.
- [ ] Alerts fire within two minutes for two consecutive refresh failures or valid-generation age over 60 seconds, and cover sustained pool use above 70%, healthy-operation timeouts, repeated webhook failure, and unexpected successful empty projection.
- [ ] After database restoration, complete projection validation plus authenticated manual invalidation produces verified public convergence within 60 seconds and only then clears the incident alert.
- [ ] Fault, load, freshness, and recovery tests retain timestamps, HTTP/cache status, query/connection metrics, correlation IDs, and affected public output evidence.

## Blocked by

- [Ticket 11](11-create-and-edit-valid-catalog-product.md)
- [Ticket 12](12-browse-find-and-open-catalog-products.md)
- [Ticket 13](13-deliver-rights-safe-product-previews.md)
- [Ticket 14](14-share-and-discover-canonical-products.md)
- [Ticket 15](15-archive-and-restore-catalog-product.md)
