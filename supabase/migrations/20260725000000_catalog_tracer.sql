create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists catalog_private;
create schema if not exists catalog_public;
revoke all on schema catalog_private from public;
revoke all on schema catalog_public from public;

create table catalog_private.catalog_products (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  card_name text,
  collector_number text,
  set_name text,
  rarity text,
  design_name text,
  format_code text not null check (format_code in ('BS', 'TL', 'ALL')),
  binder_sleeve_price integer check (binder_sleeve_price > 0),
  toploader_price integer check (toploader_price > 0),
  preview_url text,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint catalog_product_binder_sleeve_price_required check (
    format_code not in ('BS', 'ALL') or binder_sleeve_price is not null
  ),
  constraint catalog_product_toploader_price_required check (
    format_code not in ('TL', 'ALL') or toploader_price is not null
  )
);

create function catalog_private.catalog_slug_base(
  card_name text,
  collector_number text,
  design_name text
) returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(extensions.unaccent(concat_ws('-', card_name, collector_number, design_name))),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create function catalog_private.set_catalog_product_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slug_base text;
begin
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    raise exception 'Catalog Product slug is immutable' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    slug_base := catalog_private.catalog_slug_base(
      new.card_name,
      new.collector_number,
      new.design_name
    );
    if slug_base = '' then
      slug_base := 'catalog-product';
    end if;
    new.slug := slug_base || '-' || left(replace(new.id::text, '-', ''), 8);
  end if;
  return new;
end;
$$;

create trigger catalog_product_slug
before insert or update of slug on catalog_private.catalog_products
for each row execute function catalog_private.set_catalog_product_slug();

create view catalog_public.active_catalog_products
with (security_barrier = true)
as
select
  slug,
  card_name,
  collector_number,
  set_name,
  rarity,
  design_name,
  format_code,
  binder_sleeve_price,
  toploader_price,
  preview_url
from catalog_private.catalog_products
where archived_at is null;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'catalog_runtime') then
    create role catalog_runtime nologin;
  end if;
end
$$;
revoke all on schema catalog_private from catalog_runtime;
revoke all on all tables in schema catalog_private from catalog_runtime;
grant usage on schema catalog_public to catalog_runtime;
grant select on catalog_public.active_catalog_products to catalog_runtime;
