# Catalog resilience qualification — 2026-07-26

Environment: isolated hosted Supabase database with two production-build Next.js application processes and a shared runtime cache directory. This is production-like application evidence; Vercel and Supavisor provider graphs remain release artifacts as required by the runbook.

## Freshness

The production browser qualification completed 20 valid transactions spanning insert, Card Name edit, Format Option and price edits, Rarity edits, Product Preview rights approval/rejection/restoration, preview configuration withdrawal/restoration, preview linkage, archive, and restore. Every affected shelf, hard-product, metadata/sitemap and preview output converged inside 60 seconds: p50 **108 ms**, p95 **115 ms**, maximum **451 ms**. UTC timestamps and webhook correlation IDs are retained in the Playwright `catalog-freshness-report` attachment.

## Multi-instance, outage, load, and recovery

Evidence: [`catalog-resilience-2026-07-26.json`](catalog-resilience-2026-07-26.json)

- Cross-instance convergence after invalidating through one instance: **1,193 ms**.
- Locked-database outage: **900 seconds**.
- Outage observations: **23**, each checking shelf, hard product, and sitemap through both instances.
- Outage response statuses: **138/138 HTTP 200** with one coherent retained generation; no empty Catalog, mass not-found, mixed projection, or successful empty sitemap.
- Recovery after lock removal and authenticated manual invalidation: **555 ms**, without application restart or connection cleanup.
- Load: **600 seconds at a target 50 requests/second**, then a **100-concurrent** post-invalidation burst.
- Recorded requests: **30,100**, all HTTP 200; no pool exhaustion or database-caused 5xx.
- Latency: p50 **26 ms**, p95 **57 ms**, p99 **468 ms**, maximum **10,907 ms**. The maximum occurred under the configured ten-second fault bound and remained below the bound plus two seconds.
- Each warm process reported at most one local driver connection, zero waiting connections, and one projection query per refresh; the cold safety-copy path remained within two projection queries.
- Each process emitted `catalog.alert.refresh_failures` after its second failed refresh and `catalog.alert.generation_age` at 81–82 seconds. Recovery produced a complete validated generation before incident clearance.

No credential, database host, SQL text, private rights evidence, or raw database error is present in the retained JSON.
