// workspaceInvalidation.ts — Workspace Wave 6.2.
//
// THE PROBLEM THIS SOLVES:
// Before this module, `switchWorkspace` updated `activeWorkspaceId` and
// localStorage and then returned. Nothing else was notified. Every
// server-data store keys its cache on the USER id only, so switching
// Workspace A → Workspace B left A's collections, dashboard figures,
// activities and withdrawals sitting in memory and marked fresh — while the
// workspace badge already displayed B's name. That is the exact "switching
// must not merely change a label" failure the Wave 6 brief names.
//
// THE FIX IS TWO INDEPENDENT LAYERS, deliberately:
//   1. RESET (this file) — on every activeWorkspaceId change, blow away the
//      workspace-sensitive stores so the mounted page re-renders into its
//      loading/skeleton state and its existing effect refetches under the new
//      header. This handles the common path.
//   2. CACHE KEYS (in each store) — `activeWorkspaceId` is now part of every
//      workspace-sensitive cache key, so if a reset is ever MISSED the stale
//      entry still fails its freshness check and refetches. Belt and braces:
//      a missed reset degrades to an extra fetch, never to showing another
//      workspace's data.
//
// ⚠️ NOT A SECURITY BOUNDARY. Clearing client state hides nothing an attacker
// could not re-request; the backend re-verifies membership and capability on
// every call. This exists for CORRECTNESS (never show A's rows under B's
// label), not protection.
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useCollectionStore } from "@/store/useCollectionStore";
import { useDashboardHomeStore } from "@/store/useDashboardHomeStore";
import { useActivities } from "@/store/useDashboard";
import { useWithdrawalStore } from "@/store/useWithdrawalStore";
import { useTransactionStore } from "@/store/useTransactionStore";

/**
 * Clear every store whose contents are scoped to a workspace.
 *
 * Each store is reset to its EMPTY state with `lastFetchedAt = 0` and its
 * cache key cleared, so the next read is a genuine miss. `inFlight` is nulled
 * too: a request issued under the previous workspace must not be awaited and
 * adopted by the next caller (the stores additionally drop late responses
 * whose originating workspace no longer matches — see each store's
 * stale-response guard).
 */
export function resetWorkspaceScopedStores(): void {
  (useCollectionStore as any).setState({
    collections: [],
    currentCollection: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastFetchedAt: 0,
    lastFetchKey: "",
    inFlight: null,
  });

  useDashboardHomeStore.setState({
    stats: {
      totalCollections: 0,
      activeCollections: 0,
      totalBalance: 0,
      availableBalance: 0,
      pendingBalance: 0,
    },
    activities: [],
    recentCollections: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastFetchedAt: 0,
    lastUserId: null,
    lastWorkspaceId: null,
    inFlight: null,
  } as any);

  (useActivities as any).setState({
    activities: [],
    isLoading: false,
    error: null,
    lastFetchedAt: 0,
    lastFetchKey: "",
    inFlight: null,
  });

  (useWithdrawalStore as any).setState({
    withdrawals: [],
    isLoading: false,
    error: null,
    lastFetchedAt: 0,
    lastFetchKey: "",
    inFlight: null,
  });

  (useTransactionStore as any).setState({
    transactions: [],
    financialSummary: null,
    isLoading: false,
    error: null,
  });
}

/**
 * Is `workspaceId` the user's PERSONAL workspace, per the loaded list?
 *
 * Used only by the bootstrap exemption below. Returns false when the list has
 * not loaded or the id is not in it — i.e. it fails towards "reset", never
 * towards "keep the previous workspace's rows".
 */
function isPersonalWorkspace(
  workspaces: { id: string; type: string }[],
  workspaceId: string | null,
): boolean {
  if (!workspaceId) return false;
  return workspaces.some((w) => w.id === workspaceId && w.type === "personal");
}

/**
 * Start watching for workspace switches. Returns zustand's unsubscribe fn.
 *
 * Registered once, at app root (see useWorkspaceInvalidation below), rather
 * than per-page: a switch triggered from the navbar must invalidate the data
 * behind EVERY page, not only whichever one happens to be mounted.
 *
 * Deliberately fires only on a genuine change of id. `fetchWorkspaces`
 * re-sets `activeWorkspaceId` to the same value on every bootstrap, and
 * resetting on that would wipe good caches on every page load.
 *
 * ── THE null → PERSONAL BOOTSTRAP EXEMPTION (performance wave, 2026-08-20) ──
 *
 * WHAT WAS SLOW: on a user's FIRST load in a browser (or the first after
 * sign-out) there is no persisted selection, so `activeWorkspaceId` starts
 * `null`. The dashboard mounts and fires its three requests immediately —
 * with no X-Workspace-Id header, which the backend resolves to the caller's
 * PERSONAL workspace (middleware/workspaceContext.js's
 * `ensurePersonalWorkspace` path). Moments later `fetchWorkspaces` resolves
 * and sets `activeWorkspaceId`, null → id counted as a "switch", every store
 * was wiped, and the page refetched all of it. Every dashboard request fired
 * TWICE on first load, and the user watched a fully-populated dashboard
 * collapse back into a skeleton.
 *
 * WHY SKIPPING IS CORRECT, NOT A SHORTCUT: those in-flight requests carried
 * no workspace header, so the server already scoped them to exactly the
 * personal workspace. If the id we are settling on IS that personal
 * workspace, the data in the stores is already the right data for it — there
 * is nothing stale to clear. Nothing is being shown under the wrong label.
 *
 * EVERY OTHER TRANSITION STILL RESETS, including:
 *   • null → a NON-personal workspace (a restored selection, or a user with
 *     no personal workspace falling back to workspaces[0]) — the headerless
 *     responses belong to a different workspace and MUST be discarded;
 *   • any id → any other id — the actual switch this module exists for;
 *   • any id → null (sign-out).
 * The check also fails closed: an unloaded or unknown workspace list makes
 * `isPersonalWorkspace` false, so the reset happens.
 */
export function subscribeWorkspaceInvalidation(): () => void {
  let previous = useWorkspaceStore.getState().activeWorkspaceId;
  return useWorkspaceStore.subscribe((state) => {
    const next = state.activeWorkspaceId;
    if (next === previous) return;

    const isBootstrapToPersonal =
      previous === null && isPersonalWorkspace(state.workspaces, next);

    previous = next;
    if (isBootstrapToPersonal) return;
    resetWorkspaceScopedStores();
  });
}
