import React, { useState } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer/Footer";
import { Mail, MessageSquare, MapPin, Clock, ArrowRight, Send } from "lucide-react";
import { FaWhatsapp, FaInstagram, FaTwitter, FaLinkedin, FaFacebook } from "react-icons/fa";
import { toast } from "sonner";

const ContactPage: React.FC = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSending(true);
    // Construct mailto link as a simple fallback (no backend needed)
    const subject = encodeURIComponent(form.subject || "Message from Kolekto Contact Form");
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    window.open(`mailto:team@kolekto.com.ng?subject=${subject}&body=${body}`, "_blank");
    toast.success("Mail client opened");
    setForm({ name: "", email: "", subject: "", message: "" });
    setSending(false);
  };

  const channels = [
    {
      icon: <FaWhatsapp size={22} color="#25D366" />,
      title: "WhatsApp",
      detail: "+234 901 984 0377",
      sub: "Typically replies in under 2 hours",
      action: "Chat now",
      href: "https://wa.me/+2349019840377",
      bg: "#F0FDF4",
      border: "#BBF7D0",
    },
    {
      icon: <Mail size={22} color="#2563EB" />,
      title: "Email",
      detail: "team@kolekto.com.ng",
      sub: "We respond within 24 hours",
      action: "Send email",
      href: "mailto:team@kolekto.com.ng",
      bg: "#EFF6FF",
      border: "#BFDBFE",
    },
    {
      icon: <MessageSquare size={22} color="#7C3AED" />,
      title: "Community",
      detail: "WhatsApp Community",
      sub: "Get help from other Kolekto users",
      action: "Join group",
      href: "https://chat.whatsapp.com/JctLgtMQTEc0nFCk40C4Vj",
      bg: "#F5F3FF",
      border: "#DDD6FE",
    },
  ];

  const socials = [
    { icon: <FaFacebook size={18} />, href: "https://www.facebook.com/profile.php?id=61575665957385", label: "Facebook" },
    { icon: <FaTwitter size={18} />, href: "https://x.com/kolekto_ng", label: "Twitter / X" },
    { icon: <FaLinkedin size={18} />, href: "https://www.linkedin.com/company/kolektong/", label: "LinkedIn" },
    { icon: <FaInstagram size={18} />, href: "https://www.instagram.com/kolekto_ng/", label: "Instagram" },
  ];

  const faqs = [
    { q: "How do I get started with Kolekto?", a: "Sign up for free, create your first collection, and share the link. No technical setup required." },
    { q: "Is my payment data secure?", a: "Yes. All payments are processed by Paystack using bank-grade encryption. We never store card details." },
    { q: "Can contributors pay without an account?", a: "Absolutely. Contributors use the link you share and pay directly — no signup needed on their end." },
    { q: "How do I withdraw my collected funds?", a: "Go to your dashboard, navigate to Transactions, and request a withdrawal to your registered bank account." },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAFA" }}>
      <NavBar />

      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1A3A1A 100%)", padding: "72px 24px 60px", color: "white" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 32, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#A7F3D0", marginBottom: 20, border: "1px solid rgba(255,255,255,0.2)" }}>
            <Mail size={13} /> Get in Touch
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            We're here to help
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
            Have a question, feedback, or just want to say hello? Reach us through any of the channels below — we're a real team that genuinely cares.
          </p>
        </div>
      </section>

      {/* Contact Channels */}
      <section style={{ padding: "72px 24px 48px", background: "white" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24, marginBottom: 64 }}>
            {channels.map((c, i) => (
              <a
                key={i}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 18, padding: "28px 24px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 12, transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none"; }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                  {c.icon}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E", marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{c.detail}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6B7280" }}>
                    <Clock size={11} /> {c.sub}
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#2E7D32", marginTop: 4 }}>
                  {c.action} <ArrowRight size={13} />
                </div>
              </a>
            ))}
          </div>

          {/* Contact Form + Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
            {/* Form */}
            <div style={{ background: "#FAFAFA", borderRadius: 20, padding: "36px 32px", border: "1.5px solid #E5E7EB" }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1A1A2E", margin: "0 0 6px" }}>Send us a message</h2>
              <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 28px", lineHeight: 1.6 }}>Fill in the form and we'll get back to you within 24 hours on business days.</p>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your full name"
                      required
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, background: "white", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#2E7D32")}
                      onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email *</label>
                    <input
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="your@email.com"
                      type="email"
                      required
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, background: "white", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#2E7D32")}
                      onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Subject</label>
                  <input
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="What is this about?"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, background: "white", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#2E7D32")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Message *</label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Tell us how we can help..."
                    rows={5}
                    required
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, background: "white", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#2E7D32")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  style={{ background: "linear-gradient(135deg, #1C5C23, #2E7D32)", color: "white", padding: "13px 24px", borderRadius: 10, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: sending ? 0.7 : 1 }}
                >
                  <Send size={15} /> {sending ? "Opening mail client..." : "Send Message"}
                </button>
              </form>
            </div>

            {/* Info + FAQ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div style={{ background: "white", borderRadius: 18, padding: "28px 24px", border: "1.5px solid #E5E7EB" }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A1A2E", margin: "0 0 16px" }}>Quick details</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F1F8F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MapPin size={16} color="#2E7D32" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", marginBottom: 2 }}>Base</div>
                      <div style={{ fontSize: 13, color: "#6B7280" }}>Ilorin Innovation Hub, Kwara State, Nigeria</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F1F8F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Clock size={16} color="#2E7D32" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", marginBottom: 2 }}>Response Time</div>
                      <div style={{ fontSize: 13, color: "#6B7280" }}>WhatsApp: within 2 hrs · Email: within 24 hrs</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #F3F4F6" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Follow us</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {socials.map((s, i) => (
                      <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                        style={{ width: 36, height: 36, borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", textDecoration: "none", transition: "background 0.2s" }}
                        title={s.label}
                        onMouseOver={e => (e.currentTarget.style.background = "#E5E7EB")}
                        onMouseOut={e => (e.currentTarget.style.background = "#F3F4F6")}
                      >
                        {s.icon}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: "white", borderRadius: 18, padding: "28px 24px", border: "1.5px solid #E5E7EB" }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A1A2E", margin: "0 0 16px" }}>Common questions</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {faqs.map((faq, i) => (
                    <div key={i} style={{ paddingBottom: i < faqs.length - 1 ? 14 : 0, borderBottom: i < faqs.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A2E", marginBottom: 5 }}>{faq.q}</div>
                      <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>{faq.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ContactPage;
