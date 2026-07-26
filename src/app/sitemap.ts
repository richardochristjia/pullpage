import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getCatalog } from "@/catalog/catalog";
import { catalogCanonical, productCanonical } from "@/catalog/discoverability";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const products = await getCatalog();
  return [
    { url: catalogCanonical() },
    ...products.map((product) => ({
      url: productCanonical(product.slug),
      ...(product.previewUrl ? { images: [product.previewUrl] } : {}),
    })),
  ];
}
