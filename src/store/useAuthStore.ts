import { create } from "zustand";
import { toast } from "sonner";
import { authAPI, axiosInstance } from "../utils/axios";

interface SessionData {
  user: any;
  expires_at: number;
  token: string;
}

function getValidSessionFromStorage(): SessionData | null {
  const sessionStr = localStorage.getItem("kolekto-auth-token");
  if (!sessionStr) return null;

  try {
    const session: SessionData = JSON.parse(sessionStr);
    const { expires_at } = session;

    if (!session || !expires_at) return null;

    const now = Math.floor(Date.now() / 1000); // seconds
    // console.log(now > Number(expires_at), "now:", now, expires_at, "expiry");

    if (now > Number(expires_at)) {
      localStorage.removeItem("kolekto-auth-token");
      return null;
    }

    return session;
  } catch (error) {
    console.error("Error parsing session from storage:", error);
    localStorage.removeItem("kolekto-auth-token");
    return null;
  }
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
        localStorage.removeItem("kolekto-auth-token");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      if (error?.response?.status === 401) {
        set({ user: null, session: null, isLoading: false });
        localStorage.removeItem("kolekto-auth-token");
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
      const { data } = await axiosInstance.post("/auth/signin", {
        email,
        password,
      });
      const { user, session, profile } = data.data;
      console.log(data, "Session");
      // Save to localStorage
      localStorage.setItem("kolekto-auth-token", JSON.stringify(session));

      set({
        user: user,
        profile,
        session: session,
        isLoading: false,
      });

      return { user, error: null };
    } catch (error: any) {
      console.log(error);
      const errorMessage = error.message || "Sign in failed";
      set({ error: errorMessage, isLoading: false });
      return { user: null, error: { message: errorMessage } };
    }
  },

  signUp: async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phoneNumber?: string
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
      });
      const { data } = res;
      console.log(data, "Sign up data");

      // Save to localStorage if session is returned
      set({
        // user: data.user,
        // session: data.session,
        isLoading: false,
      });

      return { user: data.user, error: null };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || "Sign up failed";
      set({ error: errorMessage, isLoading: false });
      return { user: null, error: { message: errorMessage } };
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });

    try {
      await axiosInstance.post("auth/signout");
      localStorage.removeItem("kolekto-auth-token");
      set({ user: null, session: null, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.message || "Sign out failed";
      set({ error: errorMessage, isLoading: false });
      // Still clear local state even if server call fails
      localStorage.removeItem("kolekto-auth-token");
      set({ user: null, session: null, isLoading: false });
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
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to send magic link";
      set({ error: errorMessage, isLoading: false });
      return { error: { message: errorMessage } };
    }
  },

  forgotPassword: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.post("/auth/forgot-password", { email });
      if (res.status !== 200) {
        throw new Error("Failed to send password reset email");
      }
      toast.success("Password reset email sent! Please check your inbox.");
      set({ isLoading: false });
      return { error: null };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to send password reset email";
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
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to reset password";
      set({ error: errorMessage, isLoading: false });
      return { error: { message: errorMessage } };
    }
  },
}));
