# Revise routing, SEO, and freshness for dynamic catalog data

Type: research
Status: resolved
Blocked by: 02, 03

## Question

How must the approved product routes, intercepted modal, metadata, sitemap, robots, canonical links, removed/archived behavior, social sharing, and search-engine freshness contract change when Catalog Products are queried and revalidated from Supabase rather than prerendered only at deployment?

## Answer

### Decision

Keep the accepted public URLs, intercepted-modal interaction, canonical origin, metadata formulas, sharing behavior, and production/non-production indexing policy. Replace build-time slug enumeration and deploy-time page snapshots with runtime-discoverable dynamic routes whose product content, metadata, and sitemap all consume ticket 03’s single tagged public catalog projection.

The application freshness target and search-engine freshness are separate contracts:

- In healthy operation, a valid Dashboard change should affect Pullpage’s server-rendered shelf, product response, metadata, and requested sitemap normally within 60 seconds, subject to ticket 03’s stale-while-revalidate semantics.
- Search engines and social platforms decide when to crawl, index, remove, and refresh their own caches. Sitemap changes are hints, not a push or a 60-second indexing guarantee. Pullpage must not promise when Google, Bing, X, Facebook, or another platform will show an update.

### Preserved and revised contract

| Concern | Decision |
| --- | --- |
| Catalog URL | Keep `/` as the canonical Catalog shelf. |
| Product URL | Keep one immutable `/products/<slug>` canonical per Catalog Product. Ticket 02’s database-generated slug remains unchanged through edits, archival, and restoration. |
| Modal | Keep the root `@modal` parallel slot and `@modal/(.)products/[slug]` intercepted route. Soft navigation opens the modal over the preserved shelf; hard navigation, refresh, crawler access, new tab, and disabled JavaScript render the complete canonical page. |
| Route discovery | Remove build-time publication through `generateStaticParams` and do not set `dynamicParams = false`. Any syntactically valid slug is resolved against the runtime public projection, allowing newly inserted products to work without deployment. |
| Rendering | Build a static shell and stream catalog-dependent Server Component content through meaningful Suspense/loading boundaries. Product facts are queried server-side and rendered into the response; browsers never query Supabase. |
| Metadata | Generate from the same cached DTO and same slug lookup used by the page/modal. Keep the accepted title, description, Open Graph, Twitter, image fallback, rights, and truncation rules. |
| Sitemap | Generate one runtime `/sitemap.xml` from the same active projection. Include `/`, active product canonicals, and only currently approved Product Preview image URLs. |
| Robots | Keep environment-dependent static policy: production allows crawling and points to the absolute production sitemap; non-production disallows crawling and emits page-level `noindex, nofollow`. |
| Removal | An archived or hard-deleted product disappears from the refreshed active projection and sitemap and renders the branded noindex not-found result. Do not redirect it to `/` and do not reuse its slug. |
| Restoration | Unarchiving restores the same canonical URL, metadata source, and sitemap entry after cache refresh; no deployment is required. |
| Sharing | Continue sharing exactly `https://pullpage.vercel.app/products/<slug>` without query, fragment, tracking, preview, or deployment host. |

### Route and modal structure

Use the normal App Router deployment, not static export:

```text
app/
├── @modal/
│   ├── default.tsx                         # null fallback on hard navigation
│   ├── page.tsx                            # returns null at `/`
│   ├── [...catchAll]/page.tsx              # returns null on other non-modal routes
│   └── (.)products/[slug]/page.tsx         # intercepted product modal
├── products/[slug]/
│   ├── page.tsx                            # complete canonical page
│   ├── loading.tsx                         # meaningful product skeleton
│   └── not-found.tsx                       # branded noindex result
├── page.tsx                                # Catalog shelf
├── sitemap.ts
└── robots.ts
```

The complete page and intercepted route render one shared product-detail Server Component and use the same lookup/fallback logic. `@modal/default.tsx` is mandatory for hard navigations where Next.js cannot recover the slot state; `@modal/page.tsx` closes the modal on soft navigation to `/`, and the catch-all closes it on other unrelated soft navigations. Back closes the modal, Forward reopens it, and Cache Components’ Activity preservation supports restoration of shelf controls, DOM state, and scroll, subject to the accepted interaction tests.

Do not query production Supabase during `next build`, do not generate a slug list at build time, and do not require `next build` to report every product page as prerendered. The replacement acceptance criterion is that the static shell builds successfully without database credentials while product facts appear in the server-rendered streamed response and no browser-side catalog request occurs.

### Dynamic metadata and canonical links

Both the complete page and intercepted page use a shared metadata builder backed by `getCatalogProduct(slug)`. React request memoization and the tagged remote cache prevent page/metadata duplication and ensure that title, facts, Product Preview, and rendered details come from one public projection version.

Keep the accepted metadata content rules unchanged:

- root title template `%s | Pullpage`, default `Pullpage`, English language, `en_US`, factual read-only description, and generic branded social image;
- product title uses Card Name plus ` — <Design Name>` when supplied, or `Extended Card Art` when Card Name is missing;
- description includes only known Collector Number, Set Name, Rarity, Supported Binder Formats, and lowest Format Option price, with no `Unknown …` fallbacks;
- whitespace normalization and 65-character title/160-character description word-boundary limits apply only to generated metadata;
- canonical, Open Graph URL, and share URL are the exact production product URL;
- Open Graph remains `website` with site name `Pullpage` and locale `en_US`; Twitter remains `summary_large_image`;
- the social image is the approved versioned 1200×630 non-cropped Cloudinary rendition or the checked-in Pullpage fallback; and
- do not emit merchant/Product Offer structured data.

Use fixed `metadataBase = new URL("https://pullpage.vercel.app")`; never derive canonical URLs from request headers. Both route presentations must resolve the same canonical. A missing product must not canonicalize to `/` or emit stale product metadata.

Retain Next.js 16.2.10’s default bot-aware metadata streaming. HTML-limited social crawlers receive blocking metadata in `<head>`; capable crawlers receive server-rendered streaming metadata. Do not globally set `htmlLimitedBots: /.*/` unless production evidence demonstrates a crawler incompatibility that outweighs the documented TTFB/LCP cost.

### Not-found and database-error semantics

A successful active-projection lookup returning no row calls `notFound()` in the shared route/metadata path. Next.js injects `noindex`. Because runtime params and short-lived cached data are behind Suspense, an unknown/archived product may be a streamed **HTTP 200 with `noindex`** rather than an HTTP 404 after headers have been sent. This replaces the static specification’s unconditional status-code promise. Non-streamed misses should still be 404, but correctness is defined as:

- no Catalog Product facts;
- branded not-found UI with a link to `/`;
- `noindex` in the rendered HTML;
- omission from the current sitemap; and
- no redirect to the shelf.

References to a “branded 404” in ticket 05 mean this branded not-found/noindex contract, not an unconditional wire status. Production tests must record both status and rendered robots metadata for hard loads and bot user agents. Do not add a Prisma lookup to Proxy merely to force a 404: ticket 01 prohibits the database client in that boundary, and a second lookup/cache would undermine the selected DAL. If a future analytics or compliance requirement demands a literal 404 for every miss, that is a new architecture decision requiring a fast authoritative existence check before streaming.

A database/validation failure is not “not found.” Propagate it to the temporary-unavailable error boundary. With a last-known-good projection, ticket 03 may continue serving the prior product, metadata, and sitemap beyond 60 seconds; with no usable projection, return an error/5xx path and safe generic noindex metadata. Never return an empty sitemap or mass not-found responses on a cold database failure, because that falsely tells crawlers the catalog was removed.

### Sitemap and robots

`app/sitemap.ts` must consume the same active public projection and cache tag. Next.js metadata routes are otherwise cached by default, so implementation must prove there is no independent deploy-time/output cache masking catalog invalidation. If required, use a request-time marker such as `connection()` in the metadata route and leave the only catalog TTL in the DAL; do not add a second unrelated sitemap lifetime.

For the accepted maximum of 500 products, retain one sitemap. Each active product entry contains only:

- its exact absolute canonical URL; and
- its current approved Product Preview URL in `images` when present.

Continue omitting `lastModified`, `changeFrequency`, and `priority`. Although ticket 02 adds `updated_at`, the public response can also change because of Rarity, rights, Cloudinary configuration, archival, or time-based rights expiry; product `updated_at` alone is not a truthful public-page modification timestamp. Do not emit `new Date()` or request time. A future `lastModified` field requires a database-derived public-projection timestamp covering every dependency.

`app/robots.ts` does not query the catalog. In production it allows `/` and names exactly `https://pullpage.vercel.app/sitemap.xml`. In Preview/Development it disallows `/` and omits a preview sitemap; root/page metadata also emits `noindex, nofollow` because `robots.txt` alone is not a deindexing mechanism. Non-production pages still canonicalize to the production origin and should additionally use Vercel deployment protection where available.

### Archive, hard-delete, and restoration timing

After the public cache refreshes:

- setting `archived_at` removes the Catalog Product from the shelf and sitemap and makes both full-page and modal lookup not-found;
- hard deletion has the same public result, while following ticket 04’s exceptional recovery/audit gate;
- clearing `archived_at` restores the same slug everywhere; and
- editing facts/prices/format/rights updates the shelf, product page, modal, metadata, social-image selection, and sitemap image from one projection.

Before refresh, the prior projection may still be visible. During database failure it may remain visible longer under the documented availability-over-freshness policy. Urgent legal takedown therefore also requires disabling/removing the Cloudinary delivery asset and using applicable search-engine removal tooling; neither cache invalidation nor `robots.txt` guarantees immediate removal from third-party caches.

### Search-engine and social freshness contract

The 60-second target ends at Pullpage-controlled responses. The lifecycle is:

1. Postgres accepts a valid Dashboard transaction.
2. The Supabase webhook expires the `catalog` tag; time-based revalidation is the fallback.
3. The next relevant Pullpage request refreshes the active projection.
4. Shelf/product HTML, generated metadata, and requested sitemap use that projection.
5. External crawlers and social scrapers refresh on their own schedules.

Sitemap submission and accurate HTTP/noindex signals make discovery/removal possible but do not force recrawl or indexing. Google explicitly says recrawl requests may take days to weeks and are not guaranteed. Social networks may retain an earlier link preview after Pullpage is fresh. The specification must say “public on Pullpage normally within 60 seconds,” never “indexed,” “removed from search,” or “social preview updated” within 60 seconds.

Submit the production sitemap in Google Search Console after the legal/indexing launch gate, monitor indexing and soft-404 reports, and resubmit/request recrawl for important corrections where appropriate. Do not use deprecated sitemap-ping endpoints. For urgent search-result removal, use the search engine’s removal process in addition to returning not-found/noindex; temporary removal tools do not replace correcting the source URL.

### Revised release evidence

Implementation handoff must demonstrate:

1. `next build` succeeds without a production database URL and does not enumerate Catalog Product slugs;
2. a newly inserted Catalog Product becomes reachable by hard load and intercepted soft navigation without deployment, with canonical metadata and a sitemap entry;
3. one update changes shelf/detail/modal/metadata/sitemap image coherently after refresh;
4. archive, hard delete, and restore produce the specified sitemap and route behavior without slug change;
5. an unknown/archived hard load records its status code and contains branded not-found UI plus `noindex`, including the accepted streamed-200 case;
6. normal-browser, Googlebot, and HTML-limited social-bot requests receive complete server-generated title, description, canonical, Open Graph, and Twitter metadata;
7. production and Preview robots/metadata policies use only the production canonical origin and never expose a deployment host;
8. `/sitemap.xml` follows catalog tag invalidation and never remains a build snapshot or becomes empty on database failure;
9. shared links contain only the exact canonical URL and native-share, clipboard, selectable fallback, and live-region behavior still pass;
10. Back/Forward/modal close preserve shelf controls, scroll, and focus under Cache Components; and
11. Search Console validation records sitemap acceptance while documentation makes no crawl/index timing promise.

### Primary sources

- Next.js 16.2.10, [Dynamic Route Segments](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.mdx) and [`generateStaticParams`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/generate-static-params.mdx) — runtime params, Suspense requirements, and non-regeneration of build-time params.
- Next.js 16.2.10, [Intercepting Routes](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/intercepting-routes.mdx), [Parallel Routes](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/parallel-routes.mdx), and [`default.js`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/default.mdx) — modal deep links, soft/hard navigation, and unmatched-slot fallback.
- Next.js 16.2.10, [`generateMetadata`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/generate-metadata.mdx) — dynamic metadata, bot-aware streaming, Cache Components interaction, metadata merging, and React memoization for non-`fetch` reads.
- Next.js 16.2.10, [`loading.js`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/loading.mdx), [`notFound()`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/not-found.mdx), and [`not-found.js`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/not-found.mdx) — streamed status codes, automatic noindex, and not-found UI.
- Next.js 16.2.10, [`sitemap.xml`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.mdx), [`robots.txt`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.mdx), and [`connection()`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/connection.mdx) — metadata-route caching, sitemap images, robots output, and request-time rendering.
- Next.js 16.2.10, [Cache Components](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.mdx) and [Preserving UI State](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/02-guides/preserving-ui-state.mdx) — dynamic-by-default rendering and Activity state preservation.
- Google Search Central, [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Ask Google to recrawl URLs](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [Robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag), [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), and [Removals and SafeSearch reports](https://support.google.com/webmasters/answer/9689846) — sitemap hints, recrawl timing, noindex, canonicalization, and urgent removal tooling.
- [Sitemaps XML protocol](https://www.sitemaps.org/protocol.html) — URL and optional accurate `lastmod` semantics.
- MDN, [Web Share API](https://developer.mozilla.org/docs/Web/API/Web_Share_API) and [Clipboard API](https://developer.mozilla.org/docs/Web/API/Clipboard_API) — capability-gated sharing and clipboard fallback.
