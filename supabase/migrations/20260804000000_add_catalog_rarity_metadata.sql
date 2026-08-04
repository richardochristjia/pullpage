-- migration-safety: expand/backfill/contract
-- migration-safety: finite-lock-and-statement-timeouts
-- migration-safety: two-person-approval
-- migration-safety: compatibility-window
-- migration-safety: recovery-threshold
-- Rarity is configured reference data: products retain the compatibility-safe
-- `rarity` column while its values now reference metadata used by the UI.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table catalog_private.catalog_rarities (
  code varchar(32) primary key,
  display_name text not null,
  display_order smallint not null unique,
  is_active boolean not null default true,
  badge_background_color varchar(7) not null,
  badge_foreground_color varchar(7) not null,
  constraint catalog_rarity_code_valid check (code ~ '^[A-Z][A-Z_]*$'),
  constraint catalog_rarity_display_name_nonblank check (btrim(display_name) <> ''),
  constraint catalog_rarity_display_order_positive check (display_order > 0),
  constraint catalog_rarity_badge_background_color_valid
    check (badge_background_color ~ '^#[0-9A-F]{6}$'),
  constraint catalog_rarity_badge_foreground_color_valid
    check (badge_foreground_color ~ '^#[0-9A-F]{6}$')
);

insert into catalog_private.catalog_rarities (
  code, display_name, display_order, badge_background_color, badge_foreground_color
) values
  ('C',       'Common',                    1,  '#E5E7EB', '#1F2937'),
  ('U',       'Uncommon',                  2,  '#DCFCE7', '#14532D'),
  ('R',       'Rare',                      3,  '#DBEAFE', '#1E3A8A'),
  ('RR',      'Double Rare',               4,  '#E0E7FF', '#312E81'),
  ('RRR',     'Triple Rare',               5,  '#EDE9FE', '#4C1D95'),
  ('PR',      'Prism Rare',                6,  '#CFFAFE', '#164E63'),
  ('TR',      'Trainer Rare',              7,  '#FEF3C7', '#78350F'),
  ('SR',      'Super Rare',                8,  '#FEF9C3', '#713F12'),
  ('HR',      'Hyper Rare',                9,  '#FFEDD5', '#7C2D12'),
  ('UR',      'Ultra Rare',                10, '#FDE68A', '#713F12'),
  ('K',       'Radiant Pokémon rarity',    11, '#FCE7F3', '#831843'),
  ('A',       'Amazing Rare',              12, '#FFE4E6', '#881337'),
  ('AR',      'Art Rare',                  13, '#CCFBF1', '#134E4A'),
  ('SAR',     'Special Art Rare',          14, '#FAE8FF', '#701A75'),
  ('S',       'Shiny',                     15, '#F3F4F6', '#111827'),
  ('SSR',     'Shiny Super Rare',          16, '#F3E8FF', '#581C87'),
  ('ACE',     'ACE SPEC',                  17, '#FEE2E2', '#7F1D1D'),
  ('BWR',     'Black White Rare',          18, '#111827', '#F9FAFB'),
  ('MA',      'Mega-era special rarity',   19, '#D1FAE5', '#064E3B'),
  ('MUR',     'Mega-era ultra rarity',     20, '#1E1B4B', '#F5F3FF'),
  ('NO_MARK', 'No mark',                   21, '#F3F4F6', '#374151');

alter table catalog_private.catalog_products
  drop constraint catalog_product_rarity_valid,
  add constraint catalog_product_rarity_configured
    foreign key (rarity) references catalog_private.catalog_rarities(code) not valid;

alter table catalog_private.catalog_products
  validate constraint catalog_product_rarity_configured;

create index catalog_product_rarity_idx
  on catalog_private.catalog_products (rarity);

grant select on catalog_private.catalog_rarities to catalog_runtime;
