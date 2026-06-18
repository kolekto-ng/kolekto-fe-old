import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Crown,
  GraduationCap,
  Handshake,
  Loader2,
  Megaphone,
  Network,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
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

const whyCards = [
  { title: "Earn Rewards", icon: CircleDollarSign, text: "Earn up to NGN 5,000 per successful organizer you introduce." },
  { title: "Gain Leadership Experience", icon: Crown, text: "Lead adoption in your campus, workplace, community, or event network." },
  { title: "Build Your Network", icon: Network, text: "Connect with organizers, founders, operators, and community builders." },
  { title: "Receive Training", icon: BookOpen, text: "Get practical sessions on community growth, payments, and activation." },
  { title: "Get Recognized", icon: Award, text: "Earn visible badges, certificates, social recognition, and leadership status." },
  { title: "Grow Your Career", icon: BriefcaseBusiness, text: "Build a real portfolio of impact, referrals, and community outcomes." },
];

const benefits = [
  "Official Kolekto Ambassador Status",
  "Exclusive Merchandise",
  "Digital Certificates",
  "Priority Access to New Features",
  "Monthly Training Sessions",
  "Mentorship Opportunities",
  "Social Media Recognition",
  "Networking Opportunities",
  "Internship Opportunities",
  "Career Recommendations",
  "Leadership Development",
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

const leadershipLevels = ["Ambassador", "Campus Coordinator", "Community Lead", "Regional Coordinator", "National Ambassador Lead"];
const applicationSteps = ["Submit Application", "Review", "Interview", "Acceptance", "Onboarding", "Become Active Ambassador"];
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

const AmbassadorsPage: React.FC = () => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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

  const canSubmit = useMemo(() => {
    return (
      form.full_name.trim() &&
      form.email.trim() &&
      form.phone_number.trim() &&
      form.state.trim() &&
      form.city.trim() &&
      form.school_organization.trim() &&
      Number(form.community_size) > 0 &&
      motivationLength >= MIN_DETAIL_LENGTH &&
      promotionPlanLength >= MIN_DETAIL_LENGTH
    );
  }, [form, motivationLength, promotionPlanLength]);

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
      setError(`Please complete all required fields. The two longer answers must be at least ${MIN_DETAIL_LENGTH} characters each.`);
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
    <div className="min-h-screen bg-[#f8faf8] text-slate-950">
      <NavBar />

      <main>
        <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f3fff4_0%,#ffffff_72%)] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-green-100 bg-white px-4 py-2 text-sm font-semibold text-green-800 shadow-sm">
                <Sparkles className="h-4 w-4" />
                Kolekto leadership community
              </div>
              <div className="space-y-5">
                <h1 className="font-clash text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Become a Kolekto Ambassador
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                  Help communities collect money more easily, earn rewards, gain leadership experience, and become part of the movement transforming group payments across Nigeria.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-green-900 text-white hover:bg-green-800">
                  <a href="#apply">Apply Now</a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-green-200 text-green-900 hover:bg-green-50">
                  <a href="#learn">Learn More</a>
                </Button>
                <Button asChild size="lg" variant="ghost" className="text-green-900 hover:bg-green-50">
                  <Link to="/ambassador/login">Ambassador Login</Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[28px] border border-green-100 bg-white shadow-[0_28px_80px_-50px_rgba(28,92,35,0.55)]">
                <img src={campusImage} alt="Kolekto campus leaders collaborating" className="h-full min-h-[360px] w-full object-cover" />
              </div>
              <div className="absolute -bottom-5 left-5 right-5 rounded-2xl border border-white/80 bg-white/92 p-4 shadow-xl backdrop-blur">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-900">Earn</p>
                    <p className="text-xs text-slate-500">per organizer referred</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-900">8+</p>
                    <p className="text-xs text-slate-500">badges</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-900">5</p>
                    <p className="text-xs text-slate-500">leadership levels</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="learn" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">What it is</p>
              <h2 className="font-clash text-3xl font-semibold text-slate-950 sm:text-4xl">A community growth program for people who move people.</h2>
            </div>
            <div className="rounded-2xl border border-green-100 bg-white p-6 text-base leading-8 text-slate-600 shadow-sm">
              Kolekto Ambassadors are passionate individuals who help drive the adoption and visibility of Kolekto within their communities, campuses, organizations, workplaces, and events. They promote group collections, educate users, and help people embrace simpler digital payment experiences.
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Why join</p>
                <h2 className="mt-2 font-clash text-3xl font-semibold text-slate-950">Prestige, training, rewards, and real impact.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-500">Designed for campus leaders, community builders, event organizers, and anyone trusted by a network.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {whyCards.map(({ title, icon: Icon, text }) => (
                <div key={title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-800">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[28px] border border-green-100 bg-[linear-gradient(135deg,#0f3d17_0%,#1b5e20_100%)] p-8 text-white shadow-xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-100">Ambassador rewards</p>
              <h2 className="mt-4 font-clash text-3xl font-semibold sm:text-4xl">Earn up to NGN 5,000 per successful organizer.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78">Your rewards unlock as organizers you introduce process successful collections. The dashboard shows your earnings progress clearly.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {["Locked until milestone", "NGN 2,000 unlock", "NGN 5,000 max"].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/12 bg-white/10 p-4">
                    <CheckCircle2 className="mb-3 h-5 w-5 text-yellow-300" />
                    <p className="text-sm font-semibold">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-6">
              <img src={communityImage} alt="Community builders growing with Kolekto" className="mb-5 h-48 w-full rounded-2xl object-cover" />
              <h3 className="font-semibold text-slate-950">How earnings work</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p>Earn NGN 2,000 when an organizer reaches NGN 500,000 in processed collections.</p>
                <p>The more the organizer you referred keeps using Kolekto for successful collections, the more you can earn from that referral.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-clash text-3xl font-semibold text-slate-950">Ambassador benefits</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 rounded-xl border border-green-100 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-green-700" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-300">Badges and achievements</p>
              <h2 className="mt-2 font-clash text-3xl font-semibold">Every milestone becomes visible progress.</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <BadgeGroup title="Progression Badges" icon={Trophy} badges={progressionBadges} />
              <BadgeGroup title="Prestige Badges" icon={Star} badges={prestigeBadges} />
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Leadership opportunities</p>
            <h2 className="mt-2 font-clash text-3xl font-semibold text-slate-950">Grow from ambassador to national leadership.</h2>
            <div className="mt-8 grid gap-3 md:grid-cols-5">
              {leadershipLevels.map((level, index) => (
                <div key={level} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-white">{index + 1}</div>
                  <h3 className="font-semibold text-slate-950">{level}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Unlock new responsibility through impact, consistency, and community trust.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-clash text-3xl font-semibold text-slate-950">Application process</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-6">
              {applicationSteps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-green-100 bg-[#f8faf8] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Step {index + 1}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="apply" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="space-y-4">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Apply now</p>
              <h2 className="font-clash text-3xl font-semibold text-slate-950">Tell us how you lead, connect, and grow communities.</h2>
              <p className="text-sm leading-7 text-slate-500">Applications default to pending. Accepted applicants receive an ambassador profile, unique code, and dashboard access.</p>
            </div>

            <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name" required><Input value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} /></Field>
                <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} /></Field>
                <Field label="Phone Number" required><Input value={form.phone_number} onChange={(e) => updateField("phone_number", e.target.value)} /></Field>
                <Field label="State" required><Input value={form.state} onChange={(e) => updateField("state", e.target.value)} /></Field>
                <Field label="City" required><Input value={form.city} onChange={(e) => updateField("city", e.target.value)} /></Field>
                <Field label="School/Organization" required><Input value={form.school_organization} onChange={(e) => updateField("school_organization", e.target.value)} /></Field>
                <Field label="Social Links"><Input value={form.social_links} onChange={(e) => updateField("social_links", e.target.value)} placeholder="LinkedIn, Instagram, X, TikTok..." /></Field>
                <Field label="Community Size" required><Input type="number" min={1} value={form.community_size || ""} onChange={(e) => updateField("community_size", e.target.value)} /></Field>
              </div>
              <div className="mt-4 grid gap-4">
                <Field label="Leadership Experience"><Textarea rows={3} value={form.leadership_experience} onChange={(e) => updateField("leadership_experience", e.target.value)} /></Field>
                <Field
                  label="Why do you want to become an ambassador?"
                  required
                  helper={`${motivationLength}/${MIN_DETAIL_LENGTH} characters minimum`}
                  error={motivationError}
                >
                  <Textarea rows={4} value={form.motivation} onChange={(e) => updateField("motivation", e.target.value)} />
                </Field>
                <Field
                  label="How would you promote Kolekto?"
                  required
                  helper={`${promotionPlanLength}/${MIN_DETAIL_LENGTH} characters minimum`}
                  error={promotionPlanError}
                >
                  <Textarea rows={4} value={form.promotion_plan} onChange={(e) => updateField("promotion_plan", e.target.value)} />
                </Field>
                <Field label="Previous Experience"><Textarea rows={3} value={form.previous_experience} onChange={(e) => updateField("previous_experience", e.target.value)} /></Field>
              </div>

              {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {success && <div className="mt-5 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">Your application has been submitted. We will review it and reach out with next steps.</div>}

              <Button type="submit" disabled={loading} className="mt-6 w-full bg-green-900 text-white hover:bg-green-800">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : "Submit Application"}
              </Button>
            </form>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            {[
              ["How much can I earn?", "You can earn up to NGN 5,000 per successful organizer introduced. The first reward unlocks when that organizer reaches the first processing milestone."],
              ["Can pending applicants access the dashboard?", "No. Only accepted ambassadors can access the dedicated ambassador portal."],
              ["Is this part of the organizer dashboard?", "No. Ambassador access is separate and designed for growth, rewards, resources, and leadership progression."],
            ].map(([question, answer], index) => (
              <div key={question} className="border-b border-slate-100 py-4">
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 text-left font-semibold text-slate-950">
                  {question}
                  <ChevronDown className={`h-4 w-4 transition-transform ${openFaq === index ? "rotate-180" : ""}`} />
                </button>
                {openFaq === index && <p className="mt-3 text-sm leading-7 text-slate-500">{answer}</p>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

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
        <p className={`text-xs ${error ? "text-red-600" : "text-slate-500"}`}>
          {error || helper}
        </p>
      )}
    </div>
  );
}

function BadgeGroup({ title, icon: Icon, badges }: { title: string; icon: typeof ShieldCheck; badges: string[][] }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
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
            <p className="mt-1 text-sm leading-6 text-white/60">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AmbassadorsPage;
