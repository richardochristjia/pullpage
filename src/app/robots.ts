import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { indexingPolicy, PRODUCTION_ORIGIN } from "@/catalog/discoverability";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const { index } = indexingPolicy();
  return {
    rules: index
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${PRODUCTION_ORIGIN}/sitemap.xml`,
  };
}
