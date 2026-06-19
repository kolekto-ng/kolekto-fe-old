
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
