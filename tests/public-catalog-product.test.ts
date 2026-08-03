import { describe, expect, test } from "vitest";
import { toPublicCatalogProduct, type CatalogProductRead } from "@/catalog/public-catalog-product";

const row = (overrides: Partial<CatalogProductRead> = {}): CatalogProductRead => ({
  slug: "pikachu-001-001-electric-frame-0123abcd",
  cardName: "Pikachu",
  collectorNumber: "001/001",
  setName: "Generation Test",
  rarity: "AR",
  designName: "Electric Frame",
  binderSleevePrice: 90_000,
  toploaderPrice: 120_000,
  productPreviewUrl: "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/generation/pikachu.png",
  ...overrides,
});

describe("public Catalog Product seam", () => {
  test("derives public Format Options and Rarity order from one active Catalog Product", () => {
    expect(toPublicCatalogProduct(row())).toEqual({
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
    });
  });

  test("derives only the Format Option whose price exists", () => {
    expect(toPublicCatalogProduct(row({ rarity: null, toploaderPrice: null }))).toMatchObject({
      rarity: null,
      raritySortPosition: null,
      formatOptions: [{ format: "Binder Sleeve", price: 90_000 }],
    });
  });
});
