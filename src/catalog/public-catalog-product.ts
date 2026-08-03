import type { CatalogProduct } from "@/generated/prisma/client";

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

export type CatalogProductRead = Pick<
  CatalogProduct,
  | "slug"
  | "cardName"
  | "collectorNumber"
  | "setName"
  | "rarity"
  | "designName"
  | "binderSleevePrice"
  | "toploaderPrice"
  | "productPreviewUrl"
>;

const RARITY_SORT_POSITIONS = new Map<string, number>([
  ["C", 1], ["U", 2], ["R", 3], ["RR", 4],
  ["AR", 5], ["SR", 6], ["SAR", 7], ["UR", 8],
]);

export function toPublicCatalogProduct(product: CatalogProductRead): PublicCatalogProduct {
  const formatOptions: CatalogFormatOption[] = [];
  if (product.binderSleevePrice !== null) {
    formatOptions.push({ format: "Binder Sleeve", price: product.binderSleevePrice });
  }
  if (product.toploaderPrice !== null) {
    formatOptions.push({ format: "Toploader", price: product.toploaderPrice });
  }

  return {
    slug: product.slug,
    cardName: product.cardName,
    collectorNumber: product.collectorNumber,
    setName: product.setName,
    rarity: product.rarity,
    raritySortPosition: product.rarity === null ? null : RARITY_SORT_POSITIONS.get(product.rarity) ?? null,
    designName: product.designName,
    previewUrl: product.productPreviewUrl,
    formatOptions,
  };
}
