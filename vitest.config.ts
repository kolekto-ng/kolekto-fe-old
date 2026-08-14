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
    //
    // kolekto-shared-financial/test/**/*.test.ts is the same situation: it's a
    // separate package with its own `node --experimental-strip-types --test`
    // runner (see kolekto-shared-financial/package.json's "test" script), not
    // vitest. Without this exclude, vitest still discovers these files (they
    // match its default glob) and fails each one with "no test suite found"
    // since they use node:test syntax.
    exclude: [...defaultExclude, "**/supabase/functions/**", "**/kolekto-shared-financial/**"],
  },
});
