import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuthStore } from "@/store/useAuthStore";
import {
  ArrowRight,
  Star,
  ChevronDown,
  Menu,
  X,
  Users,
  Church,
  Music2,
  BookOpen,
  HeartHandshake,
  PartyPopper,
  Layers,
  TrendingUp,
  Target,
  Ticket,
  Gift,
  Settings2,
  CreditCard,
  BarChart2,
  Mail,
  Palette,
  Share2,
  QrCode,
  Download,
  CheckCircle2,
  Clock,
  Shield,
  Zap,
  LayoutDashboard,
  LogOut,
  CalendarDays,
  Heart,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  FaWhatsapp,
  FaFacebook,
  FaTwitter,
  FaLinkedin,
  FaInstagram,
} from "react-icons/fa";
import { getActiveFundraisingCampaigns } from "@/utils/fundraisingCampaigns";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useInView,
  useMotionValueEvent,
} from "framer-motion";

// ─── Asset imports ─────────────────────────────────────────────────────
import avatar1 from "../assets/avatar-4.png";
import avatar2 from "../assets/avatar-2.png";
import avatar3 from "../assets/avatar-1.png";
import avatar4 from "../assets/avatar-3.png";
import paystackLogo from "../assets/paystack.png";
import iihLogo from "../assets/iih.png";
import featuresImage from "../assets/featuresImage.png";
import cmImage from "../assets/cm.png";
import fundraisingImage from "../assets/fundraising.png";
import tieredImage from "../assets/tier-naira.png";
import contributeImage from "../assets/contribut.png";
import collectionSvg from "../assets/collector-svg.svg";

// ═══════════════════════════════════════════════════════════════════════
//  UTILITY: useIntersectionObserver
// ═══════════════════════════════════════════════════════════════════════
function useIntersect(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, options);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, isVisible };
}

// ═══════════════════════════════════════════════════════════════════════
//  GLOBAL STYLES
// ═══════════════════════════════════════════════════════════════════════
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    :root {
      --kol-green-900: #1B5E20;
      --kol-green-800: #1C5C23;
      --kol-green-700: #2E7D32;
      --kol-green-600: #388E3C;
      --kol-green-100: #E8F5E9;
      --kol-green-50:  #F1F8F2;
      --kol-yellow:    #FFCA28;
      --kol-orange:    #FFA726;
      --kol-text:      #1A1A2E;
      --kol-muted:     #4B5563;
      --kol-border:    #E5E7EB;
      --kol-bg:        #FAFAFA;
    }

    * { box-sizing: border-box; }

    .lp-root {
      font-family: 'Inter', sans-serif;
      color: var(--kol-text);
      background: var(--kol-bg);
      overflow-x: hidden;
    }

    /* ── Reveal animation ── */
    .reveal {
      opacity: 0;
      transform: translateY(28px);
      transition: opacity 0.65s ease, transform 0.65s ease;
    }
    .reveal.visible { opacity: 1; transform: translateY(0); }
    .d1 { transition-delay: 0.05s; }
    .d2 { transition-delay: 0.12s; }
    .d3 { transition-delay: 0.19s; }
    .d4 { transition-delay: 0.26s; }
    .d5 { transition-delay: 0.33s; }
    .d6 { transition-delay: 0.40s; }

    /* ── Hero slide-in from right ── */
    .hero-img-wrap {
      opacity: 0;
      transform: translateX(40px);
      transition: opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s;
    }
    .hero-img-wrap.visible { opacity: 1; transform: translateX(0); }

    /* ── CTA glow pulse ── */
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(28,92,35,0.35); }
      50%       { box-shadow: 0 0 0 10px rgba(28,92,35,0); }
    }
    .btn-primary { animation: pulseGlow 3s ease-in-out infinite; }
    .btn-primary:hover {
      animation: none;
      box-shadow: 0 8px 32px rgba(28,92,35,0.4);
      transform: translateY(-2px);
    }

    /* ── Float animations for hero badges ── */
    @keyframes floatA {
      0%, 100% { transform: translateY(0px) rotate(-1deg); }
      50%       { transform: translateY(-12px) rotate(1deg); }
    }
    @keyframes floatB {
      0%, 100% { transform: translateY(0px) rotate(2deg); }
      50%       { transform: translateY(-9px) rotate(-1deg); }
    }
    @keyframes floatC {
      0%, 100% { transform: translateY(0px) rotate(-2deg); }
      50%       { transform: translateY(-14px) rotate(2deg); }
    }
    .float-a { animation: floatA 4s ease-in-out infinite; }
    .float-b { animation: floatB 5s ease-in-out infinite 0.8s; }
    .float-c { animation: floatC 3.5s ease-in-out infinite 1.4s; }

    /* ── Drift animations for cinematic chips ── */
    @keyframes drift1 {
      0%,100% { transform: translate(0,0) rotate(-2deg); }
      33%     { transform: translate(8px,-10px) rotate(1deg); }
      66%     { transform: translate(-5px,-6px) rotate(-1deg); }
    }
    @keyframes drift2 {
      0%,100% { transform: translate(0,0) rotate(1deg); }
      33%     { transform: translate(-10px,-8px) rotate(-2deg); }
      66%     { transform: translate(6px,-12px) rotate(2deg); }
    }
    @keyframes drift3 {
      0%,100% { transform: translate(0,0) rotate(-1deg); }
      33%     { transform: translate(6px,8px) rotate(2deg); }
      66%     { transform: translate(-8px,4px) rotate(-2deg); }
    }
    @keyframes drift4 {
      0%,100% { transform: translate(0,0) rotate(2deg); }
      33%     { transform: translate(-6px,-12px) rotate(-1deg); }
      66%     { transform: translate(10px,-6px) rotate(1deg); }
    }
    @keyframes drift5 {
      0%,100% { transform: translate(0,0) rotate(-2deg); }
      25%     { transform: translate(12px,-8px) rotate(1deg); }
      75%     { transform: translate(-4px,-14px) rotate(-1deg); }
    }
    @keyframes drift6 {
      0%,100% { transform: translate(0,0) rotate(1deg); }
      50%     { transform: translate(-12px,-10px) rotate(-2deg); }
    }
    .drift-1 { animation: drift1 7s ease-in-out infinite; }
    .drift-2 { animation: drift2 9s ease-in-out infinite 1s; }
    .drift-3 { animation: drift3 8s ease-in-out infinite 2s; }
    .drift-4 { animation: drift4 10s ease-in-out infinite 0.5s; }
    .drift-5 { animation: drift5 6.5s ease-in-out infinite 1.5s; }
    .drift-6 { animation: drift6 11s ease-in-out infinite 2.5s; }
    .drift-7 { animation: drift1 8.5s ease-in-out infinite 3s; }
    .drift-8 { animation: drift3 7.5s ease-in-out infinite 1.2s; }
    .drift-9 { animation: drift5 9.5s ease-in-out infinite 0.8s; }
    .drift-10 { animation: drift2 6s ease-in-out infinite 2.2s; }
    .drift-11 { animation: drift4 10.5s ease-in-out infinite 1.8s; }
    .drift-12 { animation: drift6 8s ease-in-out infinite 3.5s; }

    /* ── Shimmer skeleton ── */
    @keyframes shimmer {
      from { background-position: -200% 0; }
      to   { background-position: 200% 0; }
    }
    .skeleton-shimmer {
      background: linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      border-radius: 8px;
    }

    /* ── Progress bar ── */
    @keyframes growWidth { from { width: 0; } }
    .progress-fill { animation: growWidth 1.2s ease-out both; }

    /* ── Card hover lift ── */
    .card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
    .card-hover:hover { transform: translateY(-5px); box-shadow: 0 16px 48px rgba(0,0,0,0.10); }

    /* ── Icon micro-bounce ── */
    .icon-bounce { transition: transform 0.25s ease; }
    .card-hover:hover .icon-bounce { transform: scale(1.15) translateY(-2px); }

    /* ── Marquee ── */
    .marquee-outer { overflow: hidden; }
    .marquee-track {
      display: flex;
      gap: 48px;
      animation: marquee 22s linear infinite;
      width: max-content;
    }
    @keyframes marquee {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }
    .marquee-track:hover { animation-play-state: paused; }

    /* ── Accordion ── */
    .accordion-body { overflow: hidden; max-height: 0; transition: max-height 0.35s ease, padding 0.25s ease; }
    .accordion-body.open { max-height: 500px; }

    /* ── Gradients ── */
    .hero-bg { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f9fafb 100%); }
    .cta-bg { background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1A3A1A 100%); }

    /* ── Navbar ── */
    .lp-nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--kol-border);
      transition: box-shadow 0.3s;
    }
    .lp-nav.scrolled { box-shadow: 0 4px 24px rgba(0,0,0,0.08); }

    /* ── Testimonial ── */
    .testimonial-card { background: linear-gradient(145deg, #ffffff 0%, var(--kol-green-50) 100%); }

    /* ── Cinematic section ── */
    .cinematic-bg {
      background: linear-gradient(145deg, #071a0f 0%, #0d2918 40%, #091525 100%);
    }
    .use-case-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 16px;
      border-radius: 100px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.9);
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      backdrop-filter: blur(8px);
      cursor: default;
      user-select: none;
    }
    .use-case-chip:hover {
      background: rgba(255,255,255,0.14);
      border-color: rgba(167,243,208,0.4);
      color: #A7F3D0;
    }
    .chip-glow {
      border-color: rgba(167,243,208,0.35);
      background: rgba(46,125,50,0.25);
      color: #A7F3D0;
    }

    /* ── Campaign card skeleton ── */
    .campaign-skeleton { background: white; border-radius: 20px; overflow: hidden; border: 1.5px solid var(--kol-border); }

    /* ── Scroll snap for collection types ── */
    .types-scroll::-webkit-scrollbar { display: none; }
    .types-scroll { scrollbar-width: none; -ms-overflow-style: none; }

    /* ── LP campaign card ── */
    .lp-campaign-card {
      background: white;
      border-radius: 20px;
      overflow: hidden;
      border: 1.5px solid var(--kol-border);
      transition: transform 0.25s ease, box-shadow 0.25s ease;
      cursor: pointer;
      display: flex;
      flex-direction: column;
    }
    .lp-campaign-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 16px 48px rgba(0,0,0,0.13);
    }
    .lp-campaign-card:hover img {
      transform: scale(1.04);
    }
    .progress-fill {
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* ── Mobile nav overlay + slide panel ── */
    .mobile-menu-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      backdrop-filter: blur(4px);
    }
    .mobile-menu-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }
    .mobile-menu-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(340px, 90vw);
      background: white;
      z-index: 1001;
      transform: translateX(100%);
      transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
      overflow-y: auto;
      box-shadow: -10px 0 40px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
    }
    .mobile-menu-panel.open {
      transform: translateX(0);
    }

    .nav-link {
      color: var(--kol-muted);
      font-size: 14px;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s ease;
      padding: 8px 12px;
      border-radius: 8px;
    }
    .nav-link:hover {
      color: var(--kol-green-800);
      background: var(--kol-green-50);
    }

    .mobile-nav-link {
      color: var(--kol-text);
      font-size: 16px;
      text-decoration: none;
      font-weight: 600;
      padding: 12px 16px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background 0.2s;
    }
    .mobile-nav-link:active {
      background: var(--kol-green-50);
    }

    .nav-btn-primary {
      background: linear-gradient(135deg, #1C5C23, #2E7D32);
      color: white;
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(28,92,35,0.2);
    }
    .nav-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(28,92,35,0.3);
      filter: brightness(1.1);
    }

    /* ── Background floating chips in cinematic section ── */
    .bg-chip-cloud {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 0;
    }

    /* ── Chip mobile marquee (shown only on mobile, hidden on desktop) ── */
    .chip-marquee-outer { display: none; overflow: hidden; width: 100%; margin-bottom: 12px; }
    @keyframes chipScroll {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .chip-marquee-track {
      display: flex;
      gap: 10px;
      width: max-content;
      animation: chipScroll 18s linear infinite;
      will-change: transform;
      padding: 4px 0 8px;
    }
    /* legacy selector kept for safety */
    .chip-mobile-scroll { display: none; }

    /* ── Collection types grid cards ── */
    .types-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    @media (max-width: 1024px) {
      .types-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 600px) {
      .types-grid { grid-template-columns: 1fr !important; }
    }

    /* ── Auto-scroll marquee for campaigns ── */
    @keyframes campaignScroll {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .campaign-marquee-wrap {
      overflow: hidden;
      width: 100%;
    }
    .campaign-marquee-track {
      display: flex;
      gap: 24px;
      width: max-content;
      animation: campaignScroll 32s linear infinite;
      will-change: transform;
      padding: 8px 0 16px;
    }
    .campaign-marquee-track:hover {
      animation-play-state: paused;
    }

    /* ── Auto-scroll marquee for testimonials ── */
    @keyframes testimonialScroll {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .testimonial-marquee-wrap {
      overflow: hidden;
      width: 100%;
    }
    .testimonial-marquee-track {
      display: flex;
      gap: 20px;
      width: max-content;
      animation: testimonialScroll 44s linear infinite;
      will-change: transform;
      padding: 4px 0 8px;
      align-items: stretch;
    }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      .hero-grid { grid-template-columns: 1fr !important; text-align: center; }
      .hero-float-badge { display: none !important; }
      .hero-img-wrap {
        opacity: 1 !important;
        transform: none !important;
        margin-top: 32px;
      }
      .hero-img-wrap .hero-mockup-card { max-width: 420px; margin: 0 auto; }
      .hero-left { align-items: center !important; }
      .hero-left .reveal { width: auto; }
      .hero-ctas { justify-content: center !important; }
      .hero-social-proof { justify-content: center !important; }
      .hero-powered { justify-content: center !important; }
    }
    @media (max-width: 800px) {
      .why-grid { grid-template-columns: 1fr !important; }
      .cinematic-inner { grid-template-columns: 1fr !important; text-align: center; }
      .cinematic-inner .reveal { margin-left: auto; margin-right: auto; }
      .cinematic-cta { justify-content: center !important; }
    }
    @media (max-width: 768px) {
      .features-header-grid { grid-template-columns: 1fr !important; }
      .how-steps-desktop { display: none !important; }
      .how-steps-mobile { display: flex !important; }
      .faq-grid { grid-template-columns: 1fr !important; }
      .faq-sticky { position: static !important; }
    }
    @media (max-width: 800px) {
      .why-benefits-grid { grid-template-columns: 1fr 1fr !important; }
    }
    @media (max-width: 480px) {
      .why-benefits-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 640px) {
      #hero { padding: 40px 16px 48px !important; min-height: auto !important; }
      #use-cases { padding: 64px 16px !important; }
      #collection-types, #features, #how-it-works,
      #active-fundraising, #testimonials, #why-kolekto, #faq {
        padding-top: 56px !important;
        padding-bottom: 56px !important;
      }
      .cta-section-inner {
        padding: 40px 20px !important;
        border-radius: 20px !important;
      }
      .cta-btns { flex-direction: column !important; align-items: stretch !important; }
      .cta-btns a, .cta-btns button { justify-content: center !important; width: 100% !important; }
      .trust-badges { gap: 8px !important; }
      .trust-badges span { font-size: 11px !important; padding: 4px 10px !important; }
      .testimonial-rating-row { flex-direction: column !important; gap: 4px !important; align-items: center !important; }
      /* hero left col center on mobile */
      .hero-left { align-items: center !important; text-align: center !important; }
      .hero-ctas { justify-content: center !important; flex-direction: column !important; align-items: stretch !important; }
      .hero-ctas a, .hero-ctas button { width: 100% !important; justify-content: center !important; text-align: center !important; }
      .hero-powered { justify-content: center !important; }
      .hero-social-proof { justify-content: center !important; }
      /* Cinematic section */
      .cinematic-inner { gap: 32px !important; }
      .cinematic-cta { justify-content: center !important; }
      /* chip cloud hidden on small, show mobile marquee */
      .chip-cloud { display: none !important; }
      .chip-marquee-outer { display: block !important; }
      .chip-mobile-scroll { display: none !important; }
      /* campaign marquee on mobile */
      .campaign-marquee-wrap { padding: 0 8px !important; }
      #active-fundraising { padding: 56px 0 !important; }
      /* hero mockup max-width */
      .hero-mockup-card { padding: 12px !important; }
      /* footer */
      .footer-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 900px) {
      .footer-grid { grid-template-columns: 1fr 1fr !important; }
    }
    @media (max-width: 480px) {
      .footer-grid { grid-template-columns: 1fr !important; }
    }
    /* Cinematic section: desktop shows chip-cloud, mobile shows marquee */
    @media (min-width: 801px) {
      .chip-marquee-outer { display: none !important; }
      .chip-mobile-scroll { display: none !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════
//  NAVBAR
// ═══════════════════════════════════════════════════════════════════════
const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, signOut } = useAuthStore() as any;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navLinks = [
    { href: "#use-cases", label: "Who It's For" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#features", label: "Features" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <>
      <nav className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="container mx-auto px-6 flex items-center justify-between h-20 md:h-24">
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <a key={href} href={href} className="nav-link">
                {label}
              </a>
            ))}
            <Link to="/active-campaigns" className="nav-link">
              Campaigns
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="nav-link flex items-center gap-2"
                >
                  <LayoutDashboard size={18} /> Dashboard
                </Link>
                <button
                  onClick={() => signOut()}
                  className="nav-link flex items-center gap-2 bg-transparent border-none cursor-pointer"
                >
                  <LogOut size={18} /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="nav-btn-primary"
                  style={{
                    background: "transparent",
                    color: "var(--kol-green-800)",
                    border: "1.5px solid var(--kol-green-100)",
                    boxShadow: "none",
                  }}
                >
                  Sign Up
                </Link>
              </>
            )}
            <Link to="/create-collection" className="nav-btn-primary">
              Create Collection
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden flex items-center justify-center w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 z-[1002]"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Slide-in Panel */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mobile-menu-overlay open"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="mobile-menu-panel open"
            >
              {/* Header */}
              <div className="p-6 flex justify-between items-center border-b border-gray-100">
                <Logo size="md" />
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 border border-gray-100 text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation Section */}
              <div className="flex-1 p-6 space-y-6">
                <div className="space-y-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2">
                    Navigation
                  </p>
                  <div className="space-y-1">
                    {navLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className="mobile-nav-link"
                      >
                        {link.label}
                        <ChevronRight size={16} className="text-gray-300" />
                      </a>
                    ))}
                    <Link
                      to="/active-campaigns"
                      onClick={() => setMenuOpen(false)}
                      className="mobile-nav-link"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                          <Heart
                            size={16}
                            className="text-red-500 fill-red-500"
                          />
                        </span>
                        Active Campaigns
                      </span>
                      <ChevronRight size={16} className="text-gray-300" />
                    </Link>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2">
                    Account
                  </p>
                  <div className="space-y-1">
                    {user ? (
                      <>
                        <Link
                          to="/dashboard"
                          onClick={() => setMenuOpen(false)}
                          className="mobile-nav-link"
                        >
                          <span className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                              <LayoutDashboard
                                size={16}
                                className="text-green-700"
                              />
                            </span>
                            Dashboard
                          </span>
                        </Link>
                        <button
                          onClick={() => {
                            signOut();
                            setMenuOpen(false);
                          }}
                          className="mobile-nav-link w-full text-red-600 bg-transparent border-none"
                        >
                          <span className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                              <LogOut size={16} className="text-red-500" />
                            </span>
                            Sign Out
                          </span>
                        </button>
                      </>
                    ) : (
                      <Link
                        to="/login"
                        onClick={() => setMenuOpen(false)}
                        className="mobile-nav-link"
                      >
                        <span className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                            <ArrowRight size={16} className="text-green-700" />
                          </span>
                          Log In
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-gray-100 space-y-3">
                <Link
                  to="/create-collection"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center justify-center p-4 bg-gradient-to-br from-green-800 to-green-700 text-white rounded-2xl font-bold shadow-lg shadow-green-900/20"
                >
                  Create Collection
                </Link>
                {!user && (
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center justify-center p-4 bg-green-50 text-green-800 rounded-2xl font-bold border border-green-100"
                  >
                    Sign Up Free
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 1: HERO
// ═══════════════════════════════════════════════════════════════════════
const HeroSection = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(heroRef, { once: true, margin: "-50px" });

  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
  };

  return (
    <section
      id="hero"
      className="hero-bg"
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        alignItems: "center",
        padding: "64px 24px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "center",
          }}
          className="hero-grid"
        >
          {/* LEFT */}
          <motion.div
            ref={heroRef}
            className="hero-left"
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            style={{ display: "flex", flexDirection: "column", gap: 28 }}
          >
            <motion.div
              variants={itemVariants}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "white",
                border: "1px solid var(--kol-border)",
                borderRadius: 32,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--kol-green-800)",
                width: "fit-content",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <img
                src={collectionSvg}
                alt=""
                style={{ width: 16, height: 16 }}
              />
              Smart Group Collections for Communities, Teams &amp; Events
            </motion.div>

            <motion.div variants={itemVariants}>
              <h1
                style={{
                  fontSize: "clamp(2rem, 4vw, 3.5rem)",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "var(--kol-text)",
                  margin: 0,
                }}
              >
                Collect Money from Groups —{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #1C5C23, #388E3C)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Without the Stress
                </span>
              </h1>
            </motion.div>

            <motion.p
              variants={itemVariants}
              style={{
                fontSize: 18,
                color: "var(--kol-muted)",
                lineHeight: 1.65,
                maxWidth: 520,
                margin: 0,
              }}
            >
              From shared expenses to large-scale fundraising, Kolekto helps you
              collect, track, and manage payments from multiple people—all in
              one place.{" "}
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="hero-ctas"
              style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
            >
              <Link
                to="/create-collection"
                className="btn-primary"
                style={{
                  background: "linear-gradient(135deg, #1C5C23, #2E7D32)",
                  color: "white",
                  padding: "14px 28px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Start Collecting — It's Free <ArrowRight size={17} />
              </Link>
              <a
                href="#how-it-works"
                style={{
                  background: "white",
                  color: "var(--kol-green-800)",
                  padding: "14px 24px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1.5px solid var(--kol-green-100)",
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "var(--kol-green-50)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "white";
                }}
              >
                See How It Works
              </a>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="hero-social-proof"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex" }}>
                {[avatar1, avatar2, avatar3, avatar4].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: "2.5px solid white",
                      marginLeft: i === 0 ? 0 : -12,
                      objectFit: "cover",
                    }}
                  />
                ))}
              </div>
              <div>
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="#FFCA28" color="#FFCA28" />
                  ))}
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--kol-muted)",
                      marginLeft: 6,
                    }}
                  >
                    4.9 / 5 · 478 reviews
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--kol-muted)",
                    marginTop: 2,
                  }}
                >
                  Trusted by <strong>5,000+</strong> users across Nigeria
                </p>
              </div>
            </motion.div>

            {/* <motion.div variants={itemVariants} className="hero-powered" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Powered by</span>
              <img src={paystackLogo} alt="Paystack" style={{ height: 28, objectFit: "contain" }} />
              <img src={iihLogo} alt="Ilorin Innovation Hub" style={{ height: 28, objectFit: "contain" }} />
            </motion.div> */}
          </motion.div>

          {/* RIGHT — product UI mockup with floating badges */}
          <motion.div
            className={`hero-img-wrap ${isInView ? "visible" : ""}`}
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "relative" }}
          >
            {/* Main screenshot card */}
            <div
              className="hero-mockup-card"
              style={{
                background: "white",
                borderRadius: 20,
                padding: 16,
                boxShadow: "0 24px 80px rgba(0,0,0,0.14)",
                position: "relative",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #1C5C23, #2E7D32)",
                  borderRadius: 14,
                  padding: "20px 20px 16px",
                  color: "white",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div
                      style={{ fontSize: 11, opacity: 0.75, marginBottom: 4 }}
                    >
                      ACTIVE COLLECTION
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      Year-End Party Fund
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                      Fixed · ₦5,000 per person · 40 members
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    65%
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    height: 8,
                  }}
                >
                  <div
                    className="progress-fill"
                    style={{
                      width: "65%",
                      height: "100%",
                      background: "#FFCA28",
                      borderRadius: 8,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginTop: 8,
                    opacity: 0.9,
                  }}
                >
                  <span>₦130,000 raised</span>
                  <span>Goal: ₦200,000</span>
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#6B7280",
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Recent Contributions
              </div>
              {[
                { name: "Chidi A.", amount: "₦5,000", time: "2 min ago" },
                { name: "Funke B.", amount: "₦5,000", time: "14 min ago" },
                { name: "James O.", amount: "₦5,000", time: "1 hr ago" },
              ].map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: i < 2 ? "1px solid #F3F4F6" : "none",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #1C5C23, #388E3C)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {c.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                        {c.time}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--kol-green-800)",
                    }}
                  >
                    {c.amount}
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {[
                  { icon: <Share2 size={13} />, label: "Share" },
                  { icon: <QrCode size={13} />, label: "QR Code" },
                  { icon: <Download size={13} />, label: "Withdraw" },
                ].map((btn, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      background: i === 2 ? "var(--kol-green-800)" : "#F9FAFB",
                      color: i === 2 ? "white" : "var(--kol-text)",
                      borderRadius: 8,
                      padding: "9px 6px",
                      fontSize: 12,
                      fontWeight: 600,
                      border: "1px solid var(--kol-border)",
                      cursor: "pointer",
                    }}
                  >
                    {btn.icon}
                    {btn.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badge: payment received */}
            <div
              className="float-a hero-float-badge"
              style={{
                position: "absolute",
                top: -20,
                right: -20,
                background: "white",
                borderRadius: 12,
                padding: "10px 14px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--kol-green-800)",
                border: "1px solid var(--kol-green-100)",
                zIndex: 3,
                whiteSpace: "nowrap",
              }}
            >
              <CheckCircle2 size={16} color="#16A34A" /> New payment: ₦5,000
            </div>

            {/* Floating badge: WhatsApp */}
            <div
              className="float-b hero-float-badge"
              style={{
                position: "absolute",
                bottom: 24,
                left: -28,
                background: "#25D366",
                borderRadius: 12,
                padding: "10px 14px",
                boxShadow: "0 8px 24px rgba(37,211,102,0.3)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "white",
                zIndex: 3,
                whiteSpace: "nowrap",
              }}
            >
              <FaWhatsapp size={16} /> Share via WhatsApp
            </div>

            {/* Floating badge: members joined */}
            <div
              className="float-c hero-float-badge"
              style={{
                position: "absolute",
                top: "38%",
                left: -36,
                background: "white",
                borderRadius: 12,
                padding: "10px 14px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#7C3AED",
                border: "1px solid #EDE9FE",
                zIndex: 3,
                whiteSpace: "nowrap",
              }}
            >
              <Users size={15} color="#7C3AED" /> 26 of 40 paid
            </div>

            {/* Decorative blob */}
            <div
              className="hero-float-badge"
              style={{
                position: "absolute",
                bottom: -32,
                right: -32,
                width: 180,
                height: 180,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, rgba(28,92,35,0.08), rgba(46,125,50,0.04))",
                zIndex: 1,
              }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  PARTNER MARQUEE STRIP
// ═══════════════════════════════════════════════════════════════════════
const MarqueeStrip = () => {
  const logos = [
    paystackLogo,
    iihLogo,
    paystackLogo,
    iihLogo,
    paystackLogo,
    iihLogo,
    paystackLogo,
    iihLogo,
  ];
  return (
    <div
      style={{
        background: "white",
        borderTop: "1px solid var(--kol-border)",
        borderBottom: "1px solid var(--kol-border)",
        padding: "20px 0",
      }}
    >
      <div className="marquee-outer">
        <div className="marquee-track">
          {[...logos, ...logos].map((src, i) => (
            <img
              key={i}
              src={src}
              alt="partner"
              style={{ height: 32, objectFit: "contain", opacity: 0.6 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 2: CINEMATIC "WHO IT'S FOR"
// ═══════════════════════════════════════════════════════════════════════
const CinematicUseCasesSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-60px" });

  // Background floating chips — positioned absolutely behind cards
  const bgChips = [
    {
      label: "Aso ebi",
      emoji: "👗",
      glow: true,
      top: "7%",
      left: "12%",
      blur: 0,
      opacity: 0.9,
      scale: 1.05,
    },
    {
      label: "Monthly dues",
      emoji: "📅",
      glow: false,
      top: "4%",
      right: "10%",
      blur: 1,
      opacity: 0.6,
      scale: 0.9,
    },
    {
      label: "Party tickets",
      emoji: "🎫",
      glow: false,
      top: "28%",
      right: "4%",
      blur: 0,
      opacity: 0.85,
      scale: 1,
    },
    {
      label: "Handout fees",
      emoji: "📚",
      glow: true,
      top: "18%",
      left: "3%",
      blur: 2,
      opacity: 0.5,
      scale: 0.85,
    },
    {
      label: "Birthday contributions",
      emoji: "🎂",
      glow: false,
      top: "50%",
      left: "5%",
      blur: 0,
      opacity: 0.75,
      scale: 0.95,
    },
    {
      label: "Donations",
      emoji: "❤️",
      glow: false,
      top: "60%",
      right: "5%",
      blur: 1.5,
      opacity: 0.65,
      scale: 0.9,
    },
    {
      label: "Membership fees",
      emoji: "🪪",
      glow: true,
      top: "3%",
      left: "42%",
      blur: 0,
      opacity: 0.8,
      scale: 1,
    },
    {
      label: "Church tithes",
      emoji: "⛪",
      glow: false,
      top: "75%",
      left: "18%",
      blur: 2,
      opacity: 0.5,
      scale: 0.88,
    },
    {
      label: "Community electricity",
      emoji: "💡",
      glow: false,
      top: "80%",
      right: "20%",
      blur: 0,
      opacity: 0.7,
      scale: 0.92,
    },
    {
      label: "Project fee",
      emoji: "🏗️",
      glow: true,
      top: "40%",
      right: "2%",
      blur: 1,
      opacity: 0.6,
      scale: 0.9,
    },
    {
      label: "Class dues",
      emoji: "🎓",
      glow: false,
      top: "88%",
      left: "45%",
      blur: 0,
      opacity: 0.65,
      scale: 0.95,
    },
    {
      label: "Medical emergency",
      emoji: "🏥",
      glow: false,
      top: "55%",
      left: "50%",
      blur: 2,
      opacity: 0.45,
      scale: 0.82,
    },
  ];

  // Float keyframes per chip (varied)
  const chipFloats = [
    { y: [0, -14, 0, 8, 0], rotate: [-1, 1, -1, 0.5, -1], duration: 7 },
    { y: [0, -9, 3, -6, 0], rotate: [1, -1, 2, -0.5, 1], duration: 9 },
    { y: [0, 10, -8, 5, 0], rotate: [-2, 1, -1, 2, -2], duration: 8 },
    { y: [0, -12, 6, -4, 0], rotate: [0.5, -1, 1.5, -0.5, 0.5], duration: 10 },
    { y: [0, 8, -10, 4, 0], rotate: [-1, 2, -1, 1, -1], duration: 6.5 },
    { y: [0, -6, 10, -8, 0], rotate: [1, -0.5, 1, -1.5, 1], duration: 11 },
    { y: [0, 12, -6, 8, 0], rotate: [-1.5, 1, -2, 0.5, -1.5], duration: 7.5 },
    { y: [0, -10, 4, -6, 0], rotate: [0, 1.5, -1, 1, 0], duration: 9.5 },
    { y: [0, 6, -12, 8, 0], rotate: [1, -1, 1.5, -1, 1], duration: 8.5 },
    { y: [0, -8, 10, -4, 0], rotate: [-0.5, 1, -1.5, 0.5, -0.5], duration: 12 },
    { y: [0, 10, -6, 4, 0], rotate: [1.5, -1, 1, -1.5, 1.5], duration: 7 },
    { y: [0, -12, 8, -8, 0], rotate: [-1, 0.5, -1, 1, -1], duration: 10.5 },
  ];

  const useCases = [
    {
      icon: <BookOpen size={22} />,
      title: "Students & Class Reps",
      desc: "Collect dues, organize trips, manage contributions — all in one link.",
    },
    {
      icon: <PartyPopper size={22} />,
      title: "Event Organizers",
      desc: "Sell tickets, collect RSVPs, manage group expenses effortlessly.",
    },
    {
      icon: <Church size={22} />,
      title: "Churches & Faith Groups",
      desc: "Manage tithes, offerings, building funds and community drives.",
    },
    {
      icon: <Users size={22} />,
      title: "Communities & Associations",
      desc: "Streamline union dues, AGM contributions and group welfare funds.",
    },
    {
      icon: <HeartHandshake size={22} />,
      title: "Friends & Family",
      desc: "Pool money for gifts, trips, emergencies and shared expenses.",
    },
    {
      icon: <Music2 size={22} />,
      title: "Clubs & Societies",
      desc: "Manage membership fees, equipment costs and event sponsorships.",
    },
  ];

  const cardEase = [0.22, 1, 0.36, 1] as [number, number, number, number];
  const cardVariants = {
    hidden: { opacity: 0, y: 32 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.1 + i * 0.09, duration: 0.55, ease: cardEase },
    }),
  };

  return (
    <section
      id="use-cases"
      className="cinematic-bg"
      ref={sectionRef}
      style={{
        padding: "96px 24px",
        position: "relative",
        overflow: "hidden",
        minHeight: 700,
      }}
    >
      {/* ── Background radial glows ── */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "30%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(46,125,50,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "20%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── BACKGROUND floating chips (behind everything) ── */}
      <div className="bg-chip-cloud">
        {bgChips.map((chip, i) => {
          const float = chipFloats[i % chipFloats.length];
          const pos: React.CSSProperties = {
            position: "absolute",
            top: chip.top,
            ...(chip.left ? { left: chip.left } : {}),
            ...(chip.right ? { right: chip.right } : {}),
          };
          return (
            <motion.span
              key={i}
              className={`use-case-chip ${chip.glow ? "chip-glow" : ""}`}
              style={{
                ...pos,
                filter: chip.blur > 0 ? `blur(${chip.blur}px)` : "none",
                opacity: chip.opacity,
                transform: `scale(${chip.scale})`,
                transformOrigin: "center",
                cursor: "default",
                zIndex: chip.blur === 0 ? 1 : 0,
              }}
              initial={{ opacity: 0, y: -30, scale: chip.scale * 0.7 }}
              animate={
                isInView
                  ? {
                      opacity: chip.opacity,
                      y: float.y as any,
                      rotate: float.rotate as any,
                      scale: chip.scale,
                    }
                  : { opacity: 0, y: -30, scale: chip.scale * 0.7 }
              }
              transition={{
                opacity: { delay: 0.3 + i * 0.07, duration: 0.6 },
                scale: {
                  delay: 0.3 + i * 0.07,
                  duration: 0.6,
                  type: "spring",
                  stiffness: 200,
                  damping: 16,
                },
                y: {
                  delay: 1.0 + i * 0.05,
                  duration: float.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatType: "mirror",
                },
                rotate: {
                  delay: 1.0 + i * 0.05,
                  duration: float.duration * 1.1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatType: "mirror",
                },
              }}
            >
              <span style={{ fontSize: 15 }}>{chip.emoji}</span>
              {chip.label}
            </motion.span>
          );
        })}
      </div>

      {/* ── FOREGROUND content (z-index: 2) ── */}
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Section header */}
        <div
          className="cinematic-inner"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "center",
            marginBottom: 72,
          }}
        >
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(167,243,208,0.15)",
                border: "1px solid rgba(167,243,208,0.3)",
                borderRadius: 32,
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#A7F3D0",
                marginBottom: 20,
              }}
            >
              <Sparkles size={14} /> WHO IT'S FOR
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{
                fontSize: "clamp(1.9rem, 4vw, 3.2rem)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "white",
                margin: "0 0 20px",
                lineHeight: 1.1,
              }}
            >
              One platform for every type of group collection.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{
                fontSize: 17,
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.7,
                margin: "0 0 32px",
                maxWidth: 480,
              }}
            >
              From aso ebi to church tithes — if your community needs to pool
              money, Kolekto was built for it.
            </motion.p>
            <motion.div
              className="cinematic-cta"
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
            >
              <Link
                to="/create-collection"
                style={{
                  background: "linear-gradient(135deg, #2E7D32, #4CAF50)",
                  color: "white",
                  padding: "13px 24px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 24px rgba(46,125,50,0.4)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "";
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                Start for free <ArrowRight size={16} />
              </Link>
            </motion.div>
          </div>

          {/* Right side — decorative "preview" of chip names as styled list on desktop */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.25 }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "20px 0",
            }}
            className="chip-cloud"
          >
            {[
              { label: "Class dues & exam fees", emoji: "🎓", highlight: true },
              { label: "Event tickets & RSVPs", emoji: "🎫", highlight: false },
              { label: "Aso ebi contributions", emoji: "👗", highlight: true },
              {
                label: "Church tithes & offerings",
                emoji: "⛪",
                highlight: false,
              },
              {
                label: "Community welfare funds",
                emoji: "🤝",
                highlight: false,
              },
              { label: "Birthday & gift pools", emoji: "🎂", highlight: true },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.35 + i * 0.08, duration: 0.45 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: item.highlight
                    ? "rgba(167,243,208,0.12)"
                    : "rgba(255,255,255,0.06)",
                  border: `1px solid ${item.highlight ? "rgba(167,243,208,0.25)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span style={{ fontSize: 22 }}>{item.emoji}</span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: item.highlight ? "#A7F3D0" : "rgba(255,255,255,0.8)",
                  }}
                >
                  {item.label}
                </span>
                <CheckCircle2
                  size={16}
                  color={item.highlight ? "#A7F3D0" : "rgba(255,255,255,0.35)"}
                  style={{ marginLeft: "auto", flexShrink: 0 }}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Mobile auto-scrolling chip marquee */}
        <div className="chip-marquee-outer">
          <div className="chip-marquee-track">
            {[...bgChips, ...bgChips].map((chip, i) => (
              <span
                key={i}
                className={`use-case-chip ${chip.glow ? "chip-glow" : ""}`}
                style={{ flexShrink: 0 }}
              >
                <span style={{ fontSize: 15 }}>{chip.emoji}</span>
                {chip.label}
              </span>
            ))}
          </div>
        </div>

        {/* Audience cards grid — FOREGROUND */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {useCases.map((uc, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              whileHover={{
                y: -5,
                borderColor: "rgba(167,243,208,0.35)",
                background: "rgba(255,255,255,0.11)",
              }}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                padding: "28px 24px",
                cursor: "default",
                position: "relative",
                overflow: "hidden",
                backdropFilter: "blur(12px)",
                transition: "background 0.25s, border-color 0.25s",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "linear-gradient(90deg, #2E7D32, #A7F3D0)",
                }}
              />
              <div style={{ fontSize: 32, marginBottom: 14, lineHeight: 1 }}>
                {uc.emoji}
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(167,243,208,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#A7F3D0",
                  marginBottom: 14,
                }}
              >
                {uc.icon}
              </div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  marginBottom: 8,
                  marginTop: 0,
                  color: "white",
                }}
              >
                {uc.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.6,
                  margin: "0 0 16px",
                }}
              >
                {uc.desc}
              </p>
              <Link
                to="/create-collection"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#A7F3D0",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Create collection <ArrowRight size={13} />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 3: COLLECTION TYPES
// ═══════════════════════════════════════════════════════════════════════
const CollectionTypesSection = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headerRef, { once: true, margin: "-80px" });

  const types = [
    {
      icon: <Settings2 size={28} />,
      name: "Fixed Contributions",
      color: "#EFF6FF",
      iconBg: "#DBEAFE",
      iconColor: "#2563EB",
      desc: "Everyone pays the same flat amount. Perfect for class dues, membership fees and group split costs.",
      when: "Everyone pays the same",
      tag: "Most Popular",
    },
    {
      icon: <Layers size={28} />,
      name: "Tiered Contributions",
      color: "#F0FDF4",
      iconBg: "#DCFCE7",
      iconColor: "#16A34A",
      desc: "Offer multiple levels — Regular, VIP, VVIP — each with a different amount and optional perks.",
      when: "Amounts vary by level",
      tag: null,
    },
    {
      icon: <TrendingUp size={28} />,
      name: "Open Pool",
      color: "#FFF7ED",
      iconBg: "#FFEDD5",
      iconColor: "#EA580C",
      desc: "Contributors give any amount they choose. Great for gifts, group savings or community drives.",
      when: "Any amount is welcome",
      tag: null,
    },
    {
      icon: <Ticket size={28} />,
      name: "Ticketing",
      color: "#FDF4FF",
      iconBg: "#F3E8FF",
      iconColor: "#9333EA",
      desc: "Sell event tickets with unique reference codes. Track attendance and revenue in one dashboard.",
      when: "Events & admissions",
      tag: null,
    },
    {
      icon: <Gift size={28} />,
      name: "Fundraising",
      color: "#FFF1F2",
      iconBg: "#FFE4E6",
      iconColor: "#E11D48",
      desc: "Run goal-based campaigns with a visible progress bar. Ideal for medical, community or social causes.",
      when: "Goal-based campaigns",
      tag: null,
    },
  ];

  return (
    <section
      id="collection-types"
      style={{ padding: "96px 24px", background: "var(--kol-bg)" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Header */}
        <div ref={headerRef} style={{ textAlign: "center", marginBottom: 56 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--kol-green-50)",
              border: "1px solid var(--kol-green-100)",
              borderRadius: 32,
              padding: "5px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--kol-green-800)",
              marginBottom: 16,
            }}
          >
            <Layers size={14} /> COLLECTION TYPES
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 auto 16px",
            }}
          >
            One Platform. Multiple Ways to Collect.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              fontSize: 17,
              color: "var(--kol-muted)",
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            Choose the collection type that fits your situation and get started
            in minutes.
          </motion.p>
        </div>

        {/* Square card grid */}
        <div className="types-grid">
          {types.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 36 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                delay: 0.1 + i * 0.09,
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -6, boxShadow: "0 20px 48px rgba(0,0,0,0.10)" }}
              style={{
                background: "white",
                border: "1.5px solid var(--kol-border)",
                borderRadius: 20,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                cursor: "default",
                position: "relative",
                transition: "border-color 0.2s",
              }}
            >
              {/* Colored top banner */}
              <div
                style={{
                  background: t.color,
                  padding: "28px 24px 20px",
                  position: "relative",
                }}
              >
                {t.tag && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      background: t.iconColor,
                      color: "white",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 20,
                      padding: "3px 10px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {t.tag}
                  </div>
                )}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: t.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: t.iconColor,
                    marginBottom: 16,
                    boxShadow: `0 4px 12px ${t.iconColor}22`,
                  }}
                >
                  {t.icon}
                </div>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: 17,
                    margin: "0 0 6px",
                    color: "var(--kol-text)",
                    lineHeight: 1.2,
                  }}
                >
                  {t.name}
                </h3>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.iconColor,
                    background: "white",
                    border: `1px solid ${t.iconColor}30`,
                    borderRadius: 20,
                    padding: "3px 10px",
                  }}
                >
                  <CheckCircle2 size={10} /> {t.when}
                </div>
              </div>

              {/* Card body */}
              <div
                style={{
                  padding: "20px 24px 24px",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--kol-muted)",
                    lineHeight: 1.65,
                    margin: "0 0 20px",
                  }}
                >
                  {t.desc}
                </p>
                <Link
                  to="/create-collection"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.iconColor,
                    textDecoration: "none",
                    background: t.color,
                    border: `1.5px solid ${t.iconColor}22`,
                    borderRadius: 8,
                    padding: "9px 14px",
                    width: "fit-content",
                    transition: "background 0.2s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = t.iconBg;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = t.color;
                  }}
                >
                  Use this type <ArrowRight size={13} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 4: FEATURES
// ═══════════════════════════════════════════════════════════════════════
const FeaturesSection = () => {
  const { ref, isVisible } = useIntersect({ threshold: 0.1 });

  const clusters = [
    {
      cluster: "⚡ Setup",
      features: [
        {
          icon: <Settings2 size={18} />,
          title: "Custom Fields",
          desc: "Collect any info you need — matric numbers, seat choices, team names.",
        },
        {
          icon: <Layers size={18} />,
          title: "Multiple Tiers",
          desc: "Define Regular, VIP, VVIP pricing tiers with different amounts and perks.",
        },
        {
          icon: <Clock size={18} />,
          title: "Deadlines",
          desc: "Set start and end dates to create urgency and automate cutoff.",
        },
      ],
    },
    {
      cluster: "💳 Payments",
      features: [
        {
          icon: <CreditCard size={18} />,
          title: "All Local Methods",
          desc: "Card, bank transfer & USSD — contributors pay the way they prefer.",
        },
        {
          icon: <Shield size={18} />,
          title: "Paystack Security",
          desc: "Bank-grade encryption via Paystack ensures every transaction is protected.",
        },
        {
          icon: <Zap size={18} />,
          title: "Instant Confirmation",
          desc: "Payments are confirmed in seconds, no waiting for manual verification.",
        },
      ],
    },
    {
      cluster: "📊 Tracking",
      features: [
        {
          icon: <BarChart2 size={18} />,
          title: "Real-Time Dashboard",
          desc: "Watch contributions roll in live. Know who has and hasn't paid at a glance.",
        },
        {
          icon: <Users size={18} />,
          title: "Contributor List",
          desc: "Full list with names, amounts, timestamps and custom field responses.",
        },
        {
          icon: <Download size={18} />,
          title: "Export Reports",
          desc: "Download CSV exports for your records in one click.",
        },
      ],
    },
    {
      cluster: "📧 Receipts",
      features: [
        {
          icon: <Mail size={18} />,
          title: "Automated Email Receipts",
          desc: "Contributors receive branded receipts instantly after payment.",
        },
        {
          icon: <CheckCircle2 size={18} />,
          title: "Reference IDs",
          desc: "Every transaction gets a unique reference. Easy to verify & reconcile.",
        },
      ],
    },
    {
      cluster: "🎨 Branding",
      features: [
        {
          icon: <Palette size={18} />,
          title: "Logo & Colors",
          desc: "Add your logo, colors and brand name to collection pages and receipts.",
        },
        {
          icon: <Share2 size={18} />,
          title: "White-Label Experience",
          desc: "Receipts and forms show your brand — contributors trust your name.",
        },
      ],
    },
  ];

  return (
    <section
      id="features"
      style={{ padding: "96px 24px", background: "white" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          ref={ref}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "center",
            marginBottom: 72,
          }}
          className="features-header-grid"
        >
          <div>
            <div
              className={`reveal ${isVisible ? "visible" : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--kol-green-50)",
                border: "1px solid var(--kol-green-100)",
                borderRadius: 32,
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--kol-green-800)",
                marginBottom: 16,
              }}
            >
              <Zap size={14} /> FEATURES
            </div>
            <h2
              className={`reveal ${isVisible ? "visible" : ""} d1`}
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: "0 0 16px",
              }}
            >
              Everything You Need to Run a Collection Smoothly
            </h2>
            <p
              className={`reveal ${isVisible ? "visible" : ""} d2`}
              style={{
                fontSize: 17,
                color: "var(--kol-muted)",
                lineHeight: 1.65,
                maxWidth: 480,
                margin: 0,
              }}
            >
              From setup to withdrawal, Kolekto handles the heavy lifting so you
              can focus on your community.
            </p>
          </div>
          <div
            className={`reveal ${isVisible ? "visible" : ""} d3`}
            style={{
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 12px 48px rgba(0,0,0,0.10)",
            }}
          >
            <img
              src={featuresImage}
              alt="Kolekto features"
              style={{ width: "100%", display: "block" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {clusters.map((cluster, ci) => (
            <div
              key={ci}
              className={`reveal ${isVisible ? "visible" : ""} d${Math.min(ci + 1, 5)}`}
              style={{
                background: "var(--kol-bg)",
                borderRadius: 14,
                padding: "24px",
                border: "1.5px solid var(--kol-border)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 20,
                  color: "var(--kol-text)",
                }}
              >
                {cluster.cluster}
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 18 }}
              >
                {cluster.features.map((f, fi) => (
                  <div key={fi} style={{ display: "flex", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "var(--kol-green-50)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--kol-green-800)",
                        flexShrink: 0,
                      }}
                      className="icon-bounce"
                    >
                      {f.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          marginBottom: 3,
                          color: "var(--kol-text)",
                        }}
                      >
                        {f.title}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--kol-muted)",
                          lineHeight: 1.55,
                        }}
                      >
                        {f.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 5: HOW IT WORKS
// ═══════════════════════════════════════════════════════════════════════
const HowItWorksSection = () => {
  const { ref, isVisible } = useIntersect({ threshold: 0.1 });
  const steps = [
    {
      num: "01",
      icon: <Target size={22} />,
      title: "Choose Collection Type",
      desc: "Pick Fixed, Tiered, Open Pool, Ticketing or Fundraising based on your needs.",
    },
    {
      num: "02",
      icon: <Settings2 size={22} />,
      title: "Add Details",
      desc: "Set the amount, deadline, custom fields and optional branding — it takes under 2 minutes.",
    },
    {
      num: "03",
      icon: <Share2 size={22} />,
      title: "Share Link or QR Code",
      desc: "Instantly share via link, WhatsApp, or generate a QR code for in-person events.",
    },
    {
      num: "04",
      icon: <CreditCard size={22} />,
      title: "Receive Payments",
      desc: "Contributors pay instantly via card, bank transfer or USSD. Receipts are auto-sent.",
    },
    {
      num: "05",
      icon: <Download size={22} />,
      title: "Track & Withdraw",
      desc: "Monitor who has paid in real-time and withdraw funds to your account anytime.",
    },
  ];

  return (
    <section
      id="how-it-works"
      style={{ padding: "96px 24px", background: "var(--kol-bg)" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div ref={ref} style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            className={`reveal ${isVisible ? "visible" : ""}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--kol-green-50)",
              border: "1px solid var(--kol-green-100)",
              borderRadius: 32,
              padding: "5px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--kol-green-800)",
              marginBottom: 16,
            }}
          >
            <CheckCircle2 size={14} /> HOW IT WORKS
          </div>
          <h2
            className={`reveal ${isVisible ? "visible" : ""} d1`}
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 auto 16px",
            }}
          >
            Up and running in 5 easy steps
          </h2>
          <p
            className={`reveal ${isVisible ? "visible" : ""} d2`}
            style={{
              fontSize: 17,
              color: "var(--kol-muted)",
              maxWidth: 480,
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            From zero to collecting payments in under 5 minutes — no technical
            skills required.
          </p>
        </div>

        <div
          className="how-steps-desktop"
          style={{ display: "flex", alignItems: "flex-start", gap: 0 }}
        >
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div
                className={`reveal ${isVisible ? "visible" : ""} d${Math.min(i + 1, 5)}`}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  padding: "0 8px",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1C5C23, #2E7D32)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 15,
                    marginBottom: 16,
                    boxShadow: "0 4px 16px rgba(28,92,35,0.3)",
                    flexShrink: 0,
                    position: "relative",
                    zIndex: 2,
                  }}
                >
                  {step.num}
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "var(--kol-green-50)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--kol-green-800)",
                    marginBottom: 14,
                  }}
                  className="icon-bounce"
                >
                  {step.icon}
                </div>
                <h3
                  style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--kol-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {step.desc}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    marginTop: 24,
                    width: 24,
                    flexShrink: 0,
                    height: 2,
                    background:
                      "linear-gradient(90deg, var(--kol-green-700), #A7F3D0)",
                    alignSelf: "flex-start",
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div
          className="how-steps-mobile"
          style={{ display: "none", flexDirection: "column", gap: 0 }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              className={`reveal ${isVisible ? "visible" : ""} d${Math.min(i + 1, 5)}`}
              style={{ display: "flex", gap: 20, position: "relative" }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1C5C23, #2E7D32)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 14,
                    boxShadow: "0 4px 12px rgba(28,92,35,0.3)",
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 32,
                      background:
                        "linear-gradient(180deg, var(--kol-green-700), #A7F3D0)",
                      margin: "8px 0",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  paddingBottom: i < steps.length - 1 ? 24 : 0,
                  paddingTop: 8,
                }}
              >
                <h3
                  style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--kol-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`reveal ${isVisible ? "visible" : ""} d6`}
          style={{ textAlign: "center", marginTop: 56 }}
        >
          <Link
            to="/create-collection"
            className="btn-primary"
            style={{
              background: "linear-gradient(135deg, #1C5C23, #2E7D32)",
              color: "white",
              padding: "14px 32px",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Create Your First Collection <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 6: ACTIVE FUNDRAISING (live data)
// ═══════════════════════════════════════════════════════════════════════
interface LPCampaign {
  id: string;
  slug?: string | null;
  title: string;
  summary?: string | null;
  campaign_summary?: string | null;
  main_image_url?: string | null;
  banner_url?: string | null;
  deadline?: string | null;
  target_amount?: number | null;
  total_raised?: number | null;
  contributions_count?: number;
  category?: string | null;
  campaign_category?: string | null;
  status: string;
}

const LPCampaignCard: React.FC<{
  campaign: LPCampaign;
  onClick: () => void;
}> = ({ campaign, onClick }) => {
  const imageUrl = campaign.banner_url || campaign.main_image_url;
  const totalRaised = Number(campaign.total_raised || 0);
  const targetAmount = Number(campaign.target_amount || 0);
  const progress =
    targetAmount > 0 ? Math.min((totalRaised / targetAmount) * 100, 100) : 0;
  const category = campaign.category || campaign.campaign_category;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(n);

  const daysLeft = campaign.deadline
    ? Math.max(
        0,
        Math.ceil(
          (new Date(campaign.deadline).getTime() - Date.now()) / 86400000,
        ),
      )
    : null;

  const urgencyColor =
    daysLeft !== null && daysLeft === 0
      ? { bg: "#FEE2E2", color: "#DC2626" }
      : daysLeft !== null && daysLeft <= 3
        ? { bg: "#FEF3C7", color: "#92400E" }
        : { bg: "rgba(20,83,45,0.85)", color: "#bbf7d0" };

  return (
    <div
      className="lp-campaign-card"
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {/* Image */}
      <div
        style={{
          height: 190,
          background: "linear-gradient(135deg, #1C5C23, #2E7D32, #FFCA28)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={campaign.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.3s",
            }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Heart size={36} color="rgba(255,255,255,0.4)" />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)",
          }}
        />

        {/* Badges row */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          {category ? (
            <div
              style={{
                background: "rgba(255,255,255,0.94)",
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 700,
                color: "#1A1A2E",
                flexShrink: 0,
              }}
            >
              {category}
            </div>
          ) : (
            <div />
          )}
          {daysLeft !== null && (
            <div
              style={{
                background: urgencyColor.bg,
                color: urgencyColor.color,
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {daysLeft === 0 ? "Ends today" : `${daysLeft}d left`}
            </div>
          )}
        </div>

        <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "white",
              margin: 0,
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as any,
              overflow: "hidden",
            }}
          >
            {campaign.title}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px" }}>
        {/* Amount row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--kol-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 2,
              }}
            >
              Raised
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "var(--kol-green-800)",
                letterSpacing: "-0.02em",
              }}
            >
              {fmt(totalRaised)}
            </div>
          </div>
          {targetAmount > 0 && (
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--kol-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 2,
                }}
              >
                Goal
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                {fmt(targetAmount)}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              height: 7,
              background: "#F3F4F6",
              borderRadius: 10,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              className="progress-fill"
              style={{
                height: "100%",
                width: `${targetAmount > 0 ? progress : totalRaised > 0 ? 100 : 0}%`,
                background: "linear-gradient(90deg, #1C5C23, #4CAF50)",
                borderRadius: 10,
                transition: "width 0.8s ease",
              }}
            />
          </div>
          {targetAmount > 0 && (
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                fontWeight: 700,
                color: "var(--kol-green-700)",
                textAlign: "right",
              }}
            >
              {progress.toFixed(0)}% funded
            </div>
          )}
        </div>

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--kol-muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Users size={11} /> {campaign.contributions_count || 0} donor
            {(campaign.contributions_count || 0) === 1 ? "" : "s"}
          </div>
          {campaign.deadline && (
            <div
              style={{
                fontSize: 11,
                color: "var(--kol-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <CalendarDays size={11} />
              {new Date(campaign.deadline).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ActiveFundraisingSection = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headerRef, { once: true, margin: "-80px" });
  const [campaigns, setCampaigns] = useState<LPCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const CAMPAIGN_CACHE_KEY = "kolekto_lp_active_campaigns_v1";
  const CAMPAIGN_CACHE_TTL_MS = 5 * 60 * 1000;

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setHasAttemptedLoad(true);
    try {
      const cachedRaw = sessionStorage.getItem(CAMPAIGN_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as {
          data: LPCampaign[];
          timestamp: number;
        };
        if (
          cached?.data?.length &&
          Date.now() - Number(cached.timestamp || 0) < CAMPAIGN_CACHE_TTL_MS
        ) {
          setCampaigns(cached.data.slice(0, 8));
          return;
        }
      }

      const rows = (await getActiveFundraisingCampaigns()) as LPCampaign[];
      const sliced = rows.slice(0, 8);
      setCampaigns(sliced);
      sessionStorage.setItem(
        CAMPAIGN_CACHE_KEY,
        JSON.stringify({ data: sliced, timestamp: Date.now() }),
      );
    } catch {
      // Keep the section resilient: fail quietly and show nothing if data cannot load.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch when this section is about to be seen.
    if (!isInView || campaigns.length > 0 || loading) return;
    loadCampaigns();
  }, [isInView, campaigns.length, loading, loadCampaigns]);

  if (hasAttemptedLoad && !loading && campaigns.length === 0) return null;

  const scrollCampaigns = useMemo(() => {
    // Need at least 4 items to look good scrolling — pad with duplicates.
    const base = campaigns.length > 0 ? campaigns : [];
    const padded =
      base.length < 4 && base.length > 0
        ? [...base, ...base, ...base, ...base].slice(
            0,
            Math.max(8, base.length * 3),
          )
        : base;
    // Duplicate for infinite loop.
    return [...padded, ...padded];
  }, [campaigns]);

  const CARD_W = 320;
  const CARD_GAP = 24;

  return (
    <section
      id="active-fundraising"
      style={{ padding: "96px 0", background: "white" }}
    >
      {/* Header row */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div
          ref={headerRef}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 20,
            marginBottom: 48,
          }}
        >
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--kol-green-50)",
                border: "1px solid var(--kol-green-100)",
                borderRadius: 32,
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--kol-green-800)",
                marginBottom: 16,
              }}
            >
              <Heart size={14} /> ACTIVE CAMPAIGNS
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Live Fundraising Campaigns
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{
                fontSize: 16,
                color: "var(--kol-muted)",
                marginTop: 12,
                maxWidth: 520,
                lineHeight: 1.65,
              }}
            >
              Real campaigns running right now. Discover causes making an impact
              and support the ones that matter to you.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link
              to="/active-campaigns"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--kol-green-50)",
                color: "var(--kol-green-800)",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                border: "1.5px solid var(--kol-green-100)",
                transition: "background 0.2s, transform 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--kol-green-100)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "var(--kol-green-50)";
                e.currentTarget.style.transform = "";
              }}
            >
              Explore all campaigns <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* ── Scrolling marquee ── */}
      {loading ? (
        /* Skeleton placeholders */
        <div
          style={{
            display: "flex",
            gap: CARD_GAP,
            padding: `0 24px`,
            overflow: "hidden",
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="campaign-skeleton"
              style={{
                flex: `0 0 ${CARD_W}px`,
                border: "1.5px solid var(--kol-border)",
              }}
            >
              <div className="skeleton-shimmer" style={{ height: 190 }} />
              <div
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  className="skeleton-shimmer"
                  style={{ height: 18, width: "70%", borderRadius: 6 }}
                />
                <div
                  className="skeleton-shimmer"
                  style={{ height: 8, width: "100%", borderRadius: 4 }}
                />
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div
                    className="skeleton-shimmer"
                    style={{ height: 11, width: "35%", borderRadius: 4 }}
                  />
                  <div
                    className="skeleton-shimmer"
                    style={{ height: 11, width: "30%", borderRadius: 4 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="campaign-marquee-wrap"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div
            className="campaign-marquee-track"
            style={{ animationPlayState: paused ? "paused" : "running" }}
          >
            {scrollCampaigns.map((campaign, i) => (
              <div
                key={`${campaign.id}-${i}`}
                style={{ width: CARD_W, flexShrink: 0 }}
              >
                <LPCampaignCard
                  campaign={campaign}
                  onClick={() => {
                    window.location.href = `/contribute/${campaign.slug || campaign.id}`;
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{ textAlign: "center", marginTop: 48 }}
        >
          <Link
            to="/active-campaigns"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, #1C5C23, #2E7D32)",
              color: "white",
              padding: "14px 32px",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 8px 32px rgba(28,92,35,0.35)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "";
            }}
          >
            <Sparkles size={17} /> Browse All Active Campaigns
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 7: TESTIMONIALS
// ═══════════════════════════════════════════════════════════════════════
const TestimonialsSection = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headerRef, { once: true, margin: "-80px" });
  const [paused, setPaused] = useState(false);

  const testimonials = [
    {
      initials: "CA",
      name: "Chukwuemeka A.",
      role: "Class Representative, UNILORIN",
      quote:
        "I used to chase 60+ students individually for exam dues. With Kolekto, I shared one link and collected everything in 2 days. Game changer!",
    },
    {
      initials: "FB",
      name: "Funke B.",
      role: "Event Organizer, Lagos",
      quote:
        "Our charity dinner tickets sold out in 48 hours. The QR code check-in made entry seamless. I'll use Kolekto for every event going forward.",
    },
    {
      initials: "PO",
      name: "Pastor Olumide",
      role: "Church Administrator, Abuja",
      quote:
        "Tracking building fund contributions was always a headache. Kolekto's dashboard gives me full transparency — every member can see progress too.",
    },
    {
      initials: "AI",
      name: "Amina I.",
      role: "Community Leader, Kano",
      quote:
        "Our association collects dues from 200+ members. Kolekto handles everything — the automated receipts alone saved us hours every month.",
    },
    {
      initials: "TJ",
      name: "Tunde J.",
      role: "NGO Coordinator",
      quote:
        "We raised ₦1.2M for a medical cause in one week using Kolekto's fundraising feature. The progress bar kept donors motivated. Incredible tool.",
    },
    {
      initials: "SN",
      name: "Sandra N.",
      role: "Student Union President",
      quote:
        "Set up our SUG dues collection in 10 minutes. Students paid via bank transfer, got instant receipts. Zero complaints from anyone. 10/10.",
    },
  ];

  const TestimonialCard = ({ t }: { t: (typeof testimonials)[0] }) => (
    <div
      className="testimonial-card"
      style={{
        width: 320,
        flexShrink: 0,
        borderRadius: 16,
        border: "1.5px solid var(--kol-border)",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", gap: 2 }}>
        {[...Array(5)].map((_, si) => (
          <Star key={si} size={13} fill="#FFCA28" color="#FFCA28" />
        ))}
      </div>
      <p
        style={{
          fontSize: 14,
          color: "var(--kol-muted)",
          lineHeight: 1.65,
          margin: 0,
          flex: 1,
        }}
      >
        "{t.quote}"
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderTop: "1px solid var(--kol-border)",
          paddingTop: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #1C5C23, #388E3C)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {t.initials}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t.role}</div>
        </div>
      </div>
    </div>
  );

  return (
    <section
      id="testimonials"
      style={{ padding: "96px 0", background: "var(--kol-bg)" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div ref={headerRef} style={{ textAlign: "center", marginBottom: 56 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--kol-green-50)",
              border: "1px solid var(--kol-green-100)",
              borderRadius: 32,
              padding: "5px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--kol-green-800)",
              marginBottom: 16,
            }}
          >
            <Star size={14} fill="currentColor" /> TRUSTED BY THOUSANDS
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 auto 16px",
            }}
          >
            Real people. Real results.
          </motion.h2>
          <motion.div
            className="testimonial-rating-row"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 3 }}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={18} fill="#FFCA28" color="#FFCA28" />
              ))}
            </div>
            <span style={{ fontSize: 16, fontWeight: 700 }}>4.95 out of 5</span>
            <span style={{ fontSize: 14, color: "var(--kol-muted)" }}>
              · 478 reviews · 5,000+ users
            </span>
          </motion.div>
          <motion.div
            className="trust-badges"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            {[
              "🔒 Powered by Paystack",
              "✅ Secure Payments",
              "⚡ Instant Receipts",
              "👥 Used by 1,000+ Groups",
            ].map((badge, i) => (
              <span
                key={i}
                style={{
                  background: "var(--kol-green-50)",
                  border: "1px solid var(--kol-green-100)",
                  borderRadius: 32,
                  padding: "5px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--kol-green-800)",
                }}
              >
                {badge}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Auto-scrolling marquee — full width */}
      <div
        className="testimonial-marquee-wrap"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div
          className="testimonial-marquee-track"
          style={{
            animationPlayState: paused ? "paused" : "running",
            padding: "4px 0 16px",
          }}
        >
          {[...testimonials, ...testimonials].map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 8: WHY KOLEKTO
// ═══════════════════════════════════════════════════════════════════════
const WhyKolektoSection = () => {
  const { ref, isVisible } = useIntersect({ threshold: 0.1 });
  const benefits = [
    {
      icon: <Clock size={24} />,
      title: "Save Time",
      desc: "No more manual tracking or chasing people. Set up in minutes, collect automatically.",
    },
    {
      icon: <Shield size={24} />,
      title: "Reduce Stress",
      desc: "Automated receipts, real-time updates and instant confirmation — less friction for everyone.",
    },
    {
      icon: <BarChart2 size={24} />,
      title: "Full Transparency",
      desc: "Every contributor can see the real-time progress. No hidden charges, no confusion.",
    },
    {
      icon: <Users size={24} />,
      title: "Scale to 1,000+",
      desc: "Built to handle 10 or 10,000 contributors without slowing down or losing track.",
    },
  ];

  return (
    <section
      id="why-kolekto"
      style={{
        padding: "96px 24px",
        background: "linear-gradient(180deg, #F0FDF4 0%, #FAFAFA 100%)",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          ref={ref}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 72,
            alignItems: "center",
          }}
          className="why-grid"
        >
          <div>
            <div
              className={`reveal ${isVisible ? "visible" : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--kol-green-50)",
                border: "1px solid var(--kol-green-100)",
                borderRadius: 32,
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--kol-green-800)",
                marginBottom: 16,
              }}
            >
              <Zap size={14} /> WHY KOLEKTO
            </div>
            <h2
              className={`reveal ${isVisible ? "visible" : ""} d1`}
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: "0 0 20px",
              }}
            >
              Why choose Kolekto over manual methods?
            </h2>
            <p
              className={`reveal ${isVisible ? "visible" : ""} d2`}
              style={{
                fontSize: 16,
                color: "var(--kol-muted)",
                lineHeight: 1.7,
                maxWidth: 480,
                margin: "0 0 28px",
              }}
            >
              Managing group contributions the old way — spreadsheets, WhatsApp
              forwards and cash reminders — is slow, error-prone and stressful.
              Kolekto replaces all of that with a single, professional platform.
            </p>
            <div className={`reveal ${isVisible ? "visible" : ""} d3`}>
              <Link
                to="/create-collection"
                style={{
                  background: "var(--kol-green-800)",
                  color: "white",
                  padding: "13px 24px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Get started — it's free <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div
            className="why-benefits-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            {benefits.map((b, i) => (
              <div
                key={i}
                className={`card-hover reveal ${isVisible ? "visible" : ""} d${Math.min(i + 1, 4)}`}
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: "24px 20px",
                  border: "1.5px solid var(--kol-border)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "var(--kol-green-50)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--kol-green-800)",
                    marginBottom: 14,
                  }}
                  className="icon-bounce"
                >
                  {b.icon}
                </div>
                <h3
                  style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}
                >
                  {b.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--kol-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 9: FAQ
// ═══════════════════════════════════════════════════════════════════════
const FAQSection = () => {
  const { ref, isVisible } = useIntersect({ threshold: 0.1 });
  const [openIdx, setOpenIdx] = useState<number>(0);

  const faqs = [
    {
      q: "Do contributors need a Kolekto account to pay?",
      a: "No. Contributors can pay directly through the link you share — no signup or account required. They enter their details and pay instantly.",
    },
    {
      q: "How do I create a collection?",
      a: "Sign up for free, click 'Create Collection', choose your type, set the amount and details, then share the generated link. The whole process takes under 5 minutes.",
    },
    {
      q: "Is Kolekto secure?",
      a: "Yes. All payments are processed by Paystack, which uses bank-grade encryption and complies with Nigerian financial regulations. We never store sensitive card or bank information.",
    },
    {
      q: "How much does Kolekto charge?",
      a: "Creating an account and setting up collections is free. We charge a small transaction fee (as low as ₦50 per contributor) on successful payments. There are no hidden fees or setup costs.",
    },
    {
      q: "Can I withdraw my funds anytime?",
      a: "Yes. Once payments are received into your Kolekto wallet, you can request a withdrawal to your registered bank account at any time, subject to standard processing times.",
    },
    {
      q: "How do I know when someone has paid?",
      a: "You'll receive an instant notification, and the contributor automatically receives an email receipt. Your dashboard updates in real-time so you always know who has and hasn't paid.",
    },
    {
      q: "Can I use Kolekto for events and ticketing?",
      a: "Absolutely. The Ticketing collection type lets you sell event tickets with unique reference codes. You can track purchases and manage attendance directly from your dashboard.",
    },
  ];

  return (
    <section id="faq" style={{ padding: "96px 24px", background: "white" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          ref={ref}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            gap: 64,
            alignItems: "start",
          }}
          className="faq-grid"
        >
          <div className="faq-sticky" style={{ position: "sticky", top: 96 }}>
            <div
              className={`reveal ${isVisible ? "visible" : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--kol-green-50)",
                border: "1px solid var(--kol-green-100)",
                borderRadius: 32,
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--kol-green-800)",
                marginBottom: 16,
              }}
            >
              FAQ
            </div>
            <h2
              className={`reveal ${isVisible ? "visible" : ""} d1`}
              style={{
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: "0 0 16px",
              }}
            >
              Frequently Asked Questions
            </h2>
            <p
              className={`reveal ${isVisible ? "visible" : ""} d2`}
              style={{
                fontSize: 16,
                color: "var(--kol-muted)",
                lineHeight: 1.7,
                margin: "0 0 28px",
              }}
            >
              Can't find what you're looking for? Reach out via WhatsApp and
              we'll help you right away.
            </p>
            <a
              href="https://wa.me/+2349019840377"
              target="_blank"
              rel="noopener noreferrer"
              className={`reveal ${isVisible ? "visible" : ""} d3`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#25D366",
                color: "white",
                padding: "12px 22px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <FaWhatsapp size={18} /> Chat on WhatsApp
            </a>
          </div>

          <div
            className={`reveal ${isVisible ? "visible" : ""} d2`}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  background: "var(--kol-bg)",
                  borderRadius: 12,
                  border: `1.5px solid ${openIdx === i ? "var(--kol-green-700)" : "var(--kol-border)"}`,
                  overflow: "hidden",
                  transition: "border-color 0.25s",
                }}
              >
                <button
                  onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "18px 20px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--kol-text)",
                      flex: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {faq.q}
                  </span>
                  <div
                    style={{
                      transition: "transform 0.3s",
                      transform: openIdx === i ? "rotate(180deg)" : "rotate(0)",
                      color: "var(--kol-green-800)",
                      flexShrink: 0,
                    }}
                  >
                    <ChevronDown size={18} />
                  </div>
                </button>
                <div
                  className={`accordion-body ${openIdx === i ? "open" : ""}`}
                >
                  <div
                    style={{
                      padding: "0 20px 18px",
                      fontSize: 14,
                      color: "var(--kol-muted)",
                      lineHeight: 1.7,
                    }}
                  >
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 10: FINAL CTA
// ═══════════════════════════════════════════════════════════════════════
const FinalCTASection = () => {
  const ctaRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ctaRef, { once: true, margin: "-60px" });

  return (
    <section id="cta" style={{ padding: "0 16px 80px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <motion.div
          ref={ctaRef}
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="cta-bg cta-section-inner"
          style={{
            borderRadius: 28,
            padding: "64px 40px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative orbs */}
          <div
            style={{
              position: "absolute",
              top: -60,
              left: -60,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -40,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: 700,
              height: 700,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 2 }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15, duration: 0.5 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.12)",
                borderRadius: 32,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#A7F3D0",
                marginBottom: 24,
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <Zap size={14} /> START FOR FREE TODAY
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.25, duration: 0.6 }}
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "white",
                margin: "0 auto 20px",
                maxWidth: 680,
                lineHeight: 1.1,
              }}
            >
              Stop Chasing Payments. Start Collecting Smartly.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.35, duration: 0.55 }}
              style={{
                fontSize: "clamp(15px, 2vw, 18px)",
                color: "rgba(255,255,255,0.75)",
                maxWidth: 520,
                margin: "0 auto 40px",
                lineHeight: 1.65,
              }}
            >
              Join 5,000+ Nigerians who use Kolekto to save time, stay organized
              and collect with confidence. No credit card required.
            </motion.p>
            <motion.div
              className="cta-btns"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.45, duration: 0.55 }}
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                to="/create-collection"
                style={{
                  background: "white",
                  color: "var(--kol-green-800)",
                  padding: "15px 28px",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 800,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 32px rgba(0,0,0,0.22)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(0,0,0,0.15)";
                }}
              >
                Start Collecting — It's Free <ArrowRight size={17} />
              </Link>
              <a
                href="https://wa.me/+2349019840377"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  color: "white",
                  padding: "15px 24px",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1.5px solid rgba(255,255,255,0.22)",
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.18)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.10)")
                }
              >
                <FaWhatsapp size={18} /> Talk to us on WhatsApp
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  FOOTER
// ═══════════════════════════════════════════════════════════════════════
const FooterSection = () => {
  const socials = [
    {
      icon: <FaFacebook size={18} />,
      href: "https://www.facebook.com/profile.php?id=61575665957385",
    },
    { icon: <FaTwitter size={18} />, href: "https://x.com/kolekto_ng" },
    {
      icon: <FaLinkedin size={18} />,
      href: "https://www.linkedin.com/company/kolektong/",
    },
    {
      icon: <FaInstagram size={18} />,
      href: "https://www.instagram.com/kolekto_ng/",
    },
  ];

  const cols = [
    {
      title: "Product",
      links: [
        { label: "Create Collection", href: "/create-collection" },
        { label: "Explore Campaigns", href: "/active-campaigns" },
        { label: "Contribution Tiers", href: "/create-collection" },
        { label: "Real-Time Tracking", href: "/dashboard" },
        { label: "Wallet & Withdrawals", href: "/dashboard/transactions" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "Careers", href: "/contact" },
        { label: "Partnerships", href: "/contact" },
        { label: "Press", href: "/about" },
        { label: "Ambassador", href: "/ambassadors" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Help Center", href: "/help" },
        { label: "FAQ", href: "/#faq" },
        { label: "Guides", href: "/help" },
        {
          label: "Community Support",
          href: "https://chat.whatsapp.com/JctLgtMQTEc0nFCk40C4Vj",
        },
        { label: "WhatsApp Support", href: "https://wa.me/+2349019840377" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Cookie Policy", href: "/privacy" },
        { label: "KYC & Compliance", href: "/privacy" },
      ],
    },
  ];

  return (
    <footer
      style={{
        background: "var(--kol-green-900)",
        color: "white",
        padding: "64px 24px 32px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr repeat(4, 1fr)",
            gap: 32,
            marginBottom: 48,
          }}
          className="footer-grid"
        >
          <div>
            <Logo size="md" />
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.7,
                margin: "16px 0 24px",
                maxWidth: 240,
              }}
            >
              The smart group payment platform for communities, teams and events
              across Nigeria.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              {socials.map((s, i) => (
                <a
                  key={i}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    textDecoration: "none",
                    transition: "background 0.2s",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                  }
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {cols.map((col, ci) => (
            <div key={ci}>
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#FFA726",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: "0 0 16px",
                }}
              >
                {col.title}
              </h4>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {col.links.map((link, li) => {
                  const isExternal =
                    link.href.startsWith("http") ||
                    link.href.startsWith("mailto");
                  const linkStyle: React.CSSProperties = {
                    fontSize: 14,
                    color: "rgba(255,255,255,0.65)",
                    textDecoration: "none",
                    transition: "color 0.2s",
                  };
                  return (
                    <li key={li}>
                      {isExternal ? (
                        <a
                          href={link.href}
                          target={
                            link.href.startsWith("http") ? "_blank" : undefined
                          }
                          rel="noopener noreferrer"
                          style={linkStyle}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.color = "white")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.color =
                              "rgba(255,255,255,0.65)")
                          }
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          style={linkStyle}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.color = "white")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.color =
                              "rgba(255,255,255,0.65)")
                          }
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <p
            style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}
          >
            © {new Date().getFullYear()} Kolekto, Inc. All rights reserved.
          </p>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
              Payments secured by
            </span>
            <img
              src={paystackLogo}
              alt="Paystack"
              style={{
                height: 20,
                objectFit: "contain",
                filter: "brightness(0.6)",
              }}
            />
          </div>
        </div>
      </div>
    </footer>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════
const LandingPage: React.FC = () => {
  return (
    <div className="lp-root">
      <GlobalStyles />
      <Navbar />
      <HeroSection />
      <MarqueeStrip />
      <CinematicUseCasesSection />
      <CollectionTypesSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ActiveFundraisingSection />
      <TestimonialsSection />
      <WhyKolektoSection />
      <FAQSection />
      <FinalCTASection />
      <FooterSection />
    </div>
  );
};

export default LandingPage;
