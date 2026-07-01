import { useCallback, useEffect, useMemo, useState } from "react";
import {
  detectInstallPlatform,
  isStandalonePwa,
  type InstallPlatform,
} from "@/utils/platformDetection";

declare global {
  interface Window {
    gtag?: (
      command: string,
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UsePWAInstallResult {
  platform: InstallPlatform;
  isInstalled: boolean;
  /** True once Chrome/Edge has actually offered the native install event. */
  canInstall: boolean;
  promptInstall: () => Promise<boolean>;
}

function trackPwaEvent(eventName: string, label: string) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, {
      event_category: "PWA",
      event_label: label,
    });
  }
}

export const usePWAInstall = (): UsePWAInstallResult => {
  const platform = useMemo(detectInstallPlatform, []);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandalonePwa);

  useEffect(() => {
    if (isInstalled) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      trackPwaEvent("pwa_installed", "App Installed Successfully");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isInstalled]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    trackPwaEvent("pwa_install_prompt_shown", "Install Prompt Displayed");

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    trackPwaEvent(
      `pwa_install_${outcome}`,
      outcome === "accepted" ? "User Accepted Install" : "User Dismissed Install"
    );

    // A BeforeInstallPromptEvent can only be used once.
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    platform,
    isInstalled,
    canInstall: deferredPrompt !== null,
    promptInstall,
  };
};
