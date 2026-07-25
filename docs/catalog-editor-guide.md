# Catalog Editor: Edit → Save → Verify

Use this workflow in the dedicated non-production project before working in Production. Routine Catalog Editors use **Table Editor**, never SQL Editor, CSV import, DELETE, or schema controls.

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
- For this slice, leave Product Preview URL and rights ID empty. Rights-safe previews are introduced separately.

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
5. No deployment or rebuild occurred.

If the old state remains after 60 seconds, stop editing and ask the Catalog Maintainer to check the persisted row, webhook delivery, and Catalog refresh. Do not save repeatedly.

## Ambiguous Save result

If Save times out or loses its connection, **do not retry immediately**. Refresh Table Editor and search using the facts prepared for that save. If the row and generated slug exist, verify that row publicly. Retry only after confirming that no row committed; this prevents duplicate insertion.

## Rehearsal record

A non-developer rehearsal records screenshots and UTC timestamps for: one valid missing-value create, one valid edit, each error category above, unchanged slug, public before/after results, and one simulated ambiguous result resolved by checking the persisted row before retry. Retain the completed record with the release evidence.

## Maintainer: automatic invalidation

Configure one Supabase Database Webhook for `INSERT`, `UPDATE`, and `DELETE` on `catalog_private.catalog_products`. Send `POST` to `/api/catalog/invalidate` with `Authorization: Bearer <CATALOG_REVALIDATE_SECRET>`. The application accepts only that method, secret, schema, table, and event type; callers cannot choose a cache tag or path. Rotate the application secret and webhook header together.
