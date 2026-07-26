create table catalog_private.product_preview_configuration (
  singleton boolean primary key default true,
  environment_name varchar(64) not null,
  cloud_name varchar(128) not null,
  asset_folder varchar(128) not null default 'catalog-products/',
  created_at timestamptz(6) not null default statement_timestamp(),
  updated_at timestamptz(6) not null default statement_timestamp(),
  constraint product_preview_configuration_singleton check (singleton),
  constraint product_preview_environment_nonblank check (btrim(environment_name) <> ''),
  constraint product_preview_cloud_name_valid check (cloud_name ~ '^[a-z0-9_-]+$'),
  constraint product_preview_folder_fixed check (asset_folder = 'catalog-products/')
);

create table catalog_private.product_preview_rights (
  id uuid primary key default extensions.gen_random_uuid(),
  exact_versioned_url varchar(2048),
  asset_identifier varchar(255),
  source text,
  creator_photographer varchar(500),
  owner_licensor varchar(500),
  permission_basis text,
  permission_evidence text,
  channels text[],
  territories text[],
  attribution_required boolean,
  attribution_text text,
  effective_on date,
  expires_on date,
  status varchar(16) not null default 'pending',
  reviewer varchar(500),
  reviewed_at timestamptz(6),
  takedown_notes text,
  created_at timestamptz(6) not null default statement_timestamp(),
  updated_at timestamptz(6) not null default statement_timestamp(),
  constraint product_preview_rights_status_valid check (status in ('pending', 'approved', 'rejected')),
  constraint product_preview_rights_dates_ordered check (
    effective_on is null or expires_on is null or expires_on >= effective_on
  ),
  constraint product_preview_rights_attribution_paired check (
    attribution_required is distinct from true or nullif(btrim(attribution_text), '') is not null
  ),
  constraint product_preview_rights_exact_url_unique unique (exact_versioned_url),
  constraint product_preview_rights_exact_pair_unique unique (id, exact_versioned_url)
);

create or replace function catalog_private.own_product_preview_record_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := statement_timestamp();
    new.updated_at := statement_timestamp();
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception using errcode = '23514', constraint = 'product_preview_rights_id_immutable',
      message = 'Product Preview rights ID is database-owned and cannot be changed.';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception using errcode = '23514', constraint = 'product_preview_rights_created_at_immutable',
      message = 'Product Preview rights creation time is database-owned and cannot be changed.';
  end if;
  if new.updated_at is distinct from old.updated_at then
    raise exception using errcode = '23514', constraint = 'product_preview_rights_updated_at_owned',
      message = 'Product Preview rights update time is database-owned.';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
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
  return new;
end;
$$;

create trigger product_preview_rights_01_owned_fields
before insert or update on catalog_private.product_preview_rights
for each row execute function catalog_private.own_product_preview_record_fields();
create trigger product_preview_rights_02_validate_approval
before insert or update on catalog_private.product_preview_rights
for each row execute function catalog_private.validate_product_preview_rights_approval();

alter table catalog_private.product_preview_configuration enable row level security;
alter table catalog_private.product_preview_rights enable row level security;
revoke all on catalog_private.product_preview_configuration from catalog_runtime;
revoke all on catalog_private.product_preview_rights from catalog_runtime;
