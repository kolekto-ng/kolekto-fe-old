import React from "react";
import { Link } from "react-router-dom";
import { FaFacebook, FaInstagram, FaLinkedin, FaTwitter } from "react-icons/fa";

const cols = [
  {
    title: "Product",
    links: [
      { label: "Create Collection", to: "/create-collection" },
      { label: "Explore Campaigns", to: "/active-campaigns" },
      { label: "Contribution Tiers", to: "/create-collection" },
      { label: "Real-Time Tracking", to: "/dashboard" },
      { label: "Wallet & Withdrawals", to: "/dashboard/transactions" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", to: "/about" },
      { label: "Contact Us", to: "/contact" },
      { label: "Careers", to: "/contact" },
      { label: "Partnerships", to: "/contact" },
      { label: "Press", to: "/about" },
      { label: "Ambassador", to: "/ambassadors" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", to: "/help" },
      { label: "FAQ", to: "/#faq" },
      { label: "Guides", to: "/help" },
      { label: "Community Support", to: "https://chat.whatsapp.com/JctLgtMQTEc0nFCk40C4Vj", external: true },
      { label: "WhatsApp Support", to: "https://wa.me/+2349019840377", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Cookie Policy", to: "/privacy" },
      { label: "KYC & Compliance", to: "/privacy" },
    ],
  },
];

const socials = [
  { icon: <FaFacebook size={16} />, href: "https://www.facebook.com/profile.php?id=61575665957385", label: "Facebook" },
  { icon: <FaTwitter size={16} />, href: "https://x.com/kolekto_ng", label: "Twitter / X" },
  { icon: <FaLinkedin size={16} />, href: "https://www.linkedin.com/company/kolektong/", label: "LinkedIn" },
  { icon: <FaInstagram size={16} />, href: "https://www.instagram.com/kolekto_ng/", label: "Instagram" },
];

const Footer: React.FC = () => {
  const linkClass = "text-sm text-white/60 hover:text-white transition-colors";

  return (
    <footer className="w-full bg-green-900 text-white pt-14 pb-8 px-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Top grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link to="/" className="inline-block mb-4">
              <span className="text-xl font-extrabold tracking-tight text-white">Kolekto</span>
            </Link>
            <p className="text-sm text-white/60 leading-relaxed mb-6 max-w-[220px]">
              The smart group payment platform for communities, teams and events across Nigeria.
            </p>
            <div className="flex gap-3">
              {socials.map((s, i) => (
                <a
                  key={i}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a href={link.to} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Kolekto, Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <Link to="/privacy" className="hover:text-white/70 transition-colors">Privacy</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
            <span>·</span>
            <a href="mailto:team@kolekto.com.ng" className="hover:text-white/70 transition-colors">team@kolekto.com.ng</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
