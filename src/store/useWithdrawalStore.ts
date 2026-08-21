import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Withdrawal, WithdrawalState } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { toast } from "@/lib/toast";
import { axiosInstance } from "@/utils/axios";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";
// Cache-key input only — dependency-free module. See Wave 6.2.
import { getActiveWorkspaceId } from "@/utils/activeWorkspace";

export const useWithdrawalStore = create((set, get) => ({
  withdrawals: [],
  isLoading: false,
  error: null,
  inFlight: null as Promise<any> | null,
  lastFetchedAt: 0,
  lastFetchKey: "",

  // Wave 6.7F.5 — the workspace OWNER's queue of ADMIN-initiated withdrawals
  // sitting at 'pending_owner_approval', awaiting their approval before the
  // withdrawal is even eligible for Kolekto Super Admin review. Kept as
  // separate state from `withdrawals` above: that list is the caller's OWN
  // withdrawals (GET /withdrawals, user_id-scoped); this is a workspace-wide
  // read gated server-side on withdrawal:approve (OWNER-only).
  ownerApprovals: [],
  ownerApprovalsLoading: false,
  ownerApprovalsError: null,

  fetchWithdrawals: async (
    userId?: string,
    collectionId?: string,
    opts: { force?: boolean } = {},
  ) => {
    // Wave 6.2: workspace is part of the cache identity.
    const requestWorkspaceId = getActiveWorkspaceId();
    const key = `${userId || "all"}:${collectionId || "all"}:${requestWorkspaceId ?? "none"}`;
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

        // Wave 6.2 — stale in-flight guard.
        if (getActiveWorkspaceId() !== requestWorkspaceId) return res.data;

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

  // GET /withdrawals/owner-approvals — modeled on fetchWithdrawals' request/
  // error-handling shape, minus its cross-workspace caching: this list is
  // small (one workspace's pending queue) and OWNER-only, so a plain fetch
  // is enough rather than the dedupe/staleness machinery fetchWithdrawals
  // needs for its heavier, more frequently-polled use.
  fetchOwnerApprovals: async () => {
    set({ ownerApprovalsLoading: true, ownerApprovalsError: null });
    try {
      const res = await axiosInstance.get("/withdrawals/owner-approvals");
      const ownerApprovals = Array.isArray(res?.data?.withdrawals)
        ? res.data.withdrawals
        : [];
      set({ ownerApprovals, ownerApprovalsLoading: false });
      return res.data;
    } catch (error: any) {
      const message = toFriendlyErrorMessage(
        error,
        "Could not load withdrawals awaiting your approval. Please try again."
      );
      set({ ownerApprovalsError: message, ownerApprovalsLoading: false });
      throw error;
    }
  },

  // POST /withdrawals/:id/owner-approve — modeled on createWithdrawal's
  // shape. Performs NO approval logic client-side: the backend is
  // authoritative (re-derives workspace membership + withdrawal:approve
  // fresh from the withdrawal's own collection -> workspace_id on every
  // call). This only calls the endpoint and reflects the result — on success
  // it drops the row from `ownerApprovals` so the item visibly moves off the
  // "awaiting your approval" queue (its status is now 'pending' server-side,
  // eligible for the existing Super Admin flow).
  ownerApproveWithdrawal: async (withdrawalId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await axiosInstance.post(`/withdrawals/${withdrawalId}/owner-approve`);
      set((state: any) => ({
        isLoading: false,
        ownerApprovals: Array.isArray(state.ownerApprovals)
          ? state.ownerApprovals.filter((w: any) => w.id !== withdrawalId)
          : state.ownerApprovals,
      }));
      toast.success("Withdrawal approved");
      return data;
    } catch (error: any) {
      const message = toFriendlyErrorMessage(
        error,
        "We could not approve this withdrawal. Please try again."
      );
      set({ error: message, isLoading: false });
      toast.error(message);
      throw error;
    }
  },

  // POST /withdrawals/:id/owner-reject — sibling of ownerApproveWithdrawal
  // above, same shape. `reason` is optional and passed through verbatim (no
  // client-side length limit — the backend enforces none either). Performs
  // NO rejection logic client-side: the backend is authoritative. On success
  // the row moves to 'owner_rejected' server-side and drops off the
  // "awaiting your approval" queue, exactly like the approve path.
  ownerRejectWithdrawal: async (withdrawalId: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await axiosInstance.post(`/withdrawals/${withdrawalId}/owner-reject`, {
        reason: reason || undefined,
      });
      set((state: any) => ({
        isLoading: false,
        ownerApprovals: Array.isArray(state.ownerApprovals)
          ? state.ownerApprovals.filter((w: any) => w.id !== withdrawalId)
          : state.ownerApprovals,
      }));
      toast.success("Withdrawal rejected");
      return data;
    } catch (error: any) {
      const message = toFriendlyErrorMessage(
        error,
        "We could not reject this withdrawal. Please try again."
      );
      set({ error: message, isLoading: false });
      toast.error(message);
      throw error;
    }
  },
}));
