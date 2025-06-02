import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Withdrawal, WithdrawalState } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { toast } from "sonner";
import { axiosInstance } from "@/utils/axios";

export const useWithdrawalStore = create((set, get) => ({
  withdrawals: [],
  isLoading: false,
  error: null,

  fetchWithdrawals: async (userId?: string, collectionId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get("/withdrawals", {
        params: { userId, collectionId },
      });

      // let query = supabase
      //   .from("withdrawals")
      //   .select(
      //     `
      //     *,
      //     collections (title)
      //   `
      //   )
      //   .order("created_at", { ascending: false });

      // if (userId) {
      //   query = query.eq("organizer_id", userId);
      // }

      // if (collectionId) {
      //   query = query.eq("collection_id", collectionId);
      // }

      // const { data, error } = await query;

      // if (error) throw error;

      // Format data
      // const formattedData =
      //   data?.map((withdrawal) => ({
      //     ...withdrawal,
      //     formattedAmount: formatCurrency(withdrawal.amount),
      //     formattedDate: formatDate(withdrawal.created_at),
      //   })) || [];

      set({
        withdrawals: res.data.withdrawals,
        isLoading: false,
      });

      return res.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createWithdrawal: async (withdrawalData) => {
    set({ isLoading: true, error: null });
    try {
      const data = await axiosInstance.post(
        "/withdrawals/request",
        withdrawalData
      );

      // const { data, error } = await supabase
      //   .from("withdrawals")
      //   .insert(withdrawalData)
      //   .select("*, collections (title)")
      //   .single();

      // if (error) throw error;

      // Format the new withdrawal
      // const formattedWithdrawal = {
      //   ...data,
      //   formattedAmount: formatCurrency(data.amount),
      //   formattedDate: formatDate(data.created_at),
      // };

      // Add the new withdrawal to the state
      // set((state) => ({
      //   withdrawals: [formattedWithdrawal, ...state.withdrawals],
      //   isLoading: false,
      // }));

      toast.success("Withdrawal request submitted successfully");
      // return formattedWithdrawal as Withdrawal;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      toast.error(`Failed to submit withdrawal request: ${error.message}`);
      throw error;
    }
  },
}));
