grant catalog_audit_owner to postgres;
grant create on schema catalog_private to catalog_audit_owner;

create or replace function catalog_private.catalog_product_journal_for_product(target_product_id uuid)
returns setof catalog_private.catalog_product_journal
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from catalog_private.catalog_product_journal
  where product_id = target_product_id
  order by journal_id;
$$;

alter function catalog_private.catalog_product_journal_for_product(uuid) owner to catalog_audit_owner;
revoke all on function catalog_private.catalog_product_journal_for_product(uuid) from public, anon, authenticated, service_role, catalog_runtime, catalog_editor;
grant execute on function catalog_private.catalog_product_journal_for_product(uuid) to postgres, catalog_recovery_operator;

revoke create on schema catalog_private from catalog_audit_owner;
