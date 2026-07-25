drop view catalog_public.active_catalog_products;
drop trigger catalog_product_slug on catalog_private.catalog_products;
drop function catalog_private.set_catalog_product_slug();

alter table catalog_private.catalog_products rename column rarity to rarity_code;
alter table catalog_private.catalog_products rename column preview_url to product_preview_url;
alter table catalog_private.catalog_products add column product_preview_rights_id uuid;
alter table catalog_private.catalog_products alter column slug type varchar(96);

create table catalog_private.catalog_rarities (
  code varchar(32) primary key,
  sort_position smallint not null,
  created_at timestamptz(6) not null default statement_timestamp(),
  updated_at timestamptz(6) not null default statement_timestamp(),
  constraint catalog_rarity_code_nonblank check (btrim(code) <> ''),
  constraint catalog_rarity_sort_position_positive check (sort_position > 0),
  constraint catalog_rarity_sort_position_unique unique (sort_position)
);

insert into catalog_private.catalog_rarities (code, sort_position) values
  ('C', 1), ('U', 2), ('R', 3), ('RR', 4),
  ('AR', 5), ('SR', 6), ('SAR', 7), ('UR', 8);

alter table catalog_private.catalog_products
  add constraint catalog_product_rarity_configured
    foreign key (rarity_code) references catalog_private.catalog_rarities(code)
    on update restrict on delete restrict,
  add constraint catalog_product_preview_pair
    check ((product_preview_url is null) = (product_preview_rights_id is null));

create or replace function catalog_private.catalog_identity_text(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent(regexp_replace(btrim(coalesce(value, '')), '[[:space:]]+', ' ', 'g')));
$$;

create or replace function catalog_private.canonicalize_catalog_product_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.card_name is not null and btrim(new.card_name) = '' then new.card_name := null; end if;
  if new.collector_number is not null and btrim(new.collector_number) = '' then new.collector_number := null; end if;
  if new.set_name is not null and btrim(new.set_name) = '' then new.set_name := null; end if;
  if new.design_name is not null and btrim(new.design_name) = '' then new.design_name := null; end if;
  if new.rarity_code is not null and btrim(new.rarity_code) = '' then new.rarity_code := null; end if;
  if new.product_preview_url is not null and btrim(new.product_preview_url) = '' then new.product_preview_url := null; end if;
  return new;
end;
$$;

create or replace function catalog_private.catalog_slug_base(
  card_name text,
  collector_number text,
  design_name text
) returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from left(trim(both '-' from regexp_replace(
    lower(extensions.unaccent(concat_ws('-', card_name, collector_number, design_name))),
    '[^a-z0-9]+', '-', 'g'
  )), 72));
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
    slug_base := catalog_private.catalog_slug_base(new.card_name, new.collector_number, new.design_name);
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

create or replace function catalog_private.validate_catalog_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.format_code not in ('BS', 'TL', 'ALL') then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_format_valid',
      message = 'Supported Binder Formats must be BS, TL, or ALL.',
      hint = 'Choose BS for Binder Sleeve, TL for Toploader, or ALL for both.';
  end if;
  if new.binder_sleeve_price is not null and new.binder_sleeve_price <= 0 then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_binder_sleeve_price_positive',
      message = 'Binder Sleeve price must be a positive whole-IDR amount.',
      hint = 'Enter a whole number greater than zero, without currency symbols or decimals.';
  end if;
  if new.toploader_price is not null and new.toploader_price <= 0 then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_toploader_price_positive',
      message = 'Toploader price must be a positive whole-IDR amount.',
      hint = 'Enter a whole number greater than zero, without currency symbols or decimals.';
  end if;
  if new.format_code in ('BS', 'ALL') and new.binder_sleeve_price is null then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_binder_sleeve_price_required',
      message = 'Binder Sleeve price is required for the selected format.',
      hint = 'Enter a positive whole-IDR Binder Sleeve price in the same save.';
  end if;
  if new.format_code in ('TL', 'ALL') and new.toploader_price is null then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_toploader_price_required',
      message = 'Toploader price is required for the selected format.',
      hint = 'Enter a positive whole-IDR Toploader price in the same save.';
  end if;
  if new.rarity_code is not null and not exists (
    select 1 from catalog_private.catalog_rarities where code = new.rarity_code
  ) then
    raise exception using
      errcode = '23503', constraint = 'catalog_product_rarity_configured',
      message = 'Rarity is not configured for the Catalog.',
      hint = 'Choose a configured Rarity or clear the field for Unknown rarity.';
  end if;
  if (new.product_preview_url is null) <> (new.product_preview_rights_id is null) then
    raise exception using
      errcode = '23514', constraint = 'catalog_product_preview_pair',
      message = 'Product Preview URL and rights ID must be supplied together.',
      hint = 'Set both fields for the same preview, or clear both fields.';
  end if;
  return new;
end;
$$;

create or replace function catalog_private.validate_catalog_product_duplicate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  identity_key text;
  design_key text;
begin
  identity_key := concat_ws(chr(31),
    catalog_private.catalog_identity_text(new.card_name),
    catalog_private.catalog_identity_text(new.collector_number),
    catalog_private.catalog_identity_text(new.set_name)
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(identity_key, 0));

  if exists (
    select 1 from catalog_private.catalog_products p
    where p.id <> new.id
      and catalog_private.catalog_identity_text(p.card_name) = catalog_private.catalog_identity_text(new.card_name)
      and catalog_private.catalog_identity_text(p.collector_number) = catalog_private.catalog_identity_text(new.collector_number)
      and catalog_private.catalog_identity_text(p.set_name) = catalog_private.catalog_identity_text(new.set_name)
  ) then
    if new.design_name is null then
      raise exception using
        errcode = '23514', constraint = 'catalog_product_duplicate_requires_design_name',
        message = 'Duplicate card depictions require a Design Name.',
        hint = 'Give every matching Catalog Product a distinct nonblank Design Name.';
    end if;
    if exists (
      select 1 from catalog_private.catalog_products p
      where p.id <> new.id
        and catalog_private.catalog_identity_text(p.card_name) = catalog_private.catalog_identity_text(new.card_name)
        and catalog_private.catalog_identity_text(p.collector_number) = catalog_private.catalog_identity_text(new.collector_number)
        and catalog_private.catalog_identity_text(p.set_name) = catalog_private.catalog_identity_text(new.set_name)
        and p.design_name is null
    ) then
      raise exception using
        errcode = '23514', constraint = 'catalog_product_duplicate_requires_design_name',
        message = 'Every duplicate card depiction must already have a Design Name.',
        hint = 'Name the existing matching product before saving this duplicate.';
    end if;
    design_key := catalog_private.catalog_identity_text(new.design_name);
    if exists (
      select 1 from catalog_private.catalog_products p
      where p.id <> new.id
        and catalog_private.catalog_identity_text(p.card_name) = catalog_private.catalog_identity_text(new.card_name)
        and catalog_private.catalog_identity_text(p.collector_number) = catalog_private.catalog_identity_text(new.collector_number)
        and catalog_private.catalog_identity_text(p.set_name) = catalog_private.catalog_identity_text(new.set_name)
        and catalog_private.catalog_identity_text(p.design_name) = design_key
    ) then
      raise exception using
        errcode = '23505', constraint = 'catalog_product_duplicate_design_name_unique',
        message = 'Design Name must distinguish duplicate card depictions.',
        hint = 'Choose a Design Name that differs after case, accent, trim, and whitespace normalization.';
    end if;
  end if;
  return new;
end;
$$;

create trigger catalog_product_01_canonicalize
before insert or update on catalog_private.catalog_products
for each row execute function catalog_private.canonicalize_catalog_product_text();
create trigger catalog_product_02_owned_fields
before insert or update on catalog_private.catalog_products
for each row execute function catalog_private.own_catalog_product_fields();
create trigger catalog_product_03_validate
before insert or update on catalog_private.catalog_products
for each row execute function catalog_private.validate_catalog_product();
create trigger catalog_product_04_duplicate
before insert or update of card_name, collector_number, set_name, design_name
on catalog_private.catalog_products
for each row execute function catalog_private.validate_catalog_product_duplicate();

create index catalog_product_normalized_identity_idx
on catalog_private.catalog_products (
  catalog_private.catalog_identity_text(card_name),
  catalog_private.catalog_identity_text(collector_number),
  catalog_private.catalog_identity_text(set_name)
);
create unique index catalog_product_normalized_design_unique_idx
on catalog_private.catalog_products (
  catalog_private.catalog_identity_text(card_name),
  catalog_private.catalog_identity_text(collector_number),
  catalog_private.catalog_identity_text(set_name),
  catalog_private.catalog_identity_text(design_name)
) where design_name is not null;
create index catalog_product_rarity_idx on catalog_private.catalog_products (rarity_code);
create index catalog_product_preview_rights_idx on catalog_private.catalog_products (product_preview_rights_id, product_preview_url);
create index catalog_product_active_updated_idx on catalog_private.catalog_products (updated_at) where archived_at is null;

alter table catalog_private.catalog_products enable row level security;
alter table catalog_private.catalog_rarities enable row level security;

create view catalog_public.active_catalog_products
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
  p.product_preview_url
from catalog_private.catalog_products p
left join catalog_private.catalog_rarities r on r.code = p.rarity_code
where p.archived_at is null;

create view catalog_public.catalog_rarities
with (security_barrier = true)
as select code, sort_position from catalog_private.catalog_rarities;

revoke all on all tables in schema catalog_private from catalog_runtime;
grant select on catalog_public.active_catalog_products to catalog_runtime;
grant select on catalog_public.catalog_rarities to catalog_runtime;
