const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "supabase-api-cache",
        networkTimeoutSeconds: 8,
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*$/,
      handler: "CacheFirst",
      options: { cacheName: "google-fonts" },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Disable the client-side Router Cache for dynamic routes so pages like
    // the dashboard always refetch fresh data after navigating back to them
    // (e.g. right after completing a POS sale), instead of showing a stale
    // cached view for up to 30 seconds.
    staleTimes: {
      dynamic: 0,
    },
  },
};

module.exports = withPWA(nextConfig);
