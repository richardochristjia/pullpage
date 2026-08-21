import { describe, expect, test } from "vitest";
import type { PublicCatalogProduct } from "@/catalog/public-catalog-product";
import {
  buildWhatsAppOrderBody,
  buildWhatsAppOrderLink,
  buildWhatsAppOrderUrl,
} from "@/lib/whatsapp";

const baseProduct: PublicCatalogProduct = {
  slug: "pikachu-173-165-electric-bloom-a1b2c3d4",
  cardName: "Pikachu",
  englishCollectorNumber: null,
  japaneseCollectorNumber: null,
  englishSetName: null,
  japaneseSetName: null,
  rarity: null,
  designName: null,
  previewUrl: null,
  formatOptions: [],
};

describe("WhatsApp order body seam", () => {
  test("returns greeting + heading + URL when Format Options are absent and cardName is present", () => {
    expect(
      buildWhatsAppOrderBody({
        product: baseProduct,
        canonicalUrl: "https://example.test/p/pikachu",
      }),
    ).toBe(
      "Hi Kak! I'd like to order Pikachu\nhttps://example.test/p/pikachu",
    );
  });

  test("appends designName to the heading with an em dash when designName is present", () => {
    expect(
      buildWhatsAppOrderBody({
        product: { ...baseProduct, designName: "Electric Bloom" },
        canonicalUrl: "https://example.test/p/pikachu",
      }),
    ).toBe(
      "Hi Kak! I'd like to order Pikachu — Electric Bloom\nhttps://example.test/p/pikachu",
    );
  });

  test("falls back to 'No Name' when cardName is null", () => {
    expect(
      buildWhatsAppOrderBody({
        product: { ...baseProduct, cardName: null, designName: "Aurora Frame" },
        canonicalUrl: "https://example.test/p/aurora",
      }),
    ).toBe(
      "Hi Kak! I'd like to order No Name — Aurora Frame\nhttps://example.test/p/aurora",
    );
  });

  test("renders a single Binder Sleeve Format Option as IDR between heading and URL", () => {
    expect(
      buildWhatsAppOrderBody({
        product: {
          ...baseProduct,
          designName: "Electric Bloom",
          formatOptions: [{ format: "Binder Sleeve", price: 95_000 }],
        },
        canonicalUrl: "https://example.test/p/pikachu",
      }),
    ).toBe(
      "Hi Kak! I'd like to order Pikachu — Electric Bloom\nBinder Sleeve: Rp 95.000\nhttps://example.test/p/pikachu",
    );
  });

  test("renders a single Toploader Format Option as IDR when only that option exists", () => {
    expect(
      buildWhatsAppOrderBody({
        product: {
          ...baseProduct,
          designName: "Aurora Frame",
          formatOptions: [{ format: "Toploader", price: 80_000 }],
        },
        canonicalUrl: "https://example.test/p/aurora",
      }),
    ).toBe(
      "Hi Kak! I'd like to order Pikachu — Aurora Frame\nToploader: Rp 80.000\nhttps://example.test/p/aurora",
    );
  });

  test("renders Binder Sleeve before Toploader when both Format Options exist", () => {
    expect(
      buildWhatsAppOrderBody({
        product: {
          ...baseProduct,
          designName: "Electric Bloom",
          formatOptions: [
            { format: "Binder Sleeve", price: 95_000 },
            { format: "Toploader", price: 120_000 },
          ],
        },
        canonicalUrl: "https://example.test/p/pikachu",
      }),
    ).toBe(
      "Hi Kak! I'd like to order Pikachu — Electric Bloom\nBinder Sleeve: Rp 95.000\nToploader: Rp 120.000\nhttps://example.test/p/pikachu",
    );
  });
});

describe("WhatsApp order URL seam", () => {
  test("encodes the body into a wa.me URL with the configured business number", () => {
    expect(
      buildWhatsAppOrderUrl({
        whatsAppNumber: "6281234567890",
        body: "Hi Kak!\nhttps://example.test/p/pikachu",
      }),
    ).toBe(
      "https://wa.me/6281234567890?text=Hi%20Kak!%0Ahttps%3A%2F%2Fexample.test%2Fp%2Fpikachu",
    );
  });
});

describe("WhatsApp order link composition seam", () => {
  test("returns the body and the wa.me URL for the configured business number", () => {
    const product: PublicCatalogProduct = {
      ...baseProduct,
      designName: "Electric Bloom",
      formatOptions: [
        { format: "Binder Sleeve", price: 95_000 },
        { format: "Toploader", price: 120_000 },
      ],
    };
    const link = buildWhatsAppOrderLink({
      product,
      canonicalUrl: "https://example.test/p/pikachu",
      whatsAppNumber: "6281234567890",
    });
    expect(link.body).toBe(
      "Hi Kak! I'd like to order Pikachu — Electric Bloom\nBinder Sleeve: Rp 95.000\nToploader: Rp 120.000\nhttps://example.test/p/pikachu",
    );
    expect(link.url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    const params = new URL(link.url).searchParams;
    expect(params.get("text")).toBe(link.body);
  });
});
