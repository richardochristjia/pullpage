import type { CatalogProduct, CatalogRarity } from "@/generated/prisma/client";

export type CatalogFormatOption = {
  format: "Binder Sleeve" | "Toploader";
  price: number;
};

export type PublicCatalogRarity = {
  code: string;
  displayName: string;
  displayOrder: number;
  isActive: boolean;
  badgeBackgroundColor: string;
  badgeForegroundColor: string;
};

export type PublicCatalogProduct = {
  slug: string;
  cardName: string | null;
  collectorNumber: string | null;
  setName: string | null;
  rarity: PublicCatalogRarity | null;
  designName: string | null;
  previewUrl: string | null;
  formatOptions: CatalogFormatOption[];
};

type CatalogRarityRead = Pick<
  CatalogRarity,
  | "code"
  | "displayName"
  | "displayOrder"
  | "isActive"
  | "badgeBackgroundColor"
  | "badgeForegroundColor"
>;

export type CatalogProductRead = Pick<
  CatalogProduct,
  | "slug"
  | "cardName"
  | "collectorNumber"
  | "setName"
  | "designName"
  | "binderSleevePrice"
  | "toploaderPrice"
  | "productPreviewUrl"
> & { rarityDefinition: CatalogRarityRead | null };

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
    rarity: product.rarityDefinition,
    designName: product.designName,
    previewUrl: product.productPreviewUrl,
    formatOptions,
  };
}
