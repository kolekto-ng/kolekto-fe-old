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

export const useActivities = create((set, get) => ({
  activities: [],
  isLoading: false, // loading if no activities yet
  error: null,
  lastFetchedAt: 0,
  inFlight: null as Promise<void> | null,

  // get activities
  getActivities: async (
    opts: { force?: boolean; limit?: number } = {},
  ): Promise<void> => {
    const { activities, inFlight, lastFetchedAt } = get();
    const { force = false, limit } = opts;
    const isFresh = Date.now() - Number(lastFetchedAt || 0) < 30_000;

    if (!force && inFlight) return inFlight;
    if (!force && isFresh && Array.isArray(activities) && activities.length > 0)
      return;

    const request = (async () => {
      set({
        isLoading: !Array.isArray(activities) || activities.length === 0,
        error: null,
      });
      try {
        const query = typeof limit === "number" ? `?limit=${limit}` : "";
        const response = await axiosInstance.get(`/dashboard/activities${query}`);
        const rows = response?.data?.data || response?.data || [];
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
