import React from "react";
import { Link } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer/Footer";
import {
  Heart, Users, Shield, Zap, ArrowRight, CheckCircle2,
  Star, Globe, TrendingUp, Target,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

const AboutPage: React.FC = () => {
  const values = [
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Transparency",
      desc: "Every kobo is visible. Contributors can see real-time progress. No hidden charges, no confusion — just clarity.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Simplicity",
      desc: "Group money collection should take minutes, not days. We strip away complexity so anyone can get started instantly.",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Community",
      desc: "Kolekto was built from the ground up for Nigerian communities — we understand your use cases because we live them.",
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Reliability",
      desc: "Powered by Paystack, every payment is processed securely and every receipt is delivered automatically.",
    },
  ];

  const stats = [
    { value: "5,000+", label: "Active Users" },
    { value: "₦50M+", label: "Collected to Date" },
    { value: "1,000+", label: "Groups & Communities" },
    { value: "99.9%", label: "Payment Success Rate" },
  ];

  const team = [
    { initials: "GA", name: "Gazali A.", role: "Co-founder & CEO", bio: "Passionate about simplifying how Nigerian communities handle money together." },
    { initials: "DO", name: "Dev Team", role: "Engineering & Product", bio: "A tight-knit team dedicated to building the most intuitive group payments platform in Africa." },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAFA" }}>
      <NavBar />
      <section style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1A3A1A 100%)", padding: "80px 24px 72px", color: "white" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", borderRadius: 32, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#A7F3D0", marginBottom: 24, border: "1px solid rgba(255,255,255,0.2)" }}>
            <Heart size={13} fill="currentColor" /> Our Story
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 20px" }}>
            We built Kolekto because chasing people for money is exhausting.
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: 600, margin: "0 auto" }}>
            Every Nigerian has experienced it — the class rep with 60 unanswered WhatsApp messages, the event organizer juggling spreadsheets, the church treasurer manually tracking hundreds of contributions. We decided to fix it.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section style={{ padding: "80px 24px", background: "white" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F1F8F2", border: "1px solid #E8F5E9", borderRadius: 32, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#2E7D32", marginBottom: 20 }}>
              <Target size={13} /> Our Mission
            </div>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 20px", color: "#1A1A2E" }}>
              Make group money collection effortless for every Nigerian community.
            </h2>
            <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.75, margin: "0 0 20px" }}>
              Kolekto was founded at the Ilorin Innovation Hub with one goal: replace the chaos of manual contribution tracking with a single, professional platform that communities can trust.
            </p>
            <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.75, margin: "0 0 32px" }}>
              Whether you're a class rep at UNILORIN, a church treasurer in Abuja, or a group organizer coordinating an aso ebi in Lagos — Kolekto was built for you.
            </p>
            <Link
              to="/create-collection"
              style={{ background: "linear-gradient(135deg, #1C5C23, #2E7D32)", color: "white", padding: "13px 24px", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              Start Collecting Free <ArrowRight size={16} />
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {stats.map((s, i) => (
              <div key={i} style={{ background: i === 0 ? "linear-gradient(135deg, #1C5C23, #2E7D32)" : "#F9FAFB", borderRadius: 18, padding: "28px 24px", border: "1.5px solid #E5E7EB" }}>
                <div style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 800, color: i === 0 ? "white" : "#1A1A2E", marginBottom: 6 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: i === 0 ? "rgba(255,255,255,0.8)" : "#6B7280", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: "80px 24px", background: "#FAFAFA" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F1F8F2", border: "1px solid #E8F5E9", borderRadius: 32, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#2E7D32", marginBottom: 16 }}>
              <Star size={13} fill="currentColor" /> What We Stand For
            </div>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 auto 16px", color: "#1A1A2E" }}>
              Our core values
            </h2>
            <p style={{ fontSize: 16, color: "#4B5563", maxWidth: 480, margin: "0 auto" }}>
              These aren't wall posters. They're the principles that shape every product decision we make.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
            {values.map((v, i) => (
              <div key={i} style={{ background: "white", borderRadius: 18, padding: "28px 24px", border: "1.5px solid #E5E7EB", transition: "box-shadow 0.25s, transform 0.25s" }}
                onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "#F1F8F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#2E7D32", marginBottom: 18 }}>
                  {v.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px", color: "#1A1A2E" }}>{v.title}</h3>
                <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.65, margin: 0 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Timeline */}
      <section style={{ padding: "80px 24px", background: "white" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F1F8F2", border: "1px solid #E8F5E9", borderRadius: 32, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "#2E7D32", marginBottom: 16 }}>
              <Globe size={13} /> Our Journey
            </div>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 auto", color: "#1A1A2E" }}>
              How we got here
            </h2>
          </div>
          {[
            { year: "2023", title: "The Problem Was Personal", desc: "Our founders experienced firsthand the pain of tracking aso ebi contributions and class dues manually. Spreadsheets. Group chats. Missed payments. There had to be a better way." },
            { year: "2024", title: "Kolekto is Born", desc: "We built the first version of Kolekto at the Ilorin Innovation Hub — a simple, focused tool for fixed contributions. Communities started using it immediately." },
            { year: "2024", title: "Expanding Collection Types", desc: "User feedback showed the need for more flexibility. We launched Tiered Contributions, Open Pools, Ticketing, and Fundraising — covering every group payment use case in Nigeria." },
            { year: "2025", title: "5,000+ Users and Growing", desc: "Today, Kolekto is trusted by students, churches, event organizers, NGOs, and community groups across Nigeria. We're just getting started." },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 24, marginBottom: i < 3 ? 40 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #1C5C23, #2E7D32)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 11 }}>{item.year}</div>
                {i < 3 && <div style={{ width: 2, flex: 1, minHeight: 32, background: "linear-gradient(180deg, #2E7D32, #A7F3D0)", margin: "8px 0" }} />}
              </div>
              <div style={{ paddingTop: 12, paddingBottom: i < 3 ? 0 : 0 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#1A1A2E" }}>{item.title}</h3>
                <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section style={{ padding: "80px 24px", background: "#FAFAFA" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 12px", color: "#1A1A2E" }}>
              The people behind Kolekto
            </h2>
            <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 420, margin: "0 auto" }}>
              A small team with a big mission — building the payments infrastructure for Nigerian communities.
            </p>
          </div>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            {team.map((member, i) => (
              <div key={i} style={{ background: "white", borderRadius: 18, padding: "32px 28px", border: "1.5px solid #E5E7EB", textAlign: "center", width: 280 }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #1C5C23, #388E3C)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 22, margin: "0 auto 16px" }}>
                  {member.initials}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1A1A2E", marginBottom: 4 }}>{member.name}</div>
                <div style={{ fontSize: 13, color: "#2E7D32", fontWeight: 600, marginBottom: 12 }}>{member.role}</div>
                <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1A3A1A 100%)", borderRadius: 24, padding: "56px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "white", margin: "0 0 16px" }}>
              Ready to simplify your group collections?
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.65 }}>
              Join thousands of Nigerians who have replaced spreadsheets and WhatsApp chases with Kolekto.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/create-collection" style={{ background: "white", color: "#1C5C23", padding: "14px 28px", borderRadius: 10, fontSize: 15, fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                Start for Free <ArrowRight size={16} />
              </Link>
              <a href="https://wa.me/+2349019840377" target="_blank" rel="noopener noreferrer" style={{ background: "rgba(255,255,255,0.1)", color: "white", padding: "14px 24px", borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, border: "1.5px solid rgba(255,255,255,0.2)" }}>
                <FaWhatsapp size={17} /> Talk to Us
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutPage;
