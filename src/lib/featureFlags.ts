// featureFlags.ts — tiny runtime feature-flag resolver.
//
// Phase 1.2/1.3: used to canary the collection-creation write path between the
// legacy Supabase Edge function and the new Express CollectionService WITHOUT a
// redeploy. Resolution order (first match wins):
//   1. localStorage override  — per-tester, deploy-free (canary + instant rollback)
//   2. build-time env default — global default via VITE_CREATE_COLLECTION_PATH
//   3. hard default           — 'edge' (today's production behavior)
//
// A localStorage override means an internal tester can opt a single browser into
// the Express path, and flipping it back is instant and deploy-free — which is
// the rollback guarantee the migration plan requires. For a *global* percentage
// rollout, wire step 2 to a remote config service before going to 100%.

export type CreateCollectionPath = "edge" | "express";

const LS_KEY = "kolekto-ff-create-path";

/**
 * Resolve which backend should handle collection creation.
 * Safe by default: returns 'edge' (current production path) unless explicitly
 * overridden. Never throws.
 */
export function getCreateCollectionPath(): CreateCollectionPath {
  try {
    const override = localStorage.getItem(LS_KEY);
    if (override === "express" || override === "edge") return override;
  } catch {
    /* localStorage unavailable (SSR/private mode) — fall through */
  }

  const envDefault = (import.meta as any)?.env?.VITE_CREATE_COLLECTION_PATH;
  if (envDefault === "express" || envDefault === "edge") return envDefault;

  return "edge";
}

/** Convenience for canary testers / e2e: opt this browser in/out at runtime. */
export function setCreateCollectionPath(path: CreateCollectionPath | null): void {
  try {
    if (path === null) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, path);
  } catch {
    /* no-op */
  }
}
