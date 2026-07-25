insert into catalog_private.catalog_products (
  id,
  slug,
  card_name,
  collector_number,
  set_name,
  rarity,
  design_name,
  format_code,
  binder_sleeve_price,
  preview_url
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
on conflict (id) do nothing;

select slug
from catalog_private.catalog_products
where id = '11111111-1111-4111-8111-111111111111';
