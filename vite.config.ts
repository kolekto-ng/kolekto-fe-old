import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "https://i.imgur.com/Lb0KU2l.png",
        "kelekto_logo-removebg-preview.png",
      ],
      manifest: {
        name: "Kolekto - Smart Group Payment",
        short_name: "Kolekto",
        description: "Simplify group payments and collections with Kolekto",
        start_url: "/pwa/login",
        scope: "/pwa/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          {
            src: "https://i.imgur.com/Lb0KU2l.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "https://i.imgur.com/Lb0KU2l.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Increase file size limit for large assets
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB

        // Cache all static assets including HTML
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}"],

        // Clean URLs - remove hash from precache
        cleanupOutdatedCaches: true,

        // CRITICAL: Navigation fallback for SPA routing
        navigateFallback: "/pwa.html",
        navigateFallbackAllowlist: [/^\/pwa\/.*/], // Match /pwa/* (with trailing slash)
        navigateFallbackDenylist: [
          /^\/api/, // API routes
          /^\/$/, // Root
          /\/[^/?]+\.[^/]+$/, // Files with extensions (e.g., .js, .css, .png)
        ],

        // Runtime caching strategies
        runtimeCaching: [
          // Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
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
              cacheName: "images-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          // API calls (network first, fallback to cache)
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable PWA in dev mode for testing
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
    rollupOptions: {
      input: {
        landing: resolve(__dirname, "index.html"),
        pwa: resolve(__dirname, "pwa.html"),
      },
    },
  },
  define: {
    global: "globalThis",
  },
});
