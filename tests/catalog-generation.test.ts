import { describe, expect, test } from "vitest";
import { createCatalogGeneration, type CatalogProjectionRow } from "@/catalog/catalog-generation";

const row = (overrides: Partial<CatalogProjectionRow> = {}): CatalogProjectionRow => ({
  slug: "pikachu-001-001-electric-frame-0123abcd",
  card_name: "Pikachu",
  collector_number: "001/001",
  set_name: "Generation Test",
  rarity_code: "AR",
  rarity_sort_position: 5,
  design_name: "Electric Frame",
  format_code: "ALL",
  binder_sleeve_price: 90_000,
  toploader_price: 120_000,
  product_preview_url: "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/generation/pikachu.png",
  ...overrides,
});

describe("Catalog generation seam", () => {
  test("builds one deterministic complete generation from a valid public projection", () => {
    const generatedAt = new Date("2026-07-28T12:00:00.000Z");
    const first = createCatalogGeneration([row()], generatedAt);
    const second = createCatalogGeneration([row()], generatedAt);

    expect(first).toEqual(second);
    expect(first.generatedAt).toBe("2026-07-28T12:00:00.000Z");
    expect(first.products).toEqual([{
      slug: "pikachu-001-001-electric-frame-0123abcd",
      cardName: "Pikachu",
      collectorNumber: "001/001",
      setName: "Generation Test",
      rarity: "AR",
      raritySortPosition: 5,
      designName: "Electric Frame",
      previewUrl: "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/generation/pikachu.png",
      formatOptions: [
        { format: "Binder Sleeve", price: 90_000 },
        { format: "Toploader", price: 120_000 },
      ],
    }]);
    expect(first.id).toMatch(/^[a-f0-9]{16}$/);
    expect(createCatalogGeneration([row({ card_name: "Raichu" })], generatedAt).id).not.toBe(first.id);
  });

  test.each([
    ["an unexpected empty result", []],
    ["one malformed row", [row(), row({ slug: "bad" })]],
    ["a duplicate slug", [row(), row()]],
    ["an unsupported or missing Format Option", [row({ format_code: "ALL", toploader_price: null })]],
    ["an inconsistent Rarity", [row({ rarity_code: "AR", rarity_sort_position: null })]],
    ["an unconfigured Rarity", [row({ rarity_code: "SECRET", rarity_sort_position: 9 })]],
    ["an unsafe Product Preview", [row({ product_preview_url: "https://example.com/private.jpg" })]],
    ["more than 500 products", Array.from({ length: 501 }, (_, index) => row({ slug: `product-${index.toString().padStart(3, "0")}-${index.toString(16).padStart(8, "0")}` }))],
  ])("rejects the whole projection when it contains %s", (_label, rows) => {
    expect(() => createCatalogGeneration(rows as CatalogProjectionRow[], new Date())).toThrow("The public Catalog projection is invalid");
  });
});
