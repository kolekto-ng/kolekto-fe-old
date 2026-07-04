import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Award,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Crown,
  GraduationCap,
  Handshake,
  Heart,
  Loader2,
  Megaphone,
  MessageSquare,
  Network,
  PartyPopper,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitAmbassadorApplication, type AmbassadorApplicationPayload } from "@/utils/ambassadorApi";
import campusImage from "@/assets/kolekto-on-campus.png";
import communityImage from "@/assets/contribut.png";

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

const cardFade = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const slideLeft = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const slideRight = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function InView({ children, className = "", variants = fadeUp }: { children: React.ReactNode; className?: string; variants?: any }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ─── Content data ─────────────────────────────────────────────────────────────
const impactStats = [
  { value: 5000, prefix: "₦", suffix: "", label: "max reward per organizer" },
  { value: 8, prefix: "", suffix: "+", label: "achievement badges" },
  { value: 5, prefix: "", suffix: "", label: "leadership tiers" },
  { value: 0, prefix: "", suffix: "∞", label: "no limit on referrals" },
];

const benefitCategories = [
  {
    icon: CircleDollarSign,
    color: "bg-emerald-500/15 text-emerald-300",
    title: "Financial Rewards",
    items: [
      "Earn up to ₦5,000 per successful organizer",
      "Monthly stipends for top-performing ambassadors",
      "Performance-based incentive bonuses",
      "No limit on number of organizers you can refer",
    ],
  },
  {
    icon: Rocket,
    color: "bg-amber-400/15 text-amber-300",
    title: "Growth Opportunities",
    items: [
      "Sponsorship for your events & community activities",
      "Access to exclusive leadership programs",
      "Network with startup founders & ecosystem leaders",
      "Internship & career pathways at Kolekto",
      "Early access to new Kolekto features",
      "National ambassador awards & recognition",
    ],
  },
  {
    icon: Heart,
    color: "bg-rose-400/15 text-rose-300",
    title: "Community Impact",
    items: [
      "Drive financial inclusion in your campus & community",
      "Help organizations simplify group payments",
      "Build real-world leadership experience",
      "Leave a lasting impact beyond your tenure",
    ],
  },
];

const perksGrid = [
  { label: "Official Ambassador Status", icon: ShieldCheck },
  { label: "Exclusive Merchandise", icon: Star },
  { label: "Digital Certificates", icon: BadgeCheck },
  { label: "Priority Feature Access", icon: Zap },
  { label: "Monthly Training Sessions", icon: BookOpen },
  { label: "Mentorship Opportunities", icon: Handshake },
  { label: "Social Media Recognition", icon: Megaphone },
  { label: "Networking Opportunities", icon: Network },
  { label: "Internship Opportunities", icon: GraduationCap },
  { label: "Career Recommendations", icon: BriefcaseBusiness },
  { label: "Leadership Development", icon: Crown },
  { label: "Performance Stipends", icon: TrendingUp },
];

const responsibilities = [
  {
    icon: Megaphone,
    title: "Campus & Community Promotion",
    text: "Represent Kolekto at your campus, organization, and community events. Create awareness through offline and online channels, conversations, and demonstrations.",
  },
  {
    icon: Users,
    title: "Onboarding New Organizers",
    text: "Guide new users through creating collections, fundraisers, ticketed events, and group payment campaigns. Be their first point of support.",
  },
  {
    icon: GraduationCap,
    title: "Organizing Activations & Events",
    text: "Plan and run activations — demos, info sessions, workshops — that bring Kolekto's value to life in your community.",
  },
  {
    icon: MessageSquare,
    title: "Gathering User Feedback",
    text: "Act as Kolekto's eyes and ears on the ground. Collect product feedback, surface pain points, and relay insights that help us improve.",
  },
];

const progressionBadges = [
  ["First Flame", "First collection influenced"],
  ["Rising Star", "5 collections influenced"],
  ["The Connector", "10 collections influenced"],
  ["The Organizer", "25 collections influenced"],
  ["The Influencer", "50 collections influenced"],
  ["The Game Changer", "100 collections influenced"],
  ["The Titan", "250 collections influenced"],
  ["The Icon", "500 collections influenced"],
];

const prestigeBadges = [
  ["Millionaire Maker", "Collection exceeds NGN 1M"],
  ["Power Broker", "Collection exceeds NGN 5M"],
  ["Kingmaker", "Collection exceeds NGN 10M"],
  ["Steady Flame", "Weekly activity for 3 months"],
  ["The Rock", "Weekly activity for 6 months"],
  ["Campus Hero", "Significant student impact"],
  ["Lifeline", "Charity/medical collection raises NGN 1M+"],
  ["Trailblazer", "Opens a new campus/community"],
];

const leadershipLevels = [
  { level: "Ambassador", desc: "Your starting point — earn, grow, and influence organizers." },
  { level: "Campus Coordinator", desc: "Lead campus activations and onboard multiple organizers." },
  { level: "Community Lead", desc: "Manage a cohort of ambassadors across your city." },
  { level: "Regional Coordinator", desc: "Oversee operations and impact across a whole region." },
  { level: "National Ambassador Lead", desc: "The highest tier — shape the national ambassador program." },
];

const applicationSteps = [
  { step: "01", title: "Submit Application", desc: "Fill the form below with your background, motivation, and promotion plan." },
  { step: "02", title: "Review", desc: "Our team reviews your application — typically within 5 business days." },
  { step: "03", title: "Interview", desc: "Shortlisted candidates are invited for a brief virtual conversation." },
  { step: "04", title: "Acceptance", desc: "Successful applicants receive an ambassador code, portal access, and onboarding email." },
  { step: "05", title: "Onboarding", desc: "Complete your onboarding, set up your PIN, and access the ambassador portal." },
  { step: "06", title: "Active Ambassador", desc: "Start promoting, earning rewards, and building your leadership profile." },
];

const testimonials = [
  {
    name: "Chisom Nwosu",
    role: "Campus Ambassador, University of Lagos",
    quote:
      "Being a Kolekto Ambassador has been one of the most rewarding experiences of my final year. I've helped over 20 student associations simplify their contributions and learned so much about fintech and community building.",
    initials: "CN",
    color: "bg-green-700",
  },
  {
    name: "Tunde Bakare",
    role: "Community Lead, Lagos Island",
    quote:
      "The earnings system is transparent and fair. I've introduced several event organizers to Kolekto and can track every reward milestone right in the dashboard. The ambassador portal is genuinely well-built.",
    initials: "TB",
    color: "bg-amber-600",
  },
  {
    name: "Adaeze Okonkwo",
    role: "Ambassador, Enugu State",
    quote:
      "What I love most is the training and the community. Monthly sessions teach real skills, not just product pitches. I feel like I'm part of building something that will outlast my time as an ambassador.",
    initials: "AO",
    color: "bg-slate-600",
  },
];

const faqs = [
  {
    q: "How much can I earn as an ambassador?",
    a: "Rewards are performance-based and scale as the organizers you refer grow their collection activity. The maximum reward per organizer is ₦5,000 — with no limit on how many organizers you can refer. Your earnings are tracked in real time on your personal ambassador dashboard.",
  },
  {
    q: "Who can apply to become a Kolekto Ambassador?",
    a: "Anyone with an active community presence — students, event organizers, campus leaders, church coordinators, community builders, and social influencers in Nigeria. We especially value people who already organize group activities or payments.",
  },
  {
    q: "Can a pending applicant access the dashboard?",
    a: "No. Only accepted ambassadors receive a profile, ambassador code, and access to the dedicated ambassador portal. The portal is separate from the organizer dashboard.",
  },
  {
    q: "What does the application process look like?",
    a: "After you submit your application, our team reviews it within 5 business days. Shortlisted candidates are invited for a short virtual interview. Successful applicants receive an acceptance email with their ambassador code and onboarding instructions.",
  },
  {
    q: "How do referrals get tracked?",
    a: "Every ambassador gets a unique referral link and code. When someone signs up as an organizer using your link or code, they are attributed to your account. Their collection activity is then tracked on your ambassador dashboard.",
  },
  {
    q: "Is the ambassador program paid or voluntary?",
    a: "It is a performance-based earnings program. You earn real cash rewards for organizers you influence, plus non-monetary benefits like merchandise, certificates, training, and career pathways. There is no fixed salary.",
  },
  {
    q: "How do I get paid?",
    a: "Once you have available earnings, you can submit a withdrawal request directly from your ambassador portal's profile page. You add a Nigerian bank account, and our team processes payouts on a regular cycle.",
  },
  {
    q: "Can I be an ambassador in more than one location?",
    a: "Yes. You can promote Kolekto across any community, campus, or city you have influence in. As your impact grows, your leadership rank reflects your reach and consistency across multiple locations.",
  },
];

const MIN_DETAIL_LENGTH = 20;

const initialForm: AmbassadorApplicationPayload = {
  full_name: "",
  email: "",
  phone_number: "",
  state: "",
  city: "",
  school_organization: "",
  social_links: "",
  community_size: 0,
  leadership_experience: "",
  motivation: "",
  promotion_plan: "",
  previous_experience: "",
};

const formatError = (error: any) =>
  error?.response?.data?.error || error?.message || "Something went wrong. Please try again.";

// ─── Page component ───────────────────────────────────────────────────────────
const AmbassadorsPage: React.FC = () => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const motivationLength = form.motivation.trim().length;
  const promotionPlanLength = form.promotion_plan.trim().length;
  const motivationError =
    submitted && motivationLength < MIN_DETAIL_LENGTH
      ? `Please write at least ${MIN_DETAIL_LENGTH} characters.`
      : "";
  const promotionPlanError =
    submitted && promotionPlanLength < MIN_DETAIL_LENGTH
      ? `Please write at least ${MIN_DETAIL_LENGTH} characters.`
      : "";

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.full_name.trim() &&
          form.email.trim() &&
          form.phone_number.trim() &&
          form.state.trim() &&
          form.city.trim() &&
          form.school_organization.trim() &&
          Number(form.community_size) > 0 &&
          motivationLength >= MIN_DETAIL_LENGTH &&
          promotionPlanLength >= MIN_DETAIL_LENGTH
      ),
    [form, motivationLength, promotionPlanLength]
  );

  const updateField = (field: keyof AmbassadorApplicationPayload, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === "community_size" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitted(true);

    if (!canSubmit) {
      setError(`Please complete all required fields. The two longer answers need at least ${MIN_DETAIL_LENGTH} characters each.`);
      return;
    }

    setLoading(true);
    try {
      await submitAmbassadorApplication(form);
      setSuccess(true);
      setSubmitted(false);
      setForm(initialForm);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <NavBar />
      <main>

        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-slate-950 px-4 pb-24 pt-16 text-white sm:px-6 lg:px-8">
          {/* Animated background pattern */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-64 -top-64 h-[700px] w-[700px] rounded-full bg-green-800/20 blur-[120px]" />
            <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-emerald-700/15 blur-[100px]" />
            <div className="absolute bottom-0 right-1/3 h-[300px] w-[300px] rounded-full bg-amber-600/8 blur-[80px]" />
          </div>

          {/* Subtle dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_1fr]">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-7"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300">
                <Sparkles className="h-4 w-4" />
                Kolekto Ambassador Program
              </div>

              <div className="space-y-5">
                <h1 className="font-clash text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
                  More than referrals.{" "}
                  <br className="hidden sm:block" />
                  <span className="relative whitespace-nowrap">
                    <span className="relative z-10 text-green-400">An opportunity</span>
                    <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 8" fill="none">
                      <path d="M2 6C60 2 200 2 298 5" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </span>{" "}
                  platform.
                </h1>
                <p className="max-w-lg text-base leading-8 text-white/65 sm:text-lg">
                  Help communities, campuses, and organizations collect money more easily. Earn rewards, build leadership experience, and be part of Africa's group payment revolution.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg" className="h-12 bg-green-500 px-7 font-semibold text-white shadow-lg shadow-green-500/25 hover:bg-green-400">
                  <a href="#apply">Apply Now →</a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-white/20 bg-white/5 px-7 text-white backdrop-blur hover:bg-white/10 hover:text-white">
                  <a href="#learn">Learn More</a>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-12 px-7 text-white/70 hover:bg-white/8 hover:text-white">
                  <Link to="/ambassador/login">Ambassador Login</Link>
                </Button>
              </div>

              {/* Quick stats inline */}
              <div className="flex flex-wrap gap-6 pt-1">
                {[
                  { value: "₦5K", label: "max per organizer" },
                  { value: "8+", label: "achievement badges" },
                  { value: "5", label: "leadership tiers" },
                ].map(({ value, label }) => (
                  <div key={label} className="space-y-0.5">
                    <p className="font-clash text-2xl font-semibold text-green-400">{value}</p>
                    <p className="text-xs text-white/45">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="overflow-hidden rounded-[28px] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)]">
                <img
                  src={campusImage}
                  alt="Kolekto campus leaders collaborating"
                  loading="lazy"
                  className="h-full min-h-[380px] w-full object-cover brightness-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent" />
              </div>

              {/* Floating card — bottom */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="absolute -bottom-5 left-4 right-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-xl backdrop-blur-md"
              >
                <div className="grid grid-cols-3 divide-x divide-white/10 text-center">
                  {[
                    { v: "Earn", sub: "real rewards" },
                    { v: "Lead", sub: "your community" },
                    { v: "Grow", sub: "your career" },
                  ].map(({ v, sub }) => (
                    <div key={v} className="px-3">
                      <p className="font-clash text-lg font-semibold text-green-300">{v}</p>
                      <p className="text-xs text-white/50">{sub}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── IMPACT COUNTER STRIP ── */}
        <section className="bg-green-900 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-2 gap-6 sm:grid-cols-4"
            >
              {[
                { target: 5000, prefix: "₦", suffix: "", label: "max reward per organizer" },
                { target: 8, prefix: "", suffix: "+", label: "achievement badges" },
                { target: 5, prefix: "", suffix: "", label: "leadership tiers" },
                { target: 100, prefix: "", suffix: "%", label: "performance-based" },
              ].map(({ target, prefix, suffix, label }, i) => (
                <motion.div key={label} variants={cardFade} className="text-center">
                  <p className="font-clash text-3xl font-bold text-white sm:text-4xl">
                    <AnimatedCounter target={target} prefix={prefix} suffix={suffix} />
                  </p>
                  <p className="mt-1 text-xs text-green-200/70">{label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── WHAT IS THIS ── */}
        <section id="learn" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
              <InView variants={slideLeft}>
                <div className="space-y-4">
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">What it is</p>
                  <h2 className="font-clash text-3xl font-semibold leading-snug text-slate-950 sm:text-4xl">
                    A community growth program for people who move people.
                  </h2>
                  <p className="max-w-md text-sm leading-7 text-slate-500">
                    Built for campus leaders, event organizers, church coordinators, and anyone who commands a real community — not just a follower count.
                  </p>
                </div>
              </InView>
              <InView variants={slideRight}>
                <div className="rounded-2xl border border-green-100 bg-[#f8fdf8] p-6 text-base leading-8 text-slate-600">
                  Kolekto Ambassadors are passionate individuals who drive the adoption of Kolekto within their communities, campuses, and organizations. They promote group collections and fundraisers, educate users, and help communities embrace simpler digital payment experiences — while building real leadership skills and earning meaningful rewards.
                </div>
              </InView>
            </div>
          </div>
        </section>

        {/* ── EARNINGS HERO — aspirational only ── */}
        <section className="overflow-hidden bg-slate-950 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(140deg,#0f3d17_0%,#1b5e20_50%,#0a2e0f_100%)] px-6 py-14 text-white shadow-2xl sm:px-12 sm:py-20">
              {/* Decorative rings */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/5" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full border border-white/8" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full border border-white/5" />

              <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-300">Earnings potential</p>
                  <h2 className="mt-4 font-clash text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                    Earn up to{" "}
                    <span className="text-green-400">₦5,000</span>{" "}
                    for every organizer you onboard.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">
                    Your rewards grow as the organizers you refer grow. Track every milestone in real time on your personal ambassador dashboard. No cap on the number of organizers you can refer.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button asChild size="lg" className="h-12 bg-green-400 px-8 font-semibold text-slate-950 hover:bg-green-300">
                      <a href="#apply">Become an Ambassador →</a>
                    </Button>
                    <Button asChild size="lg" variant="ghost" className="h-12 px-8 text-white/70 hover:bg-white/10 hover:text-white">
                      <Link to="/ambassador/login">Already an ambassador? Sign in</Link>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:min-w-[220px]">
                  {[
                    { icon: CircleDollarSign, text: "Performance-based earnings" },
                    { icon: TrendingUp, text: "Rewards scale as organizers grow" },
                    { icon: PartyPopper, text: "No limit on referrals" },
                    { icon: ShieldCheck, text: "Real-time dashboard tracking" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/8 px-4 py-3">
                      <Icon className="h-5 w-5 shrink-0 text-green-400" />
                      <span className="text-sm text-white/80">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── BENEFITS — 3-column by category ── */}
        <section className="bg-[#f8fdf8] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <InView>
              <div className="mb-12">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Why join</p>
                <h2 className="mt-2 font-clash text-3xl font-semibold text-slate-950 sm:text-4xl">
                  This is bigger than referrals.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                  The Kolekto Ambassador Program is an opportunity platform — combining real earnings, career growth, community impact, and national recognition.
                </p>
              </div>
            </InView>

            {/* Category cards — dark */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={staggerContainer}
              className="mb-12 grid gap-5 md:grid-cols-3"
            >
              {benefitCategories.map(({ icon: Icon, color, title, items }) => (
                <motion.div
                  key={title}
                  variants={cardFade}
                  className="rounded-[24px] bg-slate-950 p-6 text-white"
                >
                  <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-clash text-lg font-semibold">{title}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm leading-6 text-white/65">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>

            {/* Perks grid */}
            <InView>
              <h3 className="mb-5 font-clash text-xl font-semibold text-slate-950">All ambassador perks</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {perksGrid.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl border border-green-100 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm transition-shadow hover:shadow-md">
                    <Icon className="h-4 w-4 shrink-0 text-green-700" />
                    {label}
                  </div>
                ))}
              </div>
            </InView>
          </div>
        </section>

        {/* ── RESPONSIBILITIES ── */}
        <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <InView>
              <div className="mb-10">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Your role</p>
                <h2 className="mt-2 font-clash text-3xl font-semibold text-slate-950 sm:text-4xl">
                  What ambassadors actually do.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
                  Being a Kolekto Ambassador is a hands-on role that combines community outreach, user education, and product activation.
                </p>
              </div>
            </InView>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={staggerContainer}
              className="grid gap-5 md:grid-cols-2"
            >
              {responsibilities.map(({ icon: Icon, title, text }, i) => (
                <motion.div
                  key={title}
                  variants={cardFade}
                  className="flex gap-5 rounded-2xl border border-green-100 bg-[#f8fdf8] p-6"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-900 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{text}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── COMMUNITY IMAGE BREAK ── */}
        <InView className="overflow-hidden">
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[28px] shadow-2xl">
              <img
                src={communityImage}
                alt="Community builders growing with Kolekto"
                loading="lazy"
                className="h-56 w-full object-cover sm:h-72 lg:h-80"
              />
              <div className="absolute inset-0 mx-4 flex items-end rounded-[28px] bg-gradient-to-t from-green-950/80 to-transparent p-8 sm:mx-6 lg:mx-8">
                <div>
                  <p className="font-clash text-2xl font-semibold text-white sm:text-3xl">
                    One referral is the start of something bigger.
                  </p>
                  <p className="mt-2 text-sm text-white/65">
                    Every organizer you introduce multiplies your impact and your earnings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </InView>

        {/* ── BADGES ── */}
        <section className="bg-slate-950 px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <InView>
              <div className="mb-10 max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-300">Achievement system</p>
                <h2 className="mt-2 font-clash text-3xl font-semibold sm:text-4xl">
                  Every milestone becomes visible progress.
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  A dual-badge system rewards both consistency and scale — track your progress in the ambassador portal.
                </p>
              </div>
            </InView>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={staggerContainer}
              className="grid gap-6 lg:grid-cols-2"
            >
              <BadgeGroup title="Progression Badges" icon={Trophy} badges={progressionBadges} />
              <BadgeGroup title="Prestige Badges" icon={Star} badges={prestigeBadges} />
            </motion.div>
          </div>
        </section>

        {/* ── LEADERSHIP PATH ── */}
        <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <InView>
              <div className="mb-10">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Leadership path</p>
                <h2 className="mt-2 font-clash text-3xl font-semibold text-slate-950 sm:text-4xl">
                  Grow from ambassador to national leadership.
                </h2>
              </div>
            </InView>

            {/* Horizontal scrollable on mobile, grid on desktop */}
            <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:overflow-visible sm:pb-0">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={staggerContainer}
                className="flex min-w-max gap-4 sm:min-w-0 md:grid md:grid-cols-5"
              >
                {leadershipLevels.map(({ level, desc }, index) => (
                  <motion.div
                    key={level}
                    variants={cardFade}
                    className="group w-52 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-green-200 hover:shadow-md sm:w-auto"
                  >
                    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-slate-950">{level}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── APPLICATION PROCESS ── */}
        <section className="bg-[#f8fdf8] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <InView>
              <div className="mb-10">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">How to join</p>
                <h2 className="mt-2 font-clash text-3xl font-semibold text-slate-950 sm:text-4xl">
                  Six straightforward steps.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
                  Applications are reviewed on a rolling basis. Typical turnaround from submission to acceptance is two weeks.
                </p>
              </div>
            </InView>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={staggerContainer}
              className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            >
              {applicationSteps.map(({ step, title, desc }) => (
                <motion.div
                  key={step}
                  variants={cardFade}
                  className="relative rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
                >
                  <p className="font-clash text-3xl font-semibold text-green-100">{step}</p>
                  <h3 className="mt-3 text-sm font-semibold text-slate-950">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <InView>
              <div className="mb-10">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Ambassador stories</p>
                <h2 className="mt-2 font-clash text-3xl font-semibold text-slate-950 sm:text-4xl">
                  Heard from ambassadors already in the program.
                </h2>
              </div>
            </InView>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={staggerContainer}
              className="grid gap-6 md:grid-cols-3"
            >
              {testimonials.map(({ name, role, quote, initials, color }) => (
                <motion.div
                  key={name}
                  variants={cardFade}
                  className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15">
                    <Star className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="flex-1 text-sm leading-7 text-slate-600">&ldquo;{quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{name}</p>
                      <p className="text-xs text-slate-500">{role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-[#f8fdf8] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <InView>
              <div className="mb-10">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">FAQ</p>
                <h2 className="mt-2 font-clash text-3xl font-semibold text-slate-950 sm:text-4xl">Common questions.</h2>
              </div>
            </InView>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
              {faqs.map(({ q, a }, index) => (
                <div key={q} className="px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="flex w-full items-center justify-between gap-4 text-left text-sm font-semibold text-slate-950 sm:text-base"
                  >
                    <span>{q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-green-700 transition-transform duration-200 ${openFaq === index ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="pb-1 pt-3 text-sm leading-7 text-slate-500">{a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="relative overflow-hidden bg-slate-950 px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-green-700/20 blur-[80px]" />
            <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-emerald-600/15 blur-[80px]" />
          </div>
          <div className="relative mx-auto max-w-4xl text-center">
            <InView>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-300">Ready to lead?</p>
              <h2 className="mt-4 font-clash text-4xl font-semibold leading-snug sm:text-5xl">
                Your community is waiting for someone like you.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/65">
                Join a growing network of passionate leaders helping communities, campuses, and organizations across Nigeria collect, fundraise, and pay together — more easily than ever before.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="h-12 bg-green-400 px-8 font-semibold text-slate-950 shadow-lg hover:bg-green-300">
                  <a href="#apply">Apply Now →</a>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-12 px-8 text-white/70 hover:bg-white/10 hover:text-white">
                  <Link to="/ambassador/login">
                    Already an ambassador? Sign in <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="mt-6 text-xs text-white/30">
                Applications are reviewed on a rolling basis · No fee required to apply
              </p>
            </InView>
          </div>
        </section>

        {/* ── APPLICATION FORM ── */}
        <section id="apply" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <InView className="space-y-5">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Apply now</p>
              <h2 className="font-clash text-3xl font-semibold leading-snug text-slate-950">
                Tell us how you lead, connect, and grow communities.
              </h2>
              <p className="text-sm leading-7 text-slate-500">
                Applications are reviewed in order of submission. Accepted applicants receive their ambassador profile, unique code, and dashboard access within two weeks of acceptance.
              </p>
              <div className="space-y-3 pt-2">
                {[
                  "All fields marked * are required",
                  "Your application is submitted for review — not immediately accepted",
                  "We will contact you by email with next steps",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-slate-500">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                    {note}
                  </div>
                ))}
              </div>
            </InView>

            <InView>
              <form
                onSubmit={handleSubmit}
                className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-md sm:p-8"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name" required>
                    <Input value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} />
                  </Field>
                  <Field label="Email" required>
                    <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
                  </Field>
                  <Field label="Phone Number" required>
                    <Input type="tel" inputMode="tel" value={form.phone_number} onChange={(e) => updateField("phone_number", e.target.value)} />
                  </Field>
                  <Field label="State" required>
                    <Input value={form.state} onChange={(e) => updateField("state", e.target.value)} />
                  </Field>
                  <Field label="City" required>
                    <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} />
                  </Field>
                  <Field label="School / Organization" required>
                    <Input value={form.school_organization} onChange={(e) => updateField("school_organization", e.target.value)} />
                  </Field>
                  <Field label="Social Links" helper="LinkedIn, Instagram, X, TikTok…">
                    <Input value={form.social_links} onChange={(e) => updateField("social_links", e.target.value)} />
                  </Field>
                  <Field label="Community Size" required helper="Approx. number of people in your network">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={form.community_size || ""}
                      onChange={(e) => updateField("community_size", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4">
                  <Field label="Leadership Experience" helper="Roles, clubs, or positions where you led others">
                    <Textarea rows={3} value={form.leadership_experience} onChange={(e) => updateField("leadership_experience", e.target.value)} />
                  </Field>
                  <Field
                    label="Why do you want to become a Kolekto Ambassador?"
                    required
                    helper={`${motivationLength} / ${MIN_DETAIL_LENGTH} characters minimum`}
                    error={motivationError}
                  >
                    <Textarea rows={4} value={form.motivation} onChange={(e) => updateField("motivation", e.target.value)} />
                  </Field>
                  <Field
                    label="How would you promote Kolekto in your community?"
                    required
                    helper={`${promotionPlanLength} / ${MIN_DETAIL_LENGTH} characters minimum`}
                    error={promotionPlanError}
                  >
                    <Textarea rows={4} value={form.promotion_plan} onChange={(e) => updateField("promotion_plan", e.target.value)} />
                  </Field>
                  <Field label="Previous Brand/Ambassador Experience" helper="Any prior ambassador or brand representative work">
                    <Textarea rows={3} value={form.previous_experience} onChange={(e) => updateField("previous_experience", e.target.value)} />
                  </Field>
                </div>

                {error && (
                  <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mt-5 rounded-xl border border-green-100 bg-green-50 px-4 py-4 text-sm">
                    <p className="font-semibold text-green-800">Application submitted successfully.</p>
                    <p className="mt-1 text-green-700">Our team will review it and reach out by email with next steps — typically within 5 business days.</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-6 h-12 w-full bg-green-900 text-white shadow-lg shadow-green-900/15 hover:bg-green-800"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting application…
                    </>
                  ) : (
                    "Submit Application →"
                  )}
                </Button>
                <p className="mt-4 text-center text-xs text-slate-400">
                  By submitting you agree that Kolekto may contact you at the email and phone number provided.
                </p>
              </form>
            </InView>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Field({
  label,
  required,
  helper,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
      {(helper || error) && (
        <p className={`text-xs ${error ? "text-red-600" : "text-slate-500"}`}>{error || helper}</p>
      )}
    </div>
  );
}

function BadgeGroup({
  title,
  icon: Icon,
  badges,
}: {
  title: string;
  icon: typeof ShieldCheck;
  badges: string[][];
}) {
  return (
    <motion.div variants={cardFade} className="rounded-[24px] border border-white/10 bg-white/6 p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-400/15 text-green-200">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {badges.map(([name, text]) => (
          <div key={name} className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <p className="font-semibold text-white">{name}</p>
            <p className="mt-1 text-sm leading-5 text-white/60">{text}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default AmbassadorsPage;
