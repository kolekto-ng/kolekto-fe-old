
import React from 'react';
import { Link } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import Features from "@/components/lpMain/features/Features";
import Footer from "@/components/Footer/Footer";
import Header from "@/components/header/Header";
import Hero from "@/components/lpMain/hero/Hero";
import SimplifyCollection from "@/components/lpMain/simCol/SimplifyCollection";
import WhyKolekto from "@/components/lpMain/whyKolekto/whyKolekto";
import FAQSection from "@/components/FAQSection/FAQSection";
import HowItWorks from "@/components/lpMain/hwWorks/HowItWorks";

import FaqSection from '@/components/home/FaqSection';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const HomePage: React.FC = () => {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col overflow-auto">
      <NavBar />

      <main className="flex-grow bg-[#FAFAFA]">
        {/* Hero Section */}
        <Hero />

        {/* Features Section */}
        <Features />
        <HowItWorks />
        <WhyKolekto />
        <FAQSection />
        <SimplifyCollection />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;
