import { useAuthStore } from "@/store";
import axios from "axios";

// API configuration following the backend pattern.
//
// Which URL wins depends on Vite's env-file precedence
// (.env.[mode].local > .env.[mode] > .env.local > .env). In production mode
// this always resolves to the deployed backend unless VITE_API_URL is
// explicitly overridden. In dev mode, add a `.env.development.local` with
// VITE_API_URL=http://localhost:<PORT>/api to point at a local backend —
// see kolekto-fe-old/.env.development.local. The bare fallback below matches
// the backend's own default port (see kolekto-be-old/app.js: `PORT || 3000`)
// so a fresh checkout with no env file still points somewhere that exists.
const API_BASE_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL || "https://api.kolekto.com.ng/api"
    : import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "http://localhost:3000/api";

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

// Public auth endpoints — a 401 from these is a normal credential failure
// (e.g. wrong password on /auth/signin) and must NOT trigger a hard logout.
const AUTH_PUBLIC_ENDPOINTS = [
  "/auth/signin",
  "/auth/signup",
  "/auth/magic-link",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function isPublicAuthCall(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

// Only the canonical session-check endpoint is allowed to trigger an auto-
// logout. Other endpoints' 401s are treated as transient — typically a
// concurrent-request race against the BE's cookie-based token refresh:
//
//   1. User submits a withdrawal. Bearer token is stale.
//   2. verifyToken refreshes via the refresh_token cookie → succeeds →
//      Set-Cookie returns the new access_token. Withdrawal completes.
//   3. The FE immediately fires GET /withdrawals/eligible-collections,
//      GET /dashboard/activities, GET /dashboard/collections/:id/stats
//      in parallel — but the OLD Bearer header is still attached because
//      localStorage hasn't been touched, and the refresh_token cookie
//      may have been rotated and not yet flushed to all in-flight requests.
//   4. One of those requests 401s.
//   5. Previously: the 401 handler kicked off signOut() → user yanked to
//      /login mid-page, losing the post-withdrawal UI update.
//
// Now we only auto-logout when /auth/me itself says the session is dead.
// Other 401s fail their individual callers (they can show a retry toast),
// but the user stays logged in and a single successful subsequent request
// will keep the session alive.
function shouldAutoLogout(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes("/auth/me");
}

// Coalesce concurrent 401s on /auth/me — without this, two near-simultaneous
// session checks would each call signOut() and race the navigation.
let signingOutPromise: Promise<void> | null = null;

// Track and rate-limit 401s on non-/auth/me endpoints. If we see a *sustained*
// stream (>=5 401s within 10s) we conclude the session really is dead and
// trigger the logout, rather than a transient refresh race.
const recent401s: number[] = [];
const STALE_SESSION_THRESHOLD = 5;
const STALE_SESSION_WINDOW_MS = 10_000;

function looksLikeDeadSession(): boolean {
  const now = Date.now();
  recent401s.push(now);
  // Drop entries older than the window.
  while (recent401s.length && now - recent401s[0] > STALE_SESSION_WINDOW_MS) {
    recent401s.shift();
  }
  return recent401s.length >= STALE_SESSION_THRESHOLD;
}

async function performSignOutAndRedirect() {
  if (!signingOutPromise) {
    signingOutPromise = (async () => {
      try {
        await useAuthStore.getState().signOut();
      } catch (err) {
        console.error("[axios] signOut on 401 failed:", err);
        localStorage.removeItem("kolekto-auth-token");
        useAuthStore.setState({ user: null, session: null } as any);
      } finally {
        const path = window.location.pathname;
        const onPublicPage = ["/login", "/register", "/forgot-password", "/reset-password", "/"].includes(path)
          || path.startsWith("/contribute/")
          || path.startsWith("/payment/");
        if (!onPublicPage) {
          window.location.href = "/login";
        }
        signingOutPromise = null;
      }
    })();
  }
  await signingOutPromise;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url;

    if (status === 401 && !isPublicAuthCall(url)) {
      if (shouldAutoLogout(url)) {
        // Canonical session check failed → session is definitively dead.
        await performSignOutAndRedirect();
      } else if (looksLikeDeadSession()) {
        // Sustained 401s across multiple endpoints → not just a refresh
        // race; really logged out. Trigger the auto-logout.
        console.warn("[axios] sustained 401s — signing out");
        await performSignOutAndRedirect();
      }
      // Otherwise: let the individual call fail. The user stays logged in.
      // The next successful request (or the cookie refresh on the next
      // verifyToken) will resync the session naturally.
    }
    return Promise.reject(error);
  }
);
