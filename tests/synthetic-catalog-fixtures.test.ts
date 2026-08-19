import { describe, expect, test } from "vitest";
import { buildSyntheticCatalogFixtures } from "@/catalog/synthetic-fixtures";

const rarities = ["C", "U", "R", "RR", "AR", "SR", "SAR", "UR"];

describe("synthetic Catalog fixtures", () => {
  test("deterministically covers the simplified local qualification matrix", () => {
    const first = buildSyntheticCatalogFixtures();
    const second = buildSyntheticCatalogFixtures();

    expect(second).toEqual(first);
    expect(first.products).toHaveLength(501);
    expect(first.products.filter((product) => product.isActive)).toHaveLength(480);
    expect(new Set(first.products.map((product) => product.id)).size).toBe(501);
    expect(new Set(first.products.map((product) => product.rarity).filter(Boolean))).toEqual(new Set(rarities));
    expect(first.products.some((product) => product.binderSleevePrice && product.toploaderPrice)).toBe(true);
    expect(first.products.some((product) => product.binderSleevePrice && !product.toploaderPrice)).toBe(true);
    expect(first.products.some((product) => !product.binderSleevePrice && product.toploaderPrice)).toBe(true);
    expect(first.products.some((product) => !product.isActive)).toBe(true);
    expect(first.products.some((product) =>
      product.cardName === null &&
      product.englishCollectorNumber === null && product.japaneseCollectorNumber === null &&
      product.englishSetName === null && product.japaneseSetName === null
    )).toBe(true);
    expect(first.products.some((product) => product.productPreviewUrl?.startsWith("https://"))).toBe(true);
  });
});
