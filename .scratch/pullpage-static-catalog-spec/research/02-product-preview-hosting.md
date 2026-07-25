# Product Preview hosting research

## Decision

Use **Cloudinary** as Pullpage’s Product Preview host and image CDN. Do not use Google Drive as the production image origin.

Google Drive can expose a binary file to anyone with an official browser-download link, so a small proof of concept could be made to render. It does not, however, provide a documented image-delivery contract, responsive transformations, predictable public-delivery capacity, or application-controlled cache versioning. Those gaps make it unsuitable for a public catalog even at Pullpage’s 500-product ceiling.

Cloudinary is the concrete image-CDN comparison because it combines a browser-based Media Library for the non-developer editor, stable HTTPS delivery URLs, URL-based image transformations, CDN delivery, and documented Next.js integration.

## Evidence

### Google Drive is technically reachable but not a dependable image origin

- A Drive file can be shared publicly through an `anyone` permission with the `reader` role. Workspace administrators can restrict whether this permission is available, so public delivery also depends on account policy. [Google Drive API: Share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing) and [Permissions resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions)
- For a binary file, Drive exposes `webContentLink`, described as a link for downloading the file content in a browser. The normal `/file/d/.../view` share URL is a viewer page, not an image URL. [Google Drive API: Files resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
- The API’s supported raw-file download mechanism is `files.get` with `alt=media`; the API download guidance is about downloading stored blobs, not responsive image delivery. [Google Drive API: Download and export files](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- Drive API request quotas are documented as API request limits. They do not establish a public-image bandwidth allowance or CDN service level for `webContentLink`. Consequently, Pullpage cannot turn the API quota table into a defensible traffic or reliability budget. [Google Drive API: Usage limits](https://developers.google.com/workspace/drive/api/guides/limits)
- Drive’s documented file APIs have no width, quality, crop, DPR, or automatic-format image transformation parameters. Pullpage would therefore deliver the original upload or place a separate optimizer in front of Drive.
- Common `drive.google.com/uc?...` and `lh3.googleusercontent.com/...` recipes are intentionally excluded: the cited Drive documentation does not define them as a stable public image-hosting API.

Practical consequences:

1. An editor must make every file public and obtain or convert the correct download link; copying the familiar share URL is insufficient.
2. Revoking sharing, deleting/replacing a file, an administrator disabling public sharing, or an intermediary download response can break the catalog independently of a Pullpage deployment.
3. Drive offers no documented application-controlled cache invalidation or responsive variants. Replacing an image at the same logical location gives Pullpage no reliable cache-busting workflow.
4. Storage may have no incremental cost under an existing Drive allowance, but the saving buys no documented public-image delivery budget. Operationally, this is false economy.

### Cloudinary supplies the missing image-delivery contract

- Cloudinary delivery URLs identify an asset by cloud name, asset type, delivery type, and public ID, with an optional version component for cache-safe updates. [Cloudinary: Image delivery options](https://cloudinary.com/documentation/image_delivery_options) and [Advanced URL delivery options](https://cloudinary.com/documentation/advanced_url_delivery_options)
- URL transformations support resize/crop modes, quality, format, and other operations. `c_limit` can preserve the whole Product Preview while only scaling it down; `f_auto` and `q_auto` allow delivery format and quality to adapt. [Cloudinary: Image transformations](https://cloudinary.com/documentation/image_transformations)
- Cloudinary delivers transformed assets through a CDN and documents versioning/invalidation behavior for changed assets. Immutable, versioned URLs avoid stale-preview ambiguity. [Cloudinary: CDN cache invalidation](https://cloudinary.com/documentation/invalidate_cached_media_assets_on_the_cdn)
- The Media Library provides a browser UI for uploading, organizing, previewing, and managing assets, avoiding a custom admin application. [Cloudinary: Media Library](https://cloudinary.com/documentation/dam_manage_assets)
- Cloudinary has a free plan and meters usage with monthly credits. Credits cover managed storage, delivered bandwidth, and transformations; limits and paid-plan prices can change and must be checked before implementation. [Cloudinary pricing](https://cloudinary.com/pricing) and [Cloudinary credit usage](https://cloudinary.com/documentation/developer_onboarding_faq_credit_usage)

At 500 products, capacity is not inherently a concern for an image CDN; traffic and source file size matter more than record count. Using Cloudinary’s documented equivalences of one credit per 1 GB storage, 1 GB delivered bandwidth, or 1,000 transformations, an illustrative envelope of 1 GB originals, 3,000 initially generated variants, and 7.5 GB monthly transformed delivery consumes about 11.5 credits. This is an estimate, not a forecast; measure real asset sizes and traffic against the current plan before launch.

Cloudinary’s free tier is suitable for development and likely sufficient for a low-traffic launch under that illustrative envelope. The specification should nevertheless require usage alerts and name the owner who upgrades or reduces delivery if the project approaches its current monthly allowance. A paid plan is an operating cost if traffic outgrows the free allowance.

## Next.js 16 and Vercel compatibility

Pullpage currently has no `output: "export"` setting, so “static catalog” need not mean a Next.js static export.

For a normal Next.js deployment on Vercel, either of these supported paths works:

1. **Recommended:** a Cloudinary custom image loader constructs transformed Cloudinary URLs. This keeps resizing, automatic format/quality, and CDN caching in the image service and avoids paying two optimizers to transform the same asset.
2. The default `next/image` loader fetches Cloudinary originals after a narrowly scoped `images.remotePatterns` allowlist is configured.

Next.js 16 requires external images to match `remotePatterns`; remote images need intrinsic `width`/`height` or a constrained parent with `fill`; responsive grid images need an accurate `sizes` value; and quality choices are allowlisted. The default optimizer does not forward authentication headers, which is compatible with public Cloudinary assets but not private Drive files. [Local Next.js 16 Image Component documentation](../../../node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md)

Next.js also documents Cloudinary as a custom-loader target. If Pullpage later uses `output: "export"`, the default Next.js Image Optimization API is unavailable and a custom image-service loader is required, strengthening the Cloudinary choice. [Local Next.js 16 image configuration documentation](../../../node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/images.md) and [Local Next.js 16 static export documentation](../../../node_modules/next/dist/docs/01-app/02-guides/static-exports.md)

Google Drive is only technically compatible when the selected source URL is public and the optimizer can follow its redirects. Compatibility does not solve Drive’s editor-error risk, lack of transformations, undocumented delivery capacity, or cache-update semantics.

## Specification consequences

The final specification should require:

- Product Preview URLs from one allowlisted Cloudinary cloud/account over HTTPS; arbitrary remote hosts and Google Drive URLs fail publication validation.
- Public, unauthenticated raster assets. SVG Product Previews should be rejected rather than enabling Next.js’s security-sensitive SVG path.
- Non-cropping responsive transformations (`c_limit`) for both grid thumbnails and modal previews, with automatic format and quality; the artwork must never be cropped.
- Accurate responsive `sizes`, lazy loading for non-critical grid images, and reserved aspect-ratio space to prevent layout shift.
- Immutable replacement: upload a replacement as a new/versioned asset, paste its new secure URL into the content source, publish, verify, and only then remove the superseded asset. Do not rely on same-URL overwrite invalidation.
- Publish-time checks for the allowlisted URL pattern and a successful image response, plus a runtime fallback that preserves the Catalog Product’s text details when its Product Preview cannot load.
- A short editor runbook for Media Library upload, URL copy, replacement, and deletion, plus monthly credit-usage monitoring.

The exact fallback presentation and detailed validation feedback remain customer/editor workflow decisions rather than facts established by this research.
