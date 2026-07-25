# Qualify the complete Catalog for release

Label: ready-for-agent
Type: task
Status: open
Blocked by: 12, 13, 14, 15, 16, 17, 18

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Run the complete production-like Catalog through every approved accessibility, responsive-browser, image, interaction, page-performance, dynamic-freshness, database-latency, connection-pool, outage, Dashboard, security, migration, legal, and operational gate. Fix release-blocking defects and assemble the implementation handoff evidence and owner runbooks.

This slice does not weaken thresholds or treat automated scores as substitutes for manual testing. Production content, indexing, and launch remain blocked until the external legal, infrastructure, canonical-origin, and recovery prerequisites are actually satisfied.

## Acceptance criteria

- [ ] The complete Catalog has no known WCAG 2.2 A/AA failure across shelf, representative product page, modal, filters, zero results, placeholder, streamed not-found, loading, and temporary-unavailable states.
- [ ] Automated accessibility tests report zero violations, accessibility lint has zero errors, and Lighthouse Accessibility is 100 for the shelf and representative product route.
- [ ] Complete keyboard testing passes logical order, native control behavior, visible/unobscured focus, filtering focus stability, modal containment/dismissal/restoration, sharing feedback, Back/Forward, and 200% zoom.
- [ ] NVDA with Chrome and VoiceOver with Safari smoke tests pass with recorded versions and results.
- [ ] Current Playwright Chromium/Firefox/WebKit and release-time stable Chrome, Edge, Firefox, desktop Safari, iOS Safari, and Android Chrome pass at 320×568, 375×812, 768×1024, 1024×768, 1440×900, mobile landscape, and 200% zoom.
- [ ] Reduced motion, forced colors/high contrast, text-spacing override, blocked Product Previews, orientation changes, and 500/one/zero-result states have no clipping, overlap, hidden focus, unreachable controls, or page-level horizontal overflow.
- [ ] The 500-product cold unscrolled shelf requests at most 30 thumbnails, zero modal-size images, no original shelf assets, and at most one likely LCP image eagerly.
- [ ] Selected image width is no more than 1.5× rendered CSS width × DPR; thumbnail p95 is no more than 200 KB, modal preview p95 no more than 600 KB, and image state causes no visible layout shift or retry loop.
- [ ] Under 4× CPU slowdown, search/filter/clear/sort event-to-final-paint p95 is no more than 100 ms, no task exceeds 50 ms, no input/focus is lost, no network request occurs, and each action announces one final count.
- [ ] Three warm-shared-cache and three cold-shared-cache Lighthouse mobile trials per shelf/product route meet median Performance ≥90, LCP ≤2.5 s, CLS ≤0.10, TBT ≤200 ms, FCP ≤1.8 s, compressed initial JavaScript ≤200 KB, initial non-image transfer ≤350 KB, and zero unexpected console/network failures.
- [ ] Application build succeeds without Production database access, does not enumerate product slugs, and contains no prototype variants, dummy generator, development instrumentation, browser Supabase credential, or unused prototype dependency.
- [ ] Disabled-JavaScript tests can read the completed streamed shelf/product facts and follow canonical links.
- [ ] The 20-trial healthy freshness suite, missed-webhook case, idle-cache case, 100-refresh DAL/cache latency suite, connection-pool/stampede load suite, warm/cold outage suite, invalid-projection case, and recovery case all pass their parent-spec thresholds with retained raw evidence.
- [ ] Database constraint, concurrency, RLS/grant, journal, webhook, ambiguous-commit, clean migration, previous-version upgrade, drift, Preview promotion, migration failure, app rollback, targeted recovery, PITR, independent restore, and hard-delete suites pass.
- [ ] Two non-developer operators independently complete the final Dashboard field guide in Preview, including create with/without preview, edit, validation errors, rights, replacement, archive, restore, ambiguous save, public verification, and escalation.
- [ ] Production ownership/access inventory, Team/PITR/audit/export evidence, current commercial entitlement review, Cloudinary usage owner/thresholds, alert routes, and all primary/backup runbooks are complete without secret values.
- [ ] `https://pullpage.vercel.app` is verified as the stable HTTPS Production origin and all canonical, robots, sitemap, metadata, and share smoke tests use only that origin.
- [ ] Qualified counsel has approved actual Production assets, evidence, territories including Indonesia, metadata use, and exact attribution/non-affiliation notice before real content, social images, indexing, or launch.
- [ ] Production indexing remains disabled until every legal, origin, infrastructure, recovery, accessibility, performance, freshness, failure, and smoke gate is signed off.
- [ ] Post-launch field monitoring is assigned and configured to evaluate mobile and desktop p75 LCP ≤2.5 s, INP ≤200 ms, and CLS ≤0.10 when traffic is sufficient.
- [ ] The final evidence index links accessibility reports, manual checklists, screenshots, network traces, interaction benchmarks, Lighthouse/bundle reports, freshness/latency/pool/outage traces, migration/security tests, Dashboard rehearsals, recovery drills, legal record, owners, and escalation runbooks.

## Blocked by

- [Ticket 12](12-browse-find-and-open-catalog-products.md)
- [Ticket 13](13-deliver-rights-safe-product-previews.md)
- [Ticket 14](14-share-and-discover-canonical-products.md)
- [Ticket 15](15-archive-and-restore-catalog-product.md)
- [Ticket 16](16-keep-catalog-safe-during-database-and-cache-failure.md)
- [Ticket 17](17-audit-and-recover-catalog-changes.md)
- [Ticket 18](18-promote-catalog-safely-across-environments.md)
