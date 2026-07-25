# Evaluate Product Preview hosting

Type: research
Status: resolved
Blocked by:

## Question

Can Google Drive provide stable, performant, publicly accessible Product Preview URLs for a static catalog of up to 500 products, and how does it compare with an image CDN on editor usability, transformations, quotas, caching, reliability, cost, and Next.js/Vercel compatibility?

## Answer

Use Cloudinary as Pullpage’s Product Preview host and image CDN; do not use Google Drive as the production image origin.

Drive can expose public binary download links, but its official contract is file sharing/download—not responsive public image delivery. It lacks documented image transformations, predictable public-delivery capacity, and dependable cache-versioning semantics. The familiar share URL is also a viewer page, requiring an error-prone editor workaround.

Cloudinary provides a non-developer Media Library, stable HTTPS delivery URLs, non-cropping responsive transformations, CDN delivery, versioned replacement URLs, usage-based free/paid plans, and supported Next.js 16 integration. Use immutable replacement URLs, a narrowly allowlisted Cloudinary account, publish-time URL/image validation, and a runtime fallback. A custom `next/image` loader must generate versioned, non-cropping Cloudinary transformations (`c_limit` with automatic format and quality); do not route Cloudinary assets through Vercel’s default image optimizer.

Research asset: [Product Preview hosting research](../research/02-product-preview-hosting.md)
