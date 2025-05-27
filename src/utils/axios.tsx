import axios from "axios";

let baseURL = "http://localhost:5000/api";
if (import.meta.env.MODE === "production") {
  baseURL = import.meta.env.VITE_API_URL;
  console.log("Running in production");
} else {
  console.log("Running in development");
}

export const axiosInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Add a request interceptor to always use the latest token
axiosInstance.interceptors.request.use(
  (config) => {
    let token = localStorage.getItem("kolekto-auth-token");
    if (token) {
      try {
        token = JSON.parse(token);
        if (token && token.access_token) {
          config.headers.Authorization = `Bearer ${token.access_token}`;
        }
      } catch (e) {
        // Invalid token in storage
        config.headers.Authorization = undefined;
      }
    } else {
      config.headers.Authorization = undefined;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
