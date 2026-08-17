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
 * Start watching for workspace switches. Returns zustand's unsubscribe fn.
 *
 * Registered once, at app root (see useWorkspaceInvalidation below), rather
 * than per-page: a switch triggered from the navbar must invalidate the data
 * behind EVERY page, not only whichever one happens to be mounted.
 *
 * Deliberately fires only on a genuine change of id. `fetchWorkspaces`
 * re-sets `activeWorkspaceId` to the same value on every bootstrap, and
 * resetting on that would wipe good caches on every page load.
 */
export function subscribeWorkspaceInvalidation(): () => void {
  let previous = useWorkspaceStore.getState().activeWorkspaceId;
  return useWorkspaceStore.subscribe((state) => {
    const next = state.activeWorkspaceId;
    if (next === previous) return;
    previous = next;
    resetWorkspaceScopedStores();
  });
}
