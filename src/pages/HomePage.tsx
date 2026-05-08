import React, { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
const LandingPage = lazy(() => import("./LandingPage"));
const PWAInstallPrompt = lazy(() => import("@/components/PWAInstallPrompt"));

const HomePage: React.FC = () => {
  return (
    <>
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-[60vh]">
            <Loader2 className="h-7 w-7 animate-spin text-kolekto" />
          </div>
        }
      >
        <LandingPage />
      </Suspense>
      <Suspense fallback={null}>
        {/* PWA Install Prompt - Shows when installable */}
        <PWAInstallPrompt variant="banner" />
      </Suspense>
    </>
  );
};

export default HomePage;
