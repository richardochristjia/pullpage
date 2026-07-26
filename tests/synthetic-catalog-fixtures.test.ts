import { describe, expect, test } from "vitest";
import { buildSyntheticCatalogFixtures } from "@/catalog/synthetic-fixtures";

const rarityCodes = ["C", "U", "R", "RR", "AR", "SR", "SAR", "UR"];

describe("synthetic Catalog fixtures", () => {
  test("deterministically covers the complete non-production qualification matrix", () => {
    const first = buildSyntheticCatalogFixtures();
    const second = buildSyntheticCatalogFixtures();
    expect(second).toEqual(first);
    expect(first.products).toHaveLength(501);
    expect(first.products.filter((product) => product.archivedAt === null)).toHaveLength(480);
    expect(new Set(first.products.map((product) => product.id)).size).toBe(501);
    expect(new Set(first.products.map((product) => product.rarityCode).filter(Boolean))).toEqual(new Set(rarityCodes));
    expect(new Set(first.products.map((product) => product.formatCode))).toEqual(new Set(["BS", "TL", "ALL"]));
    expect(first.products.some((product) => product.archivedAt !== null)).toBe(true);
    expect(first.products.some((product) => product.cardName === null && product.collectorNumber === null && product.setName === null)).toBe(true);
    const duplicateDepictions = first.products.filter((product) => product.collectorNumber === "DUP-001");
    expect(duplicateDepictions.map((product) => product.designName)).toEqual(["Synthetic Dawn", "Synthetic Dusk"]);
    expect(first.approvedRights).toMatchObject({ id: "20000000-0000-4000-8000-000000000001", status: "approved" });
    expect(first.products.some((product) => product.productPreviewRightsId === first.approvedRights.id)).toBe(true);
  });
});
