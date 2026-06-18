import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import {
  clearAuthSessionStorage,
  getSessionExpiryMs,
  getValidAuthSessionFromStorage,
  isAuthSessionExpired,
} from "@/utils/authSession";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.endsWith(route));
}

const SessionTimeoutGuard = () => {
  const user = useAuthStore((state: any) => state.user);
  const signOut = useAuthStore((state: any) => state.signOut);
  const location = useLocation();
  const navigate = useNavigate();
  const isExpiringRef = useRef(false);

  useEffect(() => {
    if (!user) return undefined;

    let timeoutId: number | undefined;
    let intervalId: number | undefined;

    const expireIfNeeded = async () => {
      if (isExpiringRef.current) return;

      const session = getValidAuthSessionFromStorage();
      if (session && !isAuthSessionExpired(session)) return;

      isExpiringRef.current = true;
      clearAuthSessionStorage();

      try {
        await signOut();
      } finally {
        if (!isAuthRoute(window.location.pathname)) {
          toast.info("Your session expired. Please sign in again.");
          navigate("/login", { replace: true });
        }
        isExpiringRef.current = false;
      }
    };

    const scheduleExpiry = () => {
      window.clearTimeout(timeoutId);
      const session = getValidAuthSessionFromStorage();
      const expiresAt = getSessionExpiryMs(session);

      if (!session || !expiresAt) {
        void expireIfNeeded();
        return;
      }

      timeoutId = window.setTimeout(
        expireIfNeeded,
        Math.max(0, expiresAt - Date.now()),
      );
    };

    const onVisibilityOrFocus = () => {
      void expireIfNeeded();
      scheduleExpiry();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "kolekto-auth-token") {
        void expireIfNeeded();
        scheduleExpiry();
      }
    };

    scheduleExpiry();
    intervalId = window.setInterval(expireIfNeeded, 30_000);
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [location.pathname, navigate, signOut, user]);

  return null;
};

export default SessionTimeoutGuard;
