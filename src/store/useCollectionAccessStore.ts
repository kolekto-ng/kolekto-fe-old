import { create } from "zustand";
import { axiosInstance } from "@/utils/axios";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

// Mirrors the OTP-then-confirm-link state machines already built for
// email-change (useProfileStore.ts) and collection transfer
// (useCollectionStore.ts) — same shape, different domain.
export const useCollectionAccessStore = create((set: any, get: any) => ({
  inviteStep: "idle" as "idle" | "requesting" | "otp-sent" | "verifying" | "link-sent" | "error",
  inviteError: null as string | null,
  inviteId: null as string | null,
  otpSentToEmail: null as string | null,
  pendingRecipientEmail: null as string | null,

  accessList: null as { activeGrants: any[]; pendingInvites: any[] } | null,
  accessListLoading: false,

  sharedCollections: [] as any[],
  sharedCollectionsLoading: false,

  requestAccess: async (
    collectionIds: string[],
    recipientEmail: string,
    canViewEarnings: boolean,
    canViewContributors: boolean,
  ) => {
    set({ inviteStep: "requesting", inviteError: null });
    try {
      const { data } = await axiosInstance.post("/collections/access/request", {
        collectionIds,
        recipientEmail,
        canViewEarnings,
        canViewContributors,
      });
      set({
        inviteStep: "otp-sent",
        inviteId: data?.inviteId || null,
        otpSentToEmail: data?.email || null,
        pendingRecipientEmail: recipientEmail,
        inviteError: null,
      });
      return true;
    } catch (err: any) {
      const msg = toFriendlyErrorMessage(err, "Could not start access request. Please try again.");
      set({ inviteStep: "error", inviteError: msg });
      return false;
    }
  },

  verifyAccessOTP: async (otp: string) => {
    set({ inviteStep: "verifying", inviteError: null });
    try {
      const inviteId = get().inviteId;
      await axiosInstance.post("/collections/access/verify", { inviteId, otp });
      set({ inviteStep: "link-sent", inviteError: null });
      return true;
    } catch (err: any) {
      const msg = toFriendlyErrorMessage(err, "Could not verify OTP. Please try again.");
      set({ inviteStep: "error", inviteError: msg });
      return false;
    }
  },

  resetInviteState: () => {
    set({
      inviteStep: "idle",
      inviteError: null,
      inviteId: null,
      otpSentToEmail: null,
      pendingRecipientEmail: null,
    });
  },

  fetchAccessList: async (collectionId: string) => {
    set({ accessListLoading: true });
    try {
      const { data } = await axiosInstance.get(`/collections/${collectionId}/access`);
      set({ accessList: data || { activeGrants: [], pendingInvites: [] }, accessListLoading: false });
      return data;
    } catch (err) {
      set({ accessListLoading: false });
      return null;
    }
  },

  revokeAccess: async (grantId: string) => {
    try {
      await axiosInstance.post(`/collections/access/grants/${grantId}/revoke`);
      return true;
    } catch (err) {
      return false;
    }
  },

  cancelAccessInvite: async (inviteId: string) => {
    try {
      await axiosInstance.post(`/collections/access/invites/${inviteId}/cancel`);
      return true;
    } catch (err) {
      return false;
    }
  },

  fetchSharedCollections: async () => {
    set({ sharedCollectionsLoading: true });
    try {
      const { data } = await axiosInstance.get("/collections/shared-with-me");
      set({ sharedCollections: data?.collections || [], sharedCollectionsLoading: false });
      return data?.collections || [];
    } catch (err) {
      set({ sharedCollectionsLoading: false });
      return [];
    }
  },

  fetchSharedCollectionDetail: async (collectionId: string) => {
    try {
      const { data } = await axiosInstance.get(`/collections/${collectionId}/shared-view`);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: toFriendlyErrorMessage(err, "Could not load this collection.") };
    }
  },

  // Standalone — used by the recipient's accept/decline page.
  respondToAccess: async (token: string, action: "accept" | "decline") => {
    try {
      const { data } = await axiosInstance.post("/collection-access/respond", { token, action });
      return { success: true, status: data?.status };
    } catch (err: any) {
      return { success: false, error: toFriendlyErrorMessage(err, "Could not respond to this invite.") };
    }
  },
}));
