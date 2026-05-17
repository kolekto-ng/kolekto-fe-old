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
      set({ isLoading: false });
      toast.success("Withdrawal request submitted successfully");
      return data;
    } catch (error: any) {
      // Prefer the backend's specific error message (the controller now
      // returns `error`, `code`, `details`, `hint`). Falling back to the
      // raw axios message would show "Request failed with status code 500"
      // which is useless to the user.
      const backendMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Withdrawal request failed";
      set({ error: backendMessage, isLoading: false });
      toast.error(backendMessage);
      throw error;
    }
  },
}));
