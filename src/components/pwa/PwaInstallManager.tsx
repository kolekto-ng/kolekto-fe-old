import { useCallback, useEffect, useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import AndroidInstallCard from "./AndroidInstallCard";
import IosInstallGuideModal from "./IosInstallGuideModal";
import FloatingInstallButton from "./FloatingInstallButton";

const DISMISS_KEY = "kolekto-pwa-install-dismissed-at";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissalActive(): boolean {
  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return (
    Number.isFinite(dismissedAt) &&
    dismissedAt > 0 &&
    Date.now() - dismissedAt < COOLDOWN_MS
  );
}

function recordDismissal() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function scheduleIdle(callback: () => void): number {
  if (typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(callback, { timeout: 2000 });
  }
  return window.requestAnimationFrame(callback);
}

function cancelIdle(handle: number) {
  if (typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle);
  } else {
    window.cancelAnimationFrame(handle);
  }
}

const PwaInstallManager: React.FC = () => {
  const { platform, isInstalled, canInstall, promptInstall } =
    usePWAInstall();

  // iOS has no install event — Safari can always be guided through "Add to
  // Home Screen", so it's eligible as soon as it isn't already standalone.
  // Android only becomes eligible once Chrome actually offers the native
  // beforeinstallprompt event; without it there is nothing for our UI to
  // trigger. Desktop is never eligible.
  const isEligible =
    !isInstalled &&
    (platform === "ios" || (platform === "android" && canInstall));

  const [isOpen, setIsOpen] = useState(
    () => isEligible && !isDismissalActive()
  );
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (!isEligible) {
      setIsOpen(false);
      return;
    }

    if (isOpen || isDismissalActive()) return;

    // Defer the very first paint of the card/modal to idle time so it never
    // competes with the landing page's own first paint.
    const handle = scheduleIdle(() => setIsOpen(true));
    return () => cancelIdle(handle);
  }, [isEligible, isOpen]);

  const handleDismiss = useCallback(() => {
    recordDismissal();
    setIsOpen(false);
  }, []);

  const handleAndroidInstall = useCallback(async () => {
    setIsInstalling(true);
    const accepted = await promptInstall();
    setIsInstalling(false);
    setIsOpen(false);
    if (!accepted) {
      recordDismissal();
    }
  }, [promptInstall]);

  const handleFloatingButtonClick = useCallback(() => {
    if (platform === "android") {
      void promptInstall();
    } else {
      setIsOpen(true);
    }
  }, [platform, promptInstall]);

  if (!isEligible) return null;

  return (
    <>
      {platform === "android" && (
        <AndroidInstallCard
          open={isOpen}
          isInstalling={isInstalling}
          onInstall={handleAndroidInstall}
          onDismiss={handleDismiss}
        />
      )}
      {platform === "ios" && (
        <IosInstallGuideModal open={isOpen} onDismiss={handleDismiss} />
      )}
      {!isOpen && (
        <FloatingInstallButton
          platform={platform}
          onClick={handleFloatingButtonClick}
        />
      )}
    </>
  );
};

export default PwaInstallManager;
