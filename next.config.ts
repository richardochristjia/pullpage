import type { NextConfig } from "next";
import { PREVIEW_IMAGE_PATTERNS } from "./src/catalog/product-preview";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: { remotePatterns: [...PREVIEW_IMAGE_PATTERNS] },
};

export default nextConfig;
