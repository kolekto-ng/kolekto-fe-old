import axios from "axios";

// API configuration following the backend pattern
const API_BASE_URL = import.meta.env.MODE === 'production'
  ? import.meta.env.VITE_API_URL || 'https://api.kolekto.com.ng/api'
  : import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // CRUCIAL: This sends cookies cross-domain
});

// Add a request interceptor to handle authentication headers
axiosInstance.interceptors.request.use(
  (config) => {
    // Get session from localStorage
    const sessionStr = localStorage.getItem("kolekto-auth-token");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.token) {
          // Add Authorization header with Bearer token
          config.headers.Authorization = `Bearer ${session.token}`;
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

// Export API functions following the backend pattern
export const authAPI = {
  // Sign in function
  signIn: async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // CRUCIAL: This sends cookies cross-domain
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sign in failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include', // Cookies sent automatically
      });

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated
          return null;
        }
        throw new Error('Failed to get user');
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  },

  // Sign out
  signOut: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signout`, {
        method: 'POST',
        credentials: 'include', // Cookies sent automatically
      });

      if (!response.ok) {
        throw new Error('Sign out failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  // Make authenticated requests
  createCollection: async (collectionData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/create-collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Cookies sent automatically
        body: JSON.stringify({ collectionData })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create collection');
      }

      return await response.json();
    } catch (error) {
      console.error('Create collection error:', error);
      throw error;
    }
  }
};
