import { useAuthStore } from "@/store";
import axios from "axios";

// API configuration following the backend pattern
const API_BASE_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL || "https://api.kolekto.com.ng/api"
    : import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "http://localhost:5050/api";

// const { session } = useAuthStore()

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // CRUCIAL: This sends cookies cross-domain
});

// Add a request interceptor to handle authentication headers
axiosInstance.interceptors.request.use(
  (config) => {
    const method = (config.method || "get").toLowerCase();
    const url = config.url || "";
    const isAuthPublicEndpoint = [
      "/auth/signin",
      "/auth/signup",
      "/auth/magic-link",
      "/auth/forgot-password",
      "/auth/reset-password",
    ].some((endpoint) => url.includes(endpoint));

    // Only set JSON content-type when we are actually sending a body.
    // This avoids unnecessary preflight noise for GET/HEAD requests.
    if (
      !["get", "head", "options"].includes(method) &&
      !(config.data instanceof FormData)
    ) {
      config.headers["Content-Type"] = "application/json";
    }

    // Get session from localStorage
    const sessionStr = localStorage.getItem("kolekto-auth-token");
    if (sessionStr && !isAuthPublicEndpoint) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.access_token) {
          // Add Authorization header with Bearer token
          config.headers.Authorization = `Bearer ${session.access_token}`;
        }
      } catch (e) {
        // Invalid token in storage, remove it
        localStorage.removeItem("kolekto-auth-token");
        delete config.headers.Authorization;
      }
    } else {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle authentication errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear local storage and redirect to login
      localStorage.removeItem("kolekto-auth-token");
      // You might want to trigger a store action here to clear user state
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
