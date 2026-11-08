import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // keep the dev badge out of demo recordings
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
