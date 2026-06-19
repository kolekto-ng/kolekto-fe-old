import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Withdrawal, WithdrawalState } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { toast } from "sonner";
import { axiosInstance } from "@/utils/axios";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

export const useWithdrawalStore = create((set, get) => ({
  withdrawals: [],
  isLoading: false,
  error: null,
  inFlight: null as Promise<any> | null,
  lastFetchedAt: 0,
  lastFetchKey: "",

  fetchWithdrawals: async (
    userId?: string,
    collectionId?: string,
    opts: { force?: boolean } = {},
  ) => {
    const key = `${userId || "all"}:${collectionId || "all"}`;
    const { inFlight, lastFetchedAt, lastFetchKey, withdrawals } = get();
    const { force = false } = opts;
    const isFresh =
      lastFetchKey === key && Date.now() - Number(lastFetchedAt || 0) < 30_000;

    if (!force && inFlight && lastFetchKey === key) return inFlight;
    if (!force && isFresh && Array.isArray(withdrawals)) return { withdrawals };

    const request = (async () => {
      set({ isLoading: true, error: null, lastFetchKey: key });
      try {
        const res = await axiosInstance.get("/withdrawals", {
          params: { userId, collectionId },
        });

        set({
          withdrawals: Array.isArray(res?.data?.withdrawals)
            ? res.data.withdrawals
            : [],
          isLoading: false,
          lastFetchedAt: Date.now(),
        });

        return res.data;
      } catch (error: any) {
        set({ error: toFriendlyErrorMessage(error, "Could not load withdrawals. Please try again."), isLoading: false });
        throw error;
      } finally {
        set({ inFlight: null });
      }
    })();

    set({ inFlight: request });
    return request;
  },

  createWithdrawal: async (withdrawalData) => {
    set({ isLoading: true, error: null });
    try {
      const data = await axiosInstance.post(
        "/withdrawals/request",
        withdrawalData
      );
      set({ isLoading: false });
      toast.success("Withdrawal request sent");
      return data;
    } catch (error: any) {
      // Prefer the backend's specific error message (the controller now
      // returns `error`, `code`, `details`, `hint`). Falling back to the
      // raw axios message would show "Request failed with status code 500"
      // which is useless to the user.
      const message = toFriendlyErrorMessage(error, "We could not send the withdrawal request. Please try again.");
      set({ error: message, isLoading: false });
      toast.error(message);
      throw error;
    }
  },
}));
