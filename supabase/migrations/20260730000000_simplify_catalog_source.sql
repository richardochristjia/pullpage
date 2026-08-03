-- migration-safety: expand/backfill/contract
-- migration-safety: finite-lock-and-statement-timeouts
-- migration-safety: two-person-approval
-- migration-safety: compatibility-window
-- migration-safety: recovery-threshold

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Let the migration owner dismantle objects previously isolated under recovery roles.
revoke catalog_editor, catalog_recovery_operator, catalog_audit_owner from postgres;
reassign owned by catalog_editor, catalog_recovery_operator, catalog_audit_owner to postgres;
drop owned by catalog_editor, catalog_recovery_operator, catalog_audit_owner;

alter table catalog_private.catalog_products disable trigger user;
alter table catalog_private.catalog_products add column is_active boolean;

update catalog_private.catalog_products
set is_active = archived_at is null;

update catalog_private.catalog_products
set
  binder_sleeve_price = case when format_code in ('BS', 'ALL') then binder_sleeve_price else null end,
  toploader_price = case when format_code in ('TL', 'ALL') then toploader_price else null end;

update catalog_private.catalog_products
set product_preview_url = null,
    product_preview_rights_id = null
where product_preview_url is not null
  and not catalog_private.product_preview_rights_are_current(
    product_preview_rights_id,
    product_preview_url,
    current_date
  );

drop schema catalog_public cascade;

drop trigger if exists catalog_product_01_canonicalize on catalog_private.catalog_products;
drop trigger if exists catalog_product_02_owned_fields on catalog_private.catalog_products;
drop trigger if exists catalog_product_02_format_required on catalog_private.catalog_products;
drop trigger if exists catalog_product_03_validate on catalog_private.catalog_products;
drop trigger if exists catalog_product_04_duplicate on catalog_private.catalog_products;
drop trigger if exists catalog_product_90_journal on catalog_private.catalog_products;
drop trigger if exists catalog_product_99_invalidate on catalog_private.catalog_products;

drop policy if exists catalog_products_editor_select on catalog_private.catalog_products;
drop policy if exists catalog_products_editor_insert on catalog_private.catalog_products;
drop policy if exists catalog_products_editor_update on catalog_private.catalog_products;
drop policy if exists catalog_products_recovery_select on catalog_private.catalog_products;
drop policy if exists catalog_products_recovery_update on catalog_private.catalog_products;
drop policy if exists catalog_products_recovery_delete on catalog_private.catalog_products;

alter table catalog_private.catalog_products
  drop constraint if exists catalog_product_rarity_configured,
  drop constraint if exists catalog_product_preview_pair,
  drop constraint if exists catalog_product_preview_rights_exact,
  drop constraint if exists catalog_product_binder_sleeve_price_required,
  drop constraint if exists catalog_product_toploader_price_required,
  drop constraint if exists catalog_product_binder_sleeve_price_positive,
  drop constraint if exists catalog_product_toploader_price_positive;

drop function if exists catalog_private.require_catalog_product_format() cascade;
drop function if exists catalog_private.validate_catalog_product() cascade;
drop function if exists catalog_private.validate_catalog_product_duplicate() cascade;
drop function if exists catalog_private.catalog_identity_text(text) cascade;
drop function if exists catalog_private.protect_reviewed_product_preview_asset() cascade;
drop function if exists catalog_private.own_product_preview_record_fields() cascade;
drop function if exists catalog_private.validate_product_preview_rights_approval() cascade;
drop function if exists catalog_private.product_preview_text_list_is_complete(text[]) cascade;
drop function if exists catalog_private.product_preview_url_is_configured(text) cascade;
drop function if exists catalog_private.journal_catalog_product_change() cascade;
drop function if exists catalog_private.catalog_product_journal_for_product(uuid) cascade;
drop function if exists catalog_private.require_catalog_recovery_approval(text, text[]) cascade;
drop function if exists catalog_private.recover_catalog_product_fields(uuid, bigint, text[], text, text[]) cascade;
drop function if exists catalog_private.hard_delete_catalog_product(uuid, text, text[]) cascade;
drop function if exists catalog_private.enqueue_catalog_invalidation() cascade;

delete from vault.secrets
where name in ('catalog_invalidation_origin', 'catalog_invalidation_secret');

drop table catalog_private.catalog_product_journal cascade;
drop table catalog_private.product_preview_rights cascade;
drop table catalog_private.product_preview_configuration cascade;
drop table catalog_private.catalog_rarities cascade;

drop index if exists catalog_private.catalog_product_normalized_identity_idx;
drop index if exists catalog_private.catalog_product_normalized_design_unique_idx;
drop index if exists catalog_private.catalog_product_rarity_idx;
drop index if exists catalog_private.catalog_product_preview_rights_idx;
drop index if exists catalog_private.catalog_product_active_updated_idx;

alter table catalog_private.catalog_products
  rename column rarity_code to rarity;

alter table catalog_private.catalog_products
  alter column is_active set default true,
  alter column is_active set not null,
  drop column format_code,
  drop column product_preview_rights_id,
  drop column archived_at,
  add constraint catalog_product_rarity_valid check (
    rarity is null or rarity in ('C', 'U', 'R', 'RR', 'AR', 'SR', 'SAR', 'UR')
  ),
  add constraint catalog_product_binder_sleeve_price_positive check (
    binder_sleeve_price is null or binder_sleeve_price > 0
  ),
  add constraint catalog_product_toploader_price_positive check (
    toploader_price is null or toploader_price > 0
  ),
  add constraint catalog_product_format_option_required check (
    binder_sleeve_price is not null or toploader_price is not null
  ),
  add constraint catalog_product_preview_url_https check (
    product_preview_url is null
    or (
      octet_length(product_preview_url) <= 2048
      and product_preview_url ~ '^https://[^[:space:]]+$'
    )
  );

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
  if new.rarity is not null and new.rarity !~ '[^[:space:]]' then new.rarity := null; end if;
  if new.product_preview_url is not null and new.product_preview_url !~ '[^[:space:]]' then new.product_preview_url := null; end if;
  return new;
end;
$$;

create trigger catalog_product_01_canonicalize
before insert or update on catalog_private.catalog_products
for each row execute function catalog_private.canonicalize_catalog_product_text();

create trigger catalog_product_02_owned_fields
before insert or update on catalog_private.catalog_products
for each row execute function catalog_private.own_catalog_product_fields();

create index catalog_product_active_updated_idx
on catalog_private.catalog_products (updated_at)
where is_active;

alter table catalog_private.catalog_products enable row level security;
revoke all on catalog_private.catalog_products from public, anon, authenticated, service_role, catalog_runtime;
revoke all on schema catalog_private from public, anon, authenticated, service_role, catalog_runtime;
grant usage on schema catalog_private to catalog_runtime;
grant select on catalog_private.catalog_products to catalog_runtime;

create policy catalog_products_runtime_active_select
on catalog_private.catalog_products
for select to catalog_runtime
using (is_active);

drop role catalog_editor;
drop role catalog_recovery_operator;
drop role catalog_audit_owner;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-previews',
  'Product Previews',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;
drop policy if exists product_previews_public_read on storage.objects;
create policy product_previews_public_read
on storage.objects
for select to anon, authenticated
using (bucket_id = 'product-previews');

grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon, authenticated;
