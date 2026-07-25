# Define the Supabase Dashboard editing and archive workflow

Type: grilling
Status: resolved
Blocked by: 01, 02, 04

## Question

What concrete create, edit, image/rights, validation-error, automatic-publication, archive, restore, failure-diagnosis, and recovery workflow can a non-developer safely operate in Supabase Dashboard without a custom admin or Draft/Publish stage?

## Answer

Routine catalog administration is a direct **Edit → Save → Verify** workflow. A valid save commits to Supabase Postgres and becomes eligible for the public catalog automatically; there is no Pullpage Publish button, deployment, Draft state, or Dashboard Undo operation. Postgres rejects invalid saves atomically, and Next.js normally exposes accepted changes within 60 seconds.

### Roles and operating boundary

Every operator uses an individual business-controlled Supabase account with MFA. Shared accounts are prohibited. Assign and document:

- **Catalog Editor** — routine Catalog Product create, edit, archive, and restore work.
- **Rights Reviewer** — completes Product Preview rights records and is allowed to change their status to `approved`.
- **Catalog Maintainer** — protected Rarity/Cloudinary configuration, audit investigation, targeted recovery, migrations, and webhook/cache diagnosis.
- **Recovery approvers** — two named people required for hard deletion or whole-database restore.

One person may hold the first two roles if the business accepts that operating model; hard deletion and whole-database restore still require two people.

Supabase Dashboard access is broader than a purpose-built catalog admin. Do not claim that a project member with Table Editor access is technically confined to these tables if the selected Supabase project role also exposes SQL, schema, or project controls. Use the least-privileged project role that can perform the documented workflow, restrict production membership, review it quarterly, and rely on named accounts, constraints/triggers, Platform Audit Logs, `pgaudit`, and the row journal as compensating controls. Routine editors must not use SQL Editor, CSV import, schema modification, trigger controls, DELETE, or service credentials.

All training and workflow rehearsals use a non-production project. The production Table Editor must clearly identify the project/environment to reduce wrong-environment edits.

### Before every production change

1. Confirm the Dashboard header shows the production project and the `catalog` schema.
2. Ensure no migration, recovery, or catalog incident freeze is in progress.
3. Have all values ready before opening Insert/Edit. A product row is not a draft form.
4. For a routine change, modify one Catalog Product and verify it before starting the next. Planned bulk work requires a maintainer-reviewed transaction and rollback plan.
5. Never edit `id`, `slug`, `created_at`, or `updated_at`; never use `archived_at` as an availability or stock control.

### Create a Catalog Product

In **Table Editor → `catalog` → `catalog_products` → Insert row**:

1. Leave database-owned `id`, `slug`, `created_at`, and `updated_at` at their defaults.
2. Leave `archived_at` null. Do not create an archived row as a substitute Draft workflow.
3. Enter the available Card Name, Collector Number, Set Name, Rarity, and Design Name. Blank optional values become null.
4. Choose `BS`, `TL`, or `ALL` deliberately.
5. Enter positive whole-rupiah prices required by that format. Do not type currency symbols, grouping punctuation, decimals, zero, or negative values.
6. For no Product Preview, leave both preview URL and rights ID null; the public catalog will use the Pullpage placeholder.
7. For a Product Preview, complete the image/rights workflow below first, then enter the exact versioned URL and matching rights-record ID together.
8. Save once. On success, refresh the row to see its generated immutable slug, record the canonical `/products/<slug>` URL, then perform public verification.

Because there is no Draft/Publish stage, do not insert an incomplete product intending to finish it later. Gather the values first; a successful active insert starts automatic publication immediately.

### Edit a Catalog Product

Open one row in the full row editor, make interdependent changes together, and save once:

- Editing Card Name, Collector Number, Set Name, or Design Name never changes the slug.
- When changing format, set all newly required prices in the same edit. Irrelevant positive prices may remain stored but are not displayed as Format Options.
- If an identity edit makes multiple products target the same normalized card, every matching row—including archived rows—must already have a distinct Design Name. Update an existing unnamed product first, then create or rename the other product.
- Select only configured Rarity values; blank means Unknown rarity.
- Change preview URL and rights ID together.
- Do not overwrite fallback labels such as `No Name`, `Unknown number`, or `Unknown rarity` into the database.

Every valid edit is automatically public. There is no separate confirmation or publish action, so the editor must review the complete row before pressing Save.

### Product Preview and rights workflow

#### Add a preview

1. Upload a rights-cleared raster image to the business-controlled Cloudinary production environment under `catalog-products/`. Do not upload SVG or source/print-ready artwork.
2. Copy Cloudinary's immutable versioned HTTPS delivery URL and asset identifier.
3. In `catalog.product_preview_rights`, insert a `pending` record with the URL, asset identifier, source, creator, owner/licensor, permission basis/evidence reference, channels, territories, attribution requirement, effective/expiry dates, and review information.
4. The Rights Reviewer checks the evidence and changes the record to `approved`. Postgres rejects approval if required evidence is incomplete.
5. Edit the Catalog Product and set its preview URL and matching rights ID in the same save.
6. Verify the shelf thumbnail, product page, and placeholder fallback behavior after cache refresh.

A pending, rejected, future-effective, or expired rights record cannot authorize a product save. Product rights details remain private and never cross the runtime view.

#### Replace a preview

Upload a new versioned Cloudinary asset, create and approve its own rights record, then replace both product linkage columns in one save. Verify the new public image after cache refresh before removing the previous Cloudinary asset. Do not overwrite an asset at its old versioned URL.

#### Takedown or expiry

Changing a linked rights record to `rejected` or `expired`, or reaching its expiry date, causes the runtime projection to suppress the URL and show the Pullpage placeholder. Archive the whole Catalog Product only when the product itself must leave the catalog. Rights, Rarity, and preview-configuration changes that affect the public projection must invalidate the same global `catalog` cache tag as product changes; time-based revalidation remains the fallback when a webhook is delayed or an expiry occurs without a write.

Postgres does not contact Cloudinary during Save. A structurally valid image that is temporarily unreachable may save; runtime image failure falls back to the placeholder and must be investigated operationally.

### Validation-error workflow

A rejected save changes neither the database row nor the public catalog. Database migrations must give checks/triggers stable, operator-readable constraint names and return a concise message plus correction hint. The editor should keep the row editor open, correct the indicated values, and save again.

| Error category | Editor action |
| --- | --- |
| Required or non-positive price | Supply a positive whole-IDR value for every format selected by `format_code`. |
| Unknown Rarity | Select a configured Rarity or clear it; do not type a new value into the product row. |
| Duplicate card requires Design Name | Give every matching Catalog Product a Design Name before adding the duplicate. |
| Duplicate Design Name | Choose a Design Name distinct after case/accent/whitespace normalization. |
| Preview URL/rights pair missing or mismatched | Set the exact approved URL and its rights ID together, or clear both. |
| Rights not approved/current | Ask the Rights Reviewer to correct the record, replace the preview, or clear both preview fields. |
| Cloudinary URL rejected | Use the configured cloud and `catalog-products/` folder, HTTPS `image/upload`, a version segment, and a raster asset. |
| Slug or database timestamp immutable | Discard that field edit; these values are database-owned. |
| Connection/timeout or ambiguous Save result | Do not repeatedly click Save. Refresh and locate the row/row-journal entry to determine whether it committed before retrying. |
| Unrecognized database error | Stop editing, copy the complete error and UTC time, and escalate to the Catalog Maintainer. Do not work around a constraint with SQL. |

The implementation handoff must include a one-page field guide containing these messages and screenshots of the final Table Editor controls. Raw constraint names alone are insufficient training material.

### Automatic-publication verification

A successful Dashboard save triggers database cache invalidation; the 30/60-second cache policy is the fallback. Dashboard success means **committed**, not yet **publicly verified**.

For every create, edit, archive, or restore:

1. Record the affected ID/slug and UTC save time.
2. Wait up to 60 seconds under healthy operation.
3. Check the production shelf and canonical product route in a fresh browser session.
4. Verify changed identity facts, Format Options/prices, Rarity, Product Preview/placeholder, and expected search/filter behavior.
5. For create/restore, verify the canonical route and sitemap inclusion. For archive, verify shelf/sitemap removal and branded noindex 404.
6. If the old state remains after 60 seconds, follow failure diagnosis rather than resaving the row.

The healthy-operation 60-second target is intentionally relaxed during database/cache failure because the site retains the last-known-good catalog instead of publishing an empty or invalid result.

### Archive

1. Locate and recheck the product by immutable ID/slug.
2. Record the reason in the operational change/incident record.
3. Set `archived_at` to the current timestamp and save; do not delete the row.
4. Verify shelf and sitemap removal and a branded 404 at the canonical route after cache refresh.

An archival-only update must remain possible even if the existing preview's rights have just expired or its Cloudinary configuration is no longer valid: reducing public exposure must not be blocked by a newly invalid external dependency. The product-save trigger must therefore permit the transition from active to archived while preserving immutable and audit invariants. Duplicate identity checks continue to include the archived row.

Archival does not mean unavailable, out of stock, or sold out. The UI must not present those meanings.

### Restore

1. Find the archived row in Table Editor and review every current field.
2. Revalidate format/prices, duplicate-card Design Names, Rarity, Cloudinary allowlist, and current rights. Replace or clear an invalid preview linkage before restoration.
3. Set `archived_at` to null and save. Restoration is rejected if the row would not be valid as an active Catalog Product.
4. Verify reappearance on the shelf and sitemap and confirm the original slug route works after cache refresh.

Restoration never generates a new ID or slug.

### Failure diagnosis

Use this order; do not make speculative data edits while diagnosing infrastructure:

1. **Did Save commit?** Refresh Table Editor and inspect the row journal at the reported UTC time. If not, correct the validation error or connection problem.
2. **Is the runtime projection correct?** A maintainer queries the restricted active view by ID/slug. Missing means archived/RLS-filtered; a null preview may mean expired/rejected rights or invalid Cloudinary configuration.
3. **Was invalidation accepted?** Check the database webhook and Next.js invalidation endpoint logs without exposing the bearer secret. A missed webhook should still recover through time-based refresh.
4. **Can Prisma refresh?** Check bounded connection/pool, timeout, validation, and remote-cache errors by correlation ID. Never convert database failure into an empty catalog or product 404.
5. **Is only the image broken?** Confirm the exact Cloudinary version still exists and is deliverable. Keep the Catalog Product visible with its placeholder while repairing or replacing the preview.
6. **Is the site serving last-known-good data?** During Supabase or cache regeneration failure, stale content may remain beyond 60 seconds by design. Freeze edits until the incident owner confirms recovery.

After infrastructure recovery, validate the complete runtime projection, manually invalidate the global catalog tag, and repeat the public smoke checks.

### Mistake and recovery workflow

There is no Dashboard Undo button in the operating contract.

- **One mistaken field edit/archive:** stop further edits, identify the exact transaction in the append-only row journal, and have the Catalog Maintainer restore only the affected fields in one reviewed transaction. Validate, invalidate cache, and verify publicly.
- **One/few accidental deletions:** routine editors should not have or use DELETE. Recover exact before-images from the journal; do not use whole-project PITR for a targeted mistake.
- **Corrupt bulk change:** freeze edits and invalidation, preserve audit evidence, then use journal replay where practical or the approved PITR procedure. Revalidate the whole catalog before reopening editing.
- **Database loss/corruption:** follow ticket 04's PITR/independent-backup runbook. The Next.js last-known-good cache is not a backup.
- **Hard deletion:** permitted only when archival cannot meet a documented legal/privacy/data-correction requirement. It requires two-person approval, healthy PITR, verified pre-change export, journal before-image, controlled maintenance execution, cache invalidation, and public 404/sitemap verification.

Never remove a Cloudinary asset or rights record merely to hide a product; archive the Catalog Product first. After verified archive/takedown, disposition of the external asset and legal evidence follows the rights and retention requirements.

### Rarity and configuration changes

Rarity order and Cloudinary allowlist changes affect every product and are not routine row edits. Only the Catalog Maintainer performs them:

1. capture current values and affected-product count;
2. validate the change in non-production;
3. schedule and record the production change;
4. save one coherent database transaction where possible;
5. invalidate the global catalog tag; and
6. verify filters, ordering, previews, and placeholders across representative products.

Never delete a referenced Rarity. When swapping unique sort positions, use a maintainer-reviewed transaction rather than ad hoc intermediate Dashboard saves that could temporarily publish the wrong order.

### Required acceptance evidence

Before launch, two non-developer operators must independently complete in non-production:

- create with and without a Product Preview;
- ordinary text, format, price, Rarity, and image replacement edits;
- every documented validation error and proof that rejected saves leave public data unchanged;
- automatic publication within 60 seconds, plus missed-webhook fallback;
- archive and restore with stable slug;
- rights rejection/expiry producing the placeholder;
- ambiguous-save diagnosis without duplicate insertion;
- targeted journal recovery of an accidental edit; and
- escalation of bulk corruption/hard deletion without attempting Dashboard repair.

Retain the completed checklist, screenshots, timestamps, audit/journal correlation, cache/webhook evidence, named owners and backups, and the final one-page editor field guide as implementation-handoff evidence.
