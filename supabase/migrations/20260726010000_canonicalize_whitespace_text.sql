create or replace function catalog_private.canonicalize_catalog_product_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.card_name is not null and new.card_name !~ '[^[:space:]]' then new.card_name := null; end if;
  if new.collector_number is not null and new.collector_number !~ '[^[:space:]]' then new.collector_number := null; end if;
  if new.set_name is not null and new.set_name !~ '[^[:space:]]' then new.set_name := null; end if;
  if new.design_name is not null and new.design_name !~ '[^[:space:]]' then new.design_name := null; end if;
  if new.rarity_code is not null and new.rarity_code !~ '[^[:space:]]' then new.rarity_code := null; end if;
  if new.product_preview_url is not null and new.product_preview_url !~ '[^[:space:]]' then new.product_preview_url := null; end if;
  return new;
end;
$$;
