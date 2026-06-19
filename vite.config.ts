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
      includeAssets: ["kelekto_logo-removebg-preview.png", "favicon.ico"],
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
        icons: [
          {
            src: "/kelekto_logo-removebg-preview.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/kelekto_logo-removebg-preview.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/kelekto_logo-removebg-preview.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cacheId: "kolekto-pwa-v2",
        importScripts: ["sw-cleanup.js"],

        // Increase file size limit for large assets
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB

        // Cache all static assets including HTML
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}"],

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
          // Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "kolekto-google-fonts-v2",
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
              cacheName: "kolekto-images-v2",
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
