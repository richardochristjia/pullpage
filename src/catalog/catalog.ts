import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { cacheLife } from "next/cache";
import { PrismaClient } from "@/generated/prisma/client";
import {
  toPublicCatalogProduct,
  toPublicCatalogRarityFilterOption,
  type CatalogProductRead,
  type CatalogRarityFilterRead,
} from "./public-catalog-product";

export type {
  CatalogFormatOption,
  PublicCatalogProduct,
  PublicCatalogRarity,
  PublicCatalogRarityFilterOption,
} from "./public-catalog-product";

export class CatalogUnavailableError extends Error {
  constructor() {
    super("The Catalog is temporarily unavailable");
    this.name = "CatalogUnavailableError";
  }
}

let client: PrismaClient | undefined;
let clientDatabaseUrl: string | undefined;

function getCatalogClient(databaseUrl: string) {
  if (!client) {
    client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
        max: 1,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 10_000,
        query_timeout: 10_000,
        idleTimeoutMillis: 10_000,
        allowExitOnIdle: true,
        application_name: "pullpage-catalog",
      }),
    });
    clientDatabaseUrl = databaseUrl;
  }
  if (clientDatabaseUrl !== databaseUrl) {
    throw new Error("The Catalog client is already configured for this process");
  }
  return client;
}

async function queryActiveCatalogProducts(databaseUrl: string): Promise<CatalogProductRead[]> {
  return getCatalogClient(databaseUrl).catalogProduct.findMany({
    where: { isActive: true },
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      cardName: true,
      englishCollectorNumber: true,
      japaneseCollectorNumber: true,
      englishSetName: true,
      japaneseSetName: true,
      rarityDefinition: {
        select: {
          code: true,
          displayName: true,
          displayOrder: true,
          isActive: true,
          badgeBackgroundColor: true,
          badgeForegroundColor: true,
        },
      },
      designName: true,
      binderSleevePrice: true,
      toploaderPrice: true,
      productPreviewUrl: true,
    },
  });
}

async function queryCatalogRarityFilterOptions(
  databaseUrl: string,
): Promise<CatalogRarityFilterRead[]> {
  return getCatalogClient(databaseUrl).catalogRarity.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: {
      code: true,
      displayName: true,
      displayOrder: true,
      isActive: true,
      badgeBackgroundColor: true,
      badgeForegroundColor: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
}

export async function listActiveCatalogProducts(options?: { databaseUrl?: string }) {
  const databaseUrl = options?.databaseUrl ?? process.env.CATALOG_DATABASE_URL;
  if (!databaseUrl) throw new CatalogUnavailableError();

  try {
    return (await queryActiveCatalogProducts(databaseUrl)).map(toPublicCatalogProduct);
  } catch (error) {
    if (error instanceof CatalogUnavailableError) throw error;
    throw new CatalogUnavailableError();
  }
}

export async function listCatalogRarityFilterOptions(options?: { databaseUrl?: string }) {
  const databaseUrl = options?.databaseUrl ?? process.env.CATALOG_DATABASE_URL;
  if (!databaseUrl) throw new CatalogUnavailableError();

  try {
    return (await queryCatalogRarityFilterOptions(databaseUrl))
      .map(toPublicCatalogRarityFilterOption);
  } catch (error) {
    if (error instanceof CatalogUnavailableError) throw error;
    throw new CatalogUnavailableError();
  }
}

export async function getCatalog() {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 60 });
  return listActiveCatalogProducts();
}

export async function getCatalogRarityFilterOptions() {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 60 });
  return listCatalogRarityFilterOptions();
}

export async function getCatalogProduct(
  slug: string,
  options?: { databaseUrl?: string },
) {
  const products = options?.databaseUrl
    ? await listActiveCatalogProducts(options)
    : await getCatalog();
  return products.find((product) => product.slug === slug) ?? null;
}

export async function closeCatalog() {
  await client?.$disconnect();
  client = undefined;
  clientDatabaseUrl = undefined;
}
