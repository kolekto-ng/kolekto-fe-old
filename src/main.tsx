
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA
import { registerSW } from 'virtual:pwa-register';
import { registerPwaUpdater, setPwaUpdateState } from '@/lib/pwaUpdates';

// Create a custom window property for debugging drag and drop
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('error', (e) => {
    console.log('Global error handler:', e.message);
  });
}

function setupPwaUpdateChecks(registration?: ServiceWorkerRegistration) {
  if (!registration || typeof window === 'undefined') return;

  const runUpdateCheck = async () => {
    if (!navigator.onLine) return;

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
    registerPwaUpdater(updateSW);
    setPwaUpdateState({ lastCheckedAt: Date.now() });
    setupPwaUpdateChecks(registration);
  },
  onNeedRefresh() {
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
