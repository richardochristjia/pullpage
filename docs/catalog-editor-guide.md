# Edit the Pullpage Catalog in Supabase

This guide is for trusted Catalog editors. Sign in to the Pullpage Supabase organization with your own named account and MFA. Never share an account or connection string.

Use the Singapore Production project (`vozvldzmzfdohusojrfq`) and the Supabase dashboard only. The public site reads active rows automatically; no deployment or developer action is needed after an edit.

## Catalog Product fields

Open **Table Editor**, select the `catalog_private` schema, then open `catalog_products`.

Do not change these database-owned fields:

- `id`
- `slug`
- `created_at`
- `updated_at`

You may edit these fields:

| Field | How to use it |
| --- | --- |
| `is_active` | Checked means publicly visible everywhere. Unchecked means publicly absent. New rows default to checked. |
| `card_name` | Optional card name. |
| `english_collector_number` | Optional identifying number printed on the English card. |
| `japanese_collector_number` | Optional identifying number printed on the Japanese card. |
| `english_set_name` | Optional official English expansion name. |
| `japanese_set_name` | Optional official Japanese expansion name. |
| `rarity` | Optional configured Rarity code. Use `C`, `U`, `R`, `RR`, `RRR`, `PR`, `TR`, `SR`, `HR`, `UR`, `K`, `A`, `AR`, `SAR`, `S`, `SSR`, `ACE`, `BWR`, `MA`, `MUR`, or `NO_MARK`. Leave it `NULL` only when the Rarity is unknown. |
| `design_name` | Optional name that distinguishes the extended-art design. |
| `binder_sleeve_price` | Positive whole IDR amount, or `NULL` when Binder Sleeve is not offered. |
| `toploader_price` | Positive whole IDR amount, or `NULL` when Toploader is not offered. |
| `product_preview_url` | Optional public HTTPS image URL. |

At least one price is required. A positive Binder Sleeve price creates the Binder Sleeve Format Option, and a positive Toploader price creates the Toploader Format Option. Enter both prices to offer both. Do not use `0`, negative values, decimals, currency symbols, or separators. Use `NULL`, not zero, for a Format Option that is not offered.

Blank optional text is stored as missing. Every regional field is independently optional: a Set Name does not require a Collector Number, and a missing value means unknown or unrecorded. Record English and Japanese facts on the same row only when the same extended-art design fits the same card illustration. Duplicate card facts are allowed. The database creates the ID and permanent slug and maintains both timestamps. Use `NO_MARK` when the card is known to have no rarity symbol; this is different from leaving Rarity unknown.

Rarity names, display order, badge colors, and filter visibility are maintained in `catalog_private.catalog_rarities`. Its `is_active` field controls whether that Rarity appears in the Catalog filter list; every active Rarity is listed in `display_order` with its active-product count, and an active Rarity with no products remains visible but disabled. Making a Rarity inactive does not remove its badge or facts from products that already use it. Do not change this reference data during an ordinary Catalog Product edit.

## Create a Catalog Product

1. In `catalog_private.catalog_products`, choose **Insert row**.
2. Leave all database-owned fields at their defaults.
3. Enter the available product facts.
4. Leave `is_active` checked unless the row should remain publicly absent.
5. Enter at least one valid price.
6. Optionally paste a public Product Preview URL.
7. Choose **Save** once.
8. Refresh the table and note the generated `id` and `slug`.
9. Follow [Verify a change](#verify-a-change).

If Save fails, correct the field named by Supabase and save again. Do not use SQL to bypass a constraint.

## Edit a Catalog Product

1. Find the row by `id`, `slug`, or its product facts.
2. Change only the intended editor-managed fields.
3. Choose **Save** once.
4. Confirm that the `slug` did not change.
5. Follow [Verify a change](#verify-a-change).

If Save appears to time out, refresh the table and inspect the row before trying again. This avoids creating or applying the same change twice.

## Change Catalog Visibility

To make a product publicly absent, uncheck `is_active` and save. To make the same product public again, check `is_active` and save. Do not create a replacement row: the existing row keeps its ID and URL.

Catalog Visibility describes only whether Pullpage displays the product. It does not mean in stock, sold out, reviewed, or available for purchase.

## Delete a Catalog Product

Delete only when permanent removal is intended:

1. Confirm the exact row by both `id` and `slug`.
2. Confirm with the owner that permanent deletion is intended.
3. Use the Table Editor row menu and choose **Delete row**.
4. Confirm the deletion once.
5. Follow [Verify a change](#verify-a-change).

Deletion has no application-level undo. Recreating the facts later will create a different ID and URL. Deleting a row does not delete its Product Preview file from Storage.

## Upload a Product Preview

New Product Previews belong in the public `product-previews` Storage bucket.

1. Prepare a JPEG, PNG, or WebP file no larger than 5 MB. SVG and other file types are not accepted.
2. In the Supabase dashboard, open **Storage** and select `product-previews`.
3. Choose **Upload files**, select the image, and wait for the upload to finish.
4. Open the uploaded object and choose **Copy public URL**.
5. Confirm the copied address begins with `https://` and opens without signing in.
6. Paste the URL into the Catalog Product's `product_preview_url` and save.
7. Follow [Verify a change](#verify-a-change), including the shelf and product detail image.

Existing public HTTPS Cloudinary URLs may remain unchanged. Clearing or changing `product_preview_url` does not delete any Storage object. Deleting a Catalog Product also leaves its object behind; remove an unused object manually from Storage only after confirming no row still uses its public URL. Deleting an object that a row still references causes Pullpage to show its image placeholder.

## Verify a change

Allow approximately 60 seconds, then use a fresh browser page:

- For an active row, confirm the product appears on the shelf, can be found by search and filters, opens at `/products/<slug>`, and shows the expected facts, Format Options, prices, and image or placeholder.
- For an inactive or deleted row, confirm it is absent from the shelf, search results, product route, and `/sitemap.xml`.
- Confirm the permanent `slug` remains unchanged after ordinary edits or visibility changes.

A healthy edit needs no rebuild or deployment. Search engines and social platforms control their own refresh timing and may take longer than the Pullpage site.

If Pullpage still shows the old state after 60 seconds, first refresh the Supabase row and confirm the intended value was saved. Then report the row ID, slug, expected value, and UTC time to the project owner. Do not repeatedly save the same value.
