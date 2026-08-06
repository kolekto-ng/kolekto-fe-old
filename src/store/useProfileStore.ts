import { create } from "zustand";
import { toast } from "@/lib/toast";
import { axiosInstance } from "@/utils/axios";
// Reuse the ONE shared, authenticated Supabase client instead of building a
// second throwaway one here. This used to call its own bare
// `createClient(url, key)` with no auth options — which meant it never
// received the user's session (useAuthStore.mirrorSetSessionOnSupabase only
// ever calls `.auth.setSession()` on THIS shared client), so its realtime
// `postgres_changes` subscription in ensureKycSubscription() below was
// always authenticating as anon. kyc_verifications' RLS policy
// (`user_id = auth.uid()`) filters every row for an anon connection, so —
// independent of the missing supabase_realtime publication membership fixed
// in database/kyc_verification_state_consolidation.sql — this subscription
// could never have delivered a single event. It also duplicated client
// plumbing that client.ts's own header comment documents as a past source of
// ghost-logout bugs (two Supabase client instances independently managing
// session state). This module never used the extra client for anything but
// the realtime channel, so reusing the shared one is a pure fix.
import { supabase } from "@/integrations/supabase/client";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// KYC realtime subscription is a singleton keyed by user. Without this guard,
// fetchKYCStatus() created a brand-new channel on every call — and its own
// realtime callback re-invokes fetchKYCStatus(), so each kyc_verifications
// change doubled the number of live channels (a runaway subscription leak).
let kycChannel: ReturnType<typeof supabase.channel> | null = null;
let kycSubscribedFor: string | null = null;

// Monotonic request counter guarding against out-of-order responses.
// fetchKYCStatus is invoked from many independent call sites — useKycAccess,
// useKycFocusRefetch, KYCSection, BankDetailsSection, UserProfilePage, and
// the realtime subscription callback below — so overlapping in-flight
// requests are the normal case, not an edge case (e.g. the realtime event
// fired by an admin's approval can land while a focus-triggered refetch from
// moments earlier is still in flight). Without a sequence guard, whichever
// response's network round-trip happens to resolve LAST wins, even if it
// started first and carries staler data — silently reverting a just-applied
// approval back to "pending" in the UI. Each call captures its own sequence
// number and only commits to the store if it's still the most recent one
// issued for this user by the time its response arrives.
let kycFetchSeq = 0;

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
  // True once fetchKYCStatus has SETTLED (success or failure) at least once
  // for the current user. Distinct from `kycLoading` (which flips back to
  // true on every refetch) — this is a one-shot "we have resolved verification
  // state for this session" latch consumed by DashboardLayout so the KYC
  // banner never flashes in after the rest of the dashboard has already
  // painted. Reset on sign-out (see useAuthStore.signOut) and re-armed by
  // fetchKYCStatus whenever the userId changes, so switching accounts
  // re-blocks correctly instead of showing the previous user's resolved state.
  kycStatusResolved: boolean;
  kycStatusResolvedFor: string | null;
  profileLoading: boolean;
  profileRefreshing: boolean;
  profileLastFetchedAt: number;
  profileInFlight: Promise<void> | null;
  passwordStep: "idle" | "requesting" | "otp-sent" | "verifying" | "success" | "error";
  passwordError: string | null;
  otpEmail: string | null;
  emailChangeStep: "idle" | "requesting" | "otp-sent" | "verifying" | "link-sent" | "error";
  emailChangeError: string | null;
  pendingNewEmail: string | null;
  otpSentToEmail: string | null;
  confirmStep: "idle" | "confirming" | "success" | "error";
  confirmError: string | null;
  activeSection: string;
  setActiveSection: (section: string) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: any) => Promise<boolean>;
  fetchKYCStatus: (userId: string) => Promise<void>;
  /** Clears profile + KYC state on sign-out (see useAuthStore.signOut) so a
   * subsequent login — possibly as a different user — can't render with the
   * previous session's stale verification status for even one frame, and so
   * DashboardLayout's resolved-gate (kycStatusResolvedFor) correctly re-blocks
   * instead of matching a leftover value. */
  resetKycState: () => void;
  requestPasswordOTP: () => Promise<boolean>;
  verifyOTPAndChangePassword: (otp: string, newPassword: string, confirmPassword: string) => Promise<boolean>;
  resetPasswordState: () => void;
  requestEmailChangeOTP: (newEmail: string) => Promise<boolean>;
  verifyEmailChangeOTP: (otp: string) => Promise<boolean>;
  resetEmailChangeState: () => void;
  confirmEmailChange: (token: string) => Promise<boolean>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  kycData: null,
  kycLoading: false,
  kycStatusResolved: false,
  kycStatusResolvedFor: null,
  profileLoading: false,
  profileRefreshing: false,
  profileLastFetchedAt: 0,
  profileInFlight: null,
  passwordStep: "idle",
  passwordError: null,
  otpEmail: null,
  emailChangeStep: "idle",
  emailChangeError: null,
  pendingNewEmail: null,
  otpSentToEmail: null,
  confirmStep: "idle",
  confirmError: null,
  activeSection: "personal",

  setActiveSection: (section: string) => set({ activeSection: section }),

  resetKycState: () => {
    // Invalidate any fetch still in flight for the outgoing user — the
    // sequence guard in fetchKYCStatus means its response, if it arrives
    // after this reset, will be silently discarded rather than repopulating
    // kycData for a session that has already ended.
    kycFetchSeq += 1;
    set({
      profile: null,
      kycData: null,
      kycLoading: false,
      kycStatusResolved: false,
      kycStatusResolvedFor: null,
    });
  },

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
    // Stale-response guard (see kycFetchSeq above): this call's slot in the
    // sequence. Only the highest-numbered call still gets to commit state —
    // an older, slower-resolving request can never clobber a newer one.
    const seq = ++kycFetchSeq;

    set({ kycLoading: true });

    // Subscribe to real-time changes on this user's kyc_verifications row so
    // the KYC section updates automatically when an admin approves a document
    // — without requiring a manual refresh. Idempotent: only one channel per
    // user ever exists, so the re-fetch in the callback can never spawn more.
    // (kyc_verifications was added to the supabase_realtime publication in
    // database/kyc_verification_state_consolidation.sql — before that this
    // subscription was live but silently received nothing.)
    ensureKycSubscription(userId, () => {
      get().fetchKYCStatus(userId);
    });

    try {
      const [res, accessStatusRes] = await Promise.all([
        axiosInstance.get(`/settings/kyc/${userId}`),
        // Backend is the SINGLE source of truth for verification status and
        // for what this user is allowed to do (legacy-user KYC enforcement).
        // Previously this also ran an independent client-side
        // `supabase.from("kyc_verifications").select(...)` in parallel with
        // this same call — two different code paths (RLS-scoped client read
        // vs. service-role backend read) resolving the exact same row on two
        // separate network round-trips, which is exactly the kind of
        // duplicate-source drift this store must not have. Removed; every
        // status field below now comes from this one response.
        axiosInstance.get(`/settings/kyc/access-status`).catch((err) => {
          console.error("Failed to fetch KYC access status:", err);
          return null;
        }),
      ]);

      // A newer fetchKYCStatus call was issued (and possibly already
      // resolved) while this one was in flight — e.g. the realtime
      // subscription's callback fired because an admin's approval landed
      // while a focus-triggered refetch from moments earlier was still
      // pending. Discard this response; the newer call owns the final word.
      if (seq !== kycFetchSeq) return;

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

      const accessStatus = accessStatusRes?.data || null;
      // /access-status is best-effort here (its own request already caught
      // its error above and returned null rather than rejecting). If it
      // failed transiently, prefer whatever status we already had in memory
      // over silently regressing a verified user back to "not_started" —
      // fail-open the same way useKycAccess already documents doing for
      // canCreateCollection/canWithdraw, applied to the status field itself.
      const previousStatus = get().kycData?.overallStatus;
      const overallStatus = accessStatus?.kycStatus || previousStatus || "not_started";

      set({
        kycData: {
          overallStatus,
          identityVerification: {
            status: identityDocs.length > 0 ? identityDocs[0].status : "notStarted",
            documents: identityDocs,
          },
          addressVerification: {
            status: addressDocs.length > 0 ? addressDocs[0].status : "notStarted",
            documents: addressDocs,
          },

          // Legacy-user KYC enforcement — all backend-computed, never
          // re-derived here. See GET /settings/kyc/access-status
          // (controllers/settings/kyc.js -> featureAccessService).
          isVerified: accessStatus?.isVerified ?? overallStatus === "verified",
          isLegacyUser: accessStatus?.isLegacyUser ?? false,
          group: accessStatus?.group ?? null,
          canCreateCollection: accessStatus?.canCreateCollection ?? true,
          canManageBankAccount: accessStatus?.canManageBankAccount ?? false,
          canWithdraw: accessStatus?.canWithdraw ?? true,
          showBanner: accessStatus?.showBanner ?? false,
          banner: accessStatus?.banner ?? null,
          // Guided-onboarding data (progress checklist, phase copy, what's
          // locked/unlocked) — see featureAccessService.getAccessStatus().
          journey: accessStatus?.journey ?? null,
        },
        kycLoading: false,
        kycStatusResolved: true,
        kycStatusResolvedFor: userId,
      });
    } catch (error) {
      if (seq !== kycFetchSeq) return;
      console.error("Failed to fetch KYC data:", error);
      // Still latch "resolved" on failure — DashboardLayout's gate (F3) waits
      // for resolution, not success, so a persistent backend outage shows the
      // dashboard fail-open rather than stranding the user on a loading
      // skeleton forever.
      set({ kycLoading: false, kycStatusResolved: true, kycStatusResolvedFor: userId });
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

  requestEmailChangeOTP: async (newEmail: string) => {
    set({ emailChangeStep: "requesting", emailChangeError: null });
    try {
      const res = await axiosInstance.post("/settings/security/request-email-change-otp", { newEmail });
      set({
        emailChangeStep: "otp-sent",
        pendingNewEmail: newEmail,
        otpSentToEmail: res.data?.email || null,
        emailChangeError: null,
      });
      toast.success("OTP sent");
      return true;
    } catch (error: any) {
      const msg = toFriendlyErrorMessage(error, "Could not send OTP. Please try again.");
      set({ emailChangeStep: "error", emailChangeError: msg });
      toast.error(msg);
      return false;
    }
  },

  verifyEmailChangeOTP: async (otp: string) => {
    set({ emailChangeStep: "verifying", emailChangeError: null });
    try {
      await axiosInstance.post("/settings/security/verify-email-change-otp", { otp });
      set({ emailChangeStep: "link-sent", emailChangeError: null });
      toast.success("Confirmation link sent");
      return true;
    } catch (error: any) {
      const msg = toFriendlyErrorMessage(error, "Could not verify OTP. Please try again.");
      set({ emailChangeStep: "error", emailChangeError: msg });
      toast.error(msg);
      return false;
    }
  },

  resetEmailChangeState: () => {
    set({ emailChangeStep: "idle", emailChangeError: null, pendingNewEmail: null, otpSentToEmail: null });
  },

  confirmEmailChange: async (token: string) => {
    set({ confirmStep: "confirming", confirmError: null });
    try {
      await axiosInstance.post("/settings/security/confirm-email-change", { token });
      set({ confirmStep: "success", confirmError: null });
      return true;
    } catch (error: any) {
      const msg = toFriendlyErrorMessage(error, "Could not confirm email change. The link may have expired.");
      set({ confirmStep: "error", confirmError: msg });
      return false;
    }
  },
}));
