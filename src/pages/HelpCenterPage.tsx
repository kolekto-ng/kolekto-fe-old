import React, { useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer/Footer";
import {
  HelpCircle, BookOpen, CreditCard, Download, Share2,
  Settings2, ChevronDown, ArrowRight, Search, MessageSquare,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

const guides = [
  {
    icon: <Settings2 size={22} />,
    title: "Getting Started",
    color: "#EFF6FF",
    iconBg: "#DBEAFE",
    iconColor: "#2563EB",
    steps: [
      "Go to kolekto.com.ng and click Sign Up",
      "Enter your name, email, and create a secure password",
      "Verify your email address via the link we send",
      "Complete your profile and add your bank account for withdrawals",
      "You're ready to create your first collection!",
    ],
  },
  {
    icon: <BookOpen size={22} />,
    title: "Creating a Collection",
    color: "#F0FDF4",
    iconBg: "#DCFCE7",
    iconColor: "#16A34A",
    steps: [
      "Click 'Create Collection' from the dashboard or homepage",
      "Choose a collection type: Fixed, Tiered, Open Pool, Ticketing, or Fundraising",
      "Fill in the collection name, purpose, target amount, and deadline",
      "Customize the contribution link and optional branding",
      "Review and publish — your link is instantly shareable",
    ],
  },
  {
    icon: <Share2 size={22} />,
    title: "Sharing Your Collection",
    color: "#FDF4FF",
    iconBg: "#F3E8FF",
    iconColor: "#9333EA",
    steps: [
      "After publishing, copy your unique collection link",
      "Share via WhatsApp, Facebook, Instagram, or any messaging app",
      "Generate a QR code for in-person sharing at events",
      "Use the download option to save the QR code as an image",
      "Track who has clicked and contributed in real-time on your dashboard",
    ],
  },
  {
    icon: <CreditCard size={22} />,
    title: "How Contributors Pay",
    color: "#FFF7ED",
    iconBg: "#FFEDD5",
    iconColor: "#EA580C",
    steps: [
      "Contributors open your shared link — no Kolekto account needed",
      "They enter their name and email address",
      "They choose a payment method: card, bank transfer, or USSD",
      "Payment is processed securely via Paystack",
      "An automated receipt is sent to their email immediately",
    ],
  },
  {
    icon: <Download size={22} />,
    title: "Withdrawing Your Funds",
    color: "#F0FDF4",
    iconBg: "#DCFCE7",
    iconColor: "#16A34A",
    steps: [
      "Log in to your Kolekto dashboard",
      "Navigate to 'Transactions' in the sidebar",
      "Click 'Request Withdrawal'",
      "Confirm the amount and your registered bank account",
      "Funds arrive in your account within 1–3 business days",
    ],
  },
];

const faqs = [
  {
    category: "Account",
    items: [
      { q: "Do I need an account to contribute?", a: "No. Contributors can pay through your collection link without creating a Kolekto account. They just need a name, email, and payment method." },
      { q: "How do I reset my password?", a: "Click 'Forgot Password' on the login page, enter your email, and follow the reset link we send." },
      { q: "Can I change my email address?", a: "Yes. Go to Dashboard > Settings > Profile and update your email. You'll need to verify the new address." },
      { q: "Can I have multiple collections at once?", a: "Yes. There's no limit to the number of active collections you can run simultaneously." },
    ],
  },
  {
    category: "Payments",
    items: [
      { q: "What payment methods are supported?", a: "Kolekto supports debit/credit cards (Visa, Mastercard, Verve), bank transfers, and USSD payments through Paystack." },
      { q: "Is my payment information secure?", a: "Yes. All payments go through Paystack, which is PCI DSS Level 1 certified. We never see or store your card details." },
      { q: "What are Kolekto's transaction fees?", a: "We charge a small fee per successful contribution. The exact fee is shown in your dashboard before you publish a collection. Creating an account is free." },
      { q: "Can contributors get a refund?", a: "Refunds are managed by the collection organizer. If you need a refund on a contribution, contact the person who shared the collection link with you." },
    ],
  },
  {
    category: "Collections",
    items: [
      { q: "What types of collections can I create?", a: "Fixed Contributions (everyone pays the same), Tiered (multiple price levels), Open Pool (any amount), Ticketing (event tickets with codes), and Fundraising (campaign with a goal)." },
      { q: "Can I edit a collection after publishing?", a: "You can edit the description and extend the deadline. The collection type and bank account cannot be changed after contributions have been received." },
      { q: "What happens when my collection deadline passes?", a: "The collection automatically closes to new contributions. You can still view contributions and withdraw funds." },
      { q: "Can I close a collection early?", a: "Yes. Go to your collection in the dashboard and click 'Close Collection'. This immediately stops new contributions." },
    ],
  },
  {
    category: "Withdrawals",
    items: [
      { q: "How long does a withdrawal take?", a: "Withdrawals are processed within 1–3 business days. Most are completed same-day or next business day." },
      { q: "Is there a minimum withdrawal amount?", a: "Yes. The minimum withdrawal is ₦1,000." },
      { q: "Can I withdraw to any Nigerian bank?", a: "Yes. We support all Nigerian commercial banks and some microfinance banks. Your bank must accept standard NEFT transfers." },
      { q: "Are there withdrawal fees?", a: "Kolekto charges a small withdrawal processing fee. The exact amount is shown before you confirm the withdrawal." },
    ],
  },
];

const FAQItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius: 12, border: `1.5px solid ${open ? "#BBF7D0" : "#E5E7EB"}`, overflow: "hidden", transition: "border-color 0.2s" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left", gap: 12 }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A2E", lineHeight: 1.4 }}>{q}</span>
        <ChevronDown size={16} color="#6B7280" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 18px 16px", fontSize: 14, color: "#4B5563", lineHeight: 1.7 }}>{a}</div>
      )}
    </div>
  );
};

const HelpCenterPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState("Account");

  const currentFAQs = faqs.find(f => f.category === activeCategory)?.items ?? [];

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAFA" }}>
      <NavBar />

      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1A3A1A 100%)", padding: "72px 24px 60px", color: "white" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 32, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#A7F3D0", marginBottom: 20, border: "1px solid rgba(255,255,255,0.2)" }}>
            <HelpCircle size={13} /> Help Center
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            How can we help you?
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: 28 }}>
            Find step-by-step guides, quick answers, and direct support for everything Kolekto.
          </p>
          <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
            <Search size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input
              placeholder="Search help articles…"
              style={{ width: "100%", padding: "14px 16px 14px 44px", borderRadius: 12, border: "none", fontSize: 14, background: "white", outline: "none", boxSizing: "border-box", color: "#1A1A2E" }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const query = (e.target as HTMLInputElement).value.trim().toLowerCase();
                  if (query) {
                    for (const cat of faqs) {
                      const match = cat.items.find(item => item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query));
                      if (match) { setActiveCategory(cat.category); break; }
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </section>

      {/* Guides */}
      <section style={{ padding: "72px 24px 48px", background: "white" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#1A1A2E", margin: "0 0 12px" }}>
              Step-by-step guides
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280" }}>Everything you need to go from zero to collecting payments.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 24 }}>
            {guides.map((guide, i) => (
              <div key={i} style={{ background: guide.color, borderRadius: 18, padding: "28px 24px", border: "1.5px solid #E5E7EB" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: guide.iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: guide.iconColor, marginBottom: 16 }}>
                  {guide.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E", margin: "0 0 16px" }}>{guide.title}</h3>
                <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {guide.steps.map((step, si) => (
                    <li key={si} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: guide.iconBg, color: guide.iconColor, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{si + 1}</span>
                      <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "72px 24px 80px", background: "#FAFAFA" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#1A1A2E", margin: "0 0 12px" }}>
              Frequently asked questions
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280" }}>Quick answers to the most common questions.</p>
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 36 }}>
            {faqs.map(cat => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category)}
                style={{ minHeight: 44, padding: "8px 18px", borderRadius: 32, fontSize: 13, fontWeight: 600, border: "1.5px solid", borderColor: activeCategory === cat.category ? "#2E7D32" : "#E5E7EB", background: activeCategory === cat.category ? "#F0FDF4" : "white", color: activeCategory === cat.category ? "#1B5E20" : "#6B7280", cursor: "pointer", transition: "all 0.15s" }}
              >
                {cat.category}
              </button>
            ))}
          </div>

          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {currentFAQs.map((item, i) => <FAQItem key={i} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* Still need help? */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ background: "white", borderRadius: 20, border: "1.5px solid #E5E7EB", padding: "48px 40px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <MessageSquare size={28} color="#2E7D32" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1A1A2E", margin: "0 0 12px" }}>
              Still need help?
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280", maxWidth: 420, margin: "0 auto 28px", lineHeight: 1.65 }}>
              Our support team is available via WhatsApp and email. We typically respond within 2 hours during business hours.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="https://wa.me/+2349019840377" target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "white", padding: "13px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FaWhatsapp size={17} /> Chat on WhatsApp
              </a>
              <Link to="/contact" style={{ background: "#F9FAFB", color: "#1A1A2E", padding: "13px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, border: "1.5px solid #E5E7EB" }}>
                <ArrowRight size={15} /> All contact options
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HelpCenterPage;
