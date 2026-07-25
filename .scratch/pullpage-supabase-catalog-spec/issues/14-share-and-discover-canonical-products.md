# Share and discover canonical products

Label: ready-for-agent
Type: task
Status: open
Blocked by: 12, 13

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Make every active Catalog Product consistently shareable and discoverable from the same public Catalog generation used by its shelf row and detail UI. Deliver canonical sharing fallbacks, product metadata, rights-safe social images, environment-aware robots, and a runtime sitemap that changes with valid Catalog edits without deployment.

## Acceptance criteria

- [ ] The canonical origin is fixed to `https://pullpage.vercel.app` and is never derived from request headers, Preview hostnames, or deployment URLs.
- [ ] Every product shares exactly its immutable production canonical without query, fragment, tracking, Preview, or deployment host.
- [ ] Native Web Share is used when supported; otherwise clipboard copy announces success through one polite live region.
- [ ] Clipboard failure displays the canonical as selectable text with recovery guidance and no loss of modal/page state.
- [ ] Global metadata uses the approved title template/default, English language, `en_US`, factual read-only description, and branded social fallback.
- [ ] Product titles, descriptions, known-fact omission, whitespace normalization, word-boundary limits, canonical, Open Graph, Twitter, and lowest-price rules match the parent specification.
- [ ] Product metadata and rendered details resolve the same slug through the same Catalog module generation and cannot mix old and new facts in one response.
- [ ] Social imagery uses the approved rights-current 1200×630 non-cropped Product Preview rendition or the checked-in Pullpage fallback.
- [ ] Browser, normal crawler, and HTML-limited social crawler hard loads receive complete server-generated metadata appropriate to Next.js bot behavior.
- [ ] One runtime sitemap contains `/`, every active product canonical, and only current approved Product Preview image URLs.
- [ ] Sitemap omits archived/unknown products and invented `lastModified`, `changeFrequency`, and `priority` values.
- [ ] Sitemap consumes the same Catalog tag/projection and has no independent deployment snapshot or unrelated cache lifetime.
- [ ] Production robots permits crawling and names the absolute production sitemap.
- [ ] Preview/non-production robots disallows crawling, page metadata emits `noindex, nofollow`, and canonicals still use the production origin.
- [ ] Unknown/archived products emit no stale product metadata, remain absent from sitemap, and include `noindex` even when streaming yields HTTP 200.
- [ ] Database failure remains an error: with last-known-good data, body/metadata/sitemap stay coherent; without it, the sitemap does not return successful empty content.
- [ ] Tests prove create/edit/preview/archive effects across sharing, metadata and sitemap without deployment and document that external recrawl/social cache timing has no 60-second guarantee.

## Blocked by

- [Ticket 12](12-browse-find-and-open-catalog-products.md)
- [Ticket 13](13-deliver-rights-safe-product-previews.md)
