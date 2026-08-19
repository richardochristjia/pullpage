set lock_timeout = '5s';
set statement_timeout = '30s';

insert into catalog_private.catalog_rarities (
  code, display_name, display_order, is_active,
  badge_background_color, badge_foreground_color
) values
  ('CHR',     'Character Rare',             22, true, '#ECFDF5', '#065F46'),
  ('PROMO',   'Promo',                      23, true, '#EFF6FF', '#1E40AF'),
  ('MIXED',   'Mixed',                      24, true, '#F3F4F6', '#1F2937'),
  ('SR_AA',   'Secret Rare Alternate Art', 25, true, '#FFF7ED', '#9A3412'),
  ('VINTAGE', 'Vintage',                    26, true, '#FEF2F2', '#991B1B');
