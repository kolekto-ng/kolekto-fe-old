// featureFlags.ts — tiny runtime feature-flag resolver.
//
// Phase 1.2/1.3: used to canary the collection-creation write path between the
// legacy Supabase Edge function and the new Express CollectionService WITHOUT a
// redeploy. Resolution order (first match wins):
//   1. localStorage override  — per-tester, deploy-free (canary + instant rollback)
//   2. build-time env default — global default via VITE_CREATE_COLLECTION_PATH
//   3. hard default           — 'express'
//
// ⚠️ DEFAULT FLIPPED (incident follow-up): this was 'edge' until a production
// incident where the deployed Edge Function had drifted 3.5 weeks behind its
// own repository source — it was missing the KYC gate entirely and had an
// authentication hole (trusted an unverified JWT decode + a client-supplied
// body.user_id fallback). The Edge Function has since been fixed and
// hardened (real supabase.auth.getUser() verification, restored KYC gate,
// structured logging) and remains as a defense-in-depth backstop reachable
// directly — but the DEFAULT now points at the Express CollectionService,
// which is the single, tested, centralized implementation of every KYC/
// ownership rule (services/featureAccessService.js in kolekto-be-old). A
// git commit to the Edge Function's source does NOT deploy it — deployment
// is a separate, explicit `supabase functions deploy` step, and this
// default was silently trusting that step had happened when it hadn't.
// Making Express the default means a repeat of that gap fails safe: the
// codepath actually serving traffic is the one with automated tests
// (152+ passing) verifying every KYC/legacy-user scenario.
//
// A localStorage override still lets a tester opt a single browser back to
// the Edge Function path for comparison/rollback testing.

export type CreateCollectionPath = "edge" | "express";

const LS_KEY = "kolekto-ff-create-path";

/**
 * Resolve which backend should handle collection creation.
 * Safe by default: returns 'express' (the tested, centralized path) unless
 * explicitly overridden. Never throws.
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

  return "express";
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
