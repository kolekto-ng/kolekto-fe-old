import { create } from "zustand";
import { toast } from "@/lib/toast";
import { authAPI, axiosInstance } from "../utils/axios";
import { supabase } from "@/integrations/supabase/client";
import { useProfileStore } from "@/store/useProfileStore";
import {
  clearAuthSessionStorage,
  getValidAuthSessionFromStorage,
  withOneHourExpiry,
} from "@/utils/authSession";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

// B-16: after the auth store completes a sign-in/sign-up/sign-out via our
// backend (axios), mirror the session state into the Supabase client so
// direct `supabase.from(...)` queries are authenticated against RLS.
//
// Before this change the Supabase client and the Zustand store both wrote
// to the same `kolekto-auth-token` localStorage key, which caused shape
// drift and the occasional "SIGNED_OUT mid-session" ghost-logout. The
// Supabase client now uses its own key (see integrations/supabase/client.ts)
// and these helpers keep the two stores aligned at the action boundary.
//
// All three helpers are wrapped so a failure in the supabase mirror NEVER
// breaks the primary Zustand auth flow.
async function mirrorSetSessionOnSupabase(session: any) {
  try {
    if (!session?.access_token || !session?.refresh_token) return;
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (err) {
    console.warn("[useAuthStore] supabase setSession mirror failed:", (err as any)?.message);
  }
}

async function mirrorSignOutOnSupabase() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[useAuthStore] supabase signOut mirror failed:", (err as any)?.message);
  }
}

// The value stored under AUTH_STORAGE_KEY (see utils/authSession.ts) is the
// backend session ITSELF — a flat object such as
// { access_token, refresh_token, expires_at, kolekto_expires_at, ... } — not
// a { user, session } wrapper. `signIn`/`signUp` below write exactly that
// shape (`localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(timedSession))`),
// and `getValidAuthSessionFromStorage()` returns it unwrapped. There is no
// `user` on this object, so it must never be read as `initialSession.user`.
//
// Rehydration authority: on module load, if a valid (unexpired) session
// exists in storage, we do NOT know who the user is yet — only that a token
// exists — so `user` starts `null` and `isLoading` starts `true` until
// `checkAuth()` (triggered once, below) confirms the token against the
// backend and resolves the real user. If no stored session exists, there is
// nothing to verify: `isLoading` starts `false` immediately.
//
// This is the single authoritative rehydration path. Nothing else should
// call `checkAuth()` on mount — see the removed AuthSessionWatcher note in
// App.tsx. Calling it from more than one place would race two auth checks
// against each other.
const initialStoredSession = getValidAuthSessionFromStorage();

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  session: initialStoredSession,
  isLoading: !!initialStoredSession, // true only while a stored token is being verified
  error: null,

  // Check authentication status on app load (also the rehydration entry
  // point — see the module-level trigger below the store definition).
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/auth/me");
      // axiosInstance resolves to the raw axios Response. UNLIKE /auth/signin
      // (which wraps its payload as res.data.data — see signIn below), the
      // backend's GET /auth/me (controllers/auth.js getCurrentUser) returns
      // the payload flat: res.data = { user, profile }, no extra wrapper.
      // Confirmed by executing the real controller function directly
      // (stubbed Supabase client, no network) — its JSON body top-level keys
      // are exactly ['user', 'profile']. Reading res.data.data here (as a
      // previous version of this fix did) is always undefined, which made
      // every successful rehydration look like "no user" and wiped a valid
      // session on every page refresh.
      const payload = res?.data;
      const nextUser = payload?.user ?? null;

      if (nextUser) {
        const session = getValidAuthSessionFromStorage();
        set({ user: nextUser, profile: payload?.profile ?? get().profile, session, isLoading: false });
      } else {
        // Backend responded but confirmed no authenticated user.
        set({ user: null, session: null, isLoading: false });
        clearAuthSessionStorage();
      }
    } catch (error: any) {
      console.error("Auth check error:", error);
      if (error?.response?.status === 401) {
        // Genuine auth failure: the token is invalid/expired server-side.
        set({ user: null, session: null, isLoading: false });
        clearAuthSessionStorage();
      } else {
        // Transient network/server error: do NOT clear the stored token or
        // force a logout. The session in storage may still be perfectly
        // valid — we just couldn't confirm it right now. Leave `session` as
        // whatever is currently in state and let the user retry (refresh,
        // refocus) once the backend is reachable again.
        toast.error(toFriendlyErrorMessage(error, "Unable to connect. Check your internet and try again."));
        set({ isLoading: false });
      }
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const res = await axiosInstance.post("/auth/signin", {
        email,
        password,
      });

      console.log(res, "Sign in data");

      const { user, session, profile } = res.data.data;
      const timedSession = withOneHourExpiry(session);
      console.log(res.data, "Session");
      // Save to localStorage
      localStorage.setItem("kolekto-auth-token", JSON.stringify(timedSession));

      set({
        user: user,
        profile,
        session: timedSession,
        isLoading: false,
      });

      // B-16: mirror into supabase client so direct `supabase.from(...)`
      // queries are authenticated. Awaited so subsequent calls see the
      // session, but its failure is logged-and-swallowed inside the helper
      // — sign-in does not regress if mirroring breaks.
      await mirrorSetSessionOnSupabase(timedSession);

      return { user, error: null };
    } catch (error: any) {
      console.log(error, "sign in error");
      const errorMessage = toFriendlyErrorMessage(error, "Sign in failed. Please check your details and try again.");
      console.log(errorMessage);

      set({ error: errorMessage, isLoading: false });
      return { user: null, error: { message: errorMessage } };
    }
  },

  signUp: async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phoneNumber?: string,
    recaptcherToken?: string,
    recatcherType?: string,
    emailRedirectTo?: string,
    ambassadorReferralCode?: string
  ) => {
    set({ isLoading: true, error: null });
    try {
      // Use axios for signup since it's not in the authAPI yet
      const res = await axiosInstance.post("/auth/signup", {
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        recaptcherToken,
        recatcherType,
        emailRedirectTo,
        ambassadorReferralCode,
      });
      const { data } = res;
      console.log(data, "Sign up data");

      const hasSession = Boolean(data?.session?.access_token);

      if (hasSession) {
        localStorage.setItem("kolekto-auth-token", JSON.stringify(withOneHourExpiry(data.session)));
      }

      const timedSession = hasSession ? withOneHourExpiry(data.session) : null;

      set({
        user: data?.requireV2 || !hasSession ? null : data?.user ?? null,
        session: data?.requireV2 || !hasSession ? null : timedSession,
        isLoading: false,
      });

      // B-16: mirror session into supabase client when one is returned.
      // (signup often returns no session — email verification flow — in
      // which case we skip the mirror; user will sign in later.)
      if (hasSession) {
        await mirrorSetSessionOnSupabase(timedSession);
      }

      return {
        user: data?.user ?? null,
        session: timedSession,
        verificationRequired: Boolean(data?.requiresEmailVerification || (!hasSession && data?.user)),
        error: null,
      };
    } catch (error: any) {
      const errorMessage = toFriendlyErrorMessage(error, "Sign up failed. Please check your details and try again.");
      set({ error: errorMessage, isLoading: false });
      return { user: null, error: { message: errorMessage } };
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });

    try {
      await axiosInstance.post("auth/signout");
      clearAuthSessionStorage();
      set({ user: null, session: null, isLoading: false });
      // Clear verification/profile state so a subsequent login — possibly as
      // a different user on the same device — can never paint with the
      // outgoing session's kycData for even one frame. Also invalidates any
      // fetchKYCStatus call still in flight (see resetKycState).
      useProfileStore.getState().resetKycState();
      // B-16: mirror sign-out into the supabase client so its persisted
      // session is also cleared. Awaited so the SIGNED_OUT event from
      // supabase has fired before this function returns — useful for
      // callers that immediately navigate.
      await mirrorSignOutOnSupabase();
    } catch (error: any) {
      const errorMessage = toFriendlyErrorMessage(error, "Sign out failed. Please try again.");
      set({ error: errorMessage, isLoading: false });
      // Still clear local state even if server call fails
      clearAuthSessionStorage();
      set({ user: null, session: null, isLoading: false });
      useProfileStore.getState().resetKycState();
      // Mirror the sign-out on the supabase client even on backend error
      // so the user is fully signed out client-side regardless.
      await mirrorSignOutOnSupabase();
    }
  },

  sendMagicLink: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.post("/auth/magic-link", {
        email,
        emailRedirectTo: window.location.origin + "/login",
      });
      if (res.status !== 200) {
        throw new Error("Failed to send magic link");
      }
      toast.success("Magic link sent");
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      const errorMessage = toFriendlyErrorMessage(error, "Could not send the magic link. Please try again.");
      set({ error: errorMessage, isLoading: false });
      return { error: { message: errorMessage } };
    }
  },

  forgotPassword: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.post("/auth/forgot-password", {
        email,
        emailRedirectTo: `${window.location.origin}/reset-password`,
      });
      if (res.status !== 200) {
        throw new Error("Failed to send password reset email");
      }
      toast.success("Password reset email sent");
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      const errorMessage = toFriendlyErrorMessage(error, "Could not send the password reset email. Please try again.");
      set({ error: errorMessage, isLoading: false });
      return { error: { message: errorMessage } };
    }
  },

  resetPassword: async (token: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      const { axiosInstance } = await import("../utils/axios");
      const res = await axiosInstance.post("/auth/reset-password", {
        token,
        newPassword,
      });
      if (res.status !== 200) {
        throw new Error("Failed to reset password");
      }
      toast.success("Password reset successfully");
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      const errorMessage = toFriendlyErrorMessage(error, "Could not reset your password. Please try again.");
      set({ error: errorMessage, isLoading: false });
      return { error: { message: errorMessage } };
    }
  },
}));

// Authoritative startup rehydration. Runs exactly once per page load (this
// is plain module top-level code, not a React effect, so React 18
// StrictMode's double-invoke behavior does not apply to it). If a valid,
// unexpired token was found in storage above, `isLoading` is already `true`
// so ProtectedRoute/DashboardLayout render their skeleton instead of
// bouncing to /login while this resolves.
if (initialStoredSession) {
  void useAuthStore.getState().checkAuth();
}
