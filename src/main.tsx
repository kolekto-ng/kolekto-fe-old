
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
// Create a custom window property for debugging drag and drop
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('error', (e) => {
    console.log('Global error handler:', e.message);
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GoogleReCaptchaProvider reCaptchaKey="6LeWENorAAAAALS4O9P-c-x1e65yu-U5bt8XGp-t">
        <App />
      </GoogleReCaptchaProvider>
    </BrowserRouter>
  </React.StrictMode>
);
