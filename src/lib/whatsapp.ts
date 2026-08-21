import "server-only";

import type { PublicCatalogProduct } from "@/catalog/public-catalog-product";
import { displayCatalogValue } from "@/catalog/presentation";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export type BuildWhatsAppOrderBodyInput = {
  product: PublicCatalogProduct;
  canonicalUrl: string;
};

export type BuildWhatsAppOrderUrlInput = {
  whatsAppNumber: string;
  body: string;
};

export type BuildWhatsAppOrderLinkInput = BuildWhatsAppOrderBodyInput & {
  whatsAppNumber: string;
};

export type WhatsAppOrderLink = {
  url: string;
  body: string;
};

export function buildWhatsAppOrderBody(input: BuildWhatsAppOrderBodyInput): string {
  const cardName = displayCatalogValue(input.product.cardName, "No Name");
  const heading = input.product.designName
    ? `${cardName} — ${input.product.designName}`
    : cardName;
  const lines: string[] = [`Hi Kak! I'd like to order ${heading}`];
  for (const option of input.product.formatOptions) {
    lines.push(`${option.format}: ${idr.format(option.price)}`);
  }
  lines.push(input.canonicalUrl);
  return lines.join("\n");
}

export function buildWhatsAppOrderUrl(input: BuildWhatsAppOrderUrlInput): string {
  return `https://wa.me/${input.whatsAppNumber}?text=${encodeURIComponent(input.body)}`;
}

export function buildWhatsAppOrderLink(input: BuildWhatsAppOrderLinkInput): WhatsAppOrderLink {
  const body = buildWhatsAppOrderBody(input);
  const url = buildWhatsAppOrderUrl({
    whatsAppNumber: input.whatsAppNumber,
    body,
  });
  return { body, url };
}