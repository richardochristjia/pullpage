import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WhatsAppOrderCta } from "@/app/whatsapp-order-cta";

describe("WhatsAppOrderCta rendering seam", () => {
  test("renders nothing when url is undefined", () => {
    const html = renderToString(createElement(WhatsAppOrderCta, { url: undefined }));
    expect(html).not.toContain("Order via WhatsApp");
    expect(html).not.toMatch(/wa\.me\//);
  });

  test("renders the Order via WhatsApp anchor with the supplied wa.me URL when url is set", () => {
    const url = "https://wa.me/6281234567890?text=Hi%20Kak!";
    const html = renderToString(createElement(WhatsAppOrderCta, { url }));
    expect(html).toContain("Order via WhatsApp");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noopener");
  });
});
