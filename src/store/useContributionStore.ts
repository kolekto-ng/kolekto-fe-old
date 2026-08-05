import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Contribution, ContributionState } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { axiosInstance } from "@/utils/axios";
import { normalizeContributions } from "@/utils/contributions";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

export const useContributionStore = create((set, get) => ({
  contributions: [],
  currentContributionCollection: [],
  isLoading: false,
  error: null,

  fetchCollectionById: async (collectionId?: string) => {
    set({ isLoading: true, error: null });
    try {
      let res = await axiosInstance.get("/collection", {
        params: { collectionId },
      });

      // Format dataa
      const formattedData = {
        ...res.data.data,
        formattedAmount: formatCurrency(res.data.data.amount),
        formattedDate: formatDate(res.data.data.created_at),
      };

      set({
        currentContributionCollection: formattedData as Contribution[],
        isLoading: false,
      });

      return formattedData as Contribution[];
    } catch (error: any) {
      set({ error: toFriendlyErrorMessage(error), isLoading: false });
      throw error;
    }
  },

  fetchContributions: async (collectionId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.get("/contributions", {
        params: { collectionId },
      });

      // Format data
      const normalizedData = normalizeContributions(data.data || []);
      const formattedData =
        normalizedData.map((contribution) => ({
          ...contribution,
          formattedAmount: formatCurrency(contribution.amount),
          formattedDate: formatDate(contribution.created_at),
        })) || [];

      set({
        contributions: formattedData as Contribution[],
        isLoading: false,
      });

      return formattedData as Contribution[];
    } catch (error: any) {
      set({ error: toFriendlyErrorMessage(error), isLoading: false });
      throw error;
    }
  },

  // ── REMOVED: createContribution / updateContributionStatus ────────────────
  //
  // Both wrote to `contributions` — a financial table — directly from the
  // browser with supabase-js, and both were verified DEAD: nothing in src/
  // ever called them (ContributionForm.tsx destructured `createContribution`
  // but never invoked it). Contributions are created and transitioned solely
  // by the payment pipeline: POST /api/payments/initialize-payment inserts the
  // pending row, and verify-paystack-payment marks it paid after independently
  // re-verifying the amount with Paystack.
  //
  // Keeping them would have forced an INSERT/UPDATE grant on `contributions`
  // for the `authenticated` role, which is exactly the privilege that let
  // anyone holding the public anon key forge and mutate contribution rows
  // while RLS was disabled. See database/c1_rls_lockdown.sql.
}));
