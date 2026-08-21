import { create } from "zustand";
import { formatDistanceToNow } from "date-fns";
import { axiosInstance } from "@/utils/axios";
// Cache-key input only — read from the dependency-free module to avoid an
// import cycle through useWorkspaceStore → axios. See Wave 6.2.
import { getActiveWorkspaceId } from "@/utils/activeWorkspace";

const RECENT_COLLECTION_LIMIT = 3;
const RECENT_ACTIVITY_LIMIT = 5;
const DASHBOARD_STALE_MS = 20_000;

export interface DashStats {
  totalCollections: number;
  activeCollections: number;
  totalBalance: number;
  availableBalance: number;
  pendingBalance: number;
}

export interface Activity {
  id: string;
  name: string;
  email: string;
  amount: number;
  created_at: string;
  collection_title: string;
  relative_time: string;
}

export interface CollectionPreview {
  id: string;
  title: string;
  status: string;
  collection_type: string;
  totalRaised: number;
  participants: number;
  deadline?: string;
  created_at: string;
  goalAmount?: number;
  maxParticipants?: number;
}

interface DashboardHomeState {
  stats: DashStats;
  activities: Activity[];
  recentCollections: CollectionPreview[];
  /**
   * Every collection id in the active workspace (wave 6.7F.8) — not just the
   * three shown as cards.
   *
   * `GET /collections` already returns the full workspace-scoped list and this
   * store already reads it; only the top three survived into state. The ids are
   * kept so the realtime listeners can tell whether an incoming
   * contribution/wallet/withdrawal row belongs to the workspace on screen
   * before forcing a refetch — those tables carry `collection_id` and no
   * `workspace_id`, so this mapping cannot be done server-side. See
   * utils/realtimeScope.ts.
   *
   * Empty means "not loaded yet", and is treated as unknown (fail open), never
   * as "this workspace has no collections".
   */
  workspaceCollectionIds: string[];
  isLoading: boolean;
  isRefreshing: boolean;
  /**
   * PER-SECTION loading flags (performance wave, 2026-08-20).
   *
   * The three dashboard requests have always been fired in parallel, but their
   * results were applied in ONE `set()` after `Promise.all` — so the page
   * showed nothing until the SLOWEST of them returned, and `isLoading` drove a
   * single full-page skeleton. On a workspace switch that read as "I clicked,
   * the whole dashboard vanished, and some seconds later everything appeared
   * at once."
   *
   * Each request now commits its own slice the moment it lands and clears only
   * its own flag, so balances, collection cards and the activity feed appear
   * independently. `isLoading` is kept (it still means "nothing to show yet")
   * for any caller that only wants the coarse signal.
   */
  statsLoading: boolean;
  collectionsLoading: boolean;
  activitiesLoading: boolean;
  error: string | null;
  lastFetchedAt: number;
  lastUserId: string | null;
  /** Wave 6.2 — part of the cache identity, so A's figures never satisfy B. */
  lastWorkspaceId: string | null;
  inFlight: Promise<void> | null;
  loadDashboardHome: (
    userId: string | null | undefined,
    opts?: { force?: boolean; silent?: boolean },
  ) => Promise<void>;
}

const emptyStats: DashStats = {
  totalCollections: 0,
  activeCollections: 0,
  totalBalance: 0,
  availableBalance: 0,
  pendingBalance: 0,
};

function fmtDateTime(d: string) {
  try {
    return new Date(d).toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function toRelativeTime(createdAt: string) {
  try {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  } catch {
    return fmtDateTime(createdAt);
  }
}

export const useDashboardHomeStore = create<DashboardHomeState>((set, get) => ({
  stats: emptyStats,
  activities: [],
  recentCollections: [],
  workspaceCollectionIds: [],
  isLoading: false,
  isRefreshing: false,
  statsLoading: false,
  collectionsLoading: false,
  activitiesLoading: false,
  error: null,
  lastFetchedAt: 0,
  lastUserId: null,
  lastWorkspaceId: null,
  inFlight: null,

  loadDashboardHome: async (userId, opts = {}) => {
    if (!userId) {
      set({
        stats: emptyStats,
        activities: [],
        recentCollections: [],
        workspaceCollectionIds: [],
        isLoading: false,
        isRefreshing: false,
        statsLoading: false,
        collectionsLoading: false,
        activitiesLoading: false,
        lastUserId: null,
        lastWorkspaceId: null,
      });
      return;
    }

    const state = get();
    const { force = false, silent = false } = opts;
    // Wave 6.2: cache identity is (user, workspace), not user alone.
    const requestWorkspaceId = getActiveWorkspaceId();
    const sameScope =
      state.lastUserId === userId && state.lastWorkspaceId === requestWorkspaceId;
    const hasCachedData =
      sameScope &&
      (state.recentCollections.length > 0 ||
        state.activities.length > 0 ||
        state.lastFetchedAt > 0);
    const isFresh =
      hasCachedData && Date.now() - Number(state.lastFetchedAt || 0) < DASHBOARD_STALE_MS;

    if (!force && state.inFlight && sameScope) return state.inFlight;
    if (!force && isFresh) return;

    const request = (async () => {
      set({
        isLoading: !hasCachedData && !silent,
        isRefreshing: hasCachedData || silent,
        // A section is "loading" only when it has nothing to show. A silent
        // background refresh keeps the current values on screen rather than
        // flashing three skeletons over data the user is already reading.
        statsLoading: !hasCachedData && !silent,
        collectionsLoading: !hasCachedData && !silent,
        activitiesLoading: !hasCachedData && !silent,
        error: null,
        lastUserId: userId,
        lastWorkspaceId: requestWorkspaceId,
      });

      try {
        // Wave 6.4 — every read below now goes through the Express API.
        //
        // This store previously mixed three browser-side Supabase queries
        // (recent collections, two exact counts, per-collection paid
        // contributions) with two backend calls. The direct queries carried
        // no workspace context and could not be capability-gated, so the
        // dashboard's figures were reachable regardless of what the backend
        // would have permitted. All three are gone:
        //   • counts        → /dashboard/stats (already returned them)
        //   • recent cards  → /collections (workspace-scoped, money-gated)
        //   • paid amounts  → the `contributions` embed on that same response
        //
        // Each endpoint applies the transaction:read gate server-side, so a
        // caller without it simply receives no figures and the dashboard
        // renders its non-financial half.
        // PROGRESSIVE COMMIT (performance wave, 2026-08-20).
        //
        // The three requests are still fired together — that part was already
        // right. What changed is that each one now COMMITS ITS OWN SLICE the
        // moment it resolves, instead of all three being held until
        // `Promise.all` settled and applied in one `set()`. The page therefore
        // fills in section by section rather than staying blank until the
        // slowest request returns.
        //
        // Wave 6.2's stale-response guard is applied INSIDE each commit, not
        // once at the end: with three independent commit points, each must
        // re-check that the user has not switched workspace since the request
        // left. A late response from workspace A must never land under B.
        const isStillCurrent = () =>
          getActiveWorkspaceId() === requestWorkspaceId;

        const statsPromise = axiosInstance
          .get("/dashboard/stats")
          .then((res) => res?.data?.data || res?.data || res || {})
          .catch(() => ({}))
          .then((statsData: any) => {
            if (!isStillCurrent()) return statsData;
            set((prev) => ({
              stats: {
                // `??` not `||`: a genuine 0 from the backend must win over
                // the locally-derived fallback.
                totalCollections: Number(
                  statsData.totalCollections ?? prev.stats.totalCollections ?? 0,
                ),
                activeCollections: Number(
                  statsData.activeCollections ?? prev.stats.activeCollections ?? 0,
                ),
                totalBalance: Number(statsData.totalBalance || 0),
                availableBalance: Number(statsData.availableBalance || 0),
                pendingBalance: Number(statsData.pendingBalance || 0),
              },
              statsLoading: false,
            }));
            return statsData;
          });

        const collectionsPromise = axiosInstance
          .get("/collections")
          .then((res) => res?.data?.data || [])
          .catch(() => [])
          .then((allCollections: any) => {
            const cols: any[] = Array.isArray(allCollections) ? allCollections : [];
            if (!isStillCurrent()) return cols;

            // `contributions` is embedded on each collection row, with AMOUNTS
            // present only when the caller holds transaction:read. Without it
            // the reduce yields 0 and the card shows a participant count but no
            // figure — the intended money-free rendering.
            const recentCollections = cols
              .filter((collection: any) => collection.status === "active")
              .slice(0, RECENT_COLLECTION_LIMIT)
              .map((collection: any) => {
                const paid = (Array.isArray(collection.contributions)
                  ? collection.contributions
                  : []
                ).filter((contribution: any) => contribution.status === "paid");
                return {
                  id: collection.id,
                  title: collection.title,
                  status: collection.status,
                  collection_type: collection.collection_type || "fixed",
                  totalRaised: paid.reduce(
                    (sum: number, contribution: any) =>
                      sum + Number(contribution.amount || 0),
                    0,
                  ),
                  participants: paid.length,
                  deadline: collection.deadline,
                  created_at: collection.created_at,
                  goalAmount:
                    Number(collection.target_amount || collection.amount || 0) ||
                    undefined,
                  maxParticipants:
                    Number(collection.max_contributions || 0) || undefined,
                };
              });

            set((prev) => ({
              recentCollections,
              // Full workspace scope for the realtime listeners — see the
              // field's declaration. Derived from the same response the cards
              // come from, so it costs nothing extra.
              workspaceCollectionIds: cols.map((c: any) => c.id).filter(Boolean),
              collectionsLoading: false,
              // Counts fall back to this list only while /dashboard/stats is
              // still in flight or failed outright. Once stats commits, its
              // authoritative figures are already in place and are not
              // overwritten — hence the `statsLoading` guard.
              stats: prev.statsLoading
                ? {
                    ...prev.stats,
                    totalCollections: cols.length,
                    activeCollections: cols.filter(
                      (c: any) => c.status === "active",
                    ).length,
                  }
                : prev.stats,
            }));
            return cols;
          });

        const activitiesPromise = axiosInstance
          .get(`/dashboard/activities?limit=${RECENT_ACTIVITY_LIMIT}`)
          .then((res) => res?.data?.data || res?.data || res || [])
          .catch(() => null)
          .then((activitiesData: any) => {
            if (!isStillCurrent()) return activitiesData;
            const activitiesRows = Array.isArray(activitiesData)
              ? activitiesData
              : [];

            // The collection title comes off the activity row itself — the
            // backend already labels every row (see controllers/dashboard.js's
            // `titleByCollection` merge). This is what lets the feed render
            // WITHOUT waiting for /collections; the previous code built a
            // title map from that response and so could not commit until it
            // had arrived.
            const activities = activitiesRows.map((activity: any) => {
              const createdAt = activity.created_at;
              return {
                id: activity.id,
                name: activity.name || "",
                email: activity.email || "",
                amount: Number(activity.gross_amount || activity.amount) || 0,
                created_at: createdAt,
                collection_title: activity.collection_title || "Unknown",
                relative_time: toRelativeTime(createdAt),
              };
            });

            set({ activities, activitiesLoading: false });
            return activitiesData;
          });

        await Promise.all([statsPromise, collectionsPromise, activitiesPromise]);

        if (!isStillCurrent()) return;

        set({
          isLoading: false,
          isRefreshing: false,
          statsLoading: false,
          collectionsLoading: false,
          activitiesLoading: false,
          error: null,
          lastFetchedAt: Date.now(),
        });
      } catch (error: any) {
        console.error("Dashboard load error:", error);
        // Every section flag is cleared too, otherwise a failure would leave
        // skeletons shimmering forever with no error surfaced next to them.
        set({
          isLoading: false,
          isRefreshing: false,
          statsLoading: false,
          collectionsLoading: false,
          activitiesLoading: false,
          error: error?.message || "Failed to load dashboard",
        });
      } finally {
        set({ inFlight: null });
      }
    })();

    set({ inFlight: request });
    return request;
  },
}));
