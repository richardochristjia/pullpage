import dotenv from "dotenv";
import { Pool } from "pg";
import { afterAll, describe, expect, test } from "vitest";
import { closeCatalog, listActiveCatalogProducts } from "@/catalog/catalog";

dotenv.config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.TEST_CATALOG_DATABASE_URL;
const adminDatabaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
const integration = databaseUrl && adminDatabaseUrl ? describe : describe.skip;

integration("Catalog database seam", () => {
  afterAll(closeCatalog);

  test("returns the seeded active Catalog Product as a public DTO", async () => {
    const products = await listActiveCatalogProducts({ databaseUrl });

    const seeded = products.find(({ collectorNumber }) => collectorNumber === "173/165");
    expect(seeded).toEqual({
      slug: expect.stringMatching(/^pikachu-173-165-electric-bloom-[a-f0-9]{8}$/),
      cardName: "Pikachu",
      collectorNumber: "173/165",
      setName: "Scarlet & Violet—151",
      rarity: "AR",
      raritySortPosition: 5,
      designName: "Electric Bloom",
      previewUrl: null,
      formatOptions: [{ format: "Binder Sleeve", price: 95_000 }],
    });
    expect(JSON.parse(JSON.stringify(products))).toEqual(products);
  });

  test("canonicalizes optional text and exposes configured Rarity and Format Options", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const inserted = await admin.query<{ id: string; slug: string; card_name: string; collector_number: null }>(`
      insert into catalog_private.catalog_products (
        card_name, collector_number, set_name, rarity_code, design_name,
        format_code, binder_sleeve_price, toploader_price
      ) values ('  Éevee  ', E' \t ', '', 'C', null, 'ALL', 90000, 120000)
      returning id, slug, card_name, collector_number
    `);

    try {
      expect(inserted.rows[0]).toMatchObject({
        card_name: "  Éevee  ",
        collector_number: null,
      });
      expect(inserted.rows[0].slug).toMatch(/^eevee-[a-f0-9]{8}$/);

      const product = (await listActiveCatalogProducts({ databaseUrl })).find(
        ({ slug }) => slug === inserted.rows[0].slug,
      );
      expect(product).toMatchObject({
        cardName: "  Éevee  ",
        collectorNumber: null,
        setName: null,
        rarity: "C",
        raritySortPosition: 1,
        formatOptions: [
          { format: "Binder Sleeve", price: 90_000 },
          { format: "Toploader", price: 120_000 },
        ],
      });
    } finally {
      await admin.query("delete from catalog_private.catalog_products where id = $1", [
        inserted.rows[0].id,
      ]);
      await admin.end();
    }
  });

  test("enforces configured Rarity and every Supported Binder Format price boundary", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const rarities = await admin.query<{ code: string; sort_position: number }>(
      "select code, sort_position from catalog_private.catalog_rarities order by sort_position",
    );
    expect(rarities.rows).toEqual([
      { code: "C", sort_position: 1 }, { code: "U", sort_position: 2 },
      { code: "R", sort_position: 3 }, { code: "RR", sort_position: 4 },
      { code: "AR", sort_position: 5 }, { code: "SR", sort_position: 6 },
      { code: "SAR", sort_position: 7 }, { code: "UR", sort_position: 8 },
    ]);

    const insert = (suffix: string, format: string | null, binder: number | null, top: number | null, rarity = "C") =>
      admin.query(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, rarity_code, format_code, binder_sleeve_price, toploader_price)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        ["Boundary", suffix, rarity, format, binder, top],
      );

    try {
      await expect(insert("missing-format", null, 1, 1)).rejects.toMatchObject({
        constraint: "catalog_product_format_required",
        hint: expect.stringMatching(/Choose BS/i),
      });
      await expect(insert("invalid-format", "BOX", 1, 1)).rejects.toMatchObject({
        constraint: "catalog_product_format_valid",
      });
      await expect(insert("negative-price", "BS", -1, null)).rejects.toMatchObject({
        constraint: "catalog_product_binder_sleeve_price_positive",
      });
      await expect(insert("fractional-price", "BS", 1.5, null)).rejects.toThrow(/integer|whole/i);
      await expect(insert("unknown-rarity", "BS", 1, null, "SECRET")).rejects.toMatchObject({
        constraint: "catalog_product_rarity_configured",
        hint: expect.stringMatching(/configured Rarity/i),
      });
      await expect(insert("bs-missing", "BS", null, 10)).rejects.toMatchObject({
        constraint: "catalog_product_binder_sleeve_price_required",
        hint: expect.stringMatching(/same save/i),
      });
      await expect(insert("tl-zero", "TL", 10, 0)).rejects.toMatchObject({
        constraint: "catalog_product_toploader_price_positive",
        hint: expect.stringMatching(/greater than zero/i),
      });
      await expect(insert("all-missing", "ALL", 10, null)).rejects.toMatchObject({
        constraint: "catalog_product_toploader_price_required",
      });

      const valid = await Promise.all([
        insert("bs-valid", "BS", 1, 99),
        insert("tl-valid", "TL", 99, 1),
        insert("all-valid", "ALL", 1, 2),
      ]);
      expect(valid).toHaveLength(3);
      const bsOnly = (await listActiveCatalogProducts({ databaseUrl })).find(
        ({ collectorNumber }) => collectorNumber === "bs-valid",
      );
      expect(bsOnly?.formatOptions).toEqual([{ format: "Binder Sleeve", price: 1 }]);
    } finally {
      await admin.query("delete from catalog_private.catalog_products where card_name = 'Boundary'");
      await admin.end();
    }
  });

  test("requires the reserved Product Preview linkage to be paired and keeps it private", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const id = "22222222-2222-4222-8222-222222222222";
    try {
      await expect(admin.query(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, format_code, binder_sleeve_price, product_preview_url)
         values ('Preview Pair', 'url-only', 'BS', 1, 'https://example.com/preview.png')`,
      )).rejects.toMatchObject({
        constraint: "catalog_product_preview_pair",
        hint: expect.stringMatching(/both fields/i),
      });
      await admin.query(
        `insert into catalog_private.catalog_products
          (id, card_name, collector_number, format_code, binder_sleeve_price,
           product_preview_url, product_preview_rights_id)
         values ($1, 'Preview Pair', 'paired', 'BS', 1,
           'https://example.com/preview.png', '33333333-3333-4333-8333-333333333333')`,
        [id],
      );
      const projected = await admin.query<{ product_preview_url: null }>(
        "select product_preview_url from catalog_public.active_catalog_products where collector_number = 'paired'",
      );
      expect(projected.rows).toEqual([{ product_preview_url: null }]);
    } finally {
      await admin.query("delete from catalog_private.catalog_products where id = $1", [id]);
      await admin.end();
    }
  });

  test("generates bounded random slugs and protects database-owned fields", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const row = await admin.query<{
      id: string; slug: string; created_at: Date; updated_at: Date;
    }>(`
      insert into catalog_private.catalog_products
        (slug, card_name, collector_number, format_code, binder_sleeve_price, created_at, updated_at)
      values ('caller-slug', repeat('Long Name ', 20), 'slug-lifecycle', 'BS', 1, '2000-01-01', '2000-01-01')
      returning id, slug, created_at, updated_at
    `);
    const product = row.rows[0];

    try {
      expect(product.slug).toMatch(/^[a-z0-9-]+-[a-f0-9]{8}$/);
      expect(product.slug).not.toBe("caller-slug");
      expect(product.slug.length).toBeLessThanOrEqual(81);
      expect(product.created_at.getUTCFullYear()).not.toBe(2000);
      expect(product.updated_at.getUTCFullYear()).not.toBe(2000);

      await expect(
        admin.query("update catalog_private.catalog_products set id = gen_random_uuid() where id = $1", [product.id]),
      ).rejects.toMatchObject({ constraint: "catalog_product_id_immutable" });
      await expect(
        admin.query("update catalog_private.catalog_products set slug = 'changed' where id = $1", [product.id]),
      ).rejects.toMatchObject({ constraint: "catalog_product_slug_immutable" });
      await expect(
        admin.query("update catalog_private.catalog_products set created_at = '2000-01-01' where id = $1", [product.id]),
      ).rejects.toMatchObject({ constraint: "catalog_product_created_at_immutable" });

      const edited = await admin.query<{ slug: string; updated_at: Date }>(
        "update catalog_private.catalog_products set set_name = 'Edited' where id = $1 returning slug, updated_at",
        [product.id],
      );
      expect(edited.rows[0].slug).toBe(product.slug);
      expect(edited.rows[0].updated_at.getTime()).toBeGreaterThanOrEqual(product.updated_at.getTime());

      const fallback = await admin.query<{ id: string; slug: string }>(
        "insert into catalog_private.catalog_products (format_code, binder_sleeve_price) values ('BS', 1) returning id, slug",
      );
      expect(fallback.rows[0].slug).toMatch(/^catalog-product-[a-f0-9]{8}$/);
      await admin.query("delete from catalog_private.catalog_products where id = $1", [fallback.rows[0].id]);
    } finally {
      await admin.query("delete from catalog_private.catalog_products where id = $1", [product.id]);
      await admin.end();
    }
  });

  test("enforces duplicate depiction Design Names across normalization, punctuation, and archives", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl });
    const ids: string[] = [];
    const insert = async (card: string, collector: string, set: string, design: string | null, archived = false) => {
      const result = await admin.query<{ id: string }>(
        `insert into catalog_private.catalog_products
          (card_name, collector_number, set_name, design_name, format_code, binder_sleeve_price, archived_at)
         values ($1, $2, $3, $4, 'BS', 1, $5) returning id`,
        [card, collector, set, design, archived ? new Date() : null],
      );
      ids.push(result.rows[0].id);
      return result.rows[0].id;
    };

    try {
      await insert("  Flabébé ", "001/100", "Set   One", "Garden", true);
      await expect(insert("\tflabebe\t", "001/100", "\tset one\t", null)).rejects.toMatchObject({
        constraint: "catalog_product_duplicate_requires_design_name",
      });
      await expect(insert("FLABÉBÉ", "001/100", "SET ONE", "  Gárden  ")).rejects.toMatchObject({
        constraint: "catalog_product_duplicate_design_name_unique",
      });
      await insert("flabebe", "001/100", "set one", "Night");
      await insert("flabebe!", "001/100", "set one", null);
    } finally {
      if (ids.length) await admin.query("delete from catalog_private.catalog_products where id = any($1::uuid[])", [ids]);
      await admin.end();
    }
  });

  test("serializes concurrent duplicate saves and rolls rejected transactions back atomically", async () => {
    const first = new Pool({ connectionString: adminDatabaseUrl });
    const second = new Pool({ connectionString: adminDatabaseUrl });
    const identity = `Concurrent-${Date.now()}`;
    const sql = `insert into catalog_private.catalog_products
      (card_name, collector_number, set_name, format_code, binder_sleeve_price)
      values ($1, 'same', 'same', 'BS', 1) returning id`;

    const concurrent = await Promise.allSettled([
      first.query<{ id: string }>(sql, [identity]),
      second.query<{ id: string }>(sql, [identity]),
    ]);
    expect(concurrent.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const before = await first.query<{ card_name: string; updated_at: Date }>(
      "select card_name, updated_at from catalog_private.catalog_products where id = '11111111-1111-4111-8111-111111111111'",
    );
    await first.query("begin");
    try {
      await first.query(
        "update catalog_private.catalog_products set card_name = 'Must Roll Back' where id = '11111111-1111-4111-8111-111111111111'",
      );
      await expect(
        first.query("update catalog_private.catalog_products set format_code = 'ALL', toploader_price = null where id = '11111111-1111-4111-8111-111111111111'"),
      ).rejects.toMatchObject({ constraint: "catalog_product_toploader_price_required" });
    } finally {
      await first.query("rollback");
    }
    const after = await first.query<{ card_name: string; updated_at: Date }>(
      "select card_name, updated_at from catalog_private.catalog_products where id = '11111111-1111-4111-8111-111111111111'",
    );
    expect(after.rows).toEqual(before.rows);

    await first.query("delete from catalog_private.catalog_products where card_name = $1", [identity]);
    await first.end();
    await second.end();
  });

  test("denies writes through the runtime database identity", async () => {
    const pool = new Pool({ connectionString: databaseUrl });

    await expect(
      pool.query("update catalog_private.catalog_products set card_name = 'Changed'"),
    ).rejects.toThrow(/permission denied/i);

    await pool.end();
  });
});
