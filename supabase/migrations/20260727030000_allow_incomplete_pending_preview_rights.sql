alter table catalog_private.product_preview_rights
  drop constraint product_preview_rights_attribution_paired,
  add constraint product_preview_rights_approved_attribution_complete check (
    status <> 'approved'
    or attribution_required is distinct from true
    or nullif(btrim(attribution_text), '') is not null
  );
