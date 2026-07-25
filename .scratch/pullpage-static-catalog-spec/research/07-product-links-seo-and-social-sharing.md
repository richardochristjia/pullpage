# Product links, SEO, and social sharing research

## Decision

Give every Catalog Product one canonical, indexable path:

```text
/products/<persisted-slug>
```

The catalog remains a single-page browsing experience during normal use: selecting a product with a Next.js `<Link>` performs a soft navigation and opens that product in a modal over the Catalog shelf. A direct visit, refresh, crawler request, or shared-link visit to the same path renders a complete product-detail page using the same detail component. Back/forward navigation opens and closes the modal as expected.

Implement this with App Router Parallel and Intercepting Routes on a normal Vercel Next.js deployment. Prerender `/` and every published `/products/[slug]` route from the validated Published Products snapshot at build time. Do **not** enable `output: "export"`: Next.js 16 explicitly lists Intercepting Routes as unsupported for static export. The pages are still static in the business-relevant sense—catalog data is read only during `next build`, product HTML and metadata are prerendered, and browsers have no runtime Google Sheets dependency.

The prototype’s `?product=<slug>` URL is a throwaway interaction mechanism and must not become the production product URL. Query parameters may retain transient catalog controls if the final UI needs them, but they never identify a Catalog Product and never receive separate canonical or sitemap entries.

## Why path-based product routes are required

- App Router Dynamic Segments represent a slug in a path and can be populated at build time with `generateStaticParams`.[1][2]
- `generateMetadata` can use the same route slug and product data as the page; when a route is prerendered, Next.js includes the resolved metadata in the initial HTML instead of depending on client JavaScript or streamed metadata.[3][4]
- Parallel and Intercepting Routes are Next.js’s documented deep-linked modal pattern: soft navigation displays a modal while hard navigation displays the complete route, and browser back/forward controls modal state.[5][6]
- A query-param-only modal would leave the catalog route as the only stable HTML document. It would not provide one build-time HTML document, canonical, title, description, and social card per Catalog Product without introducing request-time metadata behavior.

## Route and generation contract

### Routes

- `/` — canonical Catalog shelf.
- `/products/[slug]` — canonical product detail route.
- Root-level `@modal` slot plus an intercepted `products/[slug]` route — modal presentation for soft navigation from the Catalog shelf.
- Root slot `default.tsx` returns `null`; the slot also has a null fallback for routes that should close the modal.
- `not-found.tsx` — branded missing-product view with a link back to `/`.

Both the full product page and intercepted modal use one shared product-detail component and one shared metadata builder. They must not maintain independent copies of product facts or fallback logic.

### Static generation

- Load and validate the Published Products CSV once through the build-time catalog data module selected by **Select the non-developer publishing architecture**.
- `generateStaticParams()` returns every published slug for `app/products/[slug]/page.tsx` and any dynamic intercepted page that requires params.
- Set `dynamicParams = false` for the product segment. A slug absent from the published build is not generated on demand and resolves to the not-found experience.[2]
- `generateMetadata()` looks up the same validated Catalog Product by slug. If lookup fails, call `notFound()`; Next.js documents that `notFound()` supplies a noindex directive as part of not-found handling.[7][8]
- Do not fetch Google Sheets or Cloudinary metadata at request time. Product metadata is derived from the already validated build snapshot and known Cloudinary URL.
- A removed product disappears from the next sitemap and returns 404 after the successful deployment. Do not redirect it to `/` because the catalog is not an equivalent replacement. Persisted slugs prevent ordinary descriptive edits from breaking links.

The current `next.config.ts` has no `output: "export"`, which is compatible with this decision. The normal Vercel adapter may serve prerendered outputs while retaining the routing support needed for intercepted modals. Next.js’s separate portable static-export mode is not selected because it explicitly excludes Intercepting Routes.[9]

## Canonical URL contract

A single configured, absolute HTTPS **production origin** is required. The production build must fail if it is absent or invalid. Use it for:

- root `metadataBase`;
- catalog and product canonicals;
- Open Graph `url` values;
- copied/shared links;
- sitemap entries and the robots sitemap URL.

The catalog canonical is exactly `<origin>/`. A product canonical is exactly `<origin>/products/<slug>`.

Exclude query strings, fragments, Vercel deployment URLs, and preview-domain origins from canonical and shared URLs. Catalog query parameters—if retained for search, filter, or sort state—canonicalize to `/`; product routes with incidental query parameters canonicalize to their query-free product path. There are no language alternates because the catalog is English-only.

The actual production origin is a business/deployment decision not present in the current map and must be selected before the specification can be approved.

## Metadata contract

### Global and catalog metadata

Root metadata defines:

- `metadataBase` from the validated production origin;
- title template `%s | Pullpage` with a `Pullpage` default;
- application/site name `Pullpage`;
- English document language and Open Graph locale `en_US`;
- a short catalog description;
- generic Pullpage Open Graph and Twitter images;
- `robots` policy based on deployment environment.

The catalog page defines its own title, description, canonical `/`, Open Graph URL, and generic social image. Suggested copy may be refined by legal/content review, but it must describe a read-only extended-art catalog and must not imply checkout, stock, official Pokémon affiliation, or rights not established by **Determine trademark and attribution requirements**.

### Product metadata

`generateMetadata` builds plain-text metadata deterministically from the Catalog Product:

- **Title base:** Card Name, followed by ` — <Design Name>` when present; if Card Name is missing, use `Extended Card Art` rather than `No Name` as SEO copy. The root template appends ` | Pullpage`.
- **Description:** identify the item as Pullpage extended card art, then include only known Collector Number, Set Name, and Rarity values, followed by Supported Binder Formats and the lowest Format Option price. Do not insert `Unknown number`, `Unknown set`, or `Unknown rarity` into metadata. If all identity fields are absent, use a generic product description.
- **Canonical/OG URL:** the absolute canonical product path.
- **Open Graph:** `type: "website"`, `siteName: "Pullpage"`, `locale: "en_US"`, product title/description/URL, and one product social image.
- **Twitter/X:** `summary_large_image` with the same title, description, image, and image alt.
- **Robots:** index/follow only in production after launch gates pass; permit large image previews.

Because source text has no length limit, the metadata builder normalizes whitespace and truncates generated title output to 65 characters and description output to 160 characters at a word boundary. This is an output guard, not a mutation of Catalog Product data and not a promise about how a search engine displays snippets.

Next.js metadata objects merge shallowly, so any route that defines `openGraph` must provide the complete intended nested object or spread a shared base; otherwise child metadata replaces the parent Open Graph object.[3]

## Social image contract

Use one 1200×630 social image per product:

- For a valid Product Preview, derive a versioned Cloudinary URL that pads without cropping the preview onto the Pullpage dark background and emits a broadly supported JPEG. The metadata declares absolute URL, width, height, MIME type, and descriptive alt text.
- If Product Preview is missing or invalid, use a static branded Pullpage 1200×630 fallback image.
- Never use the untransformed portrait Product Preview directly as a social card, and never crop away artwork.
- Use the same image for Open Graph and Twitter/X unless later testing proves a platform-specific image is needed.
- The generic catalog social image is a checked-in Pullpage-branded asset.

Cloudinary was selected specifically for stable, versioned HTTPS delivery and non-cropping transformations. Next.js supports absolute Open Graph and Twitter image metadata and route-specific generated/static social images.[3][10] The legal/rights launch gate applies to Product Previews in social cards just as it does on catalog pages.

The Share action always shares or copies the absolute canonical product URL. Native Web Share may be used where available, with clipboard copy as fallback; neither mechanism adds transient filter state or tracking parameters by default.

## Indexing contract

### Production

- `app/robots.ts` allows crawling and advertises the absolute sitemap URL.
- `app/sitemap.ts` contains `/` and every published `/products/<slug>` route. One sitemap is sufficient for the 500-product ceiling.
- Include a valid Product Preview Cloudinary URL in a product sitemap entry’s image list when rights and URL validation pass; omit missing/fallback-only images.
- Omit per-product `lastModified` until the content model records a trustworthy per-product modification time. Do not pretend every product changed at build time.
- Submit the production sitemap through the chosen search-engine webmaster tooling after launch; this is operational follow-up, not a runtime dependency.

Next.js provides buildable `robots.ts` and `sitemap.ts` metadata routes, and its sitemap type supports image URLs.[11][12]

### Preview and non-production deployments

Use the build environment to emit both:

- `robots` metadata with `index: false, follow: false`; and
- a robots file that disallows crawling.

Preview documents still point canonical metadata at the configured production origin, never at a Vercel preview origin. This duplicates platform protections intentionally so indexing policy remains testable in application output.

### Structured data

Do not emit Google merchant/product-offer structured data in the initial specification. Pullpage has no purchasing flow, stock/availability model, or resolved commercial Product schema contract, and misleading Offer/availability markup would conflict with the domain model. Reconsider structured data only in a separate effort if those business semantics change. Ordinary semantic HTML, route metadata, canonicals, and sitemap coverage are sufficient for this destination.

## Acceptance checks for the final specification

1. A successful build with `N` published Catalog Products prerenders `N` canonical product paths plus `/`.
2. Viewing page source for a product path contains its title, description, canonical, Open Graph, and Twitter metadata without requiring client execution.
3. A Catalog shelf product link soft-navigates to `/products/<slug>` and opens the modal; browser Back closes it and restores the shelf state.
4. Opening or refreshing the same URL renders the complete product page and the same product facts.
5. Share/copy yields the configured production URL even on a preview deployment.
6. Unknown and removed slugs return the branded not-found experience and are noindex.
7. The sitemap contains exactly the canonical catalog/product URLs from the validated snapshot, with no filter/query or preview URLs.
8. Production robots allows crawling and names the sitemap; preview output is noindex/disallow.
9. Social-card validation shows the product-specific title, description, and 1200×630 image; a missing Product Preview shows the branded fallback.
10. No route fetches Google Sheets in a browser or at request time.
11. No Product structured data claims stock, availability, purchase, or official affiliation.
12. Legal/rights and production-origin launch gates are satisfied before production indexing is enabled.

## Primary sources

1. Next.js 16.2.10, **Dynamic Route Segments**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` (online: https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes)
2. Next.js 16.2.10, **generateStaticParams**: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md` (online: https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
3. Next.js 16.2.10, **generateMetadata**: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` (online: https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
4. Next.js 16.2.10, **Metadata and OG images**: `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md` (online: https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
5. Next.js 16.2.10, **Parallel Routes — Modals**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/parallel-routes.md` (online: https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#modals)
6. Next.js 16.2.10, **Intercepting Routes**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/intercepting-routes.md` (online: https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)
7. Next.js 16.2.10, **notFound**: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md` (online: https://nextjs.org/docs/app/api-reference/functions/not-found)
8. Next.js 16.2.10, **not-found file**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md` (online: https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
9. Next.js 16.2.10, **Static Exports**: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` (online: https://nextjs.org/docs/app/guides/static-exports)
10. Next.js 16.2.10, **Open Graph and Twitter image conventions**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md` (online: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
11. Next.js 16.2.10, **sitemap.xml**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md` (online: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
12. Next.js 16.2.10, **robots.txt**: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md` (online: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
13. Next.js 16.2.10, **Link Component**: `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` (online: https://nextjs.org/docs/app/api-reference/components/link)
14. Google Search Central, **Specify a canonical URL**: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
15. Google Search Central, **Build and submit a sitemap**: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
16. Google Search Central, **Product structured data**: https://developers.google.com/search/docs/appearance/structured-data/product
17. The Open Graph protocol: https://ogp.me/
18. X Developer Platform, **Cards markup**: https://developer.x.com/en/docs/x-for-websites/cards/overview/markup
19. Vercel, **System environment variables**: https://vercel.com/docs/environment-variables/system-environment-variables
