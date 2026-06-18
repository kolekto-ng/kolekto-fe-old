import React, { useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer/Footer";
import { FileText, ChevronDown } from "lucide-react";

const sections = [
  {
    id: "agreement",
    title: "Agreement to Terms",
    content: `By accessing or using Kolekto at kolekto.com.ng (the "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these Terms, you do not have permission to use the Platform.

These Terms apply to all users of the Platform, including collection organizers, contributors, and visitors. Kolekto reserves the right to update these Terms at any time, with notice to active users.`,
  },
  {
    id: "accounts",
    title: "Account Registration & Responsibility",
    content: `To create and manage collections, you must register for a Kolekto account. You agree to:

• Provide accurate, current, and complete registration information
• Keep your password secure and not share it with others
• Notify us immediately at team@kolekto.com.ng of any unauthorized access to your account
• Accept responsibility for all activities that occur under your account

You must be at least 18 years old to create a Kolekto account. By registering, you confirm that you meet this age requirement.

Kolekto reserves the right to suspend or terminate accounts that violate these Terms or that are involved in fraudulent activity.`,
  },
  {
    id: "collections",
    title: "Creating & Managing Collections",
    content: `As a collection organizer, you are responsible for:

**Accuracy of Information**
Providing truthful, complete, and accurate information about your collection — including its purpose, target amount, deadline, and intended use of funds.

**Lawful Purpose**
Ensuring your collection is for a legal purpose. Collections used for fraud, deception, money laundering, or any illegal activity are strictly prohibited and will result in immediate account termination.

**Contributor Relationships**
Managing your relationship with contributors. Kolekto is a technology platform — we facilitate payments but are not a party to the agreement between organizers and contributors.

**Fund Usage**
Using collected funds for the stated purpose. Misuse of funds is a violation of these Terms and may be reported to relevant Nigerian authorities.`,
  },
  {
    id: "payments",
    title: "Payments & Fees",
    content: `**Payment Processing**
All payments are processed by Paystack, a licensed payment processor regulated by the Central Bank of Nigeria (CBN). By using Kolekto, you also agree to Paystack's terms of service.

**Platform Fees**
Kolekto charges a small transaction fee per successful contribution. The current fee structure is displayed in your dashboard settings before you publish a collection. We reserve the right to adjust fees with 14 days' prior notice.

**Withdrawals**
Funds collected are held in your Kolekto wallet. Withdrawals can be requested to your registered Nigerian bank account. Kolekto processes withdrawal requests within 1–3 business days. Withdrawals below ₦1,000 may not be processed.

**Refunds**
Kolekto does not directly manage contributor refunds — this is the responsibility of the collection organizer. If a contributor requests a refund, the organizer must facilitate it through their dashboard or manually. Kolekto platform fees are non-refundable once a transaction is processed.

**Chargebacks**
If a contributor initiates a chargeback through their bank, Kolekto will deduct the chargeback amount plus a dispute processing fee from the organizer's wallet.`,
  },
  {
    id: "prohibited",
    title: "Prohibited Activities",
    content: `You may not use Kolekto for any of the following:

• **Fraud or Deception** — Creating collections with false pretenses, misrepresenting the purpose of funds, or impersonating individuals or organizations
• **Money Laundering** — Using Kolekto to conceal the origin of illegally obtained funds
• **Prohibited Goods/Services** — Collecting money for illegal products, drugs, weapons, gambling, or adult content
• **Harassment** — Using contributor data to harass, spam, or solicit outside the scope of the collection
• **Platform Abuse** — Attempting to hack, overload, or reverse-engineer the Kolekto platform
• **Duplicate Accounts** — Creating multiple accounts to circumvent restrictions or fees
• **Unauthorized Access** — Accessing another user's account without permission

Violation of these rules may result in immediate account suspension, forfeiture of funds, and/or referral to Nigerian law enforcement.`,
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
    content: `The Kolekto name, logo, product design, and all content on the platform are the intellectual property of Kolekto, Inc. You may not copy, reproduce, modify, or distribute our content without prior written consent.

By posting content on Kolekto (collection descriptions, images, etc.), you grant Kolekto a non-exclusive, royalty-free license to display and distribute that content solely for operating the Platform.`,
  },
  {
    id: "disclaimers",
    title: "Disclaimers & Limitation of Liability",
    content: `**Service Availability**
Kolekto strives for 99.9% uptime but does not guarantee uninterrupted access to the Platform. Scheduled maintenance and unforeseen outages may occur.

**No Investment Advice**
Nothing on Kolekto constitutes financial, investment, or legal advice.

**Limitation of Liability**
To the maximum extent permitted by Nigerian law, Kolekto's liability to you for any cause is limited to the total transaction fees you paid to Kolekto in the preceding 3 months. We are not liable for indirect, incidental, or consequential damages.

**Third-Party Services**
Kolekto is not responsible for the actions of third-party services such as Paystack, banks, or WhatsApp that are used in conjunction with the Platform.`,
  },
  {
    id: "indemnification",
    title: "Indemnification",
    content: `You agree to indemnify and hold harmless Kolekto, its directors, employees, and partners from any claims, losses, damages, or expenses (including reasonable legal fees) arising from:

• Your use of the Platform in violation of these Terms
• Your collection activities and the funds you collect
• Any dispute between you and your contributors
• Your violation of any applicable Nigerian law or regulation`,
  },
  {
    id: "governing-law",
    title: "Governing Law & Dispute Resolution",
    content: `These Terms are governed by the laws of the Federal Republic of Nigeria.

**Informal Resolution**
We encourage you to contact us first at team@kolekto.com.ng before pursuing formal dispute resolution. Most issues are resolved quickly.

**Formal Disputes**
Any formal dispute that cannot be resolved informally will be submitted to binding arbitration under the Arbitration and Conciliation Act (Cap A18 LFN 2004) in Kwara State, Nigeria. The arbitration will be conducted in English.

**Class Action Waiver**
You agree not to bring or join any class-action claims against Kolekto.`,
  },
  {
    id: "termination",
    title: "Termination",
    content: `Either party may terminate the service relationship at any time.

If you close your account, pending withdrawals will be processed within 7 business days. Any uncollected funds that cannot be returned to contributors may be subject to dormancy fees per Nigerian unclaimed funds regulations.

Kolekto may terminate your account immediately without notice if you violate these Terms, engage in fraudulent activity, or if required by law.`,
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    content: `We may modify these Terms from time to time. Material changes will be communicated via:

• Email to your registered address
• An in-platform notification
• A prominent notice on our website

Changes take effect 14 days after notification. Your continued use of Kolekto after that date constitutes acceptance of the updated Terms.

These Terms were last updated: January 2025.

Questions? Contact us at team@kolekto.com.ng.`,
  },
];

const TermSection: React.FC<{ section: typeof sections[0] }> = ({ section }) => {
  const [open, setOpen] = useState(true);

  const renderContent = (text: string) =>
    text.split("\n").map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      const parts = line.split(/\*\*([^*]+)\*\*/g);
      return (
        <p key={i} style={{ margin: "0 0 8px", fontSize: 15, color: "#374151", lineHeight: 1.75 }}>
          {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
        </p>
      );
    });

  return (
    <div style={{ borderRadius: 14, border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: 12 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", background: open ? "#F9FAFB" : "white", border: "none", cursor: "pointer", textAlign: "left", gap: 12 }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>{section.title}</span>
        <ChevronDown size={18} color="#6B7280" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s" }} />
      </button>
      {open && (
        <div style={{ padding: "4px 22px 20px", background: "white" }}>
          {renderContent(section.content)}
        </div>
      )}
    </div>
  );
};

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAFA" }}>
      <NavBar />

      <section style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1A3A1A 100%)", padding: "72px 24px 60px", color: "white" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 32, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#A7F3D0", marginBottom: 20, border: "1px solid rgba(255,255,255,0.2)" }}>
            <FileText size={13} /> Legal
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
            These terms govern your use of the Kolekto platform. Please read them carefully before creating or contributing to any collection.
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 16 }}>Last updated: January 2025 · Governed by Nigerian Law</p>
        </div>
      </section>

      <section style={{ padding: "64px 24px 80px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ background: "#FEF3C7", border: "1.5px solid #FDE68A", borderRadius: 14, padding: "18px 22px", marginBottom: 32, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <FileText size={18} color="#92400E" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 14, color: "#92400E", margin: 0, lineHeight: 1.65 }}>
              <strong>Important:</strong> By using Kolekto, you agree to these Terms. Kolekto is a payment facilitation platform — organizers are responsible for the lawful use of collected funds.
            </p>
          </div>
          {sections.map(s => <TermSection key={s.id} section={s} />)}
          <div style={{ marginTop: 40, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>Questions about these Terms?</p>
            <Link to="/contact" style={{ background: "linear-gradient(135deg, #1C5C23, #2E7D32)", color: "white", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsPage;
