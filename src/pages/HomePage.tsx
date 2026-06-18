import React, { Suspense, lazy } from "react";
import LandingPage from "./LandingPage";
const PWAInstallPrompt = lazy(() => import("@/components/PWAInstallPrompt"));

const HomePage: React.FC = () => {
  return (
    <>
      <LandingPage />
      <Suspense fallback={null}>
        {/* PWA Install Prompt - Shows when installable */}
        <PWAInstallPrompt variant="banner" />
      </Suspense>
    </>
  );
};

export default HomePage;
