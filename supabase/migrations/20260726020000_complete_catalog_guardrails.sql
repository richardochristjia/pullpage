create or replace function catalog_private.require_catalog_product_format()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.format_code is null then
    raise exception using
      errcode = '23502', constraint = 'catalog_product_format_required',
      message = 'Supported Binder Formats are required.',
      hint = 'Choose BS for Binder Sleeve, TL for Toploader, or ALL for both.';
  end if;
  return new;
end;
$$;

create trigger catalog_product_02_format_required
before insert or update of format_code on catalog_private.catalog_products
for each row execute function catalog_private.require_catalog_product_format();

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
  null::text as product_preview_url
from catalog_private.catalog_products p
left join catalog_private.catalog_rarities r on r.code = p.rarity_code
where p.archived_at is null;
