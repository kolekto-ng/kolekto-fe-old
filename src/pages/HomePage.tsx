
import React from 'react';
import NavBar from '@/components/NavBar';
import Features from "@/components/lpMain/features/Features";
import Footer from "@/components/Footer/Footer";
import Hero from "@/components/lpMain/hero/Hero";
import SimplifyCollection from "@/components/lpMain/simCol/SimplifyCollection";
import WhyKolekto from "@/components/lpMain/whyKolekto/whyKolekto";
import FAQSection from "@/components/FAQSection/FAQSection";
import HowItWorks from "@/components/lpMain/hwWorks/HowItWorks";


const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <div className='bg-[#E3FFE6] text-center text-[18px] py-[12px]'>Be part of the leaders shaping Kolekto on campus</div>
      <NavBar />

      <main className="flex-grow bg-[#FAFAFA] overflow-hidden">
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
