import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    catalog: {
      stale: 30,
      revalidate: 30,
      expire: 60,
    },
  },
};

export default nextConfig;
