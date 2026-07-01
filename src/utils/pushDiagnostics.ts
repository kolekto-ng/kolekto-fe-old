// One-call push/realtime diagnostics. Run `kolektoPushDiagnostics()` from the
// browser console (it is attached to window in dev) to see exactly where push
// is failing — service worker, permission, subscription, VAPID key match, and
// the backend's view (env presence, this user's subscription count, recent
// delivery outcomes). Exposes no secrets: only the already-public VAPID key.

import { axiosInstance } from "@/utils/axios";
import {
  getExistingPushSubscription,
  getPushServerConfig,
  getPushSupport,
} from "@/utils/pushNotifications";

export type PushDiagnostics = {
  capturedAt: string;
  client: {
    support: ReturnType<typeof getPushSupport>;
    permission: NotificationPermission | "unsupported";
    serviceWorkers: Array<{ scriptURL: string; scope: string; state: string }>;
    hasSubscription: boolean;
    subscriptionEndpointHost: string | null;
    frontendVapidPublicKey: string | null;
    secureContext: boolean;
    origin: string;
  };
  server?: unknown;
  serverError?: string;
  vapidKeyMatches?: boolean | null;
};

function hostOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export async function collectPushDiagnostics(): Promise<PushDiagnostics> {
  const permission: NotificationPermission | "unsupported" =
    typeof Notification === "undefined" ? "unsupported" : Notification.permission;

  const serviceWorkers: Array<{ scriptURL: string; scope: string; state: string }> = [];
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const worker = reg.active || reg.waiting || reg.installing;
        serviceWorkers.push({
          scriptURL: worker?.scriptURL || "(none)",
          scope: reg.scope,
          state: worker?.state || "unknown",
        });
      }
    } catch {
      /* ignore */
    }
  }

  const subscription = await getExistingPushSubscription().catch(() => null);
  const serverConfig = await getPushServerConfig().catch(() => ({ configured: false } as const));
  const frontendVapidPublicKey = "publicKey" in serverConfig ? serverConfig.publicKey ?? null : null;

  const result: PushDiagnostics = {
    capturedAt: new Date().toISOString(),
    client: {
      support: getPushSupport(),
      permission,
      serviceWorkers,
      hasSubscription: Boolean(subscription),
      subscriptionEndpointHost: hostOf(subscription?.endpoint),
      frontendVapidPublicKey,
      secureContext: typeof window !== "undefined" ? window.isSecureContext : false,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    },
  };

  try {
    const { data } = await axiosInstance.get("/push/diagnostics");
    result.server = data;
    const serverKey = (data as { server?: { vapidPublicKey?: string | null } })?.server?.vapidPublicKey ?? null;
    result.vapidKeyMatches =
      serverKey && frontendVapidPublicKey ? serverKey === frontendVapidPublicKey : null;
  } catch (error) {
    result.serverError =
      (error as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ||
      (error as { message?: string })?.message ||
      "diagnostics request failed";
  }

  // Loud, readable console output for support sessions.
  /* eslint-disable no-console */
  console.groupCollapsed("%c[Kolekto] Push diagnostics", "color:#38bdf8;font-weight:600");
  console.log("client", result.client);
  if (result.server) console.log("server", result.server);
  if (result.serverError) console.warn("serverError", result.serverError);
  console.log("vapidKeyMatches", result.vapidKeyMatches);
  if (!result.client.support.supported) console.warn("Push unsupported:", result.client.support.reason);
  if (result.client.permission !== "granted") console.warn("Notification permission:", result.client.permission);
  if (!result.client.hasSubscription) console.warn("No push subscription on this device.");
  if (result.vapidKeyMatches === false) console.warn("VAPID key mismatch: re-subscribe required.");
  console.groupEnd();
  /* eslint-enable no-console */

  return result;
}

// Attach to window so it can be invoked from the console in any environment
// (handy on a real phone via remote debugging). Safe — it only reads state.
if (typeof window !== "undefined") {
  (window as unknown as { kolektoPushDiagnostics?: typeof collectPushDiagnostics }).kolektoPushDiagnostics =
    collectPushDiagnostics;
}
