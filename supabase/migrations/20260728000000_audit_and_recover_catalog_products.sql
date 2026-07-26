do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'catalog_audit_owner') then
    create role catalog_audit_owner nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'catalog_recovery_operator') then
    create role catalog_recovery_operator nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'catalog_editor') then
    create role catalog_editor nologin noinherit;
  end if;
end
$$;

grant catalog_audit_owner, catalog_editor, catalog_recovery_operator to postgres;
grant usage, create on schema catalog_private to catalog_audit_owner, catalog_recovery_operator;

create table catalog_private.catalog_product_journal (
  journal_id bigint generated always as identity primary key,
  operation text not null constraint catalog_product_journal_operation check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  product_id uuid not null,
  product_slug varchar(96) not null,
  occurred_at timestamptz(6) not null default transaction_timestamp(),
  database_role name not null,
  transaction_id text not null,
  old_row jsonb,
  new_row jsonb,
  change_reason text,
  approved_by text[],
  constraint catalog_product_journal_row_shape check (
    (operation = 'INSERT' and old_row is null and new_row is not null)
    or (operation = 'UPDATE' and old_row is not null and new_row is not null)
    or (operation = 'DELETE' and old_row is not null and new_row is null)
  ),
  constraint catalog_product_journal_reason_nonblank check (change_reason is null or btrim(change_reason) <> '')
);

alter table catalog_private.catalog_product_journal owner to catalog_audit_owner;
alter sequence catalog_private.catalog_product_journal_journal_id_seq owner to catalog_audit_owner;
revoke all on catalog_private.catalog_product_journal from public, anon, authenticated, service_role, catalog_runtime, catalog_editor;
revoke all on sequence catalog_private.catalog_product_journal_journal_id_seq from public, anon, authenticated, service_role, catalog_runtime, catalog_editor;
grant select on catalog_private.catalog_product_journal to catalog_recovery_operator;

create or replace function catalog_private.journal_catalog_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor name;
  reason text;
  approvers text[];
begin
  actor := coalesce(nullif(current_setting('role', true), 'none'), session_user)::name;
  reason := nullif(current_setting('catalog.change_reason', true), '');
  if nullif(current_setting('catalog.approved_by', true), '') is not null then
    select array_agg(value order by ordinal)
      into approvers
      from jsonb_array_elements_text(current_setting('catalog.approved_by', true)::jsonb)
        with ordinality as approval(value, ordinal);
  end if;

  insert into catalog_private.catalog_product_journal (
    operation, product_id, product_slug, occurred_at, database_role, transaction_id,
    old_row, new_row, change_reason, approved_by
  ) values (
    tg_op,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op = 'DELETE' then old.slug else new.slug end,
    transaction_timestamp(),
    actor,
    pg_current_xact_id()::text,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    reason,
    approvers
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

alter function catalog_private.journal_catalog_product_change() owner to catalog_audit_owner;
revoke all on function catalog_private.journal_catalog_product_change() from public, anon, authenticated, service_role, catalog_runtime, catalog_editor, catalog_recovery_operator;

create trigger catalog_product_90_journal
  after insert or update or delete on catalog_private.catalog_products
  for each row execute function catalog_private.journal_catalog_product_change();

create or replace function catalog_private.require_catalog_recovery_approval(
  reason text,
  approvers text[]
) returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if reason is null or btrim(reason) = '' then
    raise exception using
      errcode = '22023', message = 'A documented recovery reason is required.';
  end if;
  if approvers is null or (
    select count(distinct lower(btrim(value))) from unnest(approvers) value where btrim(value) <> ''
  ) < 2 then
    raise exception using
      errcode = '22023', message = 'Two distinct named approvers are required.';
  end if;
end;
$$;

create or replace function catalog_private.recover_catalog_product_fields(
  target_product_id uuid,
  source_journal_id bigint,
  fields text[],
  reason text,
  approvers text[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_fields constant text[] := array[
    'card_name', 'collector_number', 'set_name', 'rarity_code', 'design_name',
    'format_code', 'binder_sleeve_price', 'toploader_price',
    'product_preview_url', 'product_preview_rights_id', 'archived_at'
  ];
  source_before jsonb;
  current_row catalog_private.catalog_products%rowtype;
  recovered_row catalog_private.catalog_products%rowtype;
  recovered_json jsonb;
  field_name text;
begin
  perform catalog_private.require_catalog_recovery_approval(reason, approvers);
  if fields is null or cardinality(fields) = 0 then
    raise exception using errcode = '22023', message = 'At least one recoverable field is required.';
  end if;
  if exists (select 1 from unnest(fields) value where not (value = any(allowed_fields))) then
    raise exception using errcode = '22023', message = 'Recovery requested a database-owned or unknown field.';
  end if;

  select old_row into source_before
  from catalog_private.catalog_product_journal
  where journal_id = source_journal_id
    and product_id = target_product_id
    and operation = 'UPDATE';
  if source_before is null then
    raise exception using errcode = 'P0002', message = 'The requested Catalog Product journal before-image was not found.';
  end if;

  select * into current_row
  from catalog_private.catalog_products
  where id = target_product_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'The Catalog Product to recover was not found.';
  end if;

  recovered_json := to_jsonb(current_row);
  foreach field_name in array fields loop
    recovered_json := jsonb_set(recovered_json, array[field_name], source_before -> field_name, true);
  end loop;
  select * into recovered_row
  from jsonb_populate_record(null::catalog_private.catalog_products, recovered_json);

  perform set_config('catalog.change_reason', btrim(reason), true);
  perform set_config('catalog.approved_by', to_jsonb(approvers)::text, true);

  update catalog_private.catalog_products set
    card_name = recovered_row.card_name,
    collector_number = recovered_row.collector_number,
    set_name = recovered_row.set_name,
    rarity_code = recovered_row.rarity_code,
    design_name = recovered_row.design_name,
    format_code = recovered_row.format_code,
    binder_sleeve_price = recovered_row.binder_sleeve_price,
    toploader_price = recovered_row.toploader_price,
    product_preview_url = recovered_row.product_preview_url,
    product_preview_rights_id = recovered_row.product_preview_rights_id,
    archived_at = recovered_row.archived_at
  where id = target_product_id;

  return target_product_id;
end;
$$;

create or replace function catalog_private.hard_delete_catalog_product(
  target_product_id uuid,
  reason text,
  approvers text[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived boolean;
begin
  perform catalog_private.require_catalog_recovery_approval(reason, approvers);
  select archived_at is not null into archived
  from catalog_private.catalog_products
  where id = target_product_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'The Catalog Product to delete was not found.';
  end if;
  if not archived then
    raise exception using
      errcode = '55000', message = 'A Catalog Product must be archived and publicly withdrawn before exceptional hard deletion.';
  end if;

  perform set_config('catalog.change_reason', btrim(reason), true);
  perform set_config('catalog.approved_by', to_jsonb(approvers)::text, true);
  delete from catalog_private.catalog_products where id = target_product_id;
  return target_product_id;
end;
$$;

alter function catalog_private.require_catalog_recovery_approval(text, text[]) owner to catalog_recovery_operator;
alter function catalog_private.recover_catalog_product_fields(uuid, bigint, text[], text, text[]) owner to catalog_recovery_operator;
alter function catalog_private.hard_delete_catalog_product(uuid, text, text[]) owner to catalog_recovery_operator;
revoke all on function catalog_private.require_catalog_recovery_approval(text, text[]) from public, anon, authenticated, service_role, catalog_runtime, catalog_editor;
revoke all on function catalog_private.recover_catalog_product_fields(uuid, bigint, text[], text, text[]) from public, anon, authenticated, service_role, catalog_runtime, catalog_editor;
revoke all on function catalog_private.hard_delete_catalog_product(uuid, text, text[]) from public, anon, authenticated, service_role, catalog_runtime, catalog_editor;
grant execute on function catalog_private.recover_catalog_product_fields(uuid, bigint, text[], text, text[]) to catalog_recovery_operator;
grant execute on function catalog_private.hard_delete_catalog_product(uuid, text, text[]) to catalog_recovery_operator;

grant usage on schema catalog_private to catalog_editor, catalog_recovery_operator;
grant select, insert, update on catalog_private.catalog_products to catalog_editor;
grant select, update, delete on catalog_private.catalog_products to catalog_recovery_operator;
grant select on catalog_private.catalog_rarities, catalog_private.product_preview_rights, catalog_private.product_preview_configuration to catalog_editor, catalog_recovery_operator;
revoke delete, truncate on catalog_private.catalog_products from catalog_editor;

create policy catalog_products_editor_select on catalog_private.catalog_products
  for select to catalog_editor using (true);
create policy catalog_products_editor_insert on catalog_private.catalog_products
  for insert to catalog_editor with check (true);
create policy catalog_products_editor_update on catalog_private.catalog_products
  for update to catalog_editor using (true) with check (true);
create policy catalog_products_recovery_select on catalog_private.catalog_products
  for select to catalog_recovery_operator using (true);
create policy catalog_products_recovery_update on catalog_private.catalog_products
  for update to catalog_recovery_operator using (true) with check (true);
create policy catalog_products_recovery_delete on catalog_private.catalog_products
  for delete to catalog_recovery_operator using (true);

revoke create on schema catalog_private from catalog_audit_owner, catalog_recovery_operator;
revoke catalog_audit_owner from postgres;
