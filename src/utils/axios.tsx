import { useAuthStore } from "@/store";
import axios from "axios";

// API configuration following the backend pattern
const API_BASE_URL = import.meta.env.MODE === 'production'
  ? import.meta.env.VITE_API_URL || 'https://api.kolekto.com.ng/api'
  : import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// const { session } = useAuthStore()

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // CRUCIAL: This sends cookies cross-domain
});

// Add a request interceptor to handle authentication headers
axiosInstance.interceptors.request.use(
  (config) => {

    // If we're sending FormData (file upload), don't set Content-Type
    // Let the browser set it automatically with the proper boundary
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }

    // Get session from localStorage
    const sessionStr = localStorage.getItem("kolekto-auth-token");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        // console.log(session, "session in axios interceptor");

        if (session && session.access_token
        ) {
          // Add Authorization header with Bearer token
          config.headers.Authorization = `Bearer ${session?.access_token
            }`;
        }
      } catch (e) {
        // Invalid token in storage, remove it
        localStorage.removeItem("kolekto-auth-token");
        config.headers.Authorization = undefined;
      }
    } else {
      config.headers.Authorization = undefined;
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


