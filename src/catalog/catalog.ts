import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type PublicCatalogRow = {
  slug: string;
  card_name: string | null;
  collector_number: string | null;
  set_name: string | null;
  rarity: string | null;
  design_name: string | null;
  format_code: "BS" | "TL" | "ALL";
  binder_sleeve_price: number | null;
  toploader_price: number | null;
  preview_url: string | null;
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
  designName: string | null;
  previewUrl: string | null;
  formatOptions: CatalogFormatOption[];
};

let client: PrismaClient | undefined;
let clientDatabaseUrl: string | undefined;

function getCatalogClient(databaseUrl: string) {
  if (!client || clientDatabaseUrl !== databaseUrl) {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    clientDatabaseUrl = databaseUrl;
  }
  return client;
}

function toPublicCatalogProduct(row: PublicCatalogRow): PublicCatalogProduct {
  const formatOptions: CatalogFormatOption[] = [];
  if ((row.format_code === "BS" || row.format_code === "ALL") && row.binder_sleeve_price) {
    formatOptions.push({ format: "Binder Sleeve", price: row.binder_sleeve_price });
  }
  if ((row.format_code === "TL" || row.format_code === "ALL") && row.toploader_price) {
    formatOptions.push({ format: "Toploader", price: row.toploader_price });
  }

  return {
    slug: row.slug,
    cardName: row.card_name,
    collectorNumber: row.collector_number,
    setName: row.set_name,
    rarity: row.rarity,
    designName: row.design_name,
    previewUrl: row.preview_url,
    formatOptions,
  };
}

export async function listActiveCatalogProducts(options?: {
  databaseUrl?: string;
}): Promise<PublicCatalogProduct[]> {
  const databaseUrl = options?.databaseUrl ?? process.env.CATALOG_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("CATALOG_DATABASE_URL is required at runtime");
  }

  const rows = await getCatalogClient(databaseUrl).$queryRaw<PublicCatalogRow[]>`
    select
      slug,
      card_name,
      collector_number,
      set_name,
      rarity,
      design_name,
      format_code,
      binder_sleeve_price,
      toploader_price,
      preview_url
    from catalog_public.active_catalog_products
    order by slug
  `;

  return rows.map(toPublicCatalogProduct);
}

export async function closeCatalog() {
  await client?.$disconnect();
  client = undefined;
  clientDatabaseUrl = undefined;
}
