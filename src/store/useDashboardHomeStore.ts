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
  isLoading: boolean;
  isRefreshing: boolean;
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
  isLoading: false,
  isRefreshing: false,
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
        isLoading: false,
        isRefreshing: false,
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
        const statsPromise = axiosInstance
          .get("/dashboard/stats")
          .then((res) => res?.data?.data || res?.data || res || {})
          .catch(() => ({}));

        const collectionsPromise = axiosInstance
          .get("/collections")
          .then((res) => res?.data?.data || [])
          .catch(() => []);

        const activitiesPromise = axiosInstance
          .get(`/dashboard/activities?limit=${RECENT_ACTIVITY_LIMIT}`)
          .then((res) => res?.data?.data || res?.data || res || [])
          .catch(() => null);

        const [statsData, allCollections, activitiesData] = await Promise.all([
          statsPromise,
          collectionsPromise,
          activitiesPromise,
        ]);

        const cols: any[] = Array.isArray(allCollections) ? allCollections : [];
        const titleMap: Record<string, string> = {};
        for (const c of cols) titleMap[c.id] = c.title;

        // Counts come from the backend, which computes them over the same
        // scope it applied to the list. Falling back to the local array keeps
        // the cards populated if /dashboard/stats itself failed.
        const totalCollections = Number(
          statsData.totalCollections ?? cols.length ?? 0,
        );
        const activeCollections = Number(
          statsData.activeCollections ??
            cols.filter((c) => c.status === "active").length ??
            0,
        );

        // `contributions` is embedded on each collection row, with AMOUNTS
        // present only when the caller holds transaction:read. Without it the
        // reduce yields 0 and the card shows a participant count but no
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
                (sum: number, contribution: any) => sum + Number(contribution.amount || 0),
                0,
              ),
              participants: paid.length,
              deadline: collection.deadline,
              created_at: collection.created_at,
              goalAmount: Number(collection.target_amount || collection.amount || 0) || undefined,
              maxParticipants: Number(collection.max_contributions || 0) || undefined,
            };
          });

        const activitiesRows = Array.isArray(activitiesData) ? activitiesData : [];

        const activities = (activitiesRows || []).map((activity: any) => {
          const createdAt = activity.created_at;
          return {
            id: activity.id,
            name: activity.name || "",
            email: activity.email || "",
            amount: Number(activity.gross_amount || activity.amount) || 0,
            created_at: createdAt,
            collection_title:
              titleMap[activity.collection_id] || activity.collection_title || "Unknown",
            relative_time: toRelativeTime(createdAt),
          };
        });

        // Wave 6.2 — stale in-flight guard: discard a response that was
        // issued under a workspace the user has since switched away from,
        // rather than letting it overwrite the new workspace's state.
        if (getActiveWorkspaceId() !== requestWorkspaceId) return;

        set({
          stats: {
            totalCollections,
            activeCollections,
            totalBalance: Number(statsData.totalBalance || 0),
            availableBalance: Number(statsData.availableBalance || 0),
            pendingBalance: Number(statsData.pendingBalance || 0),
          },
          activities,
          recentCollections,
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastFetchedAt: Date.now(),
        });
      } catch (error: any) {
        console.error("Dashboard load error:", error);
        set({
          isLoading: false,
          isRefreshing: false,
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
