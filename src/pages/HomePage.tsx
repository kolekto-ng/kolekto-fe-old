import React from 'react';
import LandingPage from './LandingPage';
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const HomePage: React.FC = () => {
  return (
    <>
      <LandingPage />
      {/* PWA Install Prompt - Shows when installable */}
      <PWAInstallPrompt variant="banner" />
    </>
  );
};

export default HomePage;
