import { useState, useEffect } from "react";

const siteKey = import.meta.env.VITE_RECAPTCHER_KEY;

export function useRecaptcher() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!window.grecaptcha) {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.onload = () => setReady(true);
      document.body.appendChild(script);
    } else {
      setReady(true);
    }
  }, [siteKey]);

  const execute = async (action) => {
    if (!window.grecaptcha || !ready) return null;
    return await window.grecaptcha.execute(siteKey, { action });
  };

  return { execute, ready };
}
