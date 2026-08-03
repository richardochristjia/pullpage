import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProductPreview } from "@/app/product-preview";

const cloudinary = "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/pikachu/electric-bloom.png";
const supabase = "https://vozvldzmzfdohusojrfq.supabase.co/storage/v1/object/public/product-previews/pikachu.webp";

describe("Product Preview delivery seam", () => {
  test.each([cloudinary, supabase])("delivers an HTTPS Product Preview without provider-specific transformation", (source) => {
    const html = renderToStaticMarkup(createElement(ProductPreview, {
      url: source,
      alt: "Pikachu Product Preview",
      sizes: "138px",
    }));

    expect(html).toContain(`src="${source}"`);
    expect(html).not.toContain("/_next/image");
  });

  test("uses the branded placeholder for a non-HTTPS source", () => {
    const html = renderToStaticMarkup(createElement(ProductPreview, {
      url: "http://example.com/preview.png",
      alt: "Unsafe Product Preview",
      sizes: "138px",
    }));

    expect(html).toContain("Product Preview unavailable");
    expect(html).toContain("Preview coming soon");
    expect(html).not.toContain("http://example.com/preview.png");
  });
});
