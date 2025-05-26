import axios from "axios";

let baseURL = "http://localhost:5000/api";
if (import.meta.env.MODE === "production") {
  (baseURL = import.meta.env.VITE_API_URL),
    console.log("Running in production");
} else {
  console.log("Running in development");
}

let token = localStorage.getItem("kolekto-auth-token"); // e.g., "token=abc123; session=xyz789"
token = JSON.parse(token); // Parse the string to an object 
console.log(token, "COOKIES");
if (token) {
  token = token.access_token; // Access the access_token property
}
export const axiosInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  withCredentials: true,
});
