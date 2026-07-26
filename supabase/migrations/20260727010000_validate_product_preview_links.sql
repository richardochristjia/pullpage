create or replace function catalog_private.product_preview_url_is_configured(value text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    octet_length(value) <= 2048
    and value ~ '^https://res[.]cloudinary[.]com/[a-z0-9_-]+/image/upload/v[1-9][0-9]*/catalog-products/([A-Za-z0-9_.~-]+/)*[A-Za-z0-9_.~-]+[.](avif|gif|jpe?g|png|webp)$'
    and exists (
      select 1
      from catalog_private.product_preview_configuration c
      where value like 'https://res.cloudinary.com/' || c.cloud_name || '/image/upload/v%/catalog-products/%'
    ),
    false
  );
$$;

create or replace function catalog_private.product_preview_rights_are_current(
  rights_id uuid,
  exact_url text,
  on_date date default current_date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from catalog_private.product_preview_rights r
    where r.id = rights_id
      and r.exact_versioned_url = exact_url
      and r.status = 'approved'
      and r.effective_on <= on_date
      and (r.expires_on is null or r.expires_on >= on_date)
      and catalog_private.product_preview_url_is_configured(r.exact_versioned_url)
  );
$$;

create or replace function catalog_private.validate_product_preview_rights_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' and (
    nullif(btrim(new.exact_versioned_url), '') is null or
    nullif(btrim(new.asset_identifier), '') is null or
    nullif(btrim(new.source), '') is null or
    nullif(btrim(new.creator_photographer), '') is null or
    nullif(btrim(new.owner_licensor), '') is null or
    nullif(btrim(new.permission_basis), '') is null or
    nullif(btrim(new.permission_evidence), '') is null or
    coalesce(cardinality(new.channels), 0) = 0 or
    coalesce(cardinality(new.territories), 0) = 0 or
    new.attribution_required is null or
    new.effective_on is null or
    nullif(btrim(new.reviewer), '') is null or
    new.reviewed_at is null
  ) then
    raise exception using
      errcode = '23514', constraint = 'product_preview_rights_approval_complete',
      message = 'Approved Product Preview rights require complete evidence and review fields.',
      hint = 'Complete the exact URL, asset, source, creator, owner, permission evidence, channels, territories, attribution decision, effective date, reviewer, and review time.';
  end if;
  if new.status = 'approved' and not catalog_private.product_preview_url_is_configured(new.exact_versioned_url) then
    raise exception using
      errcode = '23514', constraint = 'product_preview_rights_url_valid',
      message = 'Product Preview URL is not an approved versioned Cloudinary raster asset.',
      hint = 'Use an absolute HTTPS URL for the configured cloud under image/upload/v…/catalog-products/ with a supported raster extension.';
  end if;
  return new;
end;
$$;

alter table catalog_private.catalog_products
  add constraint catalog_product_preview_rights_exact
  foreign key (product_preview_rights_id, product_preview_url)
  references catalog_private.product_preview_rights (id, exact_versioned_url)
  on update restrict on delete restrict;

create or replace function catalog_private.validate_catalog_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.format_code not in ('BS', 'TL', 'ALL') then
    raise exception using errcode = '23514', constraint = 'catalog_product_format_valid',
      message = 'Supported Binder Formats must be BS, TL, or ALL.',
      hint = 'Choose BS for Binder Sleeve, TL for Toploader, or ALL for both.';
  end if;
  if new.binder_sleeve_price is not null and new.binder_sleeve_price <= 0 then
    raise exception using errcode = '23514', constraint = 'catalog_product_binder_sleeve_price_positive',
      message = 'Binder Sleeve price must be a positive whole-IDR amount.',
      hint = 'Enter a whole number greater than zero, without currency symbols or decimals.';
  end if;
  if new.toploader_price is not null and new.toploader_price <= 0 then
    raise exception using errcode = '23514', constraint = 'catalog_product_toploader_price_positive',
      message = 'Toploader price must be a positive whole-IDR amount.',
      hint = 'Enter a whole number greater than zero, without currency symbols or decimals.';
  end if;
  if new.format_code in ('BS', 'ALL') and new.binder_sleeve_price is null then
    raise exception using errcode = '23514', constraint = 'catalog_product_binder_sleeve_price_required',
      message = 'Binder Sleeve price is required for the selected format.',
      hint = 'Enter a positive whole-IDR Binder Sleeve price in the same save.';
  end if;
  if new.format_code in ('TL', 'ALL') and new.toploader_price is null then
    raise exception using errcode = '23514', constraint = 'catalog_product_toploader_price_required',
      message = 'Toploader price is required for the selected format.',
      hint = 'Enter a positive whole-IDR Toploader price in the same save.';
  end if;
  if new.rarity_code is not null and not exists (
    select 1 from catalog_private.catalog_rarities where code = new.rarity_code
  ) then
    raise exception using errcode = '23503', constraint = 'catalog_product_rarity_configured',
      message = 'Rarity is not configured for the Catalog.',
      hint = 'Choose a configured Rarity or clear the field for Unknown rarity.';
  end if;
  if (new.product_preview_url is null) <> (new.product_preview_rights_id is null) then
    raise exception using errcode = '23514', constraint = 'catalog_product_preview_pair',
      message = 'Product Preview URL and rights ID must be supplied together.',
      hint = 'Set both fields for the same preview, or clear both fields.';
  end if;
  if new.archived_at is null and new.product_preview_rights_id is not null
    and not catalog_private.product_preview_rights_are_current(new.product_preview_rights_id, new.product_preview_url)
  then
    raise exception using errcode = '23514', constraint = 'catalog_product_preview_rights_current',
      message = 'An active Catalog Product requires current approved Product Preview rights.',
      hint = 'Approve complete effective rights for this exact configured URL, or clear both preview fields.';
  end if;
  return new;
end;
$$;
