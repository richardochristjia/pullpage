import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ShareProduct } from "@/app/share-product";

describe("ShareProduct WhatsApp CTA rendering seam", () => {
  test("omits the Order via WhatsApp anchor when whatsAppUrl is undefined", () => {
    const html = renderToString(
      createElement(ShareProduct, {
        canonical: "https://example.test/p/pikachu",
        whatsAppUrl: undefined,
      }),
    );
    expect(html).not.toContain("Order via WhatsApp");
    expect(html).not.toMatch(/wa\.me\//);
  });

  test("renders the Order via WhatsApp anchor with the supplied wa.me URL when whatsAppUrl is set", () => {
    const url = "https://wa.me/6281234567890?text=Hi%20Kak!";
    const html = renderToString(
      createElement(ShareProduct, {
        canonical: "https://example.test/p/pikachu",
        whatsAppUrl: url,
      }),
    );
    expect(html).toContain("Order via WhatsApp");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noopener");
  });
});