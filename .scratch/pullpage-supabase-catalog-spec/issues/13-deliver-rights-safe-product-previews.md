# Deliver rights-safe Product Previews

Label: ready-for-agent
Type: task
Status: open
Blocked by: 11, 12

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Deliver the complete Product Preview path from protected Cloudinary configuration and private rights review through a linked Catalog Product to responsive shelf and detail imagery. A trusted editor can prepare and approve an exact versioned asset, link it in one Catalog Product save, and see it publicly; missing, broken, rejected, expired, or misconfigured previews fail safely to the Pullpage placeholder without hiding textual facts.

## Acceptance criteria

- [ ] Protected configuration stores one approved Cloudinary cloud name and the `catalog-products/` folder separately per environment.
- [ ] The private rights register supports exact versioned URL, asset identifier, source, creator/photographer, owner/licensor, permission basis/evidence, channels, territories, attribution requirement/text, effective/optional expiry dates, status, reviewer/review time, takedown notes, and timestamps.
- [ ] Pending rights records may be incomplete, while transition to approved fails until all required evidence and review fields are complete.
- [ ] Rights are current only while approved, effective, and not past optional expiry; an expiry date remains valid through that calendar day.
- [ ] Product Preview URL and rights ID are both null or both present and have an exact composite relationship to the same rights record.
- [ ] Active product linking/restoration rejects missing, mismatched, pending, incomplete, future-effective, rejected, or expired rights.
- [ ] URL validation accepts only absolute HTTPS versioned Cloudinary raster `image/upload` assets under the configured cloud/folder and rejects malformed URLs, SVG, credentials, alternate ports, fragments, unapproved accounts/folders, and overlong technical values.
- [ ] Save-time validation makes no outbound Cloudinary request and a temporary delivery failure does not invalidate the Catalog Product.
- [ ] The public projection exposes no private rights evidence and emits the URL only while exact rights and Cloudinary configuration remain current.
- [ ] Rights rejection, expiry, or relevant configuration change invalidates the global Catalog generation or converges through the time fallback and replaces the image with the common placeholder.
- [ ] The custom Product Preview loader emits immutable non-cropping Cloudinary variants with automatic format/quality and accurate responsive sizes.
- [ ] Shelf images reserve layout space, lazy-load below the fold, and never request an original full-resolution or modal-size asset before product activation.
- [ ] Product detail requests a larger non-cropped variant only after activation and preserves reserved space while loading.
- [ ] Missing, blocked, timeout, HTTP failure, and expired-rights cases use the same branded accessible placeholder without retry loops, broken-image UI, console errors, or loss of facts.
- [ ] Product Preview alternative text identifies the finished presentation where informative; redundant already-named thumbnails are decorative.
- [ ] Replacing a preview uses a newly versioned asset and approved rights record; the old asset is not removed until the new public image is verified.
- [ ] Dashboard-equivalent rehearsals cover pending rights, approval, product linkage, replacement, rejection, expiry, invalid URL correction, and placeholder behavior.
- [ ] Integration and browser tests prove private-data exclusion, exact linkage, validation, responsive transformations, cache convergence, and all placeholder paths.

## Blocked by

- [Ticket 11](11-create-and-edit-valid-catalog-product.md)
- [Ticket 12](12-browse-find-and-open-catalog-products.md)
