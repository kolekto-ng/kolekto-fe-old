import { create } from "zustand";
import { toast } from "sonner";
import { axiosInstance } from "../utils/axios";
import { Routes, Route, Navigate, NavigateFunction } from "react-router-dom";

function getValidSessionFromStorage() {
  let sessionStr = localStorage.getItem("kolekto-auth-token");
  if (!sessionStr) return null;
  sessionStr = JSON.parse(sessionStr);
  let { expires_at } = sessionStr;
  console.log(sessionStr, "Session String from Storage");
  if (!sessionStr || !expires_at) return null;

  // const expiry = sessionStr.expires_in;
  const now = Math.floor(Date.now() / 1000); // seconds
  console.log(now > Number(expires_at), "now:", now, expires_at, "eexpiry");

  if (now > Number(expires_at)) {
    localStorage.removeItem("kolekto-auth-token");

    return null;
  }

  return sessionStr;
}

// Initial state from localStorage if valid
const initialSession = getValidSessionFromStorage();
console.log(initialSession, "Initial Session and User");
const user = initialSession ? initialSession.user : null;

export const useAuthStore = create((set, get) => ({
  user: user,
  session: initialSession,
  isLoading: !initialSession, // loading if no session yet
  error: null,

  // verifySession: async () => {
  //   const session = get().session;
  //   if (!session) return false;
  //   try {
  //     // Replace with your actual backend verification endpoint
  //     const res = await axiosInstance.post("/auth/verify-session", {
  //       token: session.token,
  //     });
  //     if (res.data.valid) {
  //       set({ user: session.user, session, isLoading: false });
  //       return true;
  //     } else {
  //       set({ user: null, session: null, isLoading: false });
  //       localStorage.removeItem("auth_session");
  //       localStorage.removeItem("auth_expiry");
  //       return false;
  //     }
  //   } catch (error) {
  //     set({
  //       user: null,
  //       session: null,
  //       isLoading: false,
  //       error: error.message,
  //     });
  //     localStorage.removeItem("auth_session");
  //     localStorage.removeItem("auth_expiry");
  //     return false;
  //   }
  // },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      const res = await axiosInstance.post("/auth/signin", {
        email,
        password,
      });
      const { user, session } = res.data;

      // Save to localStorage
      localStorage.setItem("kolekto-auth-token", JSON.stringify(session));
      // localStorage.setItem("auth_expiry", session.expires_at);
      set({
        user: user,
        session: session,
        isLoading: false,
      });

      return user;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  signUp: async (email, password, fullName) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.post("/auth/signup", {
        email,
        password,
        fullName,
      });
      const { data } = res;

      set({
        user: data.user,
        session: data.session,
        isLoading: false,
      });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });

    try {
      const res = await axiosInstance.post("/auth/signout");
      if (res.status !== 200) {
        throw new Error("Failed to sign out");
      }
      localStorage.removeItem("kolekto-auth-token");
      set({ user: null, session: null, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  sendMagicLink: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const res = axiosInstance.post("/auth/magic-link", {
        email,
        emailRedirectTo: window.location.origin + "/login",
      });
      if (res.status !== 200) {
        throw new Error("Failed to send magic link");
      }
      toast.success("Magic link sent! Please check your email.");
      set({ isLoading: false });
      return { error: null };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },

  forgotPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.post("/auth/forgot-password", { email });
      if (res.status !== 200) {
        throw new Error("Failed to send password reset email");
      }
      toast.success("Password reset email sent! Please check your inbox.");
      set({ isLoading: false });
      return { error: null };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },

  resetPassword: async (token, newPassword) => {
    set({ isLoading: true, error: null });
    try {
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
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { error };
    }
  },
}));
