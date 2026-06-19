import { axiosInstance } from "@/utils/axios";

type PushSupport = {
  supported: boolean;
  reason?: string;
  needsInstall?: boolean;
};

export type PushServerConfig = {
  configured: boolean;
  publicKey?: string;
};

export type PushSubscriptionMetadata = {
  userAgent?: string;
  platform?: string;
  deviceLabel?: string;
};

const PUSH_DISMISSED_KEY = "kolekto-push-permission-dismissed";

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalonePwa() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function getPushDismissed() {
  return localStorage.getItem(PUSH_DISMISSED_KEY) === "true";
}

export function setPushDismissed(value: boolean) {
  if (value) {
    localStorage.setItem(PUSH_DISMISSED_KEY, "true");
  } else {
    localStorage.removeItem(PUSH_DISMISSED_KEY);
  }
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Push notifications are not available here." };
  }

  if (!window.isSecureContext && window.location.hostname !== "localhost") {
    return {
      supported: false,
      reason: "Push notifications need a secure connection.",
    };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return {
      supported: false,
      reason: "Push notifications are not supported on this browser.",
    };
  }

  if (isIosDevice() && !isStandalonePwa()) {
    return {
      supported: false,
      needsInstall: true,
      reason: "Install Kolekto to your Home Screen to use push notifications on iOS.",
    };
  }

  return { supported: true };
}

export async function getExistingPushSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function getPushPermissionState() {
  if (!("Notification" in window)) return "unsupported";
  const subscription = await getExistingPushSubscription().catch(() => null);
  return {
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

export async function getPushServerConfig(): Promise<PushServerConfig> {
  try {
    const { data } = await axiosInstance.get("/push/vapid-public-key");
    return {
      configured: Boolean(data?.configured && data?.publicKey),
      publicKey: data?.publicKey,
    };
  } catch (error: any) {
    if (error?.response?.status === 503) {
      return { configured: false };
    }

    throw error;
  }
}

export async function enablePushNotifications(metadata: PushSubscriptionMetadata = {}) {
  const support = getPushSupport();
  if (!support.supported) {
    throw new Error(support.reason || "Push notifications are not supported.");
  }

  if (Notification.permission === "denied") {
    throw new Error("Notifications are blocked. Enable them in your browser settings.");
  }

  const config = await getPushServerConfig();
  const publicKey = config.publicKey;
  if (!publicKey) {
    throw new Error("Notifications are temporarily unavailable on this device.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notifications were not enabled.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await axiosInstance.post("/push/subscriptions", {
    subscription: subscription.toJSON(),
    metadata: {
      userAgent: metadata.userAgent || navigator.userAgent,
      platform: metadata.platform || navigator.platform,
      deviceLabel: metadata.deviceLabel || "This device",
    },
  });

  setPushDismissed(false);
  return subscription;
}

export async function disablePushNotifications() {
  const subscription = await getExistingPushSubscription().catch(() => null);
  if (!subscription) return;

  await axiosInstance.delete("/push/subscriptions", {
    data: { endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
}
