create or replace function catalog_private.protect_reviewed_product_preview_asset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.reviewed_at is not null and (
    new.exact_versioned_url is distinct from old.exact_versioned_url
    or new.asset_identifier is distinct from old.asset_identifier
  ) then
    raise exception using
      errcode = '23514', constraint = 'product_preview_rights_asset_immutable',
      message = 'A reviewed Product Preview asset and exact versioned URL cannot be replaced in place.',
      hint = 'Create and approve a new rights record, link it, verify it publicly, and only then retire the old asset.';
  end if;
  return new;
end;
$$;

create trigger product_preview_rights_00_protect_reviewed_asset
before update of exact_versioned_url, asset_identifier
on catalog_private.product_preview_rights
for each row execute function catalog_private.protect_reviewed_product_preview_asset();
