import React from "react";
import { Link } from "react-router-dom";
import { FaFacebook, FaTwitter, FaLinkedin, FaInstagram } from "react-icons/fa";
import Logo from "./Logo";
import paystackLogo from "@/assets/paystack.png";

const socials = [
  { icon: FaFacebook, href: "https://www.facebook.com/profile.php?id=61575665957385", label: "Facebook" },
  { icon: FaTwitter, href: "https://x.com/kolekto_ng", label: "Twitter" },
  { icon: FaLinkedin, href: "https://www.linkedin.com/company/kolektong/", label: "LinkedIn" },
  { icon: FaInstagram, href: "https://www.instagram.com/kolekto_ng/", label: "Instagram" },
];

const footerCols = [
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
      { label: "Ambassador", href: "/ambassadors" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "FAQ", href: "/#faq" },
      { label: "Guides", href: "/help" },
      { label: "Community Support", href: "https://chat.whatsapp.com/JctLgtMQTEc0nFCk40C4Vj" },
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

const Footer: React.FC = () => {
  return (
    <footer className="bg-green-900 text-white">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16">
        <div className="mb-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          {/* Brand column */}
          <div>
            <Logo size="md" />
            <p className="mb-6 mt-4 max-w-[240px] text-sm leading-relaxed text-white/65">
              The smart group payment platform for communities, teams and events across Nigeria.
            </p>
            <div className="flex gap-2.5">
              {socials.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerCols.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-amber-400">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => {
                  const isExternal = link.href.startsWith("http") || link.href.startsWith("mailto");
                  const cls = "text-sm text-white/65 transition-colors hover:text-white";
                  return (
                    <li key={link.label}>
                      {isExternal ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
                          {link.label}
                        </a>
                      ) : (
                        <Link to={link.href} className={cls}>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
          <p className="text-xs text-white/45">
            © {new Date().getFullYear()} Kolekto, Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/45">Payments secured by</span>
            <img src={paystackLogo} alt="Paystack" className="h-5 object-contain brightness-75" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
