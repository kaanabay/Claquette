import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components + Partial Prefetching are the Next.js 16 defaults for new apps
  // (and become mandatory in the next major). Every page streams its user-specific
  // part behind a <Suspense> boundary; nothing user-specific is cached on the server.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Adding moved onto the list's page; old links keep working (their query string is passed on).
  async redirects() {
    return [{ source: "/challenges/:challengeId/suggest", destination: "/challenges/:challengeId?add=1", permanent: false }];
  },
  // Browsers still ask for /favicon.ico on their own now and then (e.g. after the address changes).
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
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
