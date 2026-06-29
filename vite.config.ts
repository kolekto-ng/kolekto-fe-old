import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "favicon.ico"],
      manifest: {
        name: "Kolekto - Smart Group Payment",
        short_name: "Kolekto",
        description: "Simplify group payments and collections with Kolekto",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#1B5E20",
        theme_color: "#1B5E20",
        categories: ["finance", "business"],
        // Icon-only assets (no wordmark) — Android requires this distinction
        // from the marketing logo, and the `maskable` entries fill their
        // canvas edge-to-edge with the brand color so OS launchers that clip
        // icons to a circle/squircle don't crop or letterbox the glyph.
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cacheId: "kolekto-pwa-v4",
        importScripts: ["sw-cleanup.js", "push-sw.js"],
        clientsClaim: true,
        skipWaiting: true,

        // Increase file size limit for large assets
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB

        // Cache static assets needed for offline support.
        // Navigation requests use NetworkFirst below so fresh HTML wins online.
        globPatterns: ["**/*.{js,css,ico,png,jpg,jpeg,svg,woff2}"],

        // Clean URLs - remove hash from precache
        cleanupOutdatedCaches: true,

        // CRITICAL: Navigation fallback for SPA routing
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api/, // API routes
          /\/[^/?]+\.[^/]+$/, // Files with extensions (e.g., .js, .css, .png)
        ],

        // Runtime caching strategies
        runtimeCaching: [
          // Always prefer the latest app shell when the network is available.
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/api"),
            handler: "NetworkFirst",
            options: {
              cacheName: "kolekto-pages-v4",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          // Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "kolekto-google-fonts-v4",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          // Images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "kolekto-images-v4",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          // B-18: API calls MUST NOT be cached by the service worker.
          //
          // Previously this used NetworkFirst with maxAgeSeconds=300 (5 min).
          // For a payments product that is wrong: a user could refresh their
          // wallet page and see a 5-minute-stale `available_balance`, request
          // a withdrawal believing funds were there, then get rejected by the
          // backend. Same risk for collection lists, contributions, KYC.
          //
          // We now ALWAYS go to the network for /api/* — no SW caching at
          // all on financial paths. Workbox still falls through to the
          // network without caching when no rule matches.
          //
          // (Direct calls to *.supabase.co/functions/v1/* are also uncached
          // because they don't match any rule above.)
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: "NetworkOnly",
            options: {
              cacheName: "api-no-cache",
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // Disabled in dev — service worker was caching old code
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/pages": path.resolve(__dirname, "./src/pages"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
      "@/types": path.resolve(__dirname, "./src/types"),
      "@/store": path.resolve(__dirname, "./src/store"),
      "@/context": path.resolve(__dirname, "./src/context"),
      "@/utils": path.resolve(__dirname, "./src/utils"),
      "@/hooks": path.resolve(__dirname, "./src/hooks"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
  },
  define: {
    global: "globalThis",
  },
});
