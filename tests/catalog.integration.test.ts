import dotenv from "dotenv";
import { Pool } from "pg";
import { afterAll, describe, expect, test } from "vitest";
import {
  closeCatalog,
  getCatalogProduct,
  listActiveCatalogProducts,
  listCatalogRarityFilterOptions,
} from "@/catalog/catalog";
import { requireDisposableLocalDatabaseUrl } from "./support/local-database";

dotenv.config({ path: ".env.local", quiet: true });

const configuredRuntimeUrl = process.env.TEST_CATALOG_DATABASE_URL;
const configuredAdminUrl = process.env.LOCAL_MIGRATION_DATABASE_URL;
const localIntegrationConfigured = Boolean(configuredRuntimeUrl && configuredAdminUrl);
const databaseUrl = localIntegrationConfigured
  ? requireDisposableLocalDatabaseUrl(configuredRuntimeUrl, "TEST_CATALOG_DATABASE_URL")
  : undefined;
const adminDatabaseUrl = localIntegrationConfigured
  ? requireDisposableLocalDatabaseUrl(configuredAdminUrl, "LOCAL_MIGRATION_DATABASE_URL")
  : undefined;
const integration = localIntegrationConfigured ? describe : describe.skip;

integration("disposable local Catalog database seam", () => {
  afterAll(closeCatalog);

  test("maps active rows, both Format Options, and missing optional facts through Prisma", async () => {
    const products = await listActiveCatalogProducts({ databaseUrl });

    expect(products).toHaveLength(480);
    expect(products.find(({ collectorNumber }) => collectorNumber === "173/165")).toEqual({
      slug: expect.stringMatching(/^pikachu-173-165-electric-bloom-[a-f0-9]{8}$/),
      cardName: "Pikachu",
      collectorNumber: "173/165",
      setName: "Scarlet & Violet—151",
      rarity: {
        code: "AR",
        displayName: "Art Rare",
        displayOrder: 13,
        isActive: true,
        badgeBackgroundColor: "#CCFBF1",
        badgeForegroundColor: "#134E4A",
      },
      designName: "Electric Bloom",
      previewUrl: null,
      formatOptions: [{ format: "Binder Sleeve", price: 95_000 }],
    });
    expect(products.find(({ collectorNumber }) => collectorNumber === "synthetic-browser-2")).toMatchObject({
      rarity: {
        code: "R",
        displayName: "Rare",
        displayOrder: 3,
        isActive: true,
        badgeBackgroundColor: "#DBEAFE",
        badgeForegroundColor: "#1E3A8A",
      },
      formatOptions: [
        { format: "Binder Sleeve", price: 50_002 },
        { format: "Toploader", price: 70_002 },
      ],
    });
    expect(products.find(({ cardName, collectorNumber }) => cardName === null && collectorNumber === null)).toMatchObject({
      cardName: null,
      collectorNumber: null,
      setName: null,
      rarity: null,
      formatOptions: [{ format: "Toploader", price: 70_499 }],
    });
    expect(JSON.parse(JSON.stringify(products))).toEqual(products);
  });

  test("lists every active configured Rarity with its global active-product count", async () => {
    const rarities = await listCatalogRarityFilterOptions({ databaseUrl });

    expect(rarities).toHaveLength(21);
    expect(rarities.find(({ code }) => code === "AR")).toMatchObject({ productCount: 56 });
    expect(rarities.find(({ code }) => code === "RRR")).toMatchObject({ productCount: 0 });
    expect(rarities.map(({ displayOrder }) => displayOrder)).toEqual(
      Array.from({ length: 21 }, (_, index) => index + 1),
    );
  });

  test("omits an inactive Rarity from filters while retaining it as a product fact", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
    try {
      await admin.query("update catalog_private.catalog_rarities set is_active = false where code = 'AR'");

      const rarities = await listCatalogRarityFilterOptions({ databaseUrl });
      expect(rarities.some(({ code }) => code === "AR")).toBe(false);
      const products = await listActiveCatalogProducts({ databaseUrl });
      expect(products.find(({ collectorNumber }) => collectorNumber === "173/165")?.rarity).toMatchObject({
        code: "AR",
        isActive: false,
      });
    } finally {
      await admin.query("update catalog_private.catalog_rarities set is_active = true where code = 'AR'");
      await admin.end();
    }
  });

  test("keeps inactive Catalog Products absent from list and slug lookup", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
    try {
      const inactive = await admin.query<{ slug: string }>(`
        select slug from catalog_private.catalog_products
        where id = '10000000-0000-4000-8000-000000000500' and not is_active
      `);
      expect(inactive.rows).toHaveLength(1);

      const products = await listActiveCatalogProducts({ databaseUrl });
      expect(products.some(({ slug }) => slug === inactive.rows[0].slug)).toBe(false);
      expect(await getCatalogProduct(inactive.rows[0].slug, { databaseUrl })).toBeNull();
    } finally {
      await admin.end();
    }
  });

  test("enforces simple row constraints and database-owned identity", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
    let productId: string | undefined;
    try {
      await expect(admin.query(`
        insert into catalog_private.catalog_products (card_name)
        values ('Missing Format Option')
      `)).rejects.toMatchObject({ constraint: "catalog_product_format_option_required" });
      await expect(admin.query(`
        insert into catalog_private.catalog_products (card_name, binder_sleeve_price)
        values ('Invalid Price', 0)
      `)).rejects.toMatchObject({ constraint: "catalog_product_binder_sleeve_price_positive" });
      await expect(admin.query(`
        insert into catalog_private.catalog_products (card_name, rarity, binder_sleeve_price)
        values ('Invalid Rarity', 'SECRET', 1)
      `)).rejects.toMatchObject({ constraint: "catalog_product_rarity_configured" });
      await expect(admin.query(`
        insert into catalog_private.catalog_products
          (card_name, binder_sleeve_price, product_preview_url)
        values ('Invalid Preview', 1, 'http://example.com/preview.webp')
      `)).rejects.toMatchObject({ constraint: "catalog_product_preview_url_https" });

      const inserted = await admin.query<{
        id: string;
        slug: string;
        card_name: null;
        rarity: null;
        is_active: boolean;
      }>(`
        insert into catalog_private.catalog_products
          (card_name, collector_number, rarity, binder_sleeve_price, toploader_price)
        values ('   ', 'integration-current', ' ', 90000, 120000)
        returning id, slug, card_name, rarity, is_active
      `);
      productId = inserted.rows[0].id;
      expect(inserted.rows[0]).toEqual({
        id: expect.stringMatching(/^[a-f0-9-]{36}$/),
        slug: expect.stringMatching(/^integration-current-[a-f0-9]{8}$/),
        card_name: null,
        rarity: null,
        is_active: true,
      });
      await expect(admin.query(
        "update catalog_private.catalog_products set slug = 'caller-controlled' where id = $1",
        [productId],
      )).rejects.toMatchObject({ constraint: "catalog_product_slug_immutable" });
    } finally {
      if (productId) {
        await admin.query("delete from catalog_private.catalog_products where id = $1", [productId]);
      }
      await admin.end();
    }
  });

  test("gives the runtime identity active-only SELECT access", async () => {
    const runtime = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      const visible = await runtime.query<{ is_active: boolean }>(`
        select is_active from catalog_private.catalog_products
      `);
      expect(visible.rows.length).toBeGreaterThan(0);
      expect(visible.rows.every(({ is_active }) => is_active)).toBe(true);
      const rarities = await runtime.query<{ code: string }>(`
        select code from catalog_private.catalog_rarities order by display_order
      `);
      expect(rarities.rows).toHaveLength(21);
      expect(rarities.rows.at(-1)).toEqual({ code: "NO_MARK" });
      await expect(runtime.query(`
        insert into catalog_private.catalog_products (card_name, binder_sleeve_price)
        values ('Runtime Insert', 1)
      `)).rejects.toThrow(/permission denied/i);
      await expect(runtime.query(`
        update catalog_private.catalog_products set card_name = 'Runtime Update'
      `)).rejects.toThrow(/permission denied/i);
      await expect(runtime.query(`
        delete from catalog_private.catalog_products
      `)).rejects.toThrow(/permission denied/i);
    } finally {
      await runtime.end();
    }
  });

  test("accepts zero active Catalog Products as a successful empty read", async () => {
    const admin = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
    const active = await admin.query<{ id: string }>(`
      select id from catalog_private.catalog_products where is_active
    `);
    try {
      await admin.query("update catalog_private.catalog_products set is_active = false where is_active");
      await expect(listActiveCatalogProducts({ databaseUrl })).resolves.toEqual([]);
    } finally {
      if (active.rows.length > 0) {
        await admin.query(
          "update catalog_private.catalog_products set is_active = true where id = any($1::uuid[])",
          [active.rows.map(({ id }) => id)],
        );
      }
      await admin.end();
    }
  });
});
