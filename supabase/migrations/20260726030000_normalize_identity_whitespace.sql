create or replace function catalog_private.catalog_identity_text(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent(btrim(regexp_replace(coalesce(value, ''), '[[:space:]]+', ' ', 'g'))));
$$;

reindex index catalog_private.catalog_product_normalized_identity_idx;
reindex index catalog_private.catalog_product_normalized_design_unique_idx;
