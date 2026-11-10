import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProductPreview } from "@/app/product-preview";
import { isOptimizablePreview } from "@/catalog/product-preview";

const cloudinary = "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000000/catalog-products/pikachu/electric-bloom.png";
const supabase = "https://vozvldzmzfdohusojrfq.supabase.co/storage/v1/object/public/product-previews/pikachu.webp";

describe("Product Preview delivery seam", () => {
  test.each([cloudinary, supabase])("serves an allowlisted Product Preview through the image optimizer", (source) => {
    const html = renderToStaticMarkup(createElement(ProductPreview, {
      url: source,
      alt: "Pikachu Product Preview",
      sizes: "138px",
    }));

    expect(html).toContain("/_next/image");
  });

  test("keeps the original URL for an HTTPS host outside the allowlist", () => {
    const source = "https://images.example.com/preview.png";
    const html = renderToStaticMarkup(createElement(ProductPreview, { url: source, alt: "Other host", sizes: "138px" }));

    expect(html).toContain(`src="${source}"`);
    expect(html).not.toContain("/_next/image");
  });

  test("keeps the original URL when the full lightbox asks for it", () => {
    const html = renderToStaticMarkup(createElement(ProductPreview, { url: cloudinary, alt: "Full", sizes: "90vw", original: true }));

    expect(html).toContain(`src="${cloudinary}"`);
  });

  test.each([
    ["https://pullpage-images.pullpage.workers.dev/a.png", true],
    [supabase, true],
    [cloudinary, true],
    ["https://x.supabase.co/storage/v1/object/sign/a.png", false],
    ["https://a.b.supabase.co/storage/v1/object/public/a.png", false],
    ["https://evilsupabase.co/storage/v1/object/public/a.png", false],
    ["https://images.example.com/a.png", false],
    ["http://res.cloudinary.com/a.png", false],
    ["not a url", false],
  ])("isOptimizablePreview(%s) is %s", (source, expected) => {
    expect(isOptimizablePreview(source)).toBe(expected);
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
