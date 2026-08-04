import { describe, expect, test } from "vitest";
import { toPublicCatalogProduct, type CatalogProductRead } from "@/catalog/public-catalog-product";

const row = (overrides: Partial<CatalogProductRead> = {}): CatalogProductRead => ({
  slug: "pikachu-001-001-electric-frame-0123abcd",
  cardName: "Pikachu",
  collectorNumber: "001/001",
  setName: "Mapping Test",
  rarityDefinition: {
    code: "AR",
    displayName: "Art Rare",
    displayOrder: 13,
    isActive: true,
    badgeBackgroundColor: "#CCFBF1",
    badgeForegroundColor: "#134E4A",
  },
  designName: "Electric Frame",
  binderSleevePrice: 90_000,
  toploaderPrice: 120_000,
  productPreviewUrl: "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/mapping/pikachu.png",
  ...overrides,
});

describe("public Catalog Product seam", () => {
  test("maps configured Rarity metadata and derives public Format Options", () => {
    expect(toPublicCatalogProduct(row())).toEqual({
      slug: "pikachu-001-001-electric-frame-0123abcd",
      cardName: "Pikachu",
      collectorNumber: "001/001",
      setName: "Mapping Test",
      rarity: {
        code: "AR",
        displayName: "Art Rare",
        displayOrder: 13,
        isActive: true,
        badgeBackgroundColor: "#CCFBF1",
        badgeForegroundColor: "#134E4A",
      },
      designName: "Electric Frame",
      previewUrl: "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/mapping/pikachu.png",
      formatOptions: [
        { format: "Binder Sleeve", price: 90_000 },
        { format: "Toploader", price: 120_000 },
      ],
    });
  });

  test("derives only the Format Option whose price exists", () => {
    expect(toPublicCatalogProduct(row({ rarityDefinition: null, toploaderPrice: null }))).toMatchObject({
      rarity: null,
      formatOptions: [{ format: "Binder Sleeve", price: 90_000 }],
    });
  });
});
