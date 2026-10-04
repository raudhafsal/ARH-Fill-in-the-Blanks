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
        // Renamed from "image-cache" to "image-cache-v2": some devices had
        // already cached a broken/404 response for a brand image under the
        // old cache name (from before those files existed), and CacheFirst
        // would keep serving that cached failure forever even after the
        // real file was deployed. The new cache name gives everyone a clean
        // slate. `cacheableResponse` also stops a failed (non-2xx) response
        // from ever being cached again going forward.
        cacheName: "image-cache-v2",
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
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
    // Keep visited pages in the client router cache for 30s so going back and forth between pages is
    // instant. Mutations call router.refresh(), which clears this cache, so data stays correct.
    staleTimes: {
      dynamic: 30,
    },
  },
};

module.exports = withPWA(nextConfig);
