# Pullpage static catalog specification

Status: **Approved for implementation handoff**

## 1. Outcome

Build Pullpage’s English, read-only public catalog of extended-art products for Pokémon card binders. The implementation must support approximately 100 Catalog Products at launch and remain usable and performant with a deterministic 500-product fixture.

The approved implementation stack is Next.js 16.2.10, React 19.2.4, Tailwind CSS 4, and Vercel. Catalog pages are prerendered from a validated publication snapshot; browsers and production requests never query Google Sheets.

The initial canonical production origin is:

```text
https://pullpage.vercel.app
```

## 2. Scope

### In scope

- Responsive, dark-themed Catalog shelf using the supplied Pullpage logo without redesign.
- Browsing, text search, Rarity filtering, Supported Binder Format filtering, inclusive price filtering, and deterministic sorting.
- Product-specific modal navigation and complete canonical product pages.
- Product sharing, metadata, social cards, robots, sitemap, and production indexing.
- Google Sheets authoring and direct non-developer publishing through validation and Vercel.
- Cloudinary-hosted Product Previews and a branded missing/unavailable placeholder.
- Accessibility, responsive-browser, image-loading, interaction, and page-performance release gates.
- Rights provenance and legal-review launch gates.

### Out of scope

- Purchasing, contact-to-buy, orders, checkout, or payment.
- Stock quantities, availability, sold-out states, or inventory.
- A custom admin application or custom CMS.
- Multilingual UI.
- Logo redesign or broader branding work.
- Production data entry.
- Merchant/Product Offer structured data.

## 3. Ubiquitous language

Implementation and customer copy must use the terms in [`CONTEXT.md`](../../CONTEXT.md), especially **Catalog Product**, **Card Name**, **Collector Number**, **Set Name**, **Rarity**, **Supported Binder Formats**, **Format Option**, **Design Name**, and **Product Preview**.

Do not introduce “listing,” “stock item,” “card code,” “card type,” “variant,” “standard binder,” or “toploader flag” as aliases for those concepts.

## 4. Catalog Product content contract

Each row in Draft Products represents one Catalog Product.

| Source field | Rule | Public behavior |
| --- | --- | --- |
| Slug | Protected; generated and persisted on first publication | Product URL identity; never shown as product information |
| Card Name | Optional plain text | Exact supplied value or `No Name` |
| Collector Number | Optional plain text | Exact supplied value or `Unknown number` |
| Set Name | Optional plain text | Exact supplied value or `Unknown set` |
| Rarity | Optional configured controlled value | Selected value or `Unknown rarity` |
| Design Name | Optional except under duplicate-card rule | Shown when supplied; omitted when missing |
| Product Preview URL | Optional absolute HTTPS URL from the configured Cloudinary allowlist | Product Preview or Pullpage placeholder |
| Format Code | Required: `BS`, `TL`, or `ALL` | Full labels only |
| Binder Sleeve Price | Conditionally required positive whole IDR | Binder Sleeve Format Option price |
| Toploader Price | Conditionally required positive whole IDR | Toploader Format Option price |

There is no Product ID, description, inventory/availability field, row currency, manual display order, or separate thumbnail/full-image URL.

### 4.1 Text and missing values

- Null, empty, and whitespace-only optional text is missing.
- Supplied text is displayed unchanged and strictly as plain text, never HTML or Markdown.
- Fallback labels are presentation values and are never written back to source data or indexed by search.
- Layout and metadata generation must safely handle unusually long supplied text. Metadata alone applies the output truncation rules in section 10.

### 4.2 Slug and duplicate-card rules

- Generate a readable lowercase slug from available Card Name, Collector Number, and Design Name plus a short random suffix, such as `charizard-ex-203-165-sunset-k4m2`.
- Persist the slug once. Editors cannot assign or edit it; descriptive corrections never change it.
- Duplicate persisted/generated slugs block publication.
- Two rows target the same card when Card Name, Collector Number, and Set Name are equal after case folding, accent removal, trimming, and internal-whitespace collapsing. Punctuation remains significant.
- If two or more rows target the same card, every row requires a Design Name. Those Design Names must be distinct after the same normalization.

### 4.3 Rarity

The initial low-to-high order is:

```text
C → U → R → RR → AR → SR → SAR → UR
```

Blank means Unknown rarity. Any nonblank value outside the configured list blocks publication. A trusted editor may add a Rarity only through the protected configuration list and must assign it a unique sort position.

### 4.4 Format Options and prices

- `BS` creates Binder Sleeve only and requires Binder Sleeve Price; ignore any Toploader Price.
- `TL` creates Toploader only and requires Toploader Price; ignore any Binder Sleeve Price.
- `ALL` creates both and requires both prices.
- A required source price is digits only and represents a positive whole number of rupiah: no symbol, grouping punctuation, decimal, zero, or negative value.
- Display IDR using Indonesian grouping, for example source `75000` as `Rp75.000`.
- Currency is fixed catalog-wide to IDR.

### 4.5 Product Preview validation

- Blank URL: allowed, but publish with a warning and use the Pullpage placeholder.
- Nonblank URL: must be one absolute `https://` URL from the configured Cloudinary account/allowlist. Malformed, non-HTTPS, non-Cloudinary, and non-allowlisted URLs block publication.
- A valid allowlisted URL whose publish-time reachability check temporarily fails produces a warning rather than a blocking error and uses the placeholder at runtime.
- A nonblank URL also requires an approved, current rights record under section 7; missing, rejected, or expired rights block publication.

## 5. Search, filters, and sorting

All operations run locally over the build-time snapshot and issue no network request.

### 5.1 Search

- Partial-match supplied Card Name, Collector Number, Set Name, and Design Name.
- Normalize both query and fields by ignoring case, accents, spaces, slashes, and hyphens.
- Empty search adds no constraint.
- Do not index fallback labels.

### 5.2 Filters

- Rarity and Supported Binder Format allow multiple selections.
- Values within one filter combine with OR.
- Search, Rarity, Supported Binder Format, and price constraints combine with AND.
- Unknown rarity is a selectable Rarity value.
- Minimum and maximum price bounds are optional and inclusive.
- With selected binder formats, only prices belonging to those formats are eligible for price matching.
- Without a binder-format selection, any Format Option price may satisfy the range.
- A Catalog Product matches the price constraint when at least one eligible Format Option price is in range.

### 5.3 Sorting

- Default: Card Name A–Z, case- and accent-insensitive.
- Missing Card Names remain last in both directions.
- Card Name ties: Collector Number, then Design Name, then Slug.
- Price: lowest price among selected binder formats, or lowest across all Format Options when no format is selected. Ties: Card Name, then Slug.
- Rarity ascending follows the configured order; descending reverses it. Unknown rarity remains last in either direction.
- Slug is the final deterministic tie-breaker for every sort.

Search, filter, and sort state is client-only. It does not write query parameters. Refreshing `/` resets controls; opening and closing an intercepted product modal or using browser Back restores in-session shelf values, scroll, and focus.

## 6. Product Preview hosting and delivery

Cloudinary is the only remote Product Preview host. Google Drive and arbitrary image hosts are prohibited.

- Use public raster assets; reject SVG Product Previews.
- Use immutable, versioned Cloudinary URLs. Replace an asset by uploading a new/versioned asset, updating Draft Products, publishing, verifying, and only then removing the prior asset.
- Configure one narrowly scoped Cloudinary cloud/account allowlist.
- Use a custom `next/image` loader that emits versioned Cloudinary URLs with non-cropping `c_limit` transformations and automatic format/quality. Do not pass Cloudinary assets through Vercel’s default optimizer.
- Supply accurate responsive `sizes`, reserve intrinsic/aspect-ratio space, and lazy-load below-the-fold shelf thumbnails.
- Request no modal-size transformation until a product is opened.
- Missing, unreachable, blocked, or failed Product Previews use one branded Pullpage placeholder while preserving all textual product facts.
- Monitor Cloudinary usage monthly and document who responds to quota/cost thresholds.

## 7. Rights and legal launch gate

This specification is implementation-ready but does not grant or establish intellectual-property permission.

Before production content, social images, indexing, or launch, qualified counsel must review the actual extended-art products, Product Previews, served territories (including Indonesia), metadata usage, and exact attribution/non-affiliation notice. Disclaimers, attribution, watermarks, and “fan-made” wording are not substitutes for permission.

Implementation may proceed with dummy or independently rights-cleared assets.

### 7.1 Presentation controls

- Pullpage is the dominant source identity.
- Do not claim or imply “official,” “licensed,” “authorized,” partnership, sponsorship, or endorsement without documented evidence.
- Do not use official logos, card backs, set symbols, character art, or similar assets as site chrome without explicit approval.
- Use card facts narrowly and factually to identify the depicted card while distinguishing the Pullpage Catalog Product and Design Name.
- Do not scrape or copy Pokemon.com images or metadata merely because they are publicly accessible.
- Counsel must approve the exact global footer/Legal notice before launch.

### 7.2 Product Preview rights register

Maintain a private rights register keyed by Product Preview URL/Cloudinary asset reference with:

- asset identifier and source;
- creator/photographer;
- owner/licensor;
- permission basis and evidence;
- permitted channels and territories;
- required attribution;
- effective and expiry dates;
- status (`pending`, `approved`, `rejected`, or `expired`);
- reviewer and review date;
- takedown/replacement notes.

Only approved, current records may publish. Maintain a prompt takedown and replacement procedure and do not expose source/print-ready artwork.

## 8. Publishing architecture

### 8.1 Components

- Private Google workbook owned by a business-controlled account.
- **Draft Products** worksheet editable by trusted publishers.
- Protected **Published Products** worksheet written only by bound Apps Script and individually published as CSV.
- Protected Rarity/configuration and Product Preview rights data.
- **Instructions**, **Validation Results**, and **Publish Log** worksheets.
- Bound Apps Script menu: **Pullpage → Validate draft** and **Pullpage → Publish**.
- Secret Vercel production Deploy Hook stored in Apps Script project properties, never in a cell or repository.
- Next.js build-time catalog module that fetches and validates Published Products.

There is no Preview Products worksheet, staging preview deployment, custom admin, database, service account, GitHub write token, or browser/runtime Sheets request.

### 8.2 Validation

- Take an Apps Script document lock and read a consistent Draft Products snapshot in batches.
- Report all errors and warnings together in Validation Results with severity, cell link, message, and corrective guidance.
- Blocking errors include content-contract failures, duplicate identity failures, required-price failures, prohibited Product Preview URLs, and missing/unapproved/expired rights.
- Warnings include blank previews and temporarily unreachable valid Cloudinary previews.
- Successful validation reports Catalog Product count, warning count, and a Draft fingerprint.
- Any Draft edit invalidates the prior result.
- Apps Script validation supplies editor feedback; the Next.js build independently enforces the same authoritative contract. Shared valid/invalid fixtures must test both implementations.
- Never silently omit an invalid row.

### 8.3 Direct Edit → Validate → Publish → Verify workflow

1. Publisher edits Draft Products and manages Product Previews in Cloudinary.
2. Publisher may run Validate draft and correct all linked errors.
3. Publish acquires the lock and reruns validation. It must not trust an earlier result.
4. If needed, generate and persist protected Slugs, then validate uniqueness before changing Published Products.
5. Show a confirmation containing Catalog Product count, all warnings, and the fact that production deployment will start. Cancel changes nothing.
6. Copy the exact canonical validated snapshot plus a unique publication ID to Published Products and flush.
7. Poll the public CSV with cache-busting until it exposes the expected publication ID; timeout without triggering Vercel.
8. POST the Deploy Hook and show the queued deployment identifier plus direct Vercel Deployments link. Never label a queued deployment “live.”
9. Record timestamp, editor, publication ID, Draft fingerprint, row/warning counts, deployment identifier, and outcome in Publish Log.
10. Publisher waits for Ready, then immediately smoke-tests catalog load, one search/filter combination, one preview/placeholder, and one shared product URL.

### 8.4 Recovery

- Validation failure: no Published Products or production change; fix Draft and retry.
- CSV synchronization failure: no deploy; verify Google publication and retry.
- Hook failure: production remains unchanged. Published Products may be ahead of live production, so unrelated production code deployment is prohibited until recovered.
- Build failure: prior production remains live; inspect logs and retry the unchanged snapshot for a transient failure or correct Draft and republish.
- Bad successful deployment: immediately use Vercel rollback, then correct Draft and republish. Never repair Published Products manually.
- Exposed hook: create a replacement, update script properties, and delete the old hook.

At least two business-controlled maintainers must be documented. Publishers need workbook/Apps Script access, Cloudinary Media Library access, and Vercel deployment visibility plus rollback capability.

## 9. Customer experience

The design baseline is **Catalog shelf** from [Prototype the customer catalog experience](issues/04-prototype-customer-catalog-experience.md). The prototype is a visual/interaction reference only and must not be promoted directly into production.

### 9.1 Layout

- Dark theme using the supplied Pullpage logo and its blue, white, and orange cues.
- Compact 56–64px branded header with deliberate clear space around the correctly proportioned logo.
- Desktop: persistent filter-led sidebar beside comparison-friendly product rows.
- Mobile: search first, then a collapsible filter/sort panel before results.
- Product rows expose supplied identity facts, Design Name when present, Set Name/fallback, Supported Binder Formats, and prices without requiring modal opening.
- Provide clear loading, no-results, missing-preview, and branded 404 states. The no-results state keeps controls available and offers an obvious reset.
- Motion uses short transform/opacity transitions only and follows section 12’s reduced-motion gate.

### 9.2 Product detail behavior

- Selecting a product link soft-navigates to `/products/<slug>` and opens the product detail in an intercepted modal over the preserved Catalog shelf.
- Modal shows a large non-cropped Product Preview/placeholder and all product facts/Format Options.
- Browser Back closes the modal and restores controls, scroll, and focus; Forward reopens it.
- Direct visit, refresh, crawler request, opening in a new tab, or disabled-JavaScript navigation renders a complete product page using the same detail component.
- Unknown/removed slugs render a branded noindex 404 with a link to the catalog.

### 9.3 Sharing

- Share exactly `https://pullpage.vercel.app/products/<slug>` with no query, fragment, tracking parameter, preview host, or deployment host.
- Invoke native Web Share when supported.
- Otherwise copy the canonical URL and announce success through a polite live region.
- If clipboard access fails, display the canonical URL as selectable text with recovery guidance.

## 10. Routes, rendering, and metadata

Use a normal Vercel Next.js App Router deployment, not `output: "export"`, because the selected intercepted-modal pattern is unsupported by portable static export.

### 10.1 Route contract

- `/` — canonical Catalog shelf.
- `/products/[slug]` — canonical complete product page.
- Root parallel modal slot plus intercepted product route — modal presentation on soft navigation.
- Shared product-detail component and fallback logic for full page and modal.
- Branded `not-found` route.

Load and validate Published Products once through a build-time data module. `generateStaticParams` returns every published Slug and product segments disable unknown dynamic params. Prerender `/` and all product routes. No route fetches Sheets at request time.

### 10.2 Canonical origin

Use exact origin `https://pullpage.vercel.app` without a trailing slash in configuration. Use it for `metadataBase`, canonical and Open Graph URLs, shared links, robots sitemap reference, and sitemap entries. Never derive canonical origin from an incoming request or Vercel deployment hostname.

Enable indexing only after the origin is assigned to the project, serves production over HTTPS, and passes metadata/robots/sitemap smoke checks.

A later custom-domain change is a coordinated migration: update every origin-dependent output, redirect equivalent old paths, replace/submit the sitemap, and verify search/social metadata. Until then the Vercel domain is authoritative.

### 10.3 Metadata

Global metadata:

- title template `%s | Pullpage`, default `Pullpage`;
- site/application name `Pullpage`;
- language English; Open Graph locale `en_US`;
- factual read-only catalog description with no checkout, stock, official-affiliation, or unsupported-rights claims;
- generic Pullpage Open Graph/Twitter image;
- environment-aware robots policy.

Product metadata:

- Title base: Card Name plus ` — <Design Name>` when present. If Card Name is missing, use `Extended Card Art`, not `No Name`.
- Description: Pullpage extended card art plus only known Collector Number, Set Name, and Rarity facts, Supported Binder Formats, and lowest Format Option price. Omit `Unknown …` fallbacks. Use generic copy if all identity facts are absent.
- Normalize whitespace and truncate generated title output to 65 characters and description to 160 characters at a word boundary without modifying source data.
- Emit a complete canonical, Open Graph (`website`, `Pullpage`, `en_US`), and Twitter `summary_large_image` object in initial HTML.
- Product social image: 1200×630 versioned Cloudinary JPEG, padded without cropping on the Pullpage dark background; otherwise a checked-in 1200×630 Pullpage fallback.
- Apply rights approval to metadata and social images.

### 10.4 Indexing

Production:

- robots allows crawling and identifies the absolute sitemap.
- One sitemap contains `/` and every published product canonical.
- Include a validated/approved Product Preview image URL where applicable.
- Omit invented `lastModified` values.
- Removed products leave the next sitemap and return 404; do not redirect them to `/`.

Preview/non-production:

- emit `noindex, nofollow` metadata and robots disallow;
- still canonicalize to the production origin.

Do not emit merchant/Product Offer structured data.

## 11. Accessibility release gate

WCAG 2.2 Level AA is release-blocking. Automated tooling supports but never replaces manual testing.

A release candidate must have:

- no known WCAG 2.2 A/AA failures across catalog, representative product route, modal, filtered/zero states, placeholder, and 404;
- zero automated accessibility violations and no accessibility lint errors;
- Lighthouse Accessibility 100 on `/` and one representative product route;
- completed keyboard testing;
- NVDA/Chrome and VoiceOver/Safari smoke tests.

Required behavior includes:

- minimum contrast: 4.5:1 normal text, 3:1 large text and meaningful control/non-text boundaries;
- visible skip link, one descriptive `h1`, unique title, `main` landmark, persistent labels, and accessible grouped filters;
- polite single result-count announcements;
- semantic product links with duplicate designs distinguishable by accessible name;
- concise Product Preview alt text or empty alt for a redundant decorative thumbnail; accessible placeholder text;
- 24×24 CSS-pixel WCAG target minimum and project target 44×44 for primary/icon controls;
- no color-only state communication;
- no positive `tabindex`; visible, unobscured focus; no unexpected focus movement during filtering;
- accessible dialog with label, inert background, contained Tab order, Escape/Close/Back dismissal, and focus restoration;
- selectable URL fallback and polite copy status;
- all content available at 200% zoom and 320 CSS pixels without page-level two-dimensional scrolling;
- no flashing over three times/second;
- nonessential motion ≤400ms and reduced-motion behavior ≤100ms without transform/scroll animation.

## 12. Responsive and browser release gate

Support the unmodified Next.js 16 floor: Chrome/Edge/Firefox 111+ and Safari 16.4+.

Test current Playwright Chromium, Firefox, and WebKit plus release-time stable Chrome, Edge, Firefox, desktop Safari, iOS Safari, and Android Chrome.

Required viewports: 320×568, 375×812, 768×1024, 1024×768, and 1440×900, plus mobile landscape and 200% zoom. Also test reduced motion, Windows forced colors/high contrast, blocked Product Preview requests, 500 results, one result, and zero results.

No page-level horizontal overflow, clipping, overlap, unreachable controls, or sticky-header obstruction is allowed. Orientation changes preserve current client state and selected product navigation.

## 13. Performance release gate

Use a deterministic 500-product fixture containing all controlled values, duplicate-card designs, missing optional facts, missing/broken previews, and filter edge cases.

### 13.1 Images

- Cold unscrolled catalog requests at most 30 thumbnails and zero modal-size images.
- Request no original full-resolution image for shelf rows.
- Selected variant width is at most 1.5× rendered CSS width × DPR.
- Thumbnail p95 transfer ≤200KB; modal Product Preview p95 ≤600KB.
- At most one likely LCP image is eager/high-priority.
- Image state changes cause no visible layout shift or retry loop.

### 13.2 Interactions

Under Chrome DevTools 4× CPU slowdown on the designated release workstation:

- search/filter/clear/sort event-to-final-paint p95 ≤100ms;
- no task over 50ms;
- no lost input/focus and no network request;
- one final result-count announcement per action.

### 13.3 Production lab gate

Run three Lighthouse mobile-preset trials against a production Vercel deployment with a cold profile and use the median for `/` and a representative product route.

| Metric | Requirement |
| --- | ---: |
| Lighthouse Performance | ≥90 |
| LCP | ≤2.5s |
| CLS | ≤0.10 |
| TBT | ≤200ms |
| FCP | ≤1.8s |
| Compressed initial JavaScript | ≤200KB |
| Initial HTML + CSS + JS excluding images | ≤350KB |
| Console errors/unexpected failed requests | 0 |

`next build` must report catalog/product routes as prerendered. Initial HTML contains essential catalog/product facts. The production bundle contains no prototype variant switcher, losing UI variants, dummy generator, or development instrumentation.

### 13.4 Field gate

When enough traffic exists, mobile and desktop 75th-percentile values must remain LCP ≤2.5s, INP ≤200ms, and CLS ≤0.10. A regression blocks the next release unless the owner records an evidence-backed exception, scope, remediation owner, and date.

## 14. Required implementation evidence

Handoff acceptance requires:

- shared validator fixtures and Apps Script/build validation results;
- route-generation, metadata-source, canonical, robots, sitemap, 404, and share tests;
- automated accessibility and keyboard/modal results;
- completed manual keyboard and screen-reader checklist with versions;
- responsive screenshots at required viewports, landscape, and 200% zoom;
- Product Preview network trace with transformations, count, formats, and transfer sizes;
- 500-record interaction benchmark with p95 and longest task;
- three Lighthouse reports per tested route and bundle/transfer report;
- publishing happy-path and each recovery scenario exercised with non-production dummy data;
- legal/rights approval record before real production data/indexing/launch;
- post-launch field-performance dashboard and named owner.

## 15. Release sequence

1. Implement and validate using deterministic dummy/rights-cleared data.
2. Provision business-controlled Google, Cloudinary, and Vercel ownership/access.
3. Confirm `https://pullpage.vercel.app` is the assigned stable production domain.
4. Complete automated and manual acceptance evidence.
5. Obtain qualified legal review and approve exact production assets/copy/territories.
6. Enter approved production data and pass publisher validation.
7. Publish, wait for Ready, and complete smoke tests.
8. Enable production indexing only after legal, origin, metadata, robots, and sitemap gates pass.

## 16. Decision sources

- [Define the Catalog Product content model](issues/01-define-catalog-product-content-model.md)
- [Evaluate Product Preview hosting](issues/02-evaluate-product-preview-hosting.md)
- [Select the non-developer publishing architecture](issues/03-select-non-developer-publishing-architecture.md)
- [Prototype the customer catalog experience](issues/04-prototype-customer-catalog-experience.md)
- [Determine trademark and attribution requirements](issues/05-determine-trademark-and-attribution-requirements.md)
- [Prototype the editor publishing workflow](issues/06-prototype-editor-publishing-workflow.md)
- [Specify product links, SEO, and social sharing](issues/07-specify-product-links-seo-and-social-sharing.md)
- [Define accessibility and performance acceptance criteria](issues/08-define-accessibility-and-performance-acceptance-criteria.md)
- [Choose the canonical Pullpage production origin](issues/10-choose-canonical-production-origin.md)

## 17. Approval

Approved in [Approve the implementation-ready catalog specification](issues/09-approve-implementation-ready-catalog-specification.md). Implementation may begin; production content, indexing, and launch remain subject to the explicit legal and canonical-origin gates in this specification.
