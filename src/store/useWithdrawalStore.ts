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
      toast.success("Withdrawal request submitted successfully");
      // return formattedWithdrawal as Withdrawal;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      toast.error(`Failed to submit withdrawal request: ${error.message}`);
      throw error;
    }
  },
}));
