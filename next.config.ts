import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  htmlLimitedBots: /Googlebot|bingbot|Twitterbot|Slackbot/i,
  cacheLife: {
    catalog: {
      stale: 30,
      revalidate: 30,
      expire: 60,
    },
  },
};

export default nextConfig;
