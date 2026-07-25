# Archive and restore a Catalog Product

Label: ready-for-agent
Type: task
Status: open
Blocked by: 11, 12, 14

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Deliver reversible Catalog Product exclusion as one complete Dashboard-to-public workflow. A Catalog Editor can archive an existing product—even when its Product Preview validity has deteriorated—and, after cache convergence, customers and crawlers no longer see it. The editor can later restore the same UUID and slug only after the row satisfies every current active constraint.

## Acceptance criteria

- [ ] `archived_at` is nullable UTC-aware data where null means active and every non-null value archives immediately, including a future timestamp.
- [ ] An archival-only update is accepted even when linked rights are expired/rejected or Cloudinary configuration no longer accepts the old URL.
- [ ] Archival preserves immutable UUID, slug, source facts, prices, Design Name, preview linkage, creation timestamp, and duplicate-card participation.
- [ ] Archived products remain subject to duplicate-card Design Name rules so restoration cannot create an identity conflict.
- [ ] After healthy cache convergence within 60 seconds, an archived product is absent from the shelf, local search/filter data, runtime sitemap, and approved preview image entries.
- [ ] Hard and soft product lookups render branded not-found with no product facts, `noindex`, a shelf link, and no redirect to `/`; streamed HTTP 200 is accepted with those semantics.
- [ ] Clearing `archived_at` is rejected while format/price, Rarity, duplicate identity, preview URL, rights, or Cloudinary rules are invalid.
- [ ] After correction, clearing `archived_at` restores the same UUID and slug to shelf, canonical page, modal, metadata, and sitemap within 60 healthy seconds.
- [ ] Archive and restore each expire the same global Catalog generation and do not require deployment.
- [ ] Routine Catalog Editors have no documented or granted hard-delete path and the UI/copy never describes archival as unavailable, out of stock, or sold out.
- [ ] The Dashboard workflow records the immutable identifier, reason, UTC time, and public verification evidence for archive and restore.
- [ ] Integration tests cover invalid-preview archival, invalid restoration, duplicate archived identities, stable slug, active projection, and least-privilege behavior.
- [ ] Browser/crawler tests cover shelf, modal, hard route, metadata, sitemap, noindex, restore, and stale pre-convergence behavior.
- [ ] A non-developer Preview rehearsal completes archive and restore without SQL, deletion, or developer intervention.

## Blocked by

- [Ticket 11](11-create-and-edit-valid-catalog-product.md)
- [Ticket 12](12-browse-find-and-open-catalog-products.md)
- [Ticket 14](14-share-and-discover-canonical-products.md)
