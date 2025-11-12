import { useEffect, useState } from "react";

// Declare gtag as a global function from Google Analytics
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: any) => void;
    dataLayer?: any[];
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);

      // Track installation with Google Analytics if available
      if (typeof window.gtag === "function") {
        window.gtag("event", "pwa_installed", {
          event_category: "PWA",
          event_label: "App Installed Successfully",
        });
      }
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
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) {
      return false;
    }

    // Track install prompt shown
    if (typeof window.gtag === "function") {
      window.gtag("event", "pwa_install_prompt_shown", {
        event_category: "PWA",
        event_label: "Install Prompt Displayed",
      });
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // Track user choice
    if (typeof window.gtag === "function") {
      window.gtag("event", `pwa_install_${outcome}`, {
        event_category: "PWA",
        event_label:
          outcome === "accepted"
            ? "User Accepted Install"
            : "User Dismissed Install",
      });
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setIsInstallable(false);

    return outcome === "accepted";
  };

  return {
    isInstallable,
    isInstalled,
    promptInstall,
  };
};
