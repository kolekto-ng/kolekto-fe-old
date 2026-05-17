import { create } from "zustand";
import { toast } from "sonner";
import { axiosInstance } from "../utils/axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

interface ProfileState {
  profile: any;
  kycData: any;
  kycLoading: boolean;
  profileLoading: boolean;
  passwordStep: "idle" | "requesting" | "otp-sent" | "verifying" | "success" | "error";
  passwordError: string | null;
  otpEmail: string | null;
  activeSection: string;
  setActiveSection: (section: string) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: any) => Promise<boolean>;
  fetchKYCStatus: (userId: string) => Promise<void>;
  requestPasswordOTP: () => Promise<boolean>;
  verifyOTPAndChangePassword: (otp: string, newPassword: string, confirmPassword: string) => Promise<boolean>;
  resetPasswordState: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  kycData: null,
  kycLoading: false,
  profileLoading: false,
  passwordStep: "idle",
  passwordError: null,
  otpEmail: null,
  activeSection: "personal",

  setActiveSection: (section: string) => set({ activeSection: section }),

  fetchProfile: async () => {
    set({ profileLoading: true });
    try {
      const { data } = await axiosInstance.get("/settings/profile");
      set({ profile: data.data, profileLoading: false });
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      set({ profileLoading: false });
    }
  },

  updateProfile: async (profileData: any) => {
    set({ profileLoading: true });
    try {
      // Get token from localStorage
      const sessionStr = localStorage.getItem("kolekto-auth-token");
      if (!sessionStr) throw new Error("Not authenticated");
      const session = JSON.parse(sessionStr);
      const token = session.access_token;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/profile-update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update profile");

      set({ profile: result.data, profileLoading: false });
      toast.success("Profile updated successfully");
      return true;
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast.error(error.message || "Failed to update profile");
      set({ profileLoading: false });
      return false;
    }
  },

  fetchKYCStatus: async (userId: string) => {
    set({ kycLoading: true });

    // Subscribe to real-time changes on this user's kyc_verifications row so
    // the KYC section updates automatically when an admin approves a document
    // — without requiring a manual refresh.
    supabase
      .channel(`kyc-status-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kyc_verifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Re-fetch silently (no loading spinner) when any KYC row changes
          get().fetchKYCStatus(userId);
        }
      )
      .subscribe();

    try {
      const [res, kycVerificationRes] = await Promise.all([
        axiosInstance.get(`/settings/kyc/${userId}`),
        supabase
          .from("kyc_verifications")
          .select("status, nin_verified, identity_verified, address_verified, selfie_verified")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const documents = res.data?.documents || [];

      const identityDocs = documents
        .filter((doc: any) => doc.document_type === "identity")
        .map((doc: any) => ({
          id: doc.id,
          type: doc.verification_type,
          status: doc.status,
          rejectionReason: doc.rejection_reason,
          uploadedAt: doc.uploaded_at,
          files: doc.files || [],
        }));
      const addressDocs = documents
        .filter((doc: any) => doc.document_type === "address")
        .map((doc: any) => ({
          id: doc.id,
          type: doc.verification_type,
          status: doc.status,
          rejectionReason: doc.rejection_reason,
          uploadedAt: doc.uploaded_at,
          files: doc.files || [],
        }));

      const kycVerification = kycVerificationRes.data;

      set({
        kycData: {
          ...res.data?.kycData,
          overallStatus: kycVerification?.status || "not_started",
          ninVerified: kycVerification?.nin_verified || false,

          identityVerification: {
            status: identityDocs.length > 0 ? identityDocs[0].status : "notStarted",
            documents: identityDocs,
          },
          addressVerification: {
            status: addressDocs.length > 0 ? addressDocs[0].status : "notStarted",
            documents: addressDocs,
          },
        },
        kycLoading: false,
      });
    } catch (error) {
      console.error("Failed to fetch KYC data:", error);
      set({ kycLoading: false });
    }
  },

  requestPasswordOTP: async () => {
    set({ passwordStep: "requesting", passwordError: null });
    try {
      const sessionStr = localStorage.getItem("kolekto-auth-token");
      if (!sessionStr) throw new Error("Not authenticated");
      const session = JSON.parse(sessionStr);
      const token = session.access_token;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "request-otp" }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send OTP");

      set({
        passwordStep: "otp-sent",
        otpEmail: result.email,
        passwordError: null,
      });
      toast.success("OTP sent to your email");
      return true;
    } catch (error: any) {
      set({ passwordStep: "error", passwordError: error.message });
      toast.error(error.message || "Failed to send OTP");
      return false;
    }
  },

  verifyOTPAndChangePassword: async (otp: string, newPassword: string, confirmPassword: string) => {
    set({ passwordStep: "verifying", passwordError: null });
    try {
      const sessionStr = localStorage.getItem("kolekto-auth-token");
      if (!sessionStr) throw new Error("Not authenticated");
      const session = JSON.parse(sessionStr);
      const token = session.access_token;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "verify-and-change",
          otp,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to change password");

      set({ passwordStep: "success", passwordError: null });
      toast.success("Password changed successfully!");
      return true;
    } catch (error: any) {
      set({ passwordStep: "error", passwordError: error.message });
      toast.error(error.message || "Failed to change password");
      return false;
    }
  },

  resetPasswordState: () => {
    set({ passwordStep: "idle", passwordError: null, otpEmail: null });
  },
}));
