# Revise quality and failure acceptance criteria for the dynamic catalog

Type: research
Status: resolved
Blocked by: 03, 04, 05, 06, 07

## Question

Which inherited accessibility and performance gates remain unchanged, and what measurable cache-freshness, database latency/outage, stale-data, connection-pool, archive, metadata-consistency, and Dashboard-validation tests must be added for the Supabase architecture?

## Answer

### Decision

Preserve the approved WCAG 2.2 AA, responsive-browser, image-delivery, local interaction, Lighthouse, transfer-budget, and field Core Web Vitals gates. Replace only assumptions tied to build-time Google Sheets snapshots and add release-blocking tests for the runtime Supabase → Prisma → shared Next.js cache path.

The dynamic quality contract has two explicit priorities:

1. In healthy operation, valid committed catalog changes become visible in Pullpage-controlled responses within 60 seconds.
2. During database or regeneration failure, retain the last-known-good projection rather than publish an empty, partial, invalid, or mass-not-found catalog. Stale content may therefore exceed 60 seconds during an incident.

Search-engine indexing and third-party social-preview refresh remain outside the 60-second guarantee.

### Inherited gates that remain unchanged

The following requirements from the approved static specification remain release-blocking, with “build-time snapshot” interpreted as the validated public runtime projection already delivered to the page:

- WCAG 2.2 Level AA with no known A/AA failures, zero automated violations, no accessibility lint errors, Lighthouse Accessibility 100 on `/` and a representative product route, full keyboard testing, and NVDA/Chrome plus VoiceOver/Safari smoke tests.
- All accepted contrast, reflow, 200% zoom, text-spacing, labels, landmarks, status-message, target-size, focus, modal-dialog, reduced-motion, sharing, and Product Preview alternative-text behavior.
- Testing at 320×568, 375×812, 768×1024, 1024×768, and 1440×900, plus mobile landscape, 200% zoom, reduced motion, forced colors, blocked images, and current Playwright Chromium/Firefox/WebKit and release-time stable browsers. The support floor remains Chrome/Edge/Firefox 111+ and Safari 16.4+.
- The deterministic 500-Catalog-Product fixture, including every Rarity/format, duplicate-card designs, missing optional facts, placeholder/broken previews, and one/zero/all-result cases.
- Initial unscrolled image requests: at most 30 shelf thumbnails, zero modal-size images, no original full-resolution shelf assets, at most one likely LCP image eager, thumbnail p95 ≤200 KB, modal preview p95 ≤600 KB, selected width ≤1.5× rendered CSS width × DPR, and no image-caused layout shift or retry loop.
- Client search/filter/clear/sort event-to-final-paint p95 ≤100 ms under 4× CPU slowdown, no task over 50 ms, no lost input/focus, one result-count announcement, deterministic results, and no network request per interaction.
- Production lab thresholds on `/` and one representative product route: Lighthouse Performance ≥90, LCP ≤2.5 s, CLS ≤0.10, TBT ≤200 ms, FCP ≤1.8 s, compressed initial JavaScript ≤200 KB, initial non-image HTML/CSS/JS ≤350 KB, and zero console errors or unexpected failed requests.
- Field p75, split mobile/desktop when enough traffic exists: LCP ≤2.5 s, INP ≤200 ms, and CLS ≤0.10.

Add the streamed loading boundary, temporary-unavailable state, and database-recovery Retry behavior to the accessibility state matrix. Loading announcements must not repeat on every background refresh; failure UI needs a descriptive heading, plain-language message, keyboard-operable Retry control, visible focus, and no automatic focus theft.

### Revisions to obsolete static-build criteria

Replace “all product paths are prerendered” with these checks:

- `next build` succeeds with no Production database credential, performs no Production query, and does not enumerate Catalog Product slugs.
- The static shell builds successfully while the short-lived catalog cache is a request-time dynamic hole inside meaningful Suspense/loading boundaries.
- Essential Catalog Product facts occur in the server-rendered streamed response, not in a browser Supabase/API fetch. With JavaScript disabled, a user can still read a completed shelf/product response and follow canonical links.
- Newly inserted slugs work by hard load and intercepted soft navigation without deployment.
- The production bundle contains no static publishing code, Apps Script/Sheets client, fixture generator, prototype instrumentation, or database/browser credential.

Run the existing Lighthouse matrix twice, always with a cold browser profile:

1. **Warm shared catalog cache:** three runs per route; use the median.
2. **Cold shared catalog cache with healthy database:** evict the catalog entry before each of three runs per route; use the median.

Both matrices must meet the inherited lab thresholds. Record remote-cache lookup, database projection, streaming, and image timing so regressions can be assigned to the correct layer.

### Test environment and measurement rules

Dynamic acceptance tests run against the persistent synthetic-data Preview Supabase project and a production-mode Vercel deployment using the same region, Supavisor transaction mode, one-connection-per-process configuration, shared remote cache handler, webhook shape, and 500-product fixture intended for Production. Fault injection never targets Production.

Use database/journal UTC commit time—not the operator's click time—as freshness time zero. Poll canonical Pullpage responses every five seconds using fresh HTTP clients/browser cache disabled. A change is converged only when every affected Pullpage-controlled output returns the expected new state. Preserve raw timestamps, status codes, response metadata, cache status, correlation IDs, query counts, and Supabase/Vercel metrics.

“Healthy operation” means the Preview database, pooler, Vercel deployment, remote cache, and invalidation endpoint are available; no fault injection or migration is active; the measured projection query meets the latency gate; and polling traffic exists to trigger request-driven regeneration.

### Cache-freshness and invalidation gate

Run at least 20 isolated valid mutations spanning insert, identity edit, price/format edit, Rarity change, Product Preview/rights change, archive, and restore. For every trial:

- the first fully converged Pullpage response must occur no later than 60 seconds after commit;
- shelf, canonical product page, intercepted modal, generated metadata, and requested sitemap must all converge without deployment;
- the test records commit-to-webhook, webhook-to-tag-expiry, cache-refresh, and commit-to-public durations and reports p50, p95, and maximum; and
- a warm response before convergence may show the complete prior projection, never a mixture or partial update.

Additional required cases:

1. **Webhook path:** an authenticated expected event expires only the fixed `catalog` tag with `revalidateTag("catalog", { expire: 0 })`; it does not accept a caller-selected tag/path. A 2xx means invalidation was accepted, not that regeneration already finished.
2. **Missed webhook:** suppress one delivery and prove the 30-second revalidation/60-second expiry policy still converges under five-second polling within 60 seconds.
3. **Idle cache:** commit a change, send no catalog request for more than 60 seconds, then prove the first request blocks for and returns fresh data rather than serving an indefinitely idle entry.
4. **Cross-instance sharing:** alternate requests across multiple Vercel instances/regions available to the test and prove one shared catalog state; no instance may retain an independent stale in-memory catalog beyond the contract.
5. **Endpoint security:** missing, wrong, replayed where replay protection applies, wrong-method, wrong-table, and malformed webhook requests are rejected, do not invalidate, and do not leak the bearer secret in response or logs.
6. **Dependent tables:** qualifying Catalog Product, Rarity, Product Preview rights, and Cloudinary configuration changes all invalidate the same global tag. Date-only rights expiry, which emits no write event, converges through time-based revalidation.
7. **Client router cache:** hard navigation, soft navigation, Back/Forward, and a previously prefetched product are tested separately because `cacheLife.stale` governs the client cache with a documented 30-second minimum.

### Database and DAL latency gate

Measure from a production-like Vercel Node.js function in the selected region with the 500-product projection:

- One uncached DAL refresh—including pool acquisition, one Prisma projection query, DTO transformation, and whole-projection validation—must be p95 ≤500 ms and p99 ≤1,500 ms over at least 100 measured refreshes.
- A warm remote-cache hit must be p95 ≤100 ms at the server cache boundary and execute zero Prisma SQL queries.
- A cold successful refresh executes one logical projection query. Concurrent page, metadata, sitemap, and modal consumers use the same cache fill rather than independent ORM reads.
- The complete dynamic boundary must still satisfy the cold-cache Lighthouse and LCP gates above; meeting the SQL threshold alone is insufficient.

The 5-second connection timeout and 10-second database statement timeout from ticket 01 are failure bounds, not acceptable normal latency. Inject delayed acquisition and delayed SQL to prove each operation terminates within its configured timeout plus no more than two seconds of test/transport tolerance, emits a correlation ID, and does not cache an error or partial value.

### Connection-pool and stampede gate

With the 500-product fixture, run a 10-minute production-mode test at 50 requests/second plus a 100-concurrent-request burst immediately after cache invalidation.

Pass criteria:

- zero pool-exhaustion errors, acquisition timeouts, database-caused 5xx responses, or leaked connections;
- exactly one reused Prisma/driver pool per warm process and a configured maximum of one database connection per process;
- database connections remain within the measured Supavisor budget with at least 30% headroom for Dashboard, migrations, backup, and incident access;
- a warm-cache traffic interval executes no projection SQL;
- one successful refresh per invalidation is the target and no more than two projection executions are allowed for the same cache generation under the concurrency burst; and
- after forced pool saturation is removed, successful refresh resumes without process restart or manual connection cleanup.

If the selected remote handler cannot coalesce concurrent misses well enough to meet this gate, add a supported single-flight mechanism or lower frontend concurrency; do not solve it by unboundedly increasing Prisma or Supavisor pool limits.

### Database outage and stale-data gate

Exercise a complete 15-minute database/pooler outage in two starting states.

#### Last-known-good cache exists

- Shelf, product facts, metadata, and sitemap continue from one internally consistent last-known-good projection.
- Failed background regeneration does not replace the cache, publish an empty array, suppress all sitemap URLs, or turn known products into not-found results.
- Stale content may exceed 60 seconds and this exception is visible in operational telemetry, not falsely reported as a successful freshness result.
- The first failed refresh is logged. Two consecutive failures or a successful-cache age over 60 seconds trigger an operator alert within two minutes; repeated requests are rate/burst bounded and do not hammer Postgres.

#### No usable cache exists

- `/` and product routes return a 5xx temporary-unavailable response/state with safe generic Pullpage metadata and `noindex`; they do not render a zero-results catalog or product 404.
- `/sitemap.xml` returns an error rather than a successful empty sitemap.
- The error UI exposes no database host, SQL, Prisma details, credentials, private rights data, or stack trace.
- Retry is accessible and bounded; it must not create a client retry loop.

#### Recovery

After restoring the database, validate the complete runtime projection, invoke the authenticated manual global-tag invalidation, and prove the next request refreshes successfully and all outputs converge within 60 seconds. Clear the alert only after one verified fresh projection. The last-known-good cache is explicitly not accepted as backup or recovery evidence.

Also test invalid projection data injected only in an isolated fault fixture: whole-projection validation must throw, preserve last-known-good data, and never cache or selectively omit invalid rows.

### Archive, restore, and deletion gate

For one Catalog Product with a Product Preview and one without:

- an archival-only Dashboard save succeeds even when linked preview rights have just become invalid;
- after healthy convergence within 60 seconds, the product is absent from shelf/search data and sitemap, hard/soft product lookup renders branded not-found with `noindex`, and no redirect points to `/`;
- record the hard-load HTTP status because a streamed not-found may legitimately be HTTP 200, while rendered noindex/not-found semantics remain mandatory;
- no unrelated Catalog Product changes, ID changes, or slug changes occur;
- restoration is rejected while active-row constraints/rights are invalid; after correction it restores the same slug and all outputs within 60 seconds; and
- exceptional hard deletion produces the same public removal behavior while also satisfying ticket 04's two-person, journal, backup, recovery, and verification gate.

Repeat archive during a database outage to prove and document the selected tradeoff: the database commit may succeed while Pullpage continues serving the stale pre-archive projection beyond 60 seconds. An urgent legal takedown additionally disables/removes the Cloudinary delivery asset and uses applicable external removal tools; cache freshness alone is not an immediate takedown guarantee.

### Metadata, route, and sitemap consistency gate

For a single transaction that changes identity text, format/prices, Rarity, and Product Preview linkage, assert after convergence that:

- shelf, complete page, modal, title, description, canonical, Open Graph, Twitter metadata, social image choice, share URL, and sitemap image all reflect the same accepted public projection;
- page rendering and `generateMetadata` share one slug lookup/cache fill and cannot combine old metadata with new body facts in one response;
- normal browser, Googlebot, and configured HTML-limited social-bot hard loads receive complete server-generated metadata;
- canonical origin remains exactly `https://pullpage.vercel.app`, including Preview responses; Preview remains `noindex, nofollow` and never exposes its deployment hostname as canonical;
- archived/unknown successful lookups contain no stale product metadata, are omitted from sitemap, and emit `noindex` even when streaming produces HTTP 200;
- database failure is an error, not unknown-product behavior; with last-known-good data, product body, metadata, and sitemap remain on the same stale projection;
- sitemap follows the global catalog tag and has no independent deployment snapshot or unrelated TTL; and
- sitemap continues to omit invented `lastModified`, `changeFrequency`, and `priority` values.

External crawler recrawl, indexing, removal, and social-card cache refresh are monitored but have no pass/fail 60-second target.

### Dashboard and database-validation gate

Run database integration tests plus final Supabase Table Editor rehearsals for every accepted and rejected boundary. Each rejected transaction must preserve the previous row/count, `updated_at`, row journal, webhook queue, and public projection; no partial column update may commit.

Required invalid cases include:

- zero/negative/missing required prices and every format/price combination;
- unknown Rarity and invalid Rarity sort positions;
- duplicate-card missing Design Names and normalized duplicate Design Names, including concurrent inserts/updates and archived rows;
- mismatched/missing preview URL and rights ID, unapproved/future/expired/incomplete rights, unallowlisted/unversioned/non-HTTPS/SVG Cloudinary URLs;
- attempted slug, ID, or database timestamp mutation;
- overlong technical URL, blank canonicalization, and unusually long safe customer text;
- invalid restoration and valid archival-only reduction of exposure;
- routine hard-delete attempts; and
- runtime-role attempts to observe archived/private-rights data or perform any write/DDL.

Each accepted insert/update/archive/restore must create exactly the expected append-only journal entry and qualifying cache-invalidation event. Test ambiguous connection loss after commit: the operator refreshes and checks row/journal state before retrying, preventing duplicate insertion.

Constraint and trigger failures shown in Supabase Dashboard must use the documented stable name/message and correction hint. Two non-developer operators independently complete the ticket 05 field-guide scenarios in Preview without SQL, CSV import, schema changes, or developer interpretation of raw database internals.

### Observability and alert evidence

Instrument and retain, without customer secrets or private rights evidence:

- projection query and pool-acquisition duration;
- cache HIT/MISS/STALE/refresh result and successful cache-generation time;
- database query count per cache generation;
- webhook acceptance/rejection and commit-to-invalidation lag;
- commit-to-converged-public duration for controlled tests;
- connection count, pool budget/headroom, acquisition timeout, and statement timeout;
- refresh validation failures and correlation IDs; and
- last successful projection age.

Alert on two consecutive refresh failures, successful projection age over 60 seconds, sustained pool use above 70% of its database-connection budget for five minutes, any pool/statement timeout in healthy operation, repeated webhook rejection/delivery failure, and any successful empty projection when the database contains active products.

### Required release evidence

The implementation handoff must retain:

1. all inherited accessibility, responsive, image, interaction, Lighthouse, bundle, and field-performance artifacts;
2. warm- and cold-shared-cache Lighthouse reports;
3. 20-trial freshness results with p50/p95/max and one missed-webhook/idle-cache trial;
4. 100-refresh DAL/cache latency results and query counts;
5. the connection-pool/stampede load report and Supavisor headroom evidence;
6. warm-cache and cold-cache outage traces, alerts, error/noindex responses, and successful recovery;
7. create/edit/archive/restore/rights/Rarity consistency captures across shelf, routes, metadata, and sitemap;
8. database constraint/concurrency/role test results and two completed non-developer Dashboard rehearsals;
9. archive, hard-delete, targeted recovery, PITR, and independent-backup drill references from ticket 04; and
10. named performance, freshness, database, cache/webhook, Dashboard, and recovery owners with escalation runbooks.

### Primary sources

- Resolved local decisions: [connection/security](01-select-supabase-prisma-connection-security-topology.md), [schema/constraints](02-define-supabase-catalog-schema-and-constraints.md), [cache/failure strategy](03-select-nextjs-dynamic-data-and-cache-strategy.md), [backup/recovery](04-evaluate-supabase-backup-audit-and-recovery.md), [Dashboard workflow](05-define-dashboard-editing-and-archive-workflow.md), [dynamic routing/SEO](06-revise-dynamic-routing-seo-and-freshness-contract.md), and [environments/migrations](07-define-environments-migrations-and-seeding.md).
- Approved inherited criteria: [Accessibility and performance acceptance criteria](../../pullpage-static-catalog-spec/research/08-accessibility-performance-acceptance-criteria.md) and [static catalog specification](../../pullpage-static-catalog-spec/spec.md).
- Repository-pinned Next.js 16.2.10 documentation: [`use cache: remote`](../../../node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache-remote.md), [`cacheLife`](../../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md), [`revalidateTag`](../../../node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md), [ISR failure/revalidation behavior](../../../node_modules/next/dist/docs/01-app/02-guides/incremental-static-regeneration.md), [production checklist](../../../node_modules/next/dist/docs/01-app/02-guides/production-checklist.md), [Accessibility](../../../node_modules/next/dist/docs/03-architecture/accessibility.md), and [Supported Browsers](../../../node_modules/next/dist/docs/03-architecture/supported-browsers.md).
- Supabase first-party documentation cited by the resolved research: [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [Database Webhooks](https://supabase.com/docs/guides/database/webhooks), [Database Backups](https://supabase.com/docs/guides/platform/backups), [Audit Logs](https://supabase.com/docs/guides/platform/audit-logs), and [Logging](https://supabase.com/docs/guides/platform/logs).
- Prisma first-party documentation cited by the resolved research: [Connection management](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-management), [PgBouncer](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer), and [Supabase connector guide](https://www.prisma.io/docs/orm/overview/databases/supabase).
- Normative/customer-quality sources carried forward from the approved research: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Web Vitals](https://web.dev/articles/vitals), and [Interaction to Next Paint](https://web.dev/articles/inp).
