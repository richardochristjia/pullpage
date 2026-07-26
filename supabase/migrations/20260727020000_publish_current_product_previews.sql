create or replace view catalog_public.active_catalog_products
with (security_barrier = true)
as
select
  p.slug,
  p.card_name,
  p.collector_number,
  p.set_name,
  p.rarity_code,
  r.sort_position as rarity_sort_position,
  p.design_name,
  p.format_code,
  p.binder_sleeve_price,
  p.toploader_price,
  case
    when catalog_private.product_preview_rights_are_current(
      p.product_preview_rights_id,
      p.product_preview_url,
      current_date
    ) then p.product_preview_url
    else null::text
  end as product_preview_url
from catalog_private.catalog_products p
left join catalog_private.catalog_rarities r on r.code = p.rarity_code
where p.archived_at is null;

grant select on catalog_public.active_catalog_products to catalog_runtime;
