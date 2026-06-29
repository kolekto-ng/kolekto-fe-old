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

  // Whether this platform gets any install UI at all. The floating button
  // lives under this condition alone — per spec it stays available
  // (Android: "not installed", iOS: "not standalone") regardless of the
  // dismissal cooldown or whether Chrome has offered beforeinstallprompt yet.
  const isPlatformSupported = platform === "ios" || platform === "android";
  const canShowAnything = isPlatformSupported && !isInstalled;

  // Whether the install card/modal itself has something to do. iOS can
  // always be guided through "Add to Home Screen". Android needs the actual
  // beforeinstallprompt event — without it there is no native flow for the
  // card's primary button to trigger.
  const canOfferInstallFlow =
    canShowAnything && (platform === "ios" || canInstall);

  const [isOpen, setIsOpen] = useState(
    () => canOfferInstallFlow && !isDismissalActive()
  );
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (!canOfferInstallFlow) {
      setIsOpen(false);
      return;
    }

    if (isOpen || isDismissalActive()) return;

    // Defer the very first paint of the card/modal to idle time so it never
    // competes with the landing page's own first paint.
    const handle = scheduleIdle(() => setIsOpen(true));
    return () => cancelIdle(handle);
  }, [canOfferInstallFlow, isOpen]);

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

  if (!canShowAnything) return null;

  return (
    <>
      {platform === "android" && canOfferInstallFlow && (
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
