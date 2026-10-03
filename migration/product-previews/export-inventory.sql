-- Operator runs in Production vozvldzmzfdohusojrfq SQL Editor.
-- Export CSV locally; never paste rows/IDs/URLs into issues or chat.
-- Metadata only, no image download or database mutation.
BEGIN READ ONLY;

SELECT
  'object'::text AS record_type,
  name AS source_key,
  COALESCE(metadata->>'size', metadata->>'contentLength', '') AS source_bytes,
  COALESCE(lower(metadata->>'mimetype'), '') AS source_mime,
  COALESCE(to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), '') AS source_updated_at,
  COALESCE(metadata->>'eTag', metadata->>'etag', '') AS source_etag,
  ''::text AS product_id,
  ''::text AS product_slug,
  ''::text AS current_preview_url,
  ''::text AS product_updated_at
FROM storage.objects
WHERE bucket_id = 'product-previews'

UNION ALL

SELECT
  'product'::text,
  ''::text,
  ''::text,
  ''::text,
  ''::text,
  ''::text,
  id::text,
  slug::text,
  COALESCE(product_preview_url, ''),
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
FROM catalog_private.catalog_products
ORDER BY record_type, source_key, product_id;

COMMIT;
