import React, { useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer/Footer";
import { Shield, ChevronDown } from "lucide-react";

const sections = [
  {
    id: "overview",
    title: "Overview",
    content: `Kolekto ("we", "us", or "our") is committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at kolekto.com.ng.

By using Kolekto, you agree to the terms of this Privacy Policy. If you do not agree, please discontinue use of our services.

This policy is compliant with Nigeria's Data Protection Regulation (NDPR) as administered by the National Information Technology Development Agency (NITDA).`,
  },
  {
    id: "data-collected",
    title: "Information We Collect",
    content: `We collect the following categories of information:

**Account Information**
When you register, we collect your full name, email address, phone number, and a secure password hash.

**Payment & KYC Information**
To process withdrawals and comply with financial regulations, we collect your Bank Verification Number (BVN), bank account details, and government-issued ID documents for identity verification.

**Transaction Data**
We record payment amounts, timestamps, collection IDs, contributor details (name and email), and Paystack transaction references.

**Usage Data**
We automatically collect log data including your IP address, browser type, pages visited, time spent, and device information to improve the platform.

**Communications**
If you contact us, we store the content of your messages to provide support.`,
  },
  {
    id: "how-we-use",
    title: "How We Use Your Information",
    content: `We use the information we collect to:

• **Provide our services** — process collections, send receipts, and manage withdrawals
• **Identity verification** — comply with Central Bank of Nigeria (CBN) and NITDA regulations for financial services
• **Communication** — send transaction notifications, receipts, and important service updates
• **Security** — detect fraud, prevent unauthorized access, and protect our users
• **Platform improvement** — analyze usage patterns to improve features and performance
• **Legal compliance** — meet obligations under Nigerian law

We do not use your personal data for unsolicited marketing without your explicit consent.`,
  },
  {
    id: "payment-security",
    title: "Payment Processing & Security",
    content: `All payments on Kolekto are processed by **Paystack** (a PCI DSS Level 1 compliant payment processor). Kolekto does not store, process, or transmit your card numbers or bank PIN.

Paystack's privacy policy governs how your payment data is handled during transactions. You can review it at paystack.com/privacy.

We use industry-standard TLS/SSL encryption for all data in transit. Sensitive data at rest is encrypted using AES-256.`,
  },
  {
    id: "data-sharing",
    title: "Data Sharing & Disclosure",
    content: `We do not sell your personal information. We may share your data in the following limited circumstances:

**Service Providers**
We share data with trusted third-party providers (Paystack for payments, Supabase for data storage, email delivery providers) strictly to deliver our services.

**Legal Requirements**
We may disclose information when required by Nigerian law, court order, or to cooperate with law enforcement.

**Collection Organizers**
When you contribute to a collection, the organizer sees your name, email, and payment amount. Contributors do not see other contributors' payment details.

**Business Transfers**
If Kolekto is acquired or merges with another entity, your data may be transferred as part of that transaction, with prior notice to you.`,
  },
  {
    id: "your-rights",
    title: "Your Rights Under NDPR",
    content: `Under Nigeria's Data Protection Regulation, you have the following rights:

• **Right of Access** — Request a copy of the personal data we hold about you
• **Right of Rectification** — Request correction of inaccurate or incomplete data
• **Right of Erasure** — Request deletion of your personal data (subject to legal retention obligations)
• **Right to Object** — Object to processing of your data for specific purposes
• **Right to Data Portability** — Request your data in a structured, machine-readable format

To exercise any of these rights, email us at **team@kolekto.com.ng** with "Data Rights Request" in the subject line. We will respond within 30 days.`,
  },
  {
    id: "cookies",
    title: "Cookies & Tracking",
    content: `Kolekto uses cookies and similar tracking technologies to:

• Keep you signed in across sessions
• Remember your preferences
• Analyze platform usage (via analytics)
• Improve security (CSRF protection)

**Types of cookies we use:**
- **Essential cookies** — Required for the platform to function. Cannot be disabled.
- **Analytics cookies** — Help us understand how users interact with Kolekto. You can opt out.
- **Security cookies** — Protect against cross-site request forgery and session hijacking.

You can manage cookie preferences in your browser settings. Note that disabling essential cookies may prevent you from using certain features.`,
  },
  {
    id: "data-retention",
    title: "Data Retention",
    content: `We retain your personal data for as long as your account is active or as required by law.

Specifically:
• Account data is retained for the life of your account plus 3 years after deletion
• Transaction records are retained for 7 years to comply with Nigerian financial record-keeping requirements
• KYC documents are retained for 5 years per CBN AML/CFT regulations
• Support communications are retained for 2 years

You may request account deletion at any time. We will honor the request subject to legal retention requirements.`,
  },
  {
    id: "children",
    title: "Children's Privacy",
    content: `Kolekto is not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected data from a minor, please contact us immediately at team@kolekto.com.ng and we will delete the information promptly.`,
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. When we make material changes, we will notify you via email or a prominent notice on the platform at least 14 days before the changes take effect.

Your continued use of Kolekto after the effective date of the updated policy constitutes your acceptance of the changes.

This policy was last updated: January 2025.`,
  },
  {
    id: "contact",
    title: "Contact Us",
    content: `For any privacy-related questions, requests, or complaints:

**Email:** team@kolekto.com.ng (subject: "Privacy Inquiry")
**WhatsApp:** +234 901 984 0377
**Address:** Ilorin Innovation Hub, Kwara State, Nigeria

We take privacy seriously. All inquiries are handled by our team directly and responded to within 5 business days.`,
  },
];

const PolicySection: React.FC<{ section: typeof sections[0] }> = ({ section }) => {
  const [open, setOpen] = useState(true);

  const renderContent = (text: string) =>
    text.split("\n").map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      // bold **text**
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

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAFA" }}>
      <NavBar />

      <section style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1A3A1A 100%)", padding: "72px 24px 60px", color: "white" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 32, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#A7F3D0", marginBottom: 20, border: "1px solid rgba(255,255,255,0.2)" }}>
            <Shield size={13} /> Legal
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
            We believe in transparency about how your data is handled. This policy explains everything — in plain language.
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 16 }}>Last updated: January 2025 · Compliant with Nigeria's NDPR</p>
        </div>
      </section>

      <section style={{ padding: "64px 24px 80px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 14, padding: "18px 22px", marginBottom: 32, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Shield size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 14, color: "#1E40AF", margin: 0, lineHeight: 1.65 }}>
              <strong>Quick summary:</strong> We collect only what we need, never sell your data, and all payments are secured by Paystack. You have full rights to your data under Nigeria's NDPR.
            </p>
          </div>
          {sections.map(s => <PolicySection key={s.id} section={s} />)}
          <div style={{ marginTop: 40, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>Questions about this policy?</p>
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

export default PrivacyPage;
