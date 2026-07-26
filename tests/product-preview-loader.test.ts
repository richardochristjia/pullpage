import { describe, expect, test } from "vitest";
import { productPreviewLoader } from "@/catalog/product-preview-loader";

const source = "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/pikachu/electric-bloom.png";

describe("Product Preview loader seam", () => {
  test("emits immutable non-cropping automatic Cloudinary variants at the requested width", () => {
    expect(productPreviewLoader({ src: source, width: 276, quality: undefined })).toBe(
      "https://res.cloudinary.com/pullpage-tests/image/upload/f_auto,q_auto,c_limit,w_276/v1700000000/catalog-products/pikachu/electric-bloom.png",
    );
    expect(productPreviewLoader({ src: source, width: 960, quality: 75 })).toBe(
      "https://res.cloudinary.com/pullpage-tests/image/upload/f_auto,q_auto,c_limit,w_960/v1700000000/catalog-products/pikachu/electric-bloom.png",
    );
  });
});
