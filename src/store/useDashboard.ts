// import { useMemo } from "react";
// import { Transaction, Collection, Contribution } from "@/types";

// interface UseDashboardPaymentsProps {
//   contributions: Contribution[];
//   collections: Collection[];
//   userId: string;
// }

// export function useDashboardPayments({
//   contributions,
//   collections,
//   userId,
// }: UseDashboardPaymentsProps) {
//   const recentPayments: Transaction[] = useMemo(
//     () =>
//       contributions?.map((contribution) => ({
//         id: contribution.id,
//         user_id: userId,
//         collection_id: contribution.collection_id,
//         contribution_id: contribution.id,
//         withdrawal_id: null,
//         amount: contribution.amount,
//         created_at: contribution.created_at,
//         description: `Contribution from ${contribution.contributor_name}`,
//         type: "contribution",
//         collections: {
//           title:
//             collections.find((c) => c.id === contribution.collection_id)
//               ?.title || "Unknown",
//         },
//       })) || [],
//     [contributions, collections, userId]
//   );

//   return {
//     recentPayments,
//     isLoading: false,
//     error: null,
//   };
// }

import { create } from "zustand";
import { axiosInstance } from "../utils/axios";
// Cache-key input only — dependency-free module, avoids a cycle through
// useWorkspaceStore → axios. See Wave 6.2.
import { getActiveWorkspaceId } from "@/utils/activeWorkspace";

export const useActivities = create((set, get) => ({
  activities: [],
  isLoading: false, // loading if no activities yet
  error: null,
  lastFetchedAt: 0,
  // Wave 6.2: this store previously had NO cache key at all — a global
  // singleton with a 30s TTL, so a workspace switch kept serving the previous
  // workspace's activity feed for up to half a minute. Now keyed on the
  // active workspace.
  lastFetchKey: "",
  inFlight: null as Promise<void> | null,

  // get activities
  getActivities: async (
    opts: { force?: boolean; limit?: number } = {},
  ): Promise<void> => {
    // `as any`: this store is created without a generic, so `get()` is typed
    // `{}` and reading ANY field off it is a TS error (already the case for
    // activities/inFlight/lastFetchedAt). Cast once here rather than let the
    // Wave 6.2 `lastFetchKey` read add a new one.
    const { activities, inFlight, lastFetchedAt, lastFetchKey } = get() as any;
    const { force = false, limit } = opts;
    const requestWorkspaceId = getActiveWorkspaceId();
    const key = requestWorkspaceId ?? "none";
    const sameScope = lastFetchKey === key;
    const isFresh = sameScope && Date.now() - Number(lastFetchedAt || 0) < 30_000;

    if (!force && inFlight && sameScope) return inFlight;
    if (!force && isFresh && Array.isArray(activities) && activities.length > 0)
      return;

    const request = (async () => {
      set({
        isLoading: !Array.isArray(activities) || activities.length === 0,
        error: null,
        lastFetchKey: key,
      });
      try {
        const query = typeof limit === "number" ? `?limit=${limit}` : "";
        const response = await axiosInstance.get(`/dashboard/activities${query}`);
        const rows = response?.data?.data || response?.data || [];

        // Wave 6.2 — stale in-flight guard: a response that left under the
        // previous workspace must not overwrite the current one's feed.
        if (getActiveWorkspaceId() !== requestWorkspaceId) return;

        set({
          activities: Array.isArray(rows) ? rows : [],
          isLoading: false,
          error: null,
          lastFetchedAt: Date.now(),
        });
      } catch (error) {
        console.error("Activities fetch error:", error);
        set({ isLoading: false, error });
      } finally {
        set({ inFlight: null });
      }
    })();

    set({ inFlight: request });
    return request;
  },
}));
