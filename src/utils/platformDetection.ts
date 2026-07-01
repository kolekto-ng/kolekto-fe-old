export type InstallPlatform = "ios" | "android" | "desktop";

type NavigatorWithInstallHints = Navigator & {
  standalone?: boolean;
  userAgentData?: { mobile?: boolean; platform?: string };
};

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";

  const nav = navigator as NavigatorWithInstallHints;
  const ua = nav.userAgent || "";

  // Safari never exposes User-Agent Client Hints, so UA sniffing is the only
  // signal available for iOS. iPadOS 13+ reports as "Macintosh" but, unlike a
  // real Mac, is touch-only — `maxTouchPoints` tells the two apart.
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  if (isIos) return "ios";

  // Chromium browsers expose `userAgentData.mobile`, the modern (UA-CH)
  // replacement for sniffing the UA string — prefer it when available.
  if (nav.userAgentData) {
    return nav.userAgentData.mobile ? "android" : "desktop";
  }

  return /android/i.test(ua) ? "android" : "desktop";
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as NavigatorWithInstallHints;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
      window.matchMedia?.("(display-mode: window-controls-overlay)").matches ||
      nav.standalone === true ||
      document.referrer.startsWith("android-app://")
  );
}
