import { create } from "zustand";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { axiosInstance } from "@/utils/axios";

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
      });
      return;
    }

    const state = get();
    const { force = false, silent = false } = opts;
    const hasCachedData =
      state.lastUserId === userId &&
      (state.recentCollections.length > 0 ||
        state.activities.length > 0 ||
        state.lastFetchedAt > 0);
    const isFresh =
      hasCachedData && Date.now() - Number(state.lastFetchedAt || 0) < DASHBOARD_STALE_MS;

    if (!force && state.inFlight && state.lastUserId === userId) return state.inFlight;
    if (!force && isFresh) return;

    const request = (async () => {
      set({
        isLoading: !hasCachedData && !silent,
        isRefreshing: hasCachedData || silent,
        error: null,
        lastUserId: userId,
      });

      try {
        const { data: collectionsRaw, error: colErr } = await supabase
          .from("collections")
          .select("id, title, status, collection_type, deadline, created_at")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(RECENT_COLLECTION_LIMIT);

        if (colErr) console.error("Collections fetch error:", colErr.message);

        const cols: any[] = collectionsRaw || [];
        const [
          { count: totalCollectionsCount },
          { count: activeCollectionsCount },
        ] = await Promise.all([
          supabase
            .from("collections")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),
          supabase
            .from("collections")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "active"),
        ]);

        const totalCollections = Number(totalCollectionsCount || 0);
        const activeCollections = Number(activeCollectionsCount || 0);
        const collectionIds: string[] = cols.map((c: any) => c.id);
        const recentCollectionIds = collectionIds.slice(0, RECENT_COLLECTION_LIMIT);
        const titleMap: Record<string, string> = {};
        for (const c of cols) titleMap[c.id] = c.title;

        const statsPromise = axiosInstance
          .get("/dashboard/stats")
          .then((res) => res?.data?.data || res?.data || res || {})
          .catch(() => ({}));

        const paidContribsPromise =
          recentCollectionIds.length > 0
            ? supabase
                .from("contributions")
                .select("amount, collection_id")
                .in("collection_id", recentCollectionIds)
                .eq("status", "paid")
                .then((res) => res.data || [])
                .catch(() => [])
            : Promise.resolve([]);

        const activitiesPromise = axiosInstance
          .get(`/dashboard/activities?limit=${RECENT_ACTIVITY_LIMIT}`)
          .then((res) => res?.data?.data || res?.data || res || [])
          .catch(() => null);

        const [statsData, paidContribs, activitiesData] = await Promise.all([
          statsPromise,
          paidContribsPromise,
          activitiesPromise,
        ]);

        const contribsByCol: Record<string, any[]> = {};
        for (const contribution of paidContribs || []) {
          if (!contribsByCol[contribution.collection_id]) {
            contribsByCol[contribution.collection_id] = [];
          }
          contribsByCol[contribution.collection_id].push(contribution);
        }

        const recentCollections = cols.slice(0, RECENT_COLLECTION_LIMIT).map((collection: any) => {
          const cList = contribsByCol[collection.id] || [];
          return {
            id: collection.id,
            title: collection.title,
            status: collection.status,
            collection_type: collection.collection_type || "fixed",
            totalRaised: cList.reduce(
              (sum: number, contribution: any) => sum + Number(contribution.amount || 0),
              0,
            ),
            participants: cList.length,
            deadline: collection.deadline,
            created_at: collection.created_at,
          };
        });

        let activitiesRows = activitiesData;
        if (!activitiesRows && collectionIds.length > 0) {
          const { data: contribs } = await supabase
            .from("contributions")
            .select("id, name, email, amount, gross_amount, created_at, collection_id")
            .in("collection_id", collectionIds)
            .eq("status", "paid")
            .order("created_at", { ascending: false })
            .limit(RECENT_ACTIVITY_LIMIT);
          activitiesRows = contribs || [];
        } else if (!activitiesRows) {
          activitiesRows = [];
        }

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
