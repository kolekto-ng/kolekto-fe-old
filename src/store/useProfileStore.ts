import { create } from "zustand";
import { toast } from "sonner";
import { axiosInstance } from "@/utils/axios";
import { createClient } from "@supabase/supabase-js";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// KYC realtime subscription is a singleton keyed by user. Without this guard,
// fetchKYCStatus() created a brand-new channel on every call — and its own
// realtime callback re-invokes fetchKYCStatus(), so each kyc_verifications
// change doubled the number of live channels (a runaway subscription leak).
let kycChannel: ReturnType<typeof supabase.channel> | null = null;
let kycSubscribedFor: string | null = null;

function ensureKycSubscription(userId: string, onChange: () => void) {
  if (kycSubscribedFor === userId && kycChannel) return; // already live
  if (kycChannel) {
    supabase.removeChannel(kycChannel);
    kycChannel = null;
  }
  kycChannel = supabase
    .channel(`kyc-status-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "kyc_verifications", filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  kycSubscribedFor = userId;
}

interface ProfileState {
  profile: any;
  kycData: any;
  kycLoading: boolean;
  profileLoading: boolean;
  profileRefreshing: boolean;
  profileLastFetchedAt: number;
  profileInFlight: Promise<void> | null;
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
  profileRefreshing: false,
  profileLastFetchedAt: 0,
  profileInFlight: null,
  passwordStep: "idle",
  passwordError: null,
  otpEmail: null,
  activeSection: "personal",

  setActiveSection: (section: string) => set({ activeSection: section }),

  fetchProfile: async () => {
    const { profile, profileLastFetchedAt, profileInFlight } = get();
    const hasCachedProfile = !!profile;
    const isFresh =
      hasCachedProfile && Date.now() - Number(profileLastFetchedAt || 0) < 60_000;

    if (profileInFlight) return profileInFlight;
    if (isFresh) return;

    const request = (async () => {
      set({
        profileLoading: !hasCachedProfile,
        profileRefreshing: hasCachedProfile,
      });
      try {
        const { data } = await axiosInstance.get("/settings/profile");
        set({
          profile: data.data,
          profileLoading: false,
          profileRefreshing: false,
          profileLastFetchedAt: Date.now(),
        });
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        set({ profileLoading: false, profileRefreshing: false });
      } finally {
        set({ profileInFlight: null });
      }
    })();

    set({ profileInFlight: request });
    return request;
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

      set({
        profile: result.data,
        profileLoading: false,
        profileRefreshing: false,
        profileLastFetchedAt: Date.now(),
      });
      toast.success("Profile updated");
      return true;
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast.error(toFriendlyErrorMessage(error, "Could not update profile. Please try again."));
      set({ profileLoading: false });
      return false;
    }
  },

  fetchKYCStatus: async (userId: string) => {
    set({ kycLoading: true });

    // Subscribe to real-time changes on this user's kyc_verifications row so
    // the KYC section updates automatically when an admin approves a document
    // — without requiring a manual refresh. Idempotent: only one channel per
    // user ever exists, so the re-fetch in the callback can never spawn more.
    ensureKycSubscription(userId, () => {
      get().fetchKYCStatus(userId);
    });

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
      const res = await axiosInstance.post("/settings/security/request-password-otp");
      const email = res.data?.email;
      set({
        passwordStep: "otp-sent",
        otpEmail: email || null,
        passwordError: null,
      });
      toast.success("OTP sent");
      return true;
    } catch (error: any) {
      const msg = toFriendlyErrorMessage(error, "Could not send OTP. Please try again.");
      set({ passwordStep: "error", passwordError: msg });
      toast.error(msg);
      return false;
    }
  },

  verifyOTPAndChangePassword: async (otp: string, newPassword: string, confirmPassword: string) => {
    set({ passwordStep: "verifying", passwordError: null });
    try {
      const res = await axiosInstance.post("/settings/security/verify-password-otp", {
        otp,
        newPassword,
        confirmPassword,
      });

      set({ passwordStep: "success", passwordError: null });
      toast.success("Password changed");

      // Supabase invalidates active sessions when a password changes.
      // If the backend confirms this, clear local credentials and route the
      // user to /login proactively instead of leaving them with a token that
      // 401s on the next request.
      if (res?.data?.sessionInvalidated) {
        try {
          localStorage.removeItem("kolekto-auth-token");
        } catch {
          /* storage may be unavailable; ignore */
        }
        // Give the success state a beat so the user sees the confirmation.
        setTimeout(() => {
          window.history.replaceState(null, "", "/login");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, 1200);
      }

      return true;
    } catch (error: any) {
      const msg = toFriendlyErrorMessage(error, "Could not change password. Please try again.");
      set({ passwordStep: "error", passwordError: msg });
      toast.error(msg);
      return false;
    }
  },

  resetPasswordState: () => {
    set({ passwordStep: "idle", passwordError: null, otpEmail: null });
  },
}));
