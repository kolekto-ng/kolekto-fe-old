import { defineConfig, defaultExclude } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    // Edge Function regression tests under supabase/functions/**/*.test.ts run
    // under plain Node (`node --experimental-strip-types --test`), not vitest —
    // they dynamically load the actual Deno function source, which vitest's
    // jsdom environment and module graph aren't set up to exercise. See
    // package.json's "test:edge-payment" script.
    exclude: [...defaultExclude, "**/supabase/functions/**"],
  },
});
