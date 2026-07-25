import { describe, expect, test } from "vitest";
import type { PublicCatalogProduct } from "@/catalog/catalog";
import { applyCatalogView, UNKNOWN_RARITY_FILTER, type CatalogViewState } from "@/catalog/interactions";

const product = (overrides: Partial<PublicCatalogProduct>): PublicCatalogProduct => ({
  slug: "catalog-product-00000000",
  cardName: null,
  collectorNumber: null,
  setName: null,
  rarity: null,
  raritySortPosition: null,
  designName: null,
  previewUrl: null,
  formatOptions: [{ format: "Binder Sleeve", price: 100_000 }],
  ...overrides,
});

const initialState: CatalogViewState = {
  query: "",
  rarities: [],
  formats: [],
  minimumPrice: null,
  maximumPrice: null,
  sort: "card-asc",
};

describe("Catalog interactions", () => {
  test("searches supplied facts while ignoring case, accents, spaces, slashes, and hyphens", () => {
    const products = [
      product({ slug: "flabebe", cardName: "Flabébé", collectorNumber: "001/100", setName: "Set-One", designName: "Garden Glow" }),
      product({ slug: "missing" }),
    ];

    expect(applyCatalogView(products, { ...initialState, query: "FLA BE/BE" }).map(({ slug }) => slug)).toEqual(["flabebe"]);
    expect(applyCatalogView(products, { ...initialState, query: "001-100" }).map(({ slug }) => slug)).toEqual(["flabebe"]);
    expect(applyCatalogView(products, { ...initialState, query: "no name" })).toEqual([]);
  });

  test("combines OR selections within groups and AND across groups with selected-format inclusive prices", () => {
    const products = [
      product({
        slug: "both-ar",
        cardName: "Pikachu",
        rarity: "AR",
        raritySortPosition: 5,
        formatOptions: [
          { format: "Binder Sleeve", price: 90_000 },
          { format: "Toploader", price: 150_000 },
        ],
      }),
      product({ slug: "sleeve-sr", cardName: "Pikachu", rarity: "SR", raritySortPosition: 6 }),
      product({ slug: "unknown", cardName: "Pikachu" }),
      product({ slug: "other", cardName: "Eevee", rarity: "AR", raritySortPosition: 5 }),
    ];

    const matches = applyCatalogView(products, {
      ...initialState,
      query: "pika",
      rarities: ["AR", UNKNOWN_RARITY_FILTER],
      formats: ["Toploader"],
      minimumPrice: 150_000,
      maximumPrice: 150_000,
    });
    expect(matches.map(({ slug }) => slug)).toEqual(["both-ar"]);

    const anyFormat = applyCatalogView(products, {
      ...initialState,
      rarities: [UNKNOWN_RARITY_FILTER],
      minimumPrice: 100_000,
      maximumPrice: 100_000,
    });
    expect(anyFormat.map(({ slug }) => slug)).toEqual(["unknown"]);
  });

  test("sorts Card Name, eligible price, and configured Rarity with missing values last and stable ties", () => {
    const products = [
      product({ slug: "unknown", cardName: null }),
      product({ slug: "eevee-z", cardName: "Éevee", collectorNumber: "010", designName: "Zed", rarity: "SR", raritySortPosition: 6, formatOptions: [{ format: "Binder Sleeve", price: 120_000 }] }),
      product({ slug: "eevee-a", cardName: "Eevee", collectorNumber: "002", designName: "Alpha", rarity: "AR", raritySortPosition: 5, formatOptions: [{ format: "Binder Sleeve", price: 90_000 }] }),
      product({ slug: "bulba", cardName: "Bulbasaur", rarity: "AR", raritySortPosition: 5, formatOptions: [{ format: "Toploader", price: 90_000 }] }),
    ];
    const slugs = (sort: CatalogViewState["sort"], formats: CatalogViewState["formats"] = []) =>
      applyCatalogView(products, { ...initialState, sort, formats }).map(({ slug }) => slug);

    expect(slugs("card-asc")).toEqual(["bulba", "eevee-a", "eevee-z", "unknown"]);
    expect(slugs("card-desc")).toEqual(["eevee-a", "eevee-z", "bulba", "unknown"]);
    expect(slugs("price-asc", ["Binder Sleeve"])).toEqual(["eevee-a", "unknown", "eevee-z"]);
    expect(slugs("price-desc")).toEqual(["eevee-z", "unknown", "bulba", "eevee-a"]);
    expect(slugs("rarity-asc")).toEqual(["bulba", "eevee-a", "eevee-z", "unknown"]);
    expect(slugs("rarity-desc")).toEqual(["eevee-z", "bulba", "eevee-a", "unknown"]);

    const tied = [product({ slug: "same-z", cardName: "Same" }), product({ slug: "same-a", cardName: "Same" })];
    expect(applyCatalogView(tied, initialState).map(({ slug }) => slug)).toEqual(["same-a", "same-z"]);
    expect(applyCatalogView(tied, { ...initialState, sort: "card-desc" }).map(({ slug }) => slug)).toEqual(["same-a", "same-z"]);
  });
});
