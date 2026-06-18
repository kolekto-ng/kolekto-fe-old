// API utility functions for authenticated requests with cross-origin cookies
import { toFriendlyErrorMessage } from "./errorMessages";

// API configuration
const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? import.meta.env.VITE_API_URL || 'https://api.kolekto.com.ng/api'
  : import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

// Generic authenticated API call function
export const authenticatedFetch = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    credentials: 'include', // CRUCIAL: This sends cookies cross-domain
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add Authorization header if token exists
  const sessionStr = localStorage.getItem("kolekto-auth-token");
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      if (session && session.token) {
        defaultOptions.headers = {
          ...defaultOptions.headers,
          Authorization: `Bearer ${session.token}`,
        };
      }
    } catch (e) {
      // Invalid token, remove it
      localStorage.removeItem("kolekto-auth-token");
    }
  }

  return fetch(url, defaultOptions);
};

// Helper function to handle API responses
export const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized - clear local storage
      localStorage.removeItem("kolekto-auth-token");
      throw new Error('Authentication required');
    }
    
    const error = await response.json().catch(() => ({}));
    throw new Error(toFriendlyErrorMessage(error, "Something went wrong. Please try again."));
  }

  return response.json();
};

// Collection API functions
export const collectionAPI = {
  create: async (collectionData: any) => {
    const response = await authenticatedFetch('/create-collection', {
      method: 'POST',
      body: JSON.stringify({ collectionData }),
    });
    return handleApiResponse(response);
  },

  getAll: async () => {
    const response = await authenticatedFetch('/collections');
    return handleApiResponse(response);
  },

  getById: async (id: string) => {
    const response = await authenticatedFetch(`/collections/${id}`);
    return handleApiResponse(response);
  },

  update: async (id: string, data: any) => {
    const response = await authenticatedFetch(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleApiResponse(response);
  },

  delete: async (id: string) => {
    const response = await authenticatedFetch(`/collections/${id}`, {
      method: 'DELETE',
    });
    return handleApiResponse(response);
  },
};

// Transaction API functions
export const transactionAPI = {
  getAll: async () => {
    const response = await authenticatedFetch('/transactions');
    return handleApiResponse(response);
  },

  getById: async (id: string) => {
    const response = await authenticatedFetch(`/transactions/${id}`);
    return handleApiResponse(response);
  },
};

// User API functions
export const userAPI = {
  getProfile: async () => {
    const response = await authenticatedFetch('/user/profile');
    return handleApiResponse(response);
  },

  updateProfile: async (data: any) => {
    const response = await authenticatedFetch('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleApiResponse(response);
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await authenticatedFetch('/user/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handleApiResponse(response);
  },
};

// Withdrawal API functions
export const withdrawalAPI = {
  request: async (data: any) => {
    const response = await authenticatedFetch('/withdrawals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleApiResponse(response);
  },

  getAll: async () => {
    const response = await authenticatedFetch('/withdrawals');
    return handleApiResponse(response);
  },

  getById: async (id: string) => {
    const response = await authenticatedFetch(`/withdrawals/${id}`);
    return handleApiResponse(response);
  },
};
