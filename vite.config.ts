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
