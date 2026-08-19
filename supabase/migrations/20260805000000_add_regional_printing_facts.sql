-- migration-safety: expand/backfill/contract
-- migration-safety: finite-lock-and-statement-timeouts
-- migration-safety: two-person-approval
-- migration-safety: compatibility-window
-- migration-safety: recovery-threshold
-- The owner approved an immediate contract and intentional three-row Catalog reset.
-- Product Preview Storage objects and configured Rarities are outside the reset boundary.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

delete from catalog_private.catalog_products
where id in (
  'd6b1bd71-9f13-4679-9448-9b7526fa0cce',
  '16ff2fd6-efe0-436c-86b5-66ca7508c46a',
  '344ae84e-03ce-4f4a-8f47-21366edbe1c3'
);

alter table catalog_private.catalog_products
  add column english_collector_number text,
  add column japanese_collector_number text,
  add column english_set_name text,
  add column japanese_set_name text,
  drop column collector_number,
  drop column set_name;

create or replace function catalog_private.canonicalize_catalog_product_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.card_name is not null and new.card_name !~ '[^[:space:]]' then new.card_name := null; end if;
  if new.english_collector_number is not null and new.english_collector_number !~ '[^[:space:]]' then new.english_collector_number := null; end if;
  if new.japanese_collector_number is not null and new.japanese_collector_number !~ '[^[:space:]]' then new.japanese_collector_number := null; end if;
  if new.english_set_name is not null and new.english_set_name !~ '[^[:space:]]' then new.english_set_name := null; end if;
  if new.japanese_set_name is not null and new.japanese_set_name !~ '[^[:space:]]' then new.japanese_set_name := null; end if;
  if new.design_name is not null and new.design_name !~ '[^[:space:]]' then new.design_name := null; end if;
  if new.rarity is not null and new.rarity !~ '[^[:space:]]' then new.rarity := null; end if;
  if new.product_preview_url is not null and new.product_preview_url !~ '[^[:space:]]' then new.product_preview_url := null; end if;
  return new;
end;
$$;

create or replace function catalog_private.own_catalog_product_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slug_base text;
begin
  if tg_op = 'INSERT' then
    slug_base := catalog_private.catalog_slug_base(
      new.card_name,
      coalesce(new.english_collector_number, new.japanese_collector_number),
      new.design_name
    );
    if slug_base = '' then slug_base := 'catalog-product'; end if;
    new.slug := slug_base || '-' || encode(extensions.gen_random_bytes(4), 'hex');
    new.created_at := statement_timestamp();
    new.updated_at := statement_timestamp();
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_id_immutable',
      message = 'Catalog Product ID is database-owned and cannot be changed.',
      hint = 'Restore the original ID and save again.';
  end if;
  if new.slug is distinct from old.slug then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_slug_immutable',
      message = 'Catalog Product slug is immutable.',
      hint = 'Restore the generated slug; descriptive edits do not change it.';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_created_at_immutable',
      message = 'Catalog Product creation time is database-owned and cannot be changed.',
      hint = 'Restore the original creation time and save again.';
  end if;
  if new.updated_at is distinct from old.updated_at then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_updated_at_owned',
      message = 'Catalog Product update time is database-owned and cannot be changed.',
      hint = 'Leave the update time unchanged; the database updates it automatically.';
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;
