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
      includeAssets: ["favicon.ico", "kelekto_logo-removebg-preview.png"],
      manifest: {
        name: "Kolekto - Smart Group Payment",
        short_name: "Kolekto",
        description: "Simplify group payments and collections with Kolekto",
        start_url: "/pwa/",
        scope: "/pwa/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#16a34a",
        icons: [
          {
            src: "kelekto_logo-removebg-preview.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "kelekto_logo-removebg-preview.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Increase file size limit for large assets (e.g., images)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB

        // Cache strategy for better offline support
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache large images with network-first strategy
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
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
      output: {
        manualChunks: (id) => {
          // Core vendor libraries
          if (id.includes("node_modules")) {
            // React core
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor-react";
            }

            // React Router
            if (id.includes("react-router")) {
              return "vendor-router";
            }

            // Radix UI components (split into smaller chunks)
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }

            // Form libraries
            if (
              id.includes("react-hook-form") ||
              id.includes("zod") ||
              id.includes("@hookform")
            ) {
              return "vendor-forms";
            }

            // Chart/visualization libraries
            if (id.includes("recharts") || id.includes("d3")) {
              return "vendor-charts";
            }

            // Payment libraries
            if (id.includes("paystack")) {
              return "vendor-payments";
            }

            // Supabase
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }

            // Other utilities
            if (id.includes("framer-motion")) {
              return "vendor-animation";
            }

            if (id.includes("axios")) {
              return "vendor-http";
            }

            // All other node_modules
            return "vendor-misc";
          }
        },
      },
    },
  },
  define: {
    global: "globalThis",
  },
});
