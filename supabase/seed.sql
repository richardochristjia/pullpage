insert into catalog_private.catalog_products (
  id,
  slug,
  card_name,
  collector_number,
  set_name,
  rarity_code,
  design_name,
  format_code,
  binder_sleeve_price,
  product_preview_url
) values (
  '11111111-1111-4111-8111-111111111111',
  '',
  'Pikachu',
  '173/165',
  'Scarlet & Violet—151',
  'AR',
  'Electric Bloom',
  'BS',
  95000,
  null
)
on conflict (id) do update set
  card_name = excluded.card_name,
  collector_number = excluded.collector_number,
  set_name = excluded.set_name,
  rarity_code = excluded.rarity_code,
  design_name = excluded.design_name,
  format_code = excluded.format_code,
  binder_sleeve_price = excluded.binder_sleeve_price,
  toploader_price = excluded.toploader_price,
  product_preview_url = excluded.product_preview_url,
  product_preview_rights_id = null,
  archived_at = null;

select slug
from catalog_private.catalog_products
where id = '11111111-1111-4111-8111-111111111111';
