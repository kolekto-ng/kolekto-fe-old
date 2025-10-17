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
import { toast } from "sonner";
import { axiosInstance } from "../utils/axios";

export const useActivities = create((set, get) => ({
  activities: [],
  isLoading: false, // loading if no activities yet
  error: null,

  // get activities
  getActivities: async () => {
    set({ isLoading: true });
    try {
      const activities = await axiosInstance.get("/dashboard/activities");
      set({ activities: activities.data.data, isLoading: false });
      console.log(activities, "activities/me");
    } catch (error) {
      console.error("Auth check error:", error);
      set({ user: null, session: null, isLoading: false, error: error });
    }
  },
}));
