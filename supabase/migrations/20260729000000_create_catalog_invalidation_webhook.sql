create extension if not exists pg_net with schema extensions;

create or replace function catalog_private.enqueue_catalog_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invalidation_origin text;
  invalidation_secret text;
begin
  select decrypted_secret into invalidation_origin
  from vault.decrypted_secrets where name = 'catalog_invalidation_origin' limit 1;
  select decrypted_secret into invalidation_secret
  from vault.decrypted_secrets where name = 'catalog_invalidation_secret' limit 1;

  if nullif(btrim(invalidation_origin), '') is null or nullif(btrim(invalidation_secret), '') is null then
    return null;
  end if;

  perform net.http_post(
    url := rtrim(invalidation_origin, '/') || '/api/catalog/invalidate',
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || invalidation_secret),
    body := jsonb_build_object(
      'type', tg_op,
      'schema', tg_table_schema,
      'table', tg_table_name,
      'commit_timestamp', statement_timestamp()
    ),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

revoke all on function catalog_private.enqueue_catalog_invalidation() from public, anon, authenticated, catalog_runtime, catalog_editor, catalog_recovery_operator;
alter function catalog_private.enqueue_catalog_invalidation() owner to postgres;

drop trigger if exists catalog_product_99_invalidate on catalog_private.catalog_products;
create trigger catalog_product_99_invalidate
after insert or update or delete on catalog_private.catalog_products
for each statement execute function catalog_private.enqueue_catalog_invalidation();
