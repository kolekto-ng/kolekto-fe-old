// useWorkspaceBootstrap.ts — load the user's workspaces once they are signed in.
//
// Workspace Phase 1 (contract §8). Intentionally tiny and failure-tolerant:
// workspace context is additive in Phase 1, so if this fetch fails the app must
// keep working exactly as it does today. `workspace_id` is nullable server-side
// and the backend falls back to the caller's personal workspace when no
// X-Workspace-Id header is sent, so a missing list costs nothing.
//
// ⚠️ THE THREE-STATE PROBLEM (Phase 1.5 fix):
// `useAuthStore` starts with `user: null` and resolves the session
// asynchronously via checkAuth(). So "no user" means TWO different things:
//
//   isLoading === true   → auth is still verifying a stored token. UNKNOWN.
//   isLoading === false  → auth has resolved and there is genuinely no user.
//
// Treating the first case as "signed out" wiped the persisted workspace on
// every single page load, before auth had a chance to resolve. That made
// persistence silently non-functional and, once multiple workspaces exist,
// would reset a user's selection to their personal workspace on every refresh.
// Only the resolved case may clear state.
import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

export function useWorkspaceBootstrap(): void {
  const auth = useAuthStore() as any;
  const userId: string | undefined = auth?.user?.id;
  const authResolving: boolean = !!auth?.isLoading;

  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const reset = useWorkspaceStore((s) => s.reset);

  useEffect(() => {
    // Auth is still verifying a stored token — do nothing. Clearing here would
    // destroy a valid selection belonging to the user about to be restored.
    if (authResolving) return;

    if (!userId) {
      // Auth has RESOLVED and there is no user: genuinely signed out. Drop the
      // workspace list and the persisted selection so nothing leaks into the
      // next account on a shared browser.
      reset();
      return;
    }

    (async () => {
      try {
        // The user id scopes the persisted selection, so a value written by a
        // previously signed-in account on this browser is ignored rather than
        // sent as a header the backend would reject.
        await fetchWorkspaces(userId);
      } catch {
        // Swallowed by design — see header. The store records the error for any
        // UI that wants to surface it; the app itself must not degrade.
      }
    })();
  }, [userId, authResolving, fetchWorkspaces, reset]);
}

export default useWorkspaceBootstrap;
