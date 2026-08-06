
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA
import { registerSW } from 'virtual:pwa-register';
import { registerPwaUpdater, setPwaUpdateState } from '@/lib/pwaUpdates';
import { isCriticalFlowActive } from '@/lib/criticalFlow';
import { useAuthStore } from '@/store/useAuthStore';
// Attaches window.kolektoPushDiagnostics() for on-device push troubleshooting.
import '@/utils/pushDiagnostics';

// Temporary P0 diagnostic: logs whenever auth state flips user identity or
// session presence, so a mid-KYC-flow forced logout (vs. a plain page
// reload) can be told apart in the console.
useAuthStore.subscribe((state, prevState) => {
  if (state.user?.id !== prevState.user?.id || !!state.session !== !!prevState.session) {
    console.info('[diag] auth state changed', {
      prevUserId: prevState.user?.id ?? null,
      userId: state.user?.id ?? null,
      hadSession: !!prevState.session,
      hasSession: !!state.session,
      at: new Date().toISOString(),
    });
  }
});

// --- Temporary P0 diagnostics (2026-08-06): KYC upload full-page-reload ---
// Root cause has been identified and fixed (see vite.config.ts registerType
// + skipWaiting). These listeners stay in place for a few release cycles to
// confirm in production that no reload/navigation/uncaught-rejection is
// firing during the KYC flow anymore. Safe to remove once confirmed clean.
window.addEventListener('beforeunload', () => {
  // If this ever logs while a KYC dialog is open, something is still forcing
  // a navigation/reload mid-flow — the bug is not fully fixed.
  console.warn('[diag] beforeunload fired', {
    criticalFlowActive: isCriticalFlowActive(),
    path: window.location.pathname,
    at: new Date().toISOString(),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[diag] unhandled promise rejection', {
    reason: event.reason,
    criticalFlowActive: isCriticalFlowActive(),
    path: window.location.pathname,
    at: new Date().toISOString(),
  });
});

window.addEventListener('error', (e) => {
  console.error('[diag] uncaught exception', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    criticalFlowActive: isCriticalFlowActive(),
    at: new Date().toISOString(),
  });
});
// --- end temporary P0 diagnostics ---

function setupPwaUpdateChecks(registration?: ServiceWorkerRegistration) {
  if (!registration || typeof window === 'undefined') return;

  const runUpdateCheck = async () => {
    if (!navigator.onLine) return;
    if (isCriticalFlowActive()) {
      // Don't poll for a new SW while e.g. the KYC upload dialog is open.
      // With registerType: "prompt" a detected update no longer force-
      // reloads the page on its own, but skipping the check here still
      // avoids surfacing the "Refresh now" banner mid-flow and avoids
      // needless network activity while the user is mid-upload.
      console.info('[diag] skipping SW update check — critical flow active');
      return;
    }

    try {
      await registration.update();
      setPwaUpdateState({ lastCheckedAt: Date.now() });
    } catch (error) {
      console.warn('[pwa] service worker update check failed:', error);
    }
  };

  const intervalId = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void runUpdateCheck();
    }
  }, 90_000);

  const handleFocus = () => {
    void runUpdateCheck();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void runUpdateCheck();
    }
  };

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  void runUpdateCheck();

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

// One-time cleanup for duplicate push notifications on returning devices.
// Older builds registered `/push-sw.js` as a *standalone* service worker. In
// the current PWA build it is only an importScripts() module inside the single
// workbox-generated SW. Any leftover standalone registration is a second
// worker that receives the SAME push event again and shows a second system
// notification (the same `tag` only collapses notifications *within* one SW
// registration, not across two). Unregister it and drop its stale push
// subscription so only the workbox SW delivers pushes. Guarded to /push-sw.js
// so the active workbox SW (sw.js) is never touched — a no-op on clean devices.
async function cleanupLegacyPushServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (reg) => {
        const scriptUrl =
          reg.active?.scriptURL ||
          reg.waiting?.scriptURL ||
          reg.installing?.scriptURL ||
          '';
        if (!scriptUrl.endsWith('/push-sw.js')) return;
        await reg.pushManager
          .getSubscription()
          .then((sub) => sub?.unsubscribe())
          .catch(() => undefined);
        await reg.unregister().catch(() => undefined);
        console.info('[pwa] removed legacy standalone push-sw.js registration');
      }),
    );
  } catch (error) {
    console.warn('[pwa] legacy push SW cleanup failed:', error);
  }
}

void cleanupLegacyPushServiceWorker();

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    console.info('[diag] service worker registered');
    registerPwaUpdater(updateSW);
    setPwaUpdateState({ lastCheckedAt: Date.now() });
    setupPwaUpdateChecks(registration);
  },
  onNeedRefresh() {
    // Fires when a new SW is waiting. Under registerType: "prompt" this only
    // surfaces the dismissible "Refresh now" banner — nothing reloads until
    // the user clicks it (see PwaUpdatePrompt.tsx -> applyPwaUpdate()).
    console.info('[diag] new SW waiting — showing update prompt', {
      criticalFlowActive: isCriticalFlowActive(),
    });
    setPwaUpdateState({
      needRefresh: true,
      offlineReady: false,
      updateReadyAt: Date.now(),
    });
  },
  onOfflineReady() {
    console.log('App ready to work offline');
    setPwaUpdateState({ offlineReady: true });
  },
  onRegisterError(error) {
    console.warn('[pwa] service worker registration failed:', error);
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>

      <App />

    </BrowserRouter>
  </React.StrictMode>
);
