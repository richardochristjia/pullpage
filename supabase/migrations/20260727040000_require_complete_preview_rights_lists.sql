create or replace function catalog_private.product_preview_text_list_is_complete(value text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    cardinality(value) > 0
    and not exists (
      select 1 from unnest(value) item where nullif(btrim(item), '') is null
    ),
    false
  );
$$;

alter table catalog_private.product_preview_rights
  add constraint product_preview_rights_approved_lists_complete check (
    status <> 'approved'
    or (
      catalog_private.product_preview_text_list_is_complete(channels)
      and catalog_private.product_preview_text_list_is_complete(territories)
    )
  );
