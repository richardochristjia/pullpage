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

export type PublicCatalogRarityFilterOption = PublicCatalogRarity & {
  productCount: number;
};

export type PublicCatalogProduct = {
  slug: string;
  cardName: string | null;
  englishCollectorNumber: string | null;
  japaneseCollectorNumber: string | null;
  englishSetName: string | null;
  japaneseSetName: string | null;
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

export type CatalogRarityFilterRead = CatalogRarityRead & {
  _count: { products: number };
};

export type CatalogProductRead = Pick<
  CatalogProduct,
  | "slug"
  | "cardName"
  | "englishCollectorNumber"
  | "japaneseCollectorNumber"
  | "englishSetName"
  | "japaneseSetName"
  | "designName"
  | "binderSleevePrice"
  | "toploaderPrice"
  | "productPreviewUrl"
> & { rarityDefinition: CatalogRarityRead | null };

export function toPublicCatalogRarityFilterOption(
  rarity: CatalogRarityFilterRead,
): PublicCatalogRarityFilterOption {
  const { _count, ...metadata } = rarity;
  return { ...metadata, productCount: _count.products };
}

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
    englishCollectorNumber: product.englishCollectorNumber,
    japaneseCollectorNumber: product.japaneseCollectorNumber,
    englishSetName: product.englishSetName,
    japaneseSetName: product.japaneseSetName,
    rarity: product.rarityDefinition,
    designName: product.designName,
    previewUrl: product.productPreviewUrl,
    formatOptions,
  };
}
