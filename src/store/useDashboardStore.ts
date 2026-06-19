import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { DashboardState, DashboardStats, Transaction } from "@/types";
import { useMemo } from "react";
import { isAfter } from "date-fns";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

export function useDashboard(collections = [], contributions = [], userId) {
  // Ensure collections and contributions are always arrays
  const safeCollections = Array.isArray(collections) ? collections : [];
  const safeContributions = Array.isArray(contributions) ? contributions : [];

  const now = new Date();

  const stats = {
    total_collections: safeCollections.length || 0,
    total_contributions: safeContributions.length || 0,
    total_amount: safeCollections.reduce((sum, c) => sum + (c.amount || 0), 0),
    active_collections: safeCollections.filter((c) => {
      // If deadline exists and is in the future, consider active
      if (c.deadline) {
        return isAfter(new Date(c.deadline), now);
      }
      // fallback to status if no deadline
      return c.status === "active";
    }).length,
  };

  const recentPayments = useMemo(
    () =>
      safeContributions.map((contribution) => ({
        id: contribution.id,
        user_id: userId,
        collection_id: contribution.collection_id,
        contribution_id: contribution.id,
        withdrawal_id: null,
        amount: contribution.amount,
        created_at: contribution.created_at,
        description: `Contribution from ${contribution.contributor_name}`,
        type: "contribution",
        collections: {
          title:
            safeCollections.find((c) => c.id === contribution.collection_id)
              ?.title || "Unknown",
        },
      })),
    [safeContributions, safeCollections, userId]
  );

  return { stats, recentPayments, isLoading: false };
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  stats: null,
  recentPayments: [],
  isLoading: false,
  error: null,

  fetchDashboardStats: async (userId?: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!userId) throw new Error("User ID is required");

      // Get collections count
      const { count: totalCollections } = await supabase
        .from("collections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { count: activeCollections } = await supabase
        .from("collections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");

      // Get user's collections to calculate contributions
      const { data: collections } = await supabase
        .from("collections")
        .select("id")
        .eq("user_id", userId);

      let totalContributions = 0;
      let totalAmount = 0;

      if (collections && collections.length > 0) {
        const collectionIds = collections.map((c) => c.id);

        const { data: contributions } = await supabase
          .from("contributions")
          .select("amount")
          .in("collection_id", collectionIds)
          .eq("status", "paid");

        if (contributions) {
          totalContributions = contributions.length;
          totalAmount = contributions.reduce(
            (sum, c) => sum + (c.amount || 0),
            0
          );
        }
      }

      const stats: DashboardStats = {
        total_collections: totalCollections || 0,
        total_contributions: totalContributions,
        total_amount: totalAmount,
        active_collections: activeCollections || 0,
      };

      set({
        stats,
        isLoading: false,
      });

      return stats;
    } catch (error: any) {
      set({ error: toFriendlyErrorMessage(error), isLoading: false });
      throw error;
    }
  },

  fetchRecentPayments: async (userId?: string, limit: number = 5) => {
    set({ isLoading: true, error: null });
    try {
      if (!userId) throw new Error("User ID is required");

      // Get user's collections first
      const { data: collections } = await supabase
        .from("collections")
        .select("id, title")
        .eq("user_id", userId);

      if (!collections || collections.length === 0) {
        set({ recentPayments: [], isLoading: false });
        return [];
      }

      const collectionIds = collections.map((c) => c.id);

      const { data: contributions, error } = await supabase
        .from("contributions")
        .select("*")
        .in("collection_id", collectionIds)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Format as transactions for compatibility
      const formattedPayments: Transaction[] =
        contributions?.map((contribution) => ({
          id: contribution.id,
          user_id: userId,
          collection_id: contribution.collection_id,
          contribution_id: contribution.id,
          withdrawal_id: null,
          amount: contribution.amount,
          created_at: contribution.created_at,
          description: `Contribution from ${contribution.contributor_name}`,
          type: "contribution",
          collections: {
            title:
              collections.find((c) => c.id === contribution.collection_id)
                ?.title || "Unknown",
          },
        })) || [];

      set({
        recentPayments: formattedPayments,
        isLoading: false,
      });

      return formattedPayments;
    } catch (error: any) {
      set({ error: toFriendlyErrorMessage(error), isLoading: false });
      throw error;
    }
  },
}));
