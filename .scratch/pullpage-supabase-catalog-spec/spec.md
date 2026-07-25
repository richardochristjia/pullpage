Label: ready-for-agent
Status: **Approved for implementation handoff**

# Pullpage dynamic Supabase catalog

## Problem Statement

Pullpage needs to replace its throwaway static Catalog prototype and previously planned Google Sheets/build-snapshot publishing flow with a production Catalog that trusted non-developers can update directly and safely.

Customers need a fast, accessible, dark Catalog shelf where they can find and compare Catalog Products, inspect complete product details, share stable product links, and continue using the site when a Product Preview is unavailable. They must never see private rights evidence, database details, incomplete records, or silently corrupted Catalog data.

Catalog Editors need straightforward Supabase Dashboard administration without a custom admin application, developer deployment, or Draft/Publish ceremony. A valid save should normally appear on Pullpage within 60 seconds. An invalid save should fail atomically with actionable guidance. Removing a Catalog Product should be reversible through archival rather than routine deletion.

The business also needs a secure and recoverable architecture. Browsers must not connect to Supabase, application runtime access must be read-only, catalog changes must be auditable, database failures must not masquerade as an empty catalog or mass product removal, and production launch must remain gated by legal rights, accessibility, performance, backup, and operational evidence.

## Solution

Build a production Next.js Catalog backed by Supabase Postgres and read server-side through Prisma. Keep one row per Catalog Product, enforce the accepted Catalog Product contract inside Postgres, and expose only an active, public-safe projection to a deep server-only Catalog module.

The Catalog module will hide database access, validation, Format Option derivation, caching, failure behavior, and public DTO construction behind a small interface used by the shelf, product routes, intercepted modal, metadata, and sitemap. The complete public projection will use one shared remote cache entry with a 30-second stale/revalidation point, 60-second expiry, and authenticated database-webhook invalidation. Healthy valid changes will normally reach Pullpage-controlled responses within 60 seconds. Failed refreshes will retain the last-known-good projection; a cold failure will show an accessible temporary-unavailable state instead of false empty or not-found output.

Supabase Dashboard administration will use a direct Edit → Save → Verify workflow. Postgres constraints and triggers will generate immutable slugs, canonicalize missing values, validate formats and prices, enforce duplicate-card Design Names, validate Rarity and Cloudinary rights linkage, maintain timestamps and audit history, and reject invalid transactions. Catalog Products will be removed and restored by setting or clearing `archived_at`.

The production application will preserve the accepted dark Catalog shelf, local search/filter/sort behavior, canonical product pages, intercepted modal, Product Preview placeholder, sharing, metadata, sitemap, legal controls, WCAG 2.2 AA requirements, and performance budgets. The current three-direction prototype is reference material only; production keeps the approved Catalog shelf direction and removes prototype variants, dummy assets, query switches, and development controls.

## User Stories

1. As a catalog visitor, I want to browse all active Catalog Products on a dark Catalog shelf, so that I can discover Pullpage designs easily.
2. As a catalog visitor, I want each row to show identity facts, Design Name when supplied, Set Name or fallback, Supported Binder Formats, and prices, so that I can compare products without opening each one.
3. As a catalog visitor, I want missing Card Name to display as `No Name`, so that incomplete identity data remains understandable.
4. As a catalog visitor, I want missing Collector Number to display as `Unknown number`, so that absence is clear without fabricated data.
5. As a catalog visitor, I want missing Set Name to display as `Unknown set`, so that unidentified sets do not block browsing.
6. As a catalog visitor, I want missing Rarity to display as `Unknown rarity`, so that an optional classification does not hide a product.
7. As a catalog visitor, I want supplied customer-facing text displayed exactly and safely as plain text, so that Pullpage preserves the editor’s wording without executing markup.
8. As a catalog visitor, I want to search partial Card Name, Collector Number, Set Name, and Design Name matches, so that I can find a product using whichever fact I know.
9. As a catalog visitor, I want search to ignore case, accents, spaces, slashes, and hyphens, so that formatting differences do not prevent a match.
10. As a catalog visitor, I want to select multiple Rarities, so that I can browse several rarity groups together.
11. As a catalog visitor, I want to select multiple Supported Binder Formats, so that I can find products available in any acceptable format.
12. As a catalog visitor, I want inclusive minimum and maximum price filters, so that products exactly at my bounds are included.
13. As a catalog visitor, I want price filtering to consider only selected binder formats, so that an irrelevant format price does not produce a misleading match.
14. As a catalog visitor, I want deterministic Card Name, price, and Rarity sorting, so that repeated actions produce stable results.
15. As a catalog visitor, I want missing Card Names and unknown Rarities to remain last in both sort directions, so that known facts remain easiest to compare.
16. As a catalog visitor, I want prices formatted as Indonesian rupiah, so that the catalog’s currency is immediately clear.
17. As a catalog visitor, I want Binder Sleeve and Toploader prices shown separately when both formats are supported, so that I understand each Format Option.
18. As a catalog visitor, I want clear loading, zero-result, placeholder, not-found, and temporary-unavailable states, so that I always understand what Pullpage is doing.
19. As a catalog visitor, I want zero-result controls to remain available with an obvious reset, so that I can recover without reloading.
20. As a catalog visitor, I want a Product Preview of the finished presentation when available, so that I can understand the design.
21. As a catalog visitor, I want a branded placeholder when a Product Preview is missing, blocked, expired, or broken, so that all textual product facts remain usable.
22. As a catalog visitor, I want selecting a product to navigate to its canonical product URL and open a modal during soft navigation, so that I can inspect it without losing my shelf context.
23. As a catalog visitor, I want a hard load, refresh, new tab, crawler visit, or disabled-JavaScript visit to render a complete product page, so that product links work independently of modal state.
24. As a catalog visitor, I want browser Back to close the modal and restore filters, scroll, and focus, so that I can continue browsing where I left off.
25. As a catalog visitor, I want browser Forward to reopen the selected product, so that navigation history behaves normally.
26. As a catalog visitor, I want unknown and archived slugs to show branded not-found content with `noindex` and a shelf link, so that dead links are clear and recoverable.
27. As a catalog visitor, I want to share the exact canonical product URL through native sharing when available, so that recipients receive a stable link.
28. As a catalog visitor, I want clipboard and selectable-text fallbacks when native sharing is unavailable, so that sharing still works.
29. As a keyboard user, I want every control and product link operable in logical order with visible focus, so that I can use the entire Catalog without a pointer.
30. As a keyboard user, I want modal focus contained while open and restored when closed, so that I do not become lost in background content.
31. As a screen-reader user, I want descriptive titles, headings, landmarks, labels, groups, status messages, links, images, dialog naming, and route announcements, so that the Catalog’s structure and state are understandable.
32. As a user who prefers reduced motion, I want nonessential movement removed or shortened, so that interactions remain comfortable.
33. As a mobile visitor, I want search first and collapsible filter/sort controls before results, so that the small-screen workflow remains efficient.
34. As a desktop visitor, I want a persistent filter-led sidebar and comparison-friendly rows, so that refinement and comparison remain visible together.
35. As a visitor on a slow or failing backend, I want the last valid Catalog to remain available when safe, so that a temporary database incident does not erase the storefront.
36. As a visitor on a cold backend failure, I want a plain-language temporary-unavailable state with Retry, so that infrastructure failure is not misrepresented as no products.
37. As a Catalog Editor, I want to create one complete Catalog Product in Supabase Dashboard, so that I can add it without developer help or deployment.
38. As a Catalog Editor, I want a successful save to become automatically public in healthy operation, so that I do not need a Publish button.
39. As a Catalog Editor, I want invalid saves rejected atomically, so that partial or malformed product data never reaches customers.
40. As a Catalog Editor, I want stable validation messages and correction hints, so that I can fix errors without interpreting database internals.
41. As a Catalog Editor, I want blank optional text canonicalized to missing, so that whitespace does not create fake facts.
42. As a Catalog Editor, I want Postgres to generate and protect the slug, so that descriptive corrections never break shared product URLs.
43. As a Catalog Editor, I want required positive whole-IDR prices enforced for each selected format, so that every displayed Format Option is valid.
44. As a Catalog Editor, I want irrelevant positive format prices retained but ignored, so that switching formats does not unnecessarily destroy useful data.
45. As a Catalog Editor, I want only configured Rarity values accepted, so that filtering and sorting remain controlled.
46. As a Catalog Editor, I want duplicate depictions to require distinct Design Names, so that customers can distinguish multiple designs for one card.
47. As a Catalog Editor, I want a product without a preview to save with a placeholder, so that image availability does not block valid textual catalog data.
48. As a Catalog Editor, I want an approved exact rights record required before linking a Product Preview, so that unauthorized assets are not exposed.
49. As a Catalog Editor, I want to replace a Product Preview by linking a newly versioned approved asset, so that old canonical assets are not silently overwritten.
50. As a Catalog Editor, I want to archive rather than delete a Catalog Product, so that removal is safe and reversible.
51. As a Catalog Editor, I want archival to succeed even if existing preview rights just became invalid, so that reducing exposure is never blocked.
52. As a Catalog Editor, I want restoration to retain the original slug and require current validation, so that a returning product is both stable and safe.
53. As a Catalog Editor, I want to verify shelf, product, metadata, and sitemap effects after each change, so that Dashboard success is not confused with public convergence.
54. As a Catalog Editor, I want an ambiguous save checked against the row and journal before retrying, so that I do not create duplicate records.
55. As a Rights Reviewer, I want to prepare incomplete rights records as pending, so that evidence can be assembled before approval.
56. As a Rights Reviewer, I want approval blocked until required evidence, reviewer, channels, territories, attribution, and dates are complete, so that incomplete records cannot authorize images.
57. As a Rights Reviewer, I want rejected or expired rights to suppress the public preview automatically, so that Pullpage fails safely without removing the Catalog Product.
58. As a Catalog Maintainer, I want to configure Rarity order in protected data, so that new controlled values can be introduced without application enum changes.
59. As a Catalog Maintainer, I want to configure the approved Cloudinary cloud and folder centrally, so that arbitrary Cloudinary accounts cannot be used.
60. As a Catalog Maintainer, I want row-level before/after history and platform audit evidence, so that mistaken edits can be diagnosed and reversed.
61. As a Catalog Maintainer, I want targeted recovery for one or a few bad rows, so that unrelated valid work is not lost through whole-database restore.
62. As a Recovery Owner, I want PITR, scheduled backups, and independent encrypted logical exports, so that database loss and corruption have tested recovery paths.
63. As a Recovery Owner, I want hard deletion to require two people, a recent recovery point, a retained before-image, and public verification, so that exceptional irreversible work is controlled.
64. As a developer, I want one deep server-only Catalog module to provide validated public data, so that Prisma, caching, validation, and failure complexity stay local.
65. As a developer, I want shelf, product lookup, modal, metadata, and sitemap to share one projection, so that independent caches cannot produce mixed catalog versions.
66. As a developer, I want browsers to receive no Supabase client or credential, so that database access remains server-only.
67. As a developer, I want the runtime database role limited to safe views and read-only transactions, so that application compromise cannot modify catalog data or read private rights evidence.
68. As a developer, I want separate runtime, migration, shadow, and environment credentials, so that production access is least-privileged and replaceable.
69. As a developer, I want schema behavior represented by immutable reviewed migrations, so that every environment can be reproduced and drift detected.
70. As a developer, I want synthetic local and Preview fixtures plus stable public DTO fixtures, so that tests never require Production data or private rights evidence.
71. As a release owner, I want Local, Preview, and Production environments isolated, so that development, rehearsal, and live data cannot contaminate one another.
72. As a release owner, I want production migrations rehearsed with edit freeze, backup verification, and post-deploy invariants, so that releases are controlled and recoverable.
73. As a release owner, I want cache freshness, database latency, connection use, outage behavior, accessibility, and performance measured before launch, so that architectural promises have evidence.
74. As a search crawler, I want accurate canonical metadata, robots policy, and sitemap entries generated from the active public projection, so that discoverability signals match Pullpage’s current responses.
75. As a social crawler, I want complete Open Graph and Twitter metadata with a rights-approved image or branded fallback, so that shared links have dependable previews.
76. As the business owner, I want search-engine and social-cache timing described honestly, so that the 60-second Pullpage target is not misrepresented as guaranteed third-party indexing.
77. As the business owner, I want Cloudinary use and cost monitored, so that a free allowance is not mistaken for guaranteed production capacity.
78. As the business owner, I want actual production assets and notices reviewed by qualified counsel before indexing and launch, so that implementation is not mistaken for intellectual-property permission.

## Implementation Decisions

### Current-state replacement

- The repository currently contains a client-heavy, three-direction Catalog prototype with inline dummy Catalog Products, generated SVG previews, query-driven variant switching, and prototype-only modal behavior.
- Production will retain the approved dark **Catalog shelf** direction as the visual and interaction baseline. The other visual directions, prototype switcher, dummy generator, data-URI previews, prototype query controls, and development instrumentation will be removed from the production bundle.
- The existing Next.js App Router, React, Tailwind, strict TypeScript, ESLint Core Web Vitals configuration, supplied Pullpage logo, and accepted prototype styling cues are retained.
- Use Next.js 16.2.10, React 19.2.4, Tailwind CSS 4, Prisma 7 with its PostgreSQL driver adapter, Supabase Postgres, Vercel, and Cloudinary.

### Module design and seams

- Build one deep server-only **Catalog module**. Its interface supplies the complete validated public Catalog projection and product lookup by slug. Callers do not know about Prisma records, SQL views, rights tables, connection pooling, cache handlers, or validation internals.
- The Catalog module owns public DTO construction, missing-value representation inputs, Format Option derivation, Rarity sort position, whole-projection validation, cache tagging/lifetime, last-known-good behavior, and database-error distinction from a successful miss.
- The Catalog module returns plain serializable values only. Prisma models, driver objects, database errors, and private rights data never cross its interface.
- Shelf rendering, canonical product rendering, intercepted modal rendering, metadata, sitemap, and sharing all consume this same interface and projection.
- A separate pure **Catalog interaction module** owns search normalization, filters, eligible-price selection, sorting, and deterministic tie-breaking. It accepts public DTOs and client state and returns display-ready results without network access.
- A **Product Preview module** owns Cloudinary transformation URL construction, responsive size policy, accessible alternative text, and the common placeholder/failure behavior.
- An **invalidation module** owns authentication and fixed-tag expiry for database webhook events. It exposes no caller-selectable tag or route.
- A **database contract module**, delivered through migrations, owns schema, constraints, triggers, views, RLS, grants, reference data, and row journaling. Application callers do not duplicate these rules as a second publishing workflow.

### Catalog Product schema

- One Catalog Product is one Postgres row.
- Use a private immutable UUID primary key and a separate immutable customer-facing slug. The UUID is not a public Product ID.
- Generate slugs in Postgres at insert from available Card Name, Collector Number, and Design Name, normalized to a readable base no longer than 72 characters, with an eight-character random hexadecimal suffix. Use `catalog-product` when no readable base exists.
- Ignore attempted insert values for slug and reject every later slug change. A unique index is the collision backstop.
- Store Card Name, Collector Number, Set Name, and Design Name as nullable unbounded text. Convert empty or whitespace-only values to null while preserving nonblank text exactly.
- Store Rarity as a nullable foreign key to protected configuration. Seed `C`, `U`, `R`, `RR`, `AR`, `SR`, `SAR`, and `UR` at unique positive positions 1–8.
- Store format as the fixed values `BS`, `TL`, or `ALL`. Store Binder Sleeve and Toploader prices as nullable Postgres integers representing positive whole IDR.
- `BS` requires and derives Binder Sleeve only; `TL` requires and derives Toploader only; `ALL` requires and derives both. Irrelevant positive prices may remain stored but are ignored.
- Store optional Product Preview URL and rights-record UUID as an all-or-none exact composite relationship.
- Use database-owned UTC-aware creation and update timestamps. Creation is immutable; updates are trigger-maintained so Dashboard writes are covered.
- Use nullable `archived_at`. Null means active; any non-null timestamp means archived immediately. Clearing it restores the same UUID and slug after full active validation.

### Identity and duplicate constraints

- Normalize duplicate-card comparison by coalescing missing values, trimming, collapsing internal whitespace, removing accents, and lowercasing. Preserve punctuation.
- Compare Card Name, Collector Number, and Set Name together.
- If two or more active or archived products share the normalized card identity, every matching product requires a Design Name and normalized Design Names must be distinct.
- Enforce this with expression indexes, a unique normalized design backstop, and a concurrency-safe database trigger.

### Product Preview and rights

- Cloudinary is the only remote Product Preview host. Google Drive and arbitrary hosts are not accepted.
- Protected configuration stores the approved Cloudinary cloud name and `catalog-products/` folder.
- Accept only absolute HTTPS Cloudinary `image/upload` delivery URLs under that cloud and folder, with an immutable numeric version segment and supported raster asset. Reject SVG, credentials, alternate ports, fragments, unapproved clouds/folders, malformed URLs, and technical URLs over 2,048 characters.
- Do not make outbound image requests inside a database transaction. Runtime delivery failure uses the placeholder and operational monitoring.
- Keep a private rights register with exact versioned URL, asset identifier, source, creator, owner/licensor, permission basis/evidence, channels, territories, attribution requirement/text, effective and optional expiry dates, status, reviewer, review time, takedown notes, and timestamps.
- Rights records may be incomplete while pending. Transition to approved fails until required evidence is complete.
- A right is current only when approved, effective, and not past its optional expiry date. An expiry date remains valid through that calendar day.
- Active product saves and restoration require a current exact rights link. Later rejection, expiry, or configuration invalidation suppresses the URL in the public projection and causes the placeholder.
- Archival-only updates remain possible when preview rights or configuration became invalid, because reducing exposure must not be blocked.
- Use immutable versioned Cloudinary replacement assets. Verify the new public image before removing an old external asset.

### Public projection and security

- Store catalog and rights data in private database schemas and disable Supabase Data API.
- Expose a public-safe active Catalog view and Rarity projection. The Catalog view excludes archived rows, excludes private rights evidence, and returns a preview URL only while rights and Cloudinary configuration remain valid.
- Use a non-login read privilege role and a replaceable runtime login that receives only connection, schema use, and selection on the safe projections.
- The runtime login is non-superuser, read-only, owns no objects, cannot bypass RLS, and has no insert, update, delete, truncate, sequence, function, DDL, role, or replication privilege.
- Keep explicit base-table RLS as defense in depth even though runtime reads the safe views.
- Use a separate non-superuser migration owner available only to protected migration jobs.
- Disable browser Supabase access. Do not include a Supabase client, anonymous key, service key, database URL, or public-prefixed database configuration in the application bundle.
- The server-only Catalog module is the only application module allowed to import Prisma or read the runtime database URL.

### Connections and regions

- Use the Supabase-generated transaction-mode Supavisor connection for Vercel runtime traffic with TLS.
- Use a direct IPv6 or Supavisor session connection for migrations. Never migrate through transaction mode or during application build.
- Reuse one Prisma/driver pool per warm Node.js process and begin with one database connection maximum per process.
- Use finite acquisition/connect and statement failure bounds, starting around five and ten seconds respectively, and validate them under load.
- Provision Preview and Production Supabase in Singapore and run catalog-dependent Vercel Node.js functions in the Singapore region so the uncached path is colocated near the Indonesian audience.
- Only the runtime credential enters Vercel Production. Preview uses different infrastructure and credentials. Migration and shadow credentials never enter application runtime.

### Caching, freshness, and invalidation

- Read and validate the complete active projection as one cache generation. At the accepted 500-product ceiling, one coherent projection is preferred to per-product caches.
- Use one shared Next.js remote cache entry and one global `catalog` tag.
- Configure stale, revalidation, and expiry values of 30, 30, and 60 seconds respectively.
- Use request-level React memoization so page and metadata calls do not duplicate a Catalog read.
- Derive product lookup from the same projection rather than adding independently timed list and detail caches.
- Configure authenticated Supabase Database Webhooks for qualifying Catalog Product, Rarity, rights, and Cloudinary-configuration changes.
- The invalidation handler accepts only the expected method, secret, event, and table and immediately expires the fixed global tag. It does not regenerate eagerly or accept caller-selected cache identifiers.
- Time-based revalidation remains the fallback for missed/delayed webhooks and date-only rights expiry.
- A validation or database failure never becomes an empty projection or successful miss. Failed regeneration retains the last-known-good projection and retries later.
- With no usable projection, return an accessible temporary-unavailable 5xx state and safe generic noindex metadata. The sitemap must error rather than return successful empty content.
- The 60-second target applies under healthy Pullpage-controlled operation with request traffic. During database failure, coherent stale availability may exceed 60 seconds. Third-party search and social caches have no 60-second promise.

### Dashboard workflow and audit

- Routine administration is direct Edit → Save → Verify in Supabase Dashboard. There is no Draft/Publish, deploy action, CSV import, SQL workaround, or routine delete.
- Every operator uses an individual business-controlled MFA account. Document Catalog Editor, Rights Reviewer, Catalog Maintainer, Migration Owner, Deployment Owner, Recovery Owner, second approver, and backups.
- Supabase Dashboard access is broader than a custom admin. Use the least project role that permits the workflow, restrict Production membership, review access quarterly, and use audit/constraint controls as compensating safeguards.
- Database checks and triggers use stable names and correction hints for format/price, Rarity, duplicate design, preview/rights, Cloudinary, and immutable-field errors.
- A rejected save rolls back the row, timestamp, journal entry, webhook work, and public effect together.
- An accepted insert generates its slug and is immediately eligible for publication when not archived.
- Editors verify the shelf, canonical route, facts, prices, preview/placeholder, metadata, and sitemap after public convergence.
- Append every insert, update, and delete before/after image to a private transactionally written row journal with stable ID/slug, operation, timestamp, database role, and transaction identifier.
- Correlate database journal entries with Supabase Team Platform Audit Logs and focused `pgaudit`. Do not invent a human database actor when Dashboard traffic does not provide one.

### Routes, presentation, and interactions

- `/` remains the canonical Catalog shelf and `/products/<slug>` remains the immutable product canonical.
- Use an intercepted product route in a root modal slot for soft navigation and the same shared product-detail rendering for hard navigation.
- Include the required modal-slot fallbacks so hard and unrelated soft navigations do not preserve a stale modal.
- Do not use static export, deployment-time slug enumeration, or reject unknown dynamic parameters before runtime lookup.
- Build a static shell and stream Catalog-dependent server content through meaningful loading boundaries. Application build must not require Production database access.
- Desktop uses the approved persistent filter sidebar and comparison rows. Mobile presents search, then collapsible filters/sort, then results.
- Search/filter/sort state remains client-only, does not write query parameters, and resets on full shelf refresh.
- Product links are semantic canonical links, not prototype buttons with query-selected products.
- Modal behavior follows the WAI-ARIA modal-dialog pattern with an accessible name, inert background, contained Tab order, visible close control, Escape/Back dismissal, and focus restoration.
- Sharing uses the exact production canonical URL without query, fragment, tracking, Preview, or deployment host.

### Search, filtering, and sorting

- Search partial-matches supplied Card Name, Collector Number, Set Name, and Design Name after ignoring case, accents, spaces, slashes, and hyphens.
- Empty search adds no constraint and fallback labels are never indexed.
- Rarity and Supported Binder Format are multi-select OR groups. Search, Rarity, format, and price groups combine with AND.
- Unknown rarity is selectable. Minimum and maximum price bounds are optional and inclusive.
- Price matching considers selected format prices only, or any Format Option when no format is selected.
- Default sorting is Card Name ascending, case/accent insensitive, with missing Card Names last in both directions.
- Card Name ties use Collector Number, Design Name, and Slug. Price ties use Card Name and Slug. Rarity follows configured order while unknown remains last. Slug is always the final deterministic tie-breaker.

### Product Preview delivery

- Use a custom Next image loader that emits versioned non-cropping Cloudinary transformations with automatic format and quality.
- Reserve image dimensions/aspect ratio, provide accurate responsive sizes, lazy-load below-fold thumbnails, and request modal-size assets only after opening.
- Use one branded placeholder for missing, blocked, malformed, timed-out, expired-rights, and HTTP-failed previews without retry loops or loss of textual facts.
- Monitor Cloudinary storage, transformations, bandwidth, and cost monthly. A free allowance is not a guaranteed production capacity plan.

### Metadata, sitemap, and indexing

- Fix the production origin to `https://pullpage.vercel.app`; never derive canonical output from incoming headers or deployment hosts.
- Keep the global title template, English language, `en_US` locale, factual read-only description, and generic Pullpage social image.
- Product title uses Card Name plus Design Name when supplied, or `Extended Card Art` when Card Name is missing.
- Product description includes only known Collector Number, Set Name, Rarity, Supported Binder Formats, and lowest Format Option price. It omits fallback labels.
- Normalize metadata whitespace and limit generated title and description at word boundaries to 65 and 160 characters without modifying stored source text.
- Emit complete canonical, Open Graph website, and Twitter large-image metadata from the same Catalog Product DTO used by the body.
- Use a rights-approved 1200×630 non-cropped Product Preview social image or checked-in Pullpage fallback.
- Generate one runtime sitemap from the active projection with `/`, active product canonicals, and current approved preview image URLs. Omit invented last-modified, change-frequency, and priority values.
- Production robots allows crawling and names the absolute sitemap. Preview and non-production disallow crawling and emit page-level noindex/nofollow while retaining production canonicals.
- A successful unknown or archived lookup renders branded not-found, no product facts, noindex, shelf recovery, and no sitemap entry. Streaming may produce HTTP 200; literal wire status is not the correctness criterion.
- Database failure is an error and must never produce unknown-product behavior.

### Accessibility and responsive behavior

- WCAG 2.2 Level AA is release-blocking. Automated tooling supports but does not replace manual keyboard and screen-reader testing.
- Preserve accepted contrast, reflow at 320 CSS pixels, 200% zoom, text spacing, skip link, one descriptive heading, unique title, main landmark, persistent labels, grouped controls, polite status messages, and non-color state cues.
- Primary and icon controls target at least 44×44 CSS pixels; every target meets WCAG’s 24×24 minimum.
- Focus remains visible and unobscured, filtering does not unexpectedly move it, and no positive tabindex is used.
- Product rows have distinguishable accessible names. Product Preview alternatives identify the finished presentation where informative; redundant thumbnails may be decorative.
- Reduced motion removes nonessential entrance, stagger, parallax, smooth-scroll, and modal transforms. No content flashes over three times per second.
- Support Chrome, Edge, and Firefox 111+ and Safari 16.4+.

### Environments, migrations, fixtures, and recovery

- Use isolated local Supabase, persistent synthetic Preview Supabase, and dedicated Production Supabase Team environments.
- Environment project references, credentials, roles, webhook secrets, Cloudinary configuration, backup destinations, and Vercel values are distinct. Untrusted pull requests receive no hosted database secret.
- Committed Prisma migration history is the schema authority. Hand-edit reviewed migration SQL for extensions, triggers, views, RLS, grants, audit objects, and webhooks Prisma cannot represent.
- Prove migrations from zero and from the previous schema in CI, then rehearse in Preview before a protected single-flight Production migration with edit freeze and backup verification.
- Prohibit schema push, development migration, reset, and database studio tools against Preview and Production. Applied migrations and migration history are immutable.
- Use expand/backfill/contract for destructive evolution. Destructive SQL, large backfills, role/trigger/view replacement, production migration resolution, and restore require independent approval and tested recovery thresholds.
- Provide a deterministic 500-product synthetic database seed for local/Preview and stable checked-in public DTO fixtures for rendering and behavior tests. Production is never reset or fixture-seeded.
- Production minimum is Supabase Team, explicitly enabled PITR for at least 14 days, scheduled backups, Team Platform Audit Logs, focused database audit logs, append-only journal, and encrypted daily logical exports outside Supabase.
- Retain 35 daily exports, 12 month-end exports, and pre-destructive copies for at least one year. Verify content and rehearse isolated restore quarterly.
- Use journal-based targeted recovery for one/few records. Whole-database restore is an incident procedure that freezes edits, preserves evidence, requires two people, validates all invariants, replays later good work, invalidates cache, and smoke-tests before reopening.
- Hard deletion is exceptional only when archival cannot meet a documented legal, privacy, or correction need. It requires two-person approval, healthy recovery points, verified export, before-image, controlled execution, and public/Cloudinary/rights verification.

### Legal and launch controls

- The implementation does not establish intellectual-property permission.
- Use synthetic or independently rights-cleared assets until qualified counsel reviews actual products, previews, territories including Indonesia, metadata use, permission evidence, and exact attribution/non-affiliation wording.
- Pullpage remains the dominant identity. Do not claim official, licensed, authorized, partnership, sponsorship, or endorsement status without evidence.
- Do not use official logos, card backs, set symbols, character art, or similar assets as site chrome without explicit approval, and do not scrape Pokémon assets merely because they are public.
- Production indexing and launch remain blocked until legal, rights, canonical-origin, infrastructure, recovery, accessibility, performance, and failure gates pass.

## Testing Decisions

### Test philosophy and seams

- Good tests assert externally visible behavior and durable contracts, not internal function calls, React implementation details, SQL text shape, cache-library internals, or CSS class names.
- The **primary seam** is the highest end-to-end behavior: a committed Catalog transaction in production-like Supabase observed through Pullpage’s public HTTP and browser outputs. This seam covers automatic publication, cache invalidation, shelf/product/modal behavior, metadata, sitemap, archive/restore, and failure recovery.
- A single narrow **database-contract seam** supplements it for rejected writes, concurrency, grants, triggers, and audit behavior that intentionally never reaches the public application.
- The deep Catalog module interface is the main code-level seam. Route and metadata tests call through it rather than mocking Prisma independently at every caller.
- The pure Catalog interaction module is tested through public DTO input and resulting ordered/matched Catalog Products. Tests do not inspect its internal normalization helpers.

### Test tooling and current prior art

- The repository currently has no automated test framework or test scripts. Add Vitest for pure/module tests, local Supabase/Postgres integration tests for migration-owned behavior, Playwright for browser and route behavior, axe integration for automated accessibility checks, and Lighthouse automation for release measurements.
- The current Catalog prototype is interaction and visual prior art only. Its approved Catalog shelf direction informs browser expectations, but its inline data, query-selected products, buttons, and modal implementation are not test contracts.
- The resolved planning tickets and approved static quality research are the behavioral prior art for schema, routing, accessibility, performance, failure, and operations.

### Database contract tests

- Apply the complete migration history to a clean local Supabase/Postgres instance and verify tables, reference data, extensions, constraints, indexes, triggers, views, RLS, grants, audit journal, and webhook configuration shape.
- Upgrade a previous-version 500-product database and verify public facts, counts, lock duration, and runtime compatibility.
- Test every valid and invalid format/price combination, positive whole-IDR rule, Rarity relation and sort position, blank canonicalization, long customer text, and technical URL length.
- Test slug generation, uniqueness collision handling, immutability, and stability through edits/archive/restore.
- Test duplicate-card rules for case, accents, whitespace, punctuation, missing values, archived rows, distinct Design Names, and concurrent transactions.
- Test Product Preview pairing, exact composite linkage, pending/incomplete/future/expired/rejected rights, Cloudinary cloud/folder/version/raster validation, and runtime suppression after rights/configuration changes.
- Prove archival-only updates succeed when preview validity has failed and restoration fails until active constraints are corrected.
- Prove rejected transactions leave rows, timestamps, journal, webhook queue, and public projection unchanged.
- Prove accepted insert/update/archive/restore produces the expected journal and invalidation work.
- Prove runtime can read active safe projections but cannot see archived rows/private rights or perform writes, DDL, role changes, or function execution.
- Test ambiguous connection loss after commit by confirming row/journal state before any retry.

### Catalog module and behavior tests

- Test that one valid database projection becomes the expected serializable DTOs and Format Options.
- Test that any invalid projected row rejects the whole generation rather than being omitted.
- Test successful missing slug separately from database/validation failure.
- Test all missing-value displays, exact supplied text, IDR formatting, metadata omission of unknown fallbacks, and metadata truncation.
- Test search normalization and every filter combination, including selected-format price eligibility and inclusive boundaries.
- Test every sorting direction, missing-value placement, configured Rarity order, and final slug tie-breaking.
- Use fixed DTO fixtures for deterministic behavior tests and database-generated slugs only in integration tests.

### Public route and browser tests

- Verify shelf rendering, search/filter/sort, result announcements, reset, one/zero/500-result states, and no network activity during local interactions.
- Verify direct product route, intercepted modal soft navigation, hard refresh, new tab, disabled JavaScript, unknown slug, archive, restore, Back/Forward, scroll, client state, and focus restoration.
- Verify native share capability behavior, clipboard success, clipboard failure, selectable canonical URL, and live-region announcements.
- Verify Product Preview success, blank, blocked, timeout, HTTP failure, expired rights, placeholder, responsive transformations, and no retry loop.
- Verify browser, crawler, and HTML-limited social-bot title, description, canonical, Open Graph, Twitter, social image, robots, sitemap, and noindex output from the same Catalog generation.
- Record both status and rendered noindex behavior for streamed unknown/archived routes; do not require a literal 404 after streamed headers.
- Verify Preview never becomes indexable and never emits a deployment host as canonical.

### Freshness, cache, pool, and failure tests

- Run at least 20 isolated valid mutations spanning insert, edit, price/format, Rarity, rights, preview, archive, and restore. Under healthy operation every affected Pullpage-controlled output must converge within 60 seconds; report p50, p95, and maximum.
- Prove authenticated webhook invalidation, rejected malformed/unauthorized events, missed-webhook fallback, date-only rights expiry, idle-cache blocking refresh, and cross-instance shared cache behavior.
- Over at least 100 uncached refreshes, require complete projection acquisition/query/validation p95 no more than 500 ms and p99 no more than 1,500 ms. Warm remote-cache lookup p95 must be no more than 100 ms and execute zero SQL.
- Run ten minutes at 50 requests per second plus a 100-concurrent request burst after invalidation. Require no pool exhaustion, database-caused 5xx, acquisition timeout, leak, or less than 30% Supavisor headroom; allow no more than two projection executions for one successful generation.
- Inject acquisition and statement delays and verify failure within the configured bound plus two seconds, correlation logging, no partial cache value, and recovery after pressure removal.
- Exercise a 15-minute outage with last-known-good data and verify internally consistent stale shelf/product/metadata/sitemap output, bounded retries, and alerts.
- Exercise a cold-cache outage and verify temporary-unavailable 5xx, generic noindex metadata, sitemap error, no private diagnostics, accessible Retry, and no client retry loop.
- Restore the database, validate the projection, manually invalidate, and require public convergence within 60 seconds.

### Accessibility, responsive, image, and performance tests

- Require WCAG 2.2 AA with no known A/AA failures, zero automated violations, no accessibility lint errors, Lighthouse Accessibility 100, complete keyboard checks, NVDA/Chrome, and VoiceOver/Safari smoke tests.
- Cover shelf, product page, modal, filters, zero results, placeholder, streamed not-found, loading, and temporary-unavailable states.
- Test at 320×568, 375×812, 768×1024, 1024×768, 1440×900, mobile landscape, 200% zoom, reduced motion, forced colors, blocked images, and current supported browser engines.
- With 500 products, initial unscrolled load requests at most 30 thumbnails, no modal-size image, no original shelf image, thumbnail p95 no more than 200 KB, modal p95 no more than 600 KB, and no image layout shift.
- Under 4× CPU slowdown, search/filter/clear/sort event-to-final-paint p95 is no more than 100 ms, no task exceeds 50 ms, and no interaction loses input or focus.
- Run three warm-shared-cache and three cold-shared-cache Lighthouse trials per shelf/product route using cold browser profiles. Each median requires Performance at least 90, LCP no more than 2.5 seconds, CLS no more than 0.10, TBT no more than 200 ms, FCP no more than 1.8 seconds, compressed initial JavaScript no more than 200 KB, initial non-image transfer no more than 350 KB, and zero unexpected console/network failures.
- When traffic is sufficient, mobile and desktop field p75 must remain LCP no more than 2.5 seconds, INP no more than 200 ms, and CLS no more than 0.10.

### Operational acceptance tests

- Two non-developer operators independently rehearse create with/without preview, edits, every documented validation category, ambiguous save, archive, restore, rights rejection/expiry, automatic publication, and escalation in Preview.
- Rehearse targeted journal recovery without unrelated loss, whole restore, independent logical restore, missed webhook, pool saturation, additive app rollback, failed/partial migration, and hard deletion.
- Verify environment separation, Production seed refusal, secret scopes, migration credential absence from Vercel, named owners/backups, and audit correlation.
- Retain test reports, screenshots, traces, timestamps, query/connection metrics, accessibility checklists, Lighthouse output, recovery evidence, and runbooks as release artifacts.

## Out of Scope

- Purchasing, contact-to-buy, orders, checkout, payment, stock, sold-out status, availability, or inventory.
- A custom Pullpage admin application, custom CMS, or a friendlier wrapper around Supabase Dashboard.
- Draft/Publish workflow, approval queue for Catalog Product text changes, Google Sheets, published CSV, Apps Script, or deployment hooks as catalog mechanisms.
- Browser Supabase access, anonymous database/API access, service-role browser access, or real-time subscriptions.
- Arbitrary image hosts, Google Drive Product Previews, SVG Product Previews, or exposure of source/print-ready artwork.
- Multilingual UI, logo redesign, or a broader brand redesign.
- Query-parameter persistence for search/filter/sort.
- Guaranteed literal HTTP 404 after streamed headers for every missing product.
- Guaranteed search-engine recrawl/index/removal or social-preview refresh within 60 seconds.
- Merchant/Product Offer structured data.
- Production data entry, legal permission itself, infrastructure purchasing, provisioning, migration execution, deployment, or launch as part of this specification-writing work.
- Promoting the prototype directly into production or retaining its losing variants and controls.

## Further Notes

- This specification is the authoritative implementation handoff for the dynamic Catalog and replaces the static Google Sheets/build-snapshot specification as the future implementation target. The static document remains historical.
- The project currently has only the throwaway Catalog prototype and no Prisma, Supabase schema, production routes, or automated test framework. Implementation must establish those foundations rather than treating prototype code as production architecture.
- The approved test-seam plan is one primary end-to-end transaction-to-public-behavior seam plus one narrow database-contract seam for intentionally rejected writes and privilege/concurrency behavior.
- Use the project glossary consistently. In particular, say Catalog Product, Card Name, Collector Number, Set Name, Rarity, Supported Binder Formats, Format Option, Design Name, and Product Preview.
- Prisma 7 is selected; pin the exact supported patch and lockfile at implementation start.
- Preview and Production database/application runtime are colocated in Singapore. Record actual provider region identifiers during provisioning.
- Production minimum is Supabase Team with explicitly enabled PITR for at least 14 days, not merely a plan-name assumption. Commercial entitlements and Cloudinary quotas must be verified when provisioned and reviewed annually.
- Implementation can begin with synthetic or independently rights-cleared assets. Real content, social images, indexing, and launch remain blocked on qualified legal review and all specified infrastructure, recovery, canonical-origin, accessibility, performance, freshness, and failure evidence.
