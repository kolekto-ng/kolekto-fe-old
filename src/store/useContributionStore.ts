import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Contribution, ContributionState } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { axiosInstance } from "@/utils/axios";
import { normalizeContributions } from "@/utils/contributions";

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
      set({ error: error.message, isLoading: false });
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
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createContribution: async (contributionData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("contributions")
        .insert({
          collection_id: contributionData.collection_id!,
          contributor_id: contributionData.contributor_id!,
          contributor_name: contributionData.contributor_name!,
          contributor_email: contributionData.contributor_email!,
          contributor_phone: contributionData.contributor_phone,
          amount: contributionData.amount!,
          payment_method: contributionData.payment_method || "card",
          status: contributionData.status || "pending",
          receipt_details: contributionData.receipt_details || {},
          contact_info: contributionData.contact_info || {},
        })
        .select()
        .single();

      if (error) throw error;

      // Add the new contribution to the state
      set((state) => ({
        contributions: [
          {
            ...data,
            formattedAmount: formatCurrency(data.amount),
            formattedDate: formatDate(data.created_at),
          } as Contribution,
          ...state.contributions,
        ],
        isLoading: false,
      }));

      return data as Contribution;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateContributionStatus: async (id, status, reference) => {
    set({ isLoading: true, error: null });
    try {
      const updates: {
        status: string;
        payment_reference?: string;
      } = { status };

      if (reference) {
        updates.payment_reference = reference;
      }

      const { data, error } = await supabase
        .from("contributions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Update the contribution in the state
      set((state) => ({
        contributions: state.contributions.map((contribution) =>
          contribution.id === id
            ? {
                ...contribution,
                ...data,
                formattedAmount: formatCurrency(data.amount),
                formattedDate: formatDate(data.created_at),
              }
            : contribution
        ),
        isLoading: false,
      }));

      return data as Contribution;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));
