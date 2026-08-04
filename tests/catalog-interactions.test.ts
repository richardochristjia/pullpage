import { describe, expect, test } from "vitest";
import type { PublicCatalogProduct } from "@/catalog/catalog";
import {
  applyCatalogView,
  catalogStateFromSearchParams,
  catalogStateToSearchParams,
  catalogStateWithAvailableRarities,
  UNKNOWN_RARITY_FILTER,
  type CatalogViewState,
} from "@/catalog/interactions";

const rarity = (code: string, displayOrder: number) => ({
  code,
  displayName: code,
  displayOrder,
  isActive: true,
  badgeBackgroundColor: "#FFFFFF",
  badgeForegroundColor: "#000000",
});

const product = (overrides: Partial<PublicCatalogProduct>): PublicCatalogProduct => ({
  slug: "catalog-product-00000000",
  cardName: null,
  collectorNumber: null,
  setName: null,
  rarity: null,
  designName: null,
  previewUrl: null,
  formatOptions: [{ format: "Binder Sleeve", price: 100_000 }],
  ...overrides,
});

const initialState: CatalogViewState = {
  query: "",
  rarities: [],
  format: "any",
  minimumPrice: null,
  maximumPrice: null,
  sort: "card-asc",
};

describe("Catalog interactions", () => {
  test("ignores inactive Rarities from shared Catalog URLs", () => {
    const state = catalogStateFromSearchParams(new URLSearchParams(
      "rarity=AR&rarity=SR&rarity=__unknown_rarity__",
    ));

    expect(catalogStateWithAvailableRarities(state, [{ code: "AR" }]).rarities).toEqual([
      "AR",
      UNKNOWN_RARITY_FILTER,
    ]);
  });

  test("searches supplied facts while ignoring case, accents, spaces, slashes, and hyphens", () => {
    const products = [
      product({ slug: "flabebe", cardName: "Flabébé", collectorNumber: "001/100", setName: "Set-One", designName: "Garden Glow" }),
      product({ slug: "missing" }),
    ];

    expect(applyCatalogView(products, { ...initialState, query: "FLA BE/BE" }).map(({ slug }) => slug)).toEqual(["flabebe"]);
    expect(applyCatalogView(products, { ...initialState, query: "001-100" }).map(({ slug }) => slug)).toEqual(["flabebe"]);
    expect(applyCatalogView(products, { ...initialState, query: "no name" })).toEqual([]);
  });

  test("filters by one explicit Supported Binder Format and uses the displayed Starting Price", () => {
    const products = [
      product({
        slug: "both-ar",
        cardName: "Pikachu",
        rarity: rarity("AR", 13),
        formatOptions: [
          { format: "Binder Sleeve", price: 90_000 },
          { format: "Toploader", price: 150_000 },
        ],
      }),
      product({ slug: "sleeve-sr", cardName: "Pikachu", rarity: rarity("SR", 8) }),
      product({ slug: "unknown", cardName: "Pikachu" }),
      product({ slug: "other", cardName: "Eevee", rarity: rarity("AR", 13) }),
    ];

    const matches = applyCatalogView(products, {
      ...initialState,
      query: "pika",
      rarities: ["AR", UNKNOWN_RARITY_FILTER],
      format: "toploader",
      minimumPrice: 150_000,
      maximumPrice: 150_000,
    });
    expect(matches.map(({ slug }) => slug)).toEqual(["both-ar"]);

    const bothFormats = applyCatalogView(products, {
      ...initialState,
      format: "both",
      minimumPrice: 90_000,
      maximumPrice: 90_000,
    });
    expect(bothFormats.map(({ slug }) => slug)).toEqual(["both-ar"]);

    const anyFormat = applyCatalogView(products, {
      ...initialState,
      rarities: [UNKNOWN_RARITY_FILTER],
      minimumPrice: 100_000,
      maximumPrice: 100_000,
    });
    expect(anyFormat.map(({ slug }) => slug)).toEqual(["unknown"]);
  });

  test("round-trips the shareable Catalog view while rejecting unsupported URL values", () => {
    const state = catalogStateFromSearchParams(new URLSearchParams(
      "q=pika+chu&rarity=AR&rarity=__unknown_rarity__&format=toploader&min=70000&max=90000&sort=price-desc&view=list&show=48",
    ));

    expect(state).toEqual({
      query: "pika chu",
      rarities: ["AR", UNKNOWN_RARITY_FILTER],
      format: "toploader",
      minimumPrice: 70_000,
      maximumPrice: 90_000,
      sort: "price-desc",
      view: "list",
      visibleCount: 48,
    });
    expect(catalogStateToSearchParams(state).toString()).toBe(
      "q=pika+chu&rarity=AR&rarity=__unknown_rarity__&format=toploader&min=70000&max=90000&sort=price-desc&view=list&show=48",
    );
    expect(catalogStateFromSearchParams(new URLSearchParams(
      "format=unsupported&min=-1&max=nope&sort=random&view=tiles&show=7",
    ))).toMatchObject({
      format: "any",
      minimumPrice: null,
      maximumPrice: null,
      sort: "card-asc",
      view: "grid",
      visibleCount: 24,
    });
  });

  test("sorts Card Name, eligible price, and configured Rarity with missing values last and stable ties", () => {
    const products = [
      product({ slug: "unknown", cardName: null }),
      product({ slug: "eevee-z", cardName: "Éevee", collectorNumber: "010", designName: "Zed", rarity: rarity("SR", 8), formatOptions: [{ format: "Binder Sleeve", price: 120_000 }] }),
      product({ slug: "eevee-a", cardName: "Eevee", collectorNumber: "002", designName: "Alpha", rarity: rarity("AR", 13), formatOptions: [{ format: "Binder Sleeve", price: 90_000 }] }),
      product({ slug: "bulba", cardName: "Bulbasaur", rarity: rarity("AR", 13), formatOptions: [{ format: "Toploader", price: 90_000 }] }),
    ];
    const slugs = (sort: CatalogViewState["sort"], format: CatalogViewState["format"] = "any") =>
      applyCatalogView(products, { ...initialState, sort, format }).map(({ slug }) => slug);

    expect(slugs("card-asc")).toEqual(["bulba", "eevee-a", "eevee-z", "unknown"]);
    expect(slugs("card-desc")).toEqual(["eevee-a", "eevee-z", "bulba", "unknown"]);
    expect(slugs("price-asc", "binder-sleeve")).toEqual(["eevee-a", "unknown", "eevee-z"]);
    expect(slugs("price-desc")).toEqual(["eevee-z", "unknown", "bulba", "eevee-a"]);
    expect(slugs("rarity-asc")).toEqual(["eevee-z", "bulba", "eevee-a", "unknown"]);
    expect(slugs("rarity-desc")).toEqual(["bulba", "eevee-a", "eevee-z", "unknown"]);

    const tied = [product({ slug: "same-z", cardName: "Same" }), product({ slug: "same-a", cardName: "Same" })];
    expect(applyCatalogView(tied, initialState).map(({ slug }) => slug)).toEqual(["same-a", "same-z"]);
    expect(applyCatalogView(tied, { ...initialState, sort: "card-desc" }).map(({ slug }) => slug)).toEqual(["same-a", "same-z"]);
  });
});
