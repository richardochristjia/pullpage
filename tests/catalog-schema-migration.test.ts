import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, test } from "vitest";

const migrationPaths = [
  "20260730000000_simplify_catalog_source.sql",
  "20260803000000_canonicalize_product_preview_bucket_name.sql",
  "20260804000000_add_catalog_rarity_metadata.sql",
  "20260805000000_add_regional_printing_facts.sql",
  "20260806000000_add_spreadsheet_rarities.sql",
].map((migration) => join(process.cwd(), "supabase/migrations", migration));

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)]
    .sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

async function currentCatalogDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role catalog_runtime nologin;
    create role catalog_editor nologin;
    create role catalog_recovery_operator nologin;
    create role catalog_audit_owner nologin;

    create schema extensions;
    create schema catalog_private;
    create schema catalog_public;
    create schema storage;
    create schema vault;

    create function extensions.gen_random_bytes(bytes integer)
    returns bytea language sql volatile
    as $$ select decode(substr(md5(random()::text), 1, bytes * 2), 'hex') $$;

    create table catalog_private.catalog_rarities (
      code varchar(32) primary key,
      sort_position smallint not null unique
    );
    insert into catalog_private.catalog_rarities values
      ('C', 1), ('U', 2), ('R', 3), ('RR', 4),
      ('AR', 5), ('SR', 6), ('SAR', 7), ('UR', 8);

    create table catalog_private.product_preview_configuration (
      singleton boolean primary key default true,
      environment_name varchar(64) not null,
      cloud_name varchar(128) not null,
      asset_folder varchar(128) not null default 'catalog-products/'
    );
    insert into catalog_private.product_preview_configuration
      (environment_name, cloud_name) values ('test', 'pullpage-tests');

    create table catalog_private.product_preview_rights (
      id uuid primary key,
      exact_versioned_url varchar(2048),
      status varchar(16) not null,
      effective_on date,
      expires_on date
    );

    create table catalog_private.catalog_products (
      id uuid primary key default gen_random_uuid(),
      slug varchar(96) not null unique,
      card_name text,
      collector_number text,
      set_name text,
      rarity_code varchar(32),
      design_name text,
      format_code text not null,
      binder_sleeve_price integer,
      toploader_price integer,
      product_preview_url text,
      product_preview_rights_id uuid,
      archived_at timestamptz,
      created_at timestamptz not null default statement_timestamp(),
      updated_at timestamptz not null default statement_timestamp()
    );

    create function catalog_private.product_preview_rights_are_current(
      rights_id uuid,
      exact_url text,
      on_date date default current_date
    ) returns boolean language sql stable
    as $$
      select exists (
        select 1 from catalog_private.product_preview_rights r
        where r.id = rights_id
          and r.exact_versioned_url = exact_url
          and r.status = 'approved'
          and r.effective_on <= on_date
          and (r.expires_on is null or r.expires_on >= on_date)
      )
    $$;

    create function catalog_private.catalog_slug_base(
      card_name text,
      collector_number text,
      design_name text
    ) returns text language sql immutable
    as $$
      select trim(both '-' from regexp_replace(
        lower(concat_ws('-', card_name, collector_number, design_name)),
        '[^a-z0-9]+', '-', 'g'
      ))
    $$;

    create function catalog_private.own_catalog_product_fields()
    returns trigger language plpgsql
    as $$
    declare slug_base text;
    begin
      if tg_op = 'INSERT' then
        slug_base := catalog_private.catalog_slug_base(new.card_name, new.collector_number, new.design_name);
        if slug_base = '' then slug_base := 'catalog-product'; end if;
        new.slug := slug_base || '-' || encode(extensions.gen_random_bytes(4), 'hex');
        new.created_at := statement_timestamp();
        new.updated_at := statement_timestamp();
        return new;
      end if;
      if new.id is distinct from old.id then raise exception 'id immutable'; end if;
      if new.slug is distinct from old.slug then raise exception 'slug immutable'; end if;
      if new.created_at is distinct from old.created_at then raise exception 'created immutable'; end if;
      new.updated_at := statement_timestamp();
      return new;
    end
    $$;

    create trigger catalog_product_02_owned_fields
      before insert or update on catalog_private.catalog_products
      for each row execute function catalog_private.own_catalog_product_fields();

    create table catalog_private.catalog_product_journal (journal_id bigint primary key);
    create view catalog_public.active_catalog_products as
      select * from catalog_private.catalog_products where archived_at is null;
    create view catalog_public.catalog_rarities as
      select * from catalog_private.catalog_rarities;

    alter table catalog_private.catalog_products enable row level security;
    create policy catalog_products_editor_select on catalog_private.catalog_products
      for select to catalog_editor using (true);
    create policy catalog_products_editor_insert on catalog_private.catalog_products
      for insert to catalog_editor with check (true);
    create policy catalog_products_editor_update on catalog_private.catalog_products
      for update to catalog_editor using (true) with check (true);

    create table vault.secrets (name text primary key);
    insert into vault.secrets values
      ('catalog_invalidation_origin'), ('catalog_invalidation_secret'), ('unrelated_secret');

    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (id bigint primary key, bucket_id text not null);
    insert into storage.objects values (99, 'product-previews');
    alter table storage.objects enable row level security;

    insert into catalog_private.product_preview_rights values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'https://res.cloudinary.com/pullpage-tests/image/upload/v1/catalog-products/current.webp',
       'approved', current_date - 1, null),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       'https://res.cloudinary.com/pullpage-tests/image/upload/v1/catalog-products/rejected.webp',
       'rejected', current_date - 1, null);

    alter table catalog_private.catalog_products disable trigger user;
    insert into catalog_private.catalog_products (
      id, slug, card_name, collector_number, rarity_code, format_code,
      binder_sleeve_price, toploader_price, product_preview_url,
      product_preview_rights_id, archived_at, created_at, updated_at
    ) values
      ('d6b1bd71-9f13-4679-9448-9b7526fa0cce', 'binder-current-11111111',
       'Binder Current', '1/3', 'AR', 'BS', 95000, 999,
       'https://res.cloudinary.com/pullpage-tests/image/upload/v1/catalog-products/current.webp',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
      ('16ff2fd6-efe0-436c-86b5-66ca7508c46a', 'toploader-inactive-22222222',
       'Toploader Inactive', '2/3', 'SR', 'TL', 888, 125000,
       'https://res.cloudinary.com/pullpage-tests/image/upload/v1/catalog-products/rejected.webp',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-01-03T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
      ('344ae84e-03ce-4f4a-8f47-21366edbe1c3', 'both-current-33333333',
       'Both Current', '3/3', null, 'ALL', 100000, 130000,
       null, null, null, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
      ('44444444-4444-4444-8444-444444444444', 'unrelated-future-row-44444444',
       'Unrelated Future Row', '4/4', null, 'BS', 100000, null,
       null, null, '2026-01-03T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z');
    alter table catalog_private.catalog_products enable trigger user;
  `);
  return db;
}

const databases: PGlite[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()));
});

async function migratedCatalogDatabase() {
  const database = await currentCatalogDatabase();
  databases.push(database);
  for (const migrationPath of migrationPaths) {
    await database.exec(readFileSync(migrationPath, "utf8"));
  }
  return database;
}

describe("simplified Catalog schema migration", { timeout: 15_000 }, () => {
  test("deletes only the designated products while replacing singular printing facts", async () => {
    const database = await migratedCatalogDatabase();

    const columns = await database.query<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_schema = 'catalog_private' and table_name = 'catalog_products'
      order by ordinal_position
    `);
    expect(columns.rows.map(({ column_name }) => column_name)).toEqual([
      "id", "slug", "card_name", "rarity", "design_name", "binder_sleeve_price",
      "toploader_price", "product_preview_url", "created_at", "updated_at", "is_active",
      "english_collector_number", "japanese_collector_number",
      "english_set_name", "japanese_set_name",
    ]);

    const products = await database.query("select id from catalog_private.catalog_products");
    expect(products.rows).toEqual([{ id: "44444444-4444-4444-8444-444444444444" }]);

    const rarities = await database.query("select code from catalog_private.catalog_rarities");
    expect(rarities.rows).toHaveLength(26);
    const previewObjects = await database.query("select id from storage.objects order by id");
    expect(previewObjects.rows).toEqual([{ id: 99 }]);
  });

  test("seeds configured Rarity names, display order, and accessible badge colors", async () => {
    const database = await migratedCatalogDatabase();

    const rarities = await database.query<{
      code: string;
      display_name: string;
      display_order: number;
      is_active: boolean;
      badge_background_color: string;
      badge_foreground_color: string;
    }>(`
      select code, display_name, display_order, is_active,
        badge_background_color, badge_foreground_color
      from catalog_private.catalog_rarities order by display_order
    `);

    expect(rarities.rows.map(({ code, display_name }) => [code, display_name])).toEqual([
      ["C", "Common"], ["U", "Uncommon"], ["R", "Rare"], ["RR", "Double Rare"],
      ["RRR", "Triple Rare"], ["PR", "Prism Rare"], ["TR", "Trainer Rare"],
      ["SR", "Super Rare"], ["HR", "Hyper Rare"], ["UR", "Ultra Rare"],
      ["K", "Radiant Pokémon rarity"], ["A", "Amazing Rare"], ["AR", "Art Rare"],
      ["SAR", "Special Art Rare"], ["S", "Shiny"], ["SSR", "Shiny Super Rare"],
      ["ACE", "ACE SPEC"], ["BWR", "Black White Rare"],
      ["MA", "Mega-era special rarity"], ["MUR", "Mega-era ultra rarity"],
      ["NO_MARK", "No mark"], ["CHR", "Character Rare"], ["PROMO", "Promo"],
      ["MIXED", "Mixed"], ["SR_AA", "Secret Rare Alternate Art"],
      ["VINTAGE", "Vintage"],
    ]);
    expect(rarities.rows.map(({ display_order }) => display_order)).toEqual(
      Array.from({ length: 26 }, (_, index) => index + 1),
    );
    expect(rarities.rows.every(({ is_active }) => is_active)).toBe(true);
    for (const rarity of rarities.rows) {
      expect(contrastRatio(
        rarity.badge_background_color,
        rarity.badge_foreground_color,
      ), rarity.code).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("keeps only simple row integrity and database-owned identity", async () => {
    const database = await migratedCatalogDatabase();

    await expect(database.exec(`
      insert into catalog_private.catalog_products (card_name)
      values ('Missing prices')
    `)).rejects.toThrow(/catalog_product_format_option_required/);
    await expect(database.exec(`
      insert into catalog_private.catalog_products (card_name, binder_sleeve_price)
      values ('Invalid price', 0)
    `)).rejects.toThrow(/catalog_product_binder_sleeve_price_positive/);
    await expect(database.exec(`
      insert into catalog_private.catalog_products (card_name, rarity, binder_sleeve_price)
      values ('Invalid rarity', 'SECRET', 1)
    `)).rejects.toThrow(/catalog_product_rarity_configured/);
    await expect(database.exec(`
      insert into catalog_private.catalog_products
        (card_name, binder_sleeve_price, product_preview_url)
      values ('Invalid preview', 1, 'http://example.com/preview.webp')
    `)).rejects.toThrow(/catalog_product_preview_url_https/);

    const inserted = await database.query<{
      id: string;
      slug: string;
      card_name: null;
      rarity: null;
      is_active: boolean;
    }>(`
      insert into catalog_private.catalog_products
        (card_name, japanese_collector_number, rarity, binder_sleeve_price)
      values ('   ', 'new-row', ' ', 5000)
      returning id, slug, card_name, rarity, is_active
    `);
    expect(inserted.rows[0]).toEqual({
      id: expect.stringMatching(/^[a-f0-9-]{36}$/),
      slug: expect.stringMatching(/^new-row-[a-f0-9]{8}$/),
      card_name: null,
      rarity: null,
      is_active: true,
    });

    const englishPreferred = await database.query<{ slug: string }>(`
      insert into catalog_private.catalog_products
        (card_name, english_collector_number, japanese_collector_number, binder_sleeve_price)
      values ('Preference', 'english-number', 'japanese-number', 5000)
      returning slug
    `);
    expect(englishPreferred.rows[0].slug).toMatch(/^preference-english-number-[a-f0-9]{8}$/);

    await expect(database.exec(`
      update catalog_private.catalog_products
      set slug = 'caller-controlled' where id = '${inserted.rows[0].id}'
    `)).rejects.toThrow(/slug is immutable/i);

    await database.exec(`
      insert into catalog_private.catalog_products
        (card_name, english_collector_number, binder_sleeve_price)
      values
        ('Duplicate allowed', 'same', 1),
        ('Duplicate allowed', 'same', 1)
    `);
    const duplicates = await database.query<{ count: number }>(`
      select count(*)::integer count
      from catalog_private.catalog_products
      where card_name = 'Duplicate allowed'
    `);
    expect(duplicates.rows).toEqual([{ count: 2 }]);
  });

  test("gives Prisma read-only access to active Catalog Products", async () => {
    const database = await migratedCatalogDatabase();

    await database.exec(`
      insert into catalog_private.catalog_products
        (card_name, binder_sleeve_price, is_active)
      values ('Visible', 1, true), ('Hidden', 1, false)
    `);

    await database.exec("set role catalog_runtime");
    try {
      const visible = await database.query<{ card_name: string }>(`
        select card_name from catalog_private.catalog_products order by card_name
      `);
      expect(visible.rows).toEqual([{ card_name: "Visible" }]);
      const rarities = await database.query<{ code: string }>(`
        select code from catalog_private.catalog_rarities order by display_order
      `);
      expect(rarities.rows).toHaveLength(26);
      await expect(database.exec(`
        update catalog_private.catalog_products set card_name = 'Runtime write'
      `)).rejects.toThrow(/permission denied/);
      await expect(database.exec(`
        update catalog_private.catalog_rarities set display_name = 'Runtime write'
      `)).rejects.toThrow(/permission denied/);
      await expect(database.exec(`
        insert into catalog_private.catalog_products (card_name, binder_sleeve_price)
        values ('Runtime insert', 1)
      `)).rejects.toThrow(/permission denied/);
      await expect(database.exec(`
        delete from catalog_private.catalog_products
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await database.exec("reset role");
    }

    await database.exec("update catalog_private.catalog_products set is_active = false");
    await database.exec("set role catalog_runtime");
    try {
      const empty = await database.query("select id from catalog_private.catalog_products");
      expect(empty.rows).toEqual([]);
    } finally {
      await database.exec("reset role");
    }
  });

  test("retires workflow objects and configures public Product Preview storage", async () => {
    const database = await migratedCatalogDatabase();

    const privateTables = await database.query<{ table_name: string }>(`
      select table_name from information_schema.tables
      where table_schema = 'catalog_private' and table_type = 'BASE TABLE'
      order by table_name
    `);
    expect(privateTables.rows).toEqual([
      { table_name: "catalog_products" },
      { table_name: "catalog_rarities" },
    ]);

    const obsoleteSchemas = await database.query<{ count: number }>(`
      select count(*)::integer count from information_schema.schemata
      where schema_name = 'catalog_public'
    `);
    expect(obsoleteSchemas.rows).toEqual([{ count: 0 }]);

    const obsoleteRoles = await database.query<{ count: number }>(`
      select count(*)::integer count from pg_roles
      where rolname in ('catalog_editor', 'catalog_recovery_operator', 'catalog_audit_owner')
    `);
    expect(obsoleteRoles.rows).toEqual([{ count: 0 }]);

    const retainedSecrets = await database.query<{ name: string }>(`
      select name from vault.secrets order by name
    `);
    expect(retainedSecrets.rows).toEqual([{ name: "unrelated_secret" }]);

    const bucket = await database.query(`
      select id, name, public, file_size_limit, allowed_mime_types
      from storage.buckets where id = 'product-previews'
    `);
    expect(bucket.rows).toEqual([{
      id: "product-previews",
      name: "product-previews",
      public: true,
      file_size_limit: 5242880,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    }]);

    await database.exec(`
      insert into storage.objects (id, bucket_id) values
        (1, 'product-previews'),
        (2, 'private-bucket')
    `);
    await database.exec("set role anon");
    try {
      const publicObjects = await database.query<{ id: number }>(`
        select id from storage.objects order by id
      `);
      expect(publicObjects.rows).toEqual([{ id: 1 }, { id: 99 }]);
      await expect(database.exec(`
        insert into storage.objects (id, bucket_id) values (3, 'product-previews')
      `)).rejects.toThrow(/permission denied/);
    } finally {
      await database.exec("reset role");
    }
  });
});
