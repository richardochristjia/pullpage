import dotenv from "dotenv";
import { Pool } from "pg";
import { afterAll, describe, expect, test } from "vitest";
import { closeCatalog, listActiveCatalogProducts } from "@/catalog/catalog";

dotenv.config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.TEST_CATALOG_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("Catalog database seam", () => {
  afterAll(closeCatalog);

  test("returns the seeded active Catalog Product as a public DTO", async () => {
    const products = await listActiveCatalogProducts({ databaseUrl });

    expect(products).toEqual([
      {
        slug: "pikachu-173-165-electric-bloom-11111111",
        cardName: "Pikachu",
        collectorNumber: "173/165",
        setName: "Scarlet & Violet—151",
        rarity: "AR",
        designName: "Electric Bloom",
        previewUrl: null,
        formatOptions: [{ format: "Binder Sleeve", price: 95_000 }],
      },
    ]);
    expect(JSON.parse(JSON.stringify(products))).toEqual(products);
  });

  test("denies writes through the runtime database identity", async () => {
    const pool = new Pool({ connectionString: databaseUrl });

    await expect(
      pool.query("update catalog_private.catalog_products set card_name = 'Changed'"),
    ).rejects.toThrow(/permission denied/i);

    await pool.end();
  });
});
