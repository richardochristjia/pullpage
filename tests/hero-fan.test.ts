import { describe, expect, test } from "vitest";
import { DEFAULT_HERO_CARDS, pickHeroFeaturedCards } from "@/app/hero-fan";
import type { PublicCatalogProduct } from "@/catalog/catalog";

const mockProduct = (overrides: Partial<PublicCatalogProduct>): PublicCatalogProduct => ({
  slug: "test-slug",
  cardName: null,
  englishCollectorNumber: null,
  japaneseCollectorNumber: null,
  englishSetName: null,
  japaneseSetName: null,
  rarity: null,
  designName: null,
  previewUrl: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  formatOptions: [{ format: "Binder Sleeve", price: 79_000 }],
  ...overrides,
});

describe("pickHeroFeaturedCards", () => {
  test("returns DEFAULT_HERO_CARDS when empty products list is passed", () => {
    const cards = pickHeroFeaturedCards([]);
    expect(cards).toEqual(DEFAULT_HERO_CARDS);
    expect(cards[0].cardName).toBe("Greninja Terastal");
    expect(cards[1].cardName).toBe("Xerneas");
    expect(cards[2].cardName).toBe("Paldean Gardevoir");
  });

  test("picks Greninja, Xerneas, and Paldean Gardevoir when present in catalog", () => {
    const products = [
      mockProduct({
        slug: "greninja-terastal-214-167-akagi-a9d32fdb",
        cardName: "Greninja Terastal",
        englishCollectorNumber: "214/167",
        designName: "Akagi",
        previewUrl: "https://example.com/greninja.png",
      }),
      mockProduct({
        slug: "random-pikachu",
        cardName: "Pikachu",
      }),
      mockProduct({
        slug: "xerneas-091-086-yashiro-nanaco-896c81c8",
        cardName: "Xerneas",
        englishCollectorNumber: "091/086",
        designName: "Yashiro Nanaco",
        previewUrl: "https://example.com/xerneas.png",
      }),
      mockProduct({
        slug: "paldean-gardevoir-233-091-kuroimori-9adeceb5",
        cardName: "Paldean Gardevoir",
        englishCollectorNumber: "233/091",
        designName: "Kuroimori",
        previewUrl: "https://example.com/gardevoir.png",
      }),
    ];

    const cards = pickHeroFeaturedCards(products);
    expect(cards[0].slug).toBe("greninja-terastal-214-167-akagi-a9d32fdb");
    expect(cards[0].cardName).toBe("Greninja Terastal");
    expect(cards[0].collectorNumber).toBe("214/167");

    expect(cards[1].slug).toBe("xerneas-091-086-yashiro-nanaco-896c81c8");
    expect(cards[1].cardName).toBe("Xerneas");
    expect(cards[1].collectorNumber).toBe("091/086");

    expect(cards[2].slug).toBe("paldean-gardevoir-233-091-kuroimori-9adeceb5");
    expect(cards[2].cardName).toBe("Paldean Gardevoir");
    expect(cards[2].collectorNumber).toBe("233/091");
  });
});
