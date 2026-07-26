# Catalog Editor: Edit → Save → Verify

Use this workflow in the dedicated non-production project before working in Production. Routine Catalog Editors use **Table Editor**, never SQL Editor, CSV import, DELETE, or schema controls. Supabase project owners are privileged recovery administrators, not routine Catalog Editors; shared accounts are prohibited.

## Before saving

1. Confirm the Supabase project/environment and select `catalog_private.catalog_products`.
2. Confirm no edit freeze, migration, recovery, or Catalog incident is active.
3. Prepare the complete row. A successful active row is public automatically; there is no Draft or Publish button.
4. Leave `id`, `slug`, `created_at`, and `updated_at` at their database defaults. Leave `archived_at` empty for an active product.

## Fields

- Card Name, Collector Number, Set Name, Design Name, and Rarity are optional. Blank text becomes missing; do not enter display fallbacks such as `No Name`.
- Choose `BS` (Binder Sleeve), `TL` (Toploader), or `ALL` deliberately.
- Enter positive whole-rupiah prices without symbols, separators, decimals, zero, or negative signs. `BS` requires Binder Sleeve price, `TL` requires Toploader price, and `ALL` requires both. An irrelevant positive stored price is ignored publicly.
- Choose a configured Rarity (`C`, `U`, `R`, `RR`, `AR`, `SR`, `SAR`, or `UR`) or leave it empty.
- If another active or archived row depicts the same Card Name + Collector Number + Set Name after case/accent/whitespace normalization, every matching row needs a distinct Design Name. Punctuation remains significant.
- Leave Product Preview URL and rights ID empty unless the rights-safe workflow below has produced a current approved pair. Both values must identify the exact same versioned asset and must be saved together.

Save once. Refresh the row and record its ID, generated slug, and UTC save time. Descriptive edits never change the slug.

## Correct rejected saves

| Message category | Correction |
| --- | --- |
| Supported Binder Formats required/invalid | Choose `BS`, `TL`, or `ALL`. |
| Required or non-positive price | Enter each selected format's positive whole-IDR price in the same save. |
| Rarity is not configured | Choose a configured Rarity or clear it. |
| Duplicate requires Design Name | Name every matching row, including archived rows. |
| Design Name must distinguish duplicates | Choose a name distinct after case, accent, trim, and whitespace normalization. |
| Product Preview pair | Set the matching URL and rights ID together, or clear both. |
| ID, slug, or timestamp database-owned | Restore the original/default value. |

A rejection changes no row, timestamp, public projection, or cache generation. Keep the editor open, correct the named category, and save once again. Escalate an unrecognized error with its complete text and UTC time; do not bypass it with SQL.

## Verify publication

In a fresh browser session, allow up to 60 seconds under healthy operation and verify:

1. The shelf row appears and displays exact supplied text.
2. Missing values show `No Name`, `Unknown number`, `Unknown set`, and `Unknown rarity` only in the UI.
3. Only selected Format Options appear with the correct IDR prices.
4. The generated slug remains unchanged after an edit.
5. The canonical page title, description, Product Preview social image or Pullpage fallback, and share action use the production `https://pullpage.vercel.app/products/<slug>` URL.
6. `/sitemap.xml` contains the active canonical and includes the Product Preview image URL only while its rights are current.
7. No deployment or rebuild occurred.

If the old state remains after 60 seconds, stop editing and ask the Catalog Maintainer to check the persisted row, webhook delivery, and Catalog refresh. Do not save repeatedly. The 60-second target covers Pullpage-controlled responses only: search engines and social platforms choose their own recrawl and cached-card refresh timing, with no 60-second guarantee.

## Archive and restore

Routine removal is reversible archival. Never use Dashboard Delete, SQL, CSV import, or a blank replacement row. Archival is not inventory, availability, out-of-stock, or sold-out state.

### Archive

1. Open the existing row and record its immutable UUID and slug in the workflow evidence.
2. Record the reason, operator, and current UTC time outside the public Catalog row. Do not put private operational notes into customer-facing fields.
3. Change **only** `archived_at` from empty to the current UTC timestamp and save once. Any non-empty timestamp archives immediately—even a future timestamp—so do not schedule archival by entering a future time.
4. Do not clear or alter source facts, prices, Design Name, Product Preview linkage, UUID, slug, or creation time. Archival remains possible when linked rights have expired or been rejected, or when the environment no longer accepts the old Cloudinary URL.
5. In a fresh browser, allow up to 60 seconds under healthy operation and record UTC evidence that the product is absent from the shelf and local search, its hard and soft URLs show branded `noindex` not-found content without product facts, and its canonical and Product Preview image are absent from `/sitemap.xml`.

If the old state remains before convergence, do not save again: clients and shared cache entries may briefly show the last active generation. After 60 seconds, follow the same persisted-row, webhook, and Catalog-refresh escalation used for publication.

### Restore

1. Find the archived row by the recorded UUID and verify its slug has not changed.
2. Correct every current active constraint before or in the restoration save: Supported Binder Formats and prices, configured Rarity, duplicate identity and distinct Design Name, exact Product Preview pairing, current approved rights, and this environment's Cloudinary rules. Do not bypass a rejection or create a replacement row.
3. Clear `archived_at` and save once. A rejected restoration leaves the original row archived.
4. In a fresh browser, allow up to 60 seconds and record UTC evidence that the same slug appears on the shelf and in local search, opens as a canonical page and intercepted modal, has current metadata, and returns to `/sitemap.xml` with its Product Preview image only when rights are current.

The Preview rehearsal must be completed by a non-developer using Table Editor only. Retain before/after screenshots, immutable UUID and slug, reason, operator, archive and restore UTC times, rejected-restoration correction evidence, webhook/convergence times, and every public verification above. No developer intervention, SQL, or deletion is part of the rehearsal.

Successful inserts, edits, archives, and restores are recorded automatically in the private append-only journal; rejected saves and rolled-back transactions are not. Editors cannot use that evidence as an undo button. A Catalog Maintainer follows the [Catalog audit and recovery runbook](catalog-recovery-runbook.md) for reviewed targeted correction. Exceptional hard deletion is never an editor workflow.

## Ambiguous Save result

If Save times out or loses its connection, **do not retry immediately**. Refresh Table Editor and search using the facts prepared for that save. If the row and generated slug exist, verify that row publicly. Retry only after confirming that no row committed; this prevents duplicate insertion.

## Rehearsal record

A non-developer rehearsal records screenshots and UTC timestamps for: one valid missing-value create, one valid edit, each error category above, unchanged slug, public before/after results, and one simulated ambiguous result resolved by checking the persisted row before retry. Retain the completed record with the release evidence.

## Rights-safe Product Preview workflow

Only the designated Rights Reviewer may approve a Product Preview. Routine Catalog Editors must not infer permission from possession of an image.

### Maintainer: environment configuration

In each Supabase environment, keep exactly one row in `catalog_private.product_preview_configuration`. Set that environment's name, its approved Cloudinary cloud name, and the fixed folder `catalog-products/`. Never copy Production configuration into a different environment by assumption. Configuration is private and is not part of the public Catalog projection.

Use public, unauthenticated raster assets in Cloudinary. The exact delivery URL must use HTTPS, `res.cloudinary.com`, the configured cloud, `image/upload`, an explicit numeric `v…` version, the `catalog-products/` folder, and a supported raster extension. Do not paste transformation URLs, SVG, share links, credentials, ports, query strings, or fragments. Saving validates text only and never contacts Cloudinary.

### Prepare and approve rights

1. Upload a new asset under `catalog-products/` and copy its exact versioned secure URL and asset identifier. Never overwrite an already-published version.
2. Create a **pending** row in `catalog_private.product_preview_rights`. Pending records may be incomplete.
3. Record the exact URL, asset identifier, source, creator/photographer, owner/licensor, permission basis and evidence reference, approved channels and territories, attribution decision and required text, effective date, optional expiry date, and any takedown notes.
4. The Rights Reviewer verifies the evidence, enters reviewer and review time, and changes status to `approved`. Approval fails until every required field is complete and the URL matches this environment. Expiry remains current through the stated calendar date.
5. In one Catalog Product save, set both `product_preview_url` and `product_preview_rights_id` from that same approved row. A missing, mismatched, pending, future-effective, rejected, or expired pair is rejected for an active product.
6. Verify the shelf thumbnail and the larger canonical/modal detail image in a fresh browser. Textual Catalog facts must remain visible if image delivery is unavailable.

To replace an image, prepare and approve a newly versioned asset and a new rights row, save the new exact pair, and verify public delivery. Only then may the old Cloudinary asset be removed. Do not edit an old URL in place.

For a takedown, change rights status to `rejected`, record the reason, and verify the common Pullpage placeholder. Expiry and relevant configuration changes also withdraw the public URL. Do not clear evidence. Escalate delivery failures separately: temporary Cloudinary failure does not invalidate the stored Catalog Product.

### Product Preview rehearsal record

In the dedicated non-production environment, retain screenshots, row IDs, exact versioned URLs, and UTC timestamps for: incomplete pending rights; failed incomplete approval; successful approval and linkage; invalid URL rejection then correction; newly versioned replacement before old-asset removal; rejection/takedown; expiry through and after the expiry date; configuration mismatch and restoration; and missing, blocked, timeout, and HTTP-failure placeholders. Confirm no private evidence appears in browser responses.

## Maintainer: automatic invalidation

Configure Supabase Database Webhooks for `INSERT`, `UPDATE`, and `DELETE` on all three fixed-scope tables: `catalog_private.catalog_products`, `catalog_private.product_preview_rights`, and `catalog_private.product_preview_configuration`. Send `POST` to `/api/catalog/invalidate` with `Authorization: Bearer <CATALOG_REVALIDATE_SECRET>`. The application accepts only those methods, secret, schema, tables, and event types; callers cannot choose a cache tag or path. Rotate the application secret and webhook headers together. An accepted event expires the fixed current generation while preserving the last-known-good safety generation. If an expiry passes without a database event, the 60-second Catalog cache fallback converges the public URL to the placeholder. Follow the [Catalog resilience runbook](catalog-resilience-runbook.md) for repeated delivery failure, database outage, alert, and manual-recovery procedures.
