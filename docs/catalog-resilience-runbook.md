# Catalog resilience runbook

## Runtime contract

Pullpage reads and validates the complete active public projection as one immutable Catalog generation. Shelf, product lookup, intercepted modal, metadata, Rarity ordering, Product Preview eligibility, and sitemap all select from that generation; callers never combine rows or facts from separate reads.

The current generation uses the shared Vercel remote cache, global `catalog` tag, and 30-second stale/revalidation plus 60-second idle-expiry policy. A separate whole-generation safety copy is refreshed hourly and retained for one year. It is never merged with current data: when current acquisition or validation fails, every output receives the same last-known-good generation. A cold process with neither generation returns the branded temporary-unavailable boundary; sitemap generation throws rather than returning successful empty XML.

The PostgreSQL adapter reuses one Prisma/driver pool per warm process with `max: 1`, a five-second acquisition bound, and ten-second statement/query bounds. Optional runtime overrides are `CATALOG_CONNECTION_TIMEOUT_MS`, `CATALOG_STATEMENT_TIMEOUT_MS`, and `CATALOG_QUERY_TIMEOUT_MS`; accepted values are 100–60,000 milliseconds. Do not raise them without repeating load and fault qualification.

## Structured telemetry

Application logs contain JSON events only; database errors and private rights evidence are deliberately discarded.

| Event | Important fields |
| --- | --- |
| `catalog.projection.refresh` | UTC time, correlation ID, generation ID on success, result, projection duration, query count, product count, validation/timeout classification, local pool totals/waiters/utilization |
| `catalog.generation.read` | generation ID, result, cache age |
| `catalog.generation.fallback` | retained generation ID and age |
| `catalog.webhook.accepted` | correlation ID, fixed table, result, commit-to-accept lag when supplied |
| `catalog.pool.error` | safe failure result |
| `catalog.alert.refresh_failures` | second consecutive refresh failure |
| `catalog.alert.generation_age` | valid-generation age above 60 seconds |
| `catalog.alert.empty_projection` | unexpected zero-row projection rejected before replacement |
| `catalog.alert.recovered` | complete validated generation after an active refresh-failure alert |

A correlation ID from an accepted webhook is also returned as `x-correlation-id`; retain it with the Supabase delivery record and public verification timestamps.

## Alerts

Configure these monitors independently in Preview and Production before release:

1. **Refresh failure:** page immediately on `catalog.alert.refresh_failures`. The application emits it on the second consecutive failure, so log ingestion and notification must complete within two minutes.
2. **Generation age:** page on any `catalog.alert.generation_age`; keep firing while the newest valid generation is older than 60 seconds.
3. **Pool pressure:** warn when Supavisor client or database connection use remains above 70% for two minutes. Page on acquisition timeout in otherwise healthy database operation. Application-local `poolWaiting > 0` or `timeout: true` is supporting evidence, not a replacement for Supavisor metrics.
4. **Webhook delivery:** alert after two consecutive non-2xx Supabase webhook attempts or two minutes without success. Match deliveries to `catalog.webhook.accepted` by UTC time and correlation ID.
5. **Projection safety:** page on `validationFailure: true`, any successful zero-product generation, or any successful empty sitemap. Empty projections are rejected before cache replacement, so these signals indicate drift or monitoring failure.

Do not clear an alert merely because Postgres accepts a connection. Clear only after complete projection validation, authenticated manual invalidation, and fresh verification of shelf, one product page/modal, metadata, and sitemap within 60 seconds.

## Incident response

1. Freeze Dashboard edits and record incident start UTC, affected outputs, deployment, Supabase project, and correlation IDs. Never reset, seed, migrate, or rotate credentials as an initial response.
2. Verify whether responses use one coherent last-known-good generation. A stale but complete Catalog is safer than empty, partial, mass not-found, or mixed output.
3. Check Supabase status, Supavisor connection use/headroom, acquisition/statement timeouts, Vercel function and cache health, webhook delivery, and the structured events above. Do not expose raw provider errors publicly.
4. If no valid generation exists, verify the branded temporary-unavailable boundary, generic `noindex`, one user-initiated Retry with no automatic loop, and sitemap error response.
5. Restore database/pooler health. Confirm forced locks or pressure are removed and that the one-connection pool recovers without process restart or manual session cleanup.
6. Read and validate the complete projection through a controlled Preview request. Then send one authenticated fixed-scope manual invalidation event; callers cannot choose a tag or path.
7. In a fresh browser, record UTC evidence that the shelf, local search source, hard product page, intercepted modal, metadata, Product Preview eligibility, and sitemap all agree. Require convergence within 60 seconds.
8. Clear alerts only after step 7. Unfreeze edits, record root cause and durations, and retain logs, provider metrics, traces, screenshots, statuses, generation/correlation IDs, and recovery evidence.

## Qualification

Never run fault or load qualification against Production. Use an isolated Preview Supabase project and at least two warm Preview application instances sharing the configured remote cache.

The production browser suite covers cold failure, accessible Retry, safe output, sitemap failure, missed-webhook polling, idle expiry, date-expired rights, more-than-60-second stale retention, recovery, and 20 representative transactions with p50/p95/maximum attachments.

For cross-instance and load qualification:

```sh
CATALOG_QUALIFICATION_ORIGINS="https://instance-a.example,https://instance-b.example" \
CATALOG_QUALIFICATION_OUTPUT="catalog-resilience-qualification.json" \
npm run test:resilience
```

Defaults are a 15-minute locked-projection outage, recovery and manual invalidation, ten minutes at 50 requests per second, and a 100-concurrent post-invalidation burst. The script changes one existing Card Name temporarily, invalidates through only the first instance, requires every instance to converge within 60 seconds, restores the exact value, and fails on incoherent outage output or any 5xx. Upload its JSON together with:

- Vercel logs proving multiple warm instance identifiers and no more than two projection queries for one generation;
- Supavisor connection graphs proving at least 30% headroom, no exhaustion/leak/acquisition timeout, and recovery after pressure removal;
- the 20-transaction Playwright attachment;
- 15-minute fault timestamps and coherent shelf/product/metadata/sitemap evidence;
- alert delivery and post-recovery clearance timestamps.

For a quick script rehearsal only, override `CATALOG_OUTAGE_DURATION_SECONDS`, `CATALOG_LOAD_DURATION_SECONDS`, and `CATALOG_LOAD_REQUESTS_PER_SECOND`. Such a rehearsal is not release evidence.
