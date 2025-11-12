
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA
import { registerSW } from 'virtual:pwa-register';

// Create a custom window property for debugging drag and drop
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('error', (e) => {
    console.log('Global error handler:', e.message);
  });
}

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>

      <App />

    </BrowserRouter>
  </React.StrictMode>
);
