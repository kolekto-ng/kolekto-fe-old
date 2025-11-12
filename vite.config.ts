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
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      pwaAssets: {
        image: "public/kelekto_logo-removebg-preview.png",
      },
      manifest: {
        name: "Kolekto PWA",
        short_name: "Kolekto",
        start_url: "/pwa/",
        scope: "/pwa/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#16a34a",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable any",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable any",
          },
        ],
        screenshots: [
          {
            src: "screenshot-mobile.png",
            sizes: "750x1334",
            type: "image/png",
            form_factor: "narrow",
          },
          {
            src: "screenshot-desktop.png",
            sizes: "1280x800",
            type: "image/png",
            form_factor: "wide",
          },
        ],
      },
      workbox: {
        // Keep PWA navigation out of app/landing routes
        navigateFallbackDenylist: [/^\/app\//, /^\/$/],
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
    rollupOptions: {
      input: {
        landing: resolve(__dirname, "index.html"),
        pwa: resolve(__dirname, "pwa.html"),
      },
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: [
            "@radix-ui/react-accordion",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
          ],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          payments: ["react-paystack"],
        },
      },
    },
  },
  define: {
    global: "globalThis",
  },
});
