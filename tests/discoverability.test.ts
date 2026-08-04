import { describe, expect, test } from "vitest";
import { productSocialMetadataImage } from "@/catalog/product-metadata";
import {
  PRODUCTION_ORIGIN,
  catalogCanonical,
  indexingPolicy,
  productCanonical,
  productDiscoverability,
  productSocialImage,
} from "@/catalog/discoverability";

const product = {
  slug: "pikachu-173-165-electric-bloom-a1b2c3d4",
  cardName: "  Pikachu  ",
  collectorNumber: "173/165",
  setName: "Scarlet & Violet—151",
  rarity: { code: "SAR" },
  designName: " Electric   Bloom ",
  previewUrl: "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000001/catalog-products/pikachu/electric-bloom.png",
  formatOptions: [
    { format: "Binder Sleeve" as const, price: 95_000 },
    { format: "Toploader" as const, price: 120_000 },
  ],
};

describe("discoverability policy seam", () => {
  test("always emits query-free production canonicals", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://pullpage.vercel.app");
    expect(catalogCanonical()).toBe("https://pullpage.vercel.app/");
    expect(productCanonical(product.slug)).toBe(
      "https://pullpage.vercel.app/products/pikachu-173-165-electric-bloom-a1b2c3d4",
    );
  });

  test("builds bounded metadata from known facts and the lowest Format Option price", () => {
    expect(productDiscoverability(product)).toEqual({
      canonical: "https://pullpage.vercel.app/products/pikachu-173-165-electric-bloom-a1b2c3d4",
      title: "Pikachu — Electric Bloom",
      documentTitle: "Pikachu — Electric Bloom | Pullpage",
      description: "Pullpage extended card art. Collector Number 173/165. Set Name Scarlet & Violet—151. Rarity SAR. Formats Binder Sleeve and Toploader. Lowest price Rp 95.000.",
      socialImage: "https://res.cloudinary.com/pullpage-tests/image/upload/f_jpg,q_auto,c_pad,w_1200,h_630,b_rgb:08111f/v1700000001/catalog-products/pikachu/electric-bloom.png",
    });

    const sparse = productDiscoverability({
      ...product,
      cardName: null,
      collectorNumber: null,
      setName: null,
      rarity: null,
      designName: "  Aurora   Frame ",
      previewUrl: null,
      formatOptions: [{ format: "Toploader", price: 80_000 }],
    });
    expect(sparse.title).toBe("Extended Card Art — Aurora Frame");
    expect(sparse.description).toBe(
      "Pullpage extended card art. Formats Toploader. Lowest price Rp 80.000.",
    );
    expect(sparse.description).not.toMatch(/Unknown|No Name/);
    expect(sparse.socialImage).toBe("https://pullpage.vercel.app/pullpage-social.png");

    const bounded = productDiscoverability({
      ...product,
      cardName: "Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu",
      designName: "One Two Three Four Five",
      collectorNumber: "A collector number that must not be sliced in the middle of a word",
      setName: "A set name with many words that pushes the generated description past its limit",
    });
    expect(bounded.documentTitle.length).toBeLessThanOrEqual(65);
    expect(bounded.description.length).toBeLessThanOrEqual(160);
    expect(bounded.description).toContain("Formats Binder Sleeve and Toploader. Lowest price Rp 95.000.");
    expect(bounded.documentTitle).toBe("Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota | Pullpage");
    expect(bounded.description.endsWith(".")).toBe(true);
  });

  test("uses Cloudinary and Supabase Storage Product Previews for social imagery", () => {
    expect(productSocialImage(product.previewUrl)).toContain("f_jpg,q_auto,c_pad,w_1200,h_630,b_rgb:08111f");
    const supabase = "https://vozvldzmzfdohusojrfq.supabase.co/storage/v1/object/public/product-previews/pikachu.webp";
    expect(productSocialImage(supabase)).toBe(supabase);
    expect(productSocialImage("http://example.com/image.png")).toBe(
      "https://pullpage.vercel.app/pullpage-social.png",
    );
  });

  test("describes known-size social images without inventing dimensions for Storage previews", () => {
    const cloudinarySocial = productSocialImage(product.previewUrl);
    expect(productSocialMetadataImage(product.previewUrl, cloudinarySocial, "Pikachu")).toEqual({
      url: cloudinarySocial,
      width: 1200,
      height: 630,
      type: "image/jpeg",
      alt: "Pullpage Product Preview for Pikachu",
    });

    const supabase = "https://vozvldzmzfdohusojrfq.supabase.co/storage/v1/object/public/product-previews/pikachu.webp";
    expect(productSocialMetadataImage(supabase, supabase, "Pikachu")).toEqual({
      url: supabase,
      alt: "Pullpage Product Preview for Pikachu",
    });
  });

  test("indexes production and blocks every other environment", () => {
    expect(indexingPolicy("production")).toEqual({ index: true, follow: true });
    expect(indexingPolicy("preview")).toEqual({ index: false, follow: false });
    expect(indexingPolicy(undefined)).toEqual({ index: false, follow: false });
  });
});
