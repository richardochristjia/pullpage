import "server-only";

import { createHash } from "node:crypto";
import { isVersionedCloudinaryProductPreview } from "./product-preview-loader";

export type CatalogProjectionRow = {
  slug: string;
  card_name: string | null;
  collector_number: string | null;
  set_name: string | null;
  rarity_code: string | null;
  rarity_sort_position: number | null;
  design_name: string | null;
  format_code: "BS" | "TL" | "ALL";
  binder_sleeve_price: number | null;
  toploader_price: number | null;
  product_preview_url: string | null;
};

export type CatalogFormatOption = {
  format: "Binder Sleeve" | "Toploader";
  price: number;
};

export type PublicCatalogProduct = {
  slug: string;
  cardName: string | null;
  collectorNumber: string | null;
  setName: string | null;
  rarity: string | null;
  raritySortPosition: number | null;
  designName: string | null;
  previewUrl: string | null;
  formatOptions: CatalogFormatOption[];
};

export type CatalogGeneration = {
  id: string;
  generatedAt: string;
  products: PublicCatalogProduct[];
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{8}$/;
const MAX_CATALOG_PRODUCTS = 500;
const RARITY_POSITIONS = new Map([
  ["C", 1], ["U", 2], ["R", 3], ["RR", 4],
  ["AR", 5], ["SR", 6], ["SAR", 7], ["UR", 8],
]);

export class InvalidCatalogProjectionError extends Error {
  constructor() {
    super("The public Catalog projection is invalid");
    this.name = "InvalidCatalogProjectionError";
  }
}

function nullableText(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.trim().length > 0);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function optionalPositiveInteger(value: unknown): value is number | null {
  return value === null || positiveInteger(value);
}

function rowIsValid(row: CatalogProjectionRow) {
  const rarityIsValid = row.rarity_code === null
    ? row.rarity_sort_position === null
    : RARITY_POSITIONS.get(row.rarity_code) === row.rarity_sort_position;
  const formatsAreValid =
    (row.format_code === "BS" && positiveInteger(row.binder_sleeve_price) && optionalPositiveInteger(row.toploader_price)) ||
    (row.format_code === "TL" && optionalPositiveInteger(row.binder_sleeve_price) && positiveInteger(row.toploader_price)) ||
    (row.format_code === "ALL" && positiveInteger(row.binder_sleeve_price) && positiveInteger(row.toploader_price));

  return (
    row.slug.length <= 96 && SLUG.test(row.slug) &&
    nullableText(row.card_name) &&
    nullableText(row.collector_number) &&
    nullableText(row.set_name) &&
    nullableText(row.design_name) &&
    rarityIsValid &&
    formatsAreValid &&
    (row.product_preview_url === null || isVersionedCloudinaryProductPreview(row.product_preview_url))
  );
}

function toPublicCatalogProduct(row: CatalogProjectionRow): PublicCatalogProduct {
  const formatOptions: CatalogFormatOption[] = [];
  if (row.format_code === "BS" || row.format_code === "ALL") {
    formatOptions.push({ format: "Binder Sleeve", price: row.binder_sleeve_price! });
  }
  if (row.format_code === "TL" || row.format_code === "ALL") {
    formatOptions.push({ format: "Toploader", price: row.toploader_price! });
  }
  return {
    slug: row.slug,
    cardName: row.card_name,
    collectorNumber: row.collector_number,
    setName: row.set_name,
    rarity: row.rarity_code,
    raritySortPosition: row.rarity_sort_position,
    designName: row.design_name,
    previewUrl: row.product_preview_url,
    formatOptions,
  };
}

export function createCatalogGeneration(rows: CatalogProjectionRow[], generatedAt: Date): CatalogGeneration {
  const slugs = new Set<string>();
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_CATALOG_PRODUCTS) {
    throw new InvalidCatalogProjectionError();
  }
  for (const row of rows) {
    if (!row || typeof row !== "object" || !rowIsValid(row) || slugs.has(row.slug)) {
      throw new InvalidCatalogProjectionError();
    }
    slugs.add(row.slug);
  }

  const products = rows.map(toPublicCatalogProduct);
  const generatedAtIso = generatedAt.toISOString();
  const id = createHash("sha256")
    .update(JSON.stringify({ generatedAt: generatedAtIso, products }))
    .digest("hex")
    .slice(0, 16);
  return { id, generatedAt: generatedAtIso, products };
}
