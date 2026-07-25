# Specify product links, SEO, and social sharing

Type: research
Status: resolved
Blocked by: 01, 03, 04

## Question

How should the chosen single-page catalog and modal interaction use stable product URLs, static generation, metadata, indexing, canonical links, and social previews in Next.js 16 on Vercel so individual Catalog Products are meaningfully discoverable and shareable?

## Answer

Use one canonical `/products/<persisted-slug>` path per Catalog Product. From the Catalog shelf, a Next.js soft navigation opens that path in the selected product modal; a direct visit, refresh, crawler request, or shared-link visit renders a complete product page using the same detail component. Replace the prototype-only `?product=` identity with path-based routes. The Share action invokes native Web Share when supported; otherwise it copies the absolute canonical product URL, announces success accessibly, and exposes a selectable URL with recovery guidance if clipboard access fails.

Prerender `/` and every published product route from the validated Published Products snapshot with `generateStaticParams`, disable unknown dynamic params, and generate each product’s initial-HTML metadata from the same build-time record. Use a normal Vercel Next.js deployment rather than `output: "export"`, because Next.js 16 static export explicitly does not support the Intercepting Routes used for deep-linked modals. Catalog data remains build-time-only and static; browsers and requests never query Google Sheets.

Set the catalog canonical to `/` and each product canonical to its query-free product path under one configured HTTPS production origin. Share only that absolute canonical URL. Search, filter, and sort controls remain client-only state and do not write query parameters; refreshing `/` resets them, while modal close/Back restores the in-session shelf state. Fragments, Vercel preview domains, and deployment URLs never become canonical or sitemap URLs.

Generate plain-text product titles and descriptions from known product facts, omitting `Unknown …` fallbacks. Emit complete route-specific canonical, Open Graph, and `summary_large_image` metadata. Use a non-cropping 1200×630 Cloudinary JPEG derived from the Product Preview, or a static Pullpage-branded fallback. Apply the rights/legal launch gate to social images and metadata copy.

Production robots allows crawling and names a single sitemap containing `/` and all published product paths; valid Product Preview URLs may be included as sitemap images. Omit invented `lastModified` dates. Preview and non-production builds emit noindex/nofollow plus robots disallow, while still canonicalizing to production. Unknown or removed slugs return a branded noindex 404.

Do not emit merchant/Product Offer structured data: Pullpage has no checkout, stock, availability, or resolved offer semantics. The final specification must select one absolute production origin before indexing can be enabled.

Research, detailed metadata formulas, route behavior, indexing policy, acceptance checks, and primary-source citations: [Product links, SEO, and social sharing research](../research/07-product-links-seo-and-social-sharing.md).
