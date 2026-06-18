import { create } from "zustand";
import { toast } from "sonner";
import { authAPI, axiosInstance } from "../utils/axios";
import { supabase } from "@/integrations/supabase/client";
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

interface SessionData {
  user: any;
  expires_at: number;
  token: string;
}

function getValidSessionFromStorage(): SessionData | null {
  return getValidAuthSessionFromStorage() as SessionData | null;
}

// Initial state from localStorage if valid
const initialSession = getValidSessionFromStorage();
const user = initialSession ? initialSession.user : null;

export const useAuthStore = create((set, get) => ({
  user: user,
  profile: null,
  session: initialSession?.session,
  isLoading: !!initialSession?.session, // loading if no session yet
  error: null,

  // Check authentication status on app load
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const userData = await axiosInstance.get("/auth/me");

      console.log(userData, "auth/me");

      if (userData) {
        // User is authenticated, get session from storage
        const session = getValidSessionFromStorage();
        console.log(userData);

        set({ user: userData, session, isLoading: false });
      } else {
        // No valid session
        set({ user: null, session: null, isLoading: false });
        clearAuthSessionStorage();
      }
    } catch (error) {
      console.error("Auth check error:", error);
      if (error?.response?.status === 401) {
        set({ user: null, session: null, isLoading: false });
        clearAuthSessionStorage();
      } else {
        toast.error("Network error. Please try again.");
        set({ isLoading: false });
        // Don't clear user/session for non-auth errors
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
    emailRedirectTo?: string
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
      toast.success("Magic link sent! Please check your email.");
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
      toast.success("Password reset email sent! Please check your inbox.");
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
      toast.success("Password has been reset successfully!");
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      const errorMessage = toFriendlyErrorMessage(error, "Could not reset your password. Please try again.");
      set({ error: errorMessage, isLoading: false });
      return { error: { message: errorMessage } };
    }
  },
}));
