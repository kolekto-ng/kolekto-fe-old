import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  Banknote,
  BarChart3,
  BookOpen,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Download,
  Home,
  Loader2,
  Lock,
  LogOut,
  Medal,
  ShieldCheck,
  Send,
  Trophy,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import Logo from "@/components/Logo";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearAmbassadorSession,
  getAmbassadorBadges,
  getAmbassadorEarnings,
  getAmbassadorLeaderboard,
  getAmbassadorOverview,
  getAmbassadorPayoutAccounts,
  getAmbassadorResources,
  getAmbassadorToken,
  getAmbassadorWithdrawals,
  getStoredAmbassadorProfile,
  requestAmbassadorWithdrawal,
  saveAmbassadorPayoutAccount,
  getAmbassadorMe,
  signInAmbassador,
  setupAmbassadorPin,
} from "@/utils/ambassadorApi";
import { AMBASSADOR_LOGOUT_NOTICE_KEY } from "@/utils/axios";

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const navItems = [
  { label: "Overview", path: "/ambassador/dashboard", icon: Home },
  { label: "Earnings", path: "/ambassador/earnings", icon: CircleDollarSign },
  { label: "Badges", path: "/ambassador/badges", icon: Award },
  { label: "Leaderboard", path: "/ambassador/leaderboard", icon: Trophy },
  { label: "Resources", path: "/ambassador/resources", icon: BookOpen },
  { label: "Profile", path: "/ambassador/profile", icon: UserRound },
];

function normalizePath(pathname: string) {
  if (pathname === "/ambassador" || pathname === "/ambassador/") return "/ambassador/dashboard";
  if (pathname === "/ambassador/login") return "/ambassador/login";
  return pathname;
}

function ambassadorShareLink(code?: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.kolekto.com.ng";
  return `${origin}/register?ref=${encodeURIComponent(code || "")}`;
}

async function copyText(value: string, message = "Referral link copied successfully!") {
  if (!value) return;
  try {
    await navigator.clipboard?.writeText(value);
    toast.success(message);
  } catch {
    toast.error("Failed to copy — please copy the link manually.");
  }
}

// Decode the JWT payload without verifying the signature (client-side expiry check).
function getAmbassadorTokenExpiry(): number | null {
  const token = getAmbassadorToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isAmbassadorTokenExpired(): boolean {
  const expiry = getAmbassadorTokenExpiry();
  if (!expiry) return !getAmbassadorToken();
  return Date.now() >= expiry;
}

const AmbassadorPortal: React.FC = () => {
  const location = useLocation();
  const path = normalizePath(location.pathname);
  const isLogin = path === "/ambassador/login";

  const tokenValid = Boolean(getAmbassadorToken()) && !isAmbassadorTokenExpired();

  // A JWT can be cryptographically valid and unexpired while the account
  // behind it is no longer 'accepted' (suspended/rejected after the token
  // was issued). The client-side expiry check above can't see that — only
  // the server can, since ambassador_profiles.status lives in the DB. So on
  // entering the authenticated portal, re-validate with the server once via
  // /ambassadors/me before rendering the shell/nav, instead of trusting the
  // cached token alone. This only re-runs when tokenValid/isLogin actually
  // change (e.g. app load, fresh login) — not on every internal nav click,
  // since AmbassadorPortal itself doesn't remount between dashboard pages.
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionValid, setSessionValid] = useState(true);

  useEffect(() => {
    if (!tokenValid || isLogin) {
      setSessionChecked(true);
      return;
    }
    let cancelled = false;
    setSessionChecked(false);
    getAmbassadorMe()
      .catch((err) => {
        const status = err?.response?.status;
        // Only an explicit 401/403 means the account is actually denied —
        // fail open on network/5xx blips rather than logging out a
        // legitimate ambassador over a transient error. The axios
        // interceptor already handles the definitive 401/403 logout+notice;
        // this just prevents the shell from rendering in the meantime.
        if (!cancelled && (status === 401 || status === 403)) {
          setSessionValid(false);
        }
      })
      .finally(() => {
        if (!cancelled) setSessionChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenValid, isLogin]);

  if (location.pathname === "/ambassador" || location.pathname === "/ambassador/") {
    return <Navigate to="/ambassador/dashboard" replace />;
  }

  if (!tokenValid && !isLogin) {
    if (getAmbassadorToken()) clearAmbassadorSession();
    return <Navigate to="/ambassador/login" replace />;
  }

  if (tokenValid && isLogin) {
    return <Navigate to="/ambassador/dashboard" replace />;
  }

  if (isLogin) return <AmbassadorLogin />;

  if (!sessionValid) {
    clearAmbassadorSession();
    return <Navigate to="/ambassador/login" replace />;
  }

  if (!sessionChecked) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6faf6]">
        <Loader2 className="h-6 w-6 animate-spin text-green-700" />
      </div>
    );
  }

  return (
    <AmbassadorShell>
      {path.includes("/earnings") && <EarningsPage />}
      {path.includes("/badges") && <BadgesPage />}
      {path.includes("/leaderboard") && <LeaderboardPage />}
      {path.includes("/resources") && <ResourcesPage />}
      {path.includes("/profile") && <ProfilePage />}
      {!["/earnings", "/badges", "/leaderboard", "/resources", "/profile"].some((part) => path.includes(part)) && <OverviewPage />}
    </AmbassadorShell>
  );
};

const AmbassadorLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If the axios interceptor just force-logged-out a previously-valid
  // session (e.g. the account was suspended/rejected mid-session), it
  // stashes the exact backend reason here — show it once, then clear it so
  // a page refresh doesn't keep re-displaying a stale notice.
  useEffect(() => {
    const notice = sessionStorage.getItem(AMBASSADOR_LOGOUT_NOTICE_KEY);
    if (notice) {
      setError(notice);
      sessionStorage.removeItem(AMBASSADOR_LOGOUT_NOTICE_KEY);
    }
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "setup") {
        await setupAmbassadorPin(email, code, pin, confirmPin);
      } else {
        await signInAmbassador(email, code, pin);
      }
      navigate("/ambassador/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid ambassador login details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_0.82fr]">
          <div className="hidden flex-col justify-center lg:flex">
            <Logo size="lg" />
            <div className="mt-10 space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-green-200">
                <ShieldCheck className="h-4 w-4" />
                Ambassador-only portal
              </div>
              <h1 className="font-clash text-4xl font-semibold leading-tight sm:text-5xl">
                Leadership, rewards, resources, and recognition in one place.
              </h1>
              <p className="max-w-xl text-base leading-8 text-white/65">
                Sign in with your email, ambassador code, and private PIN. First-time accepted ambassadors can create their PIN before entering the portal.
              </p>
            </div>
          </div>

          <div className="w-full">
            {/* Mobile logo */}
            <div className="mb-6 lg:hidden">
              <Logo size="md" />
            </div>
            <form onSubmit={submit} className="rounded-[28px] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
              <div className="mb-6">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-green-700">Access</p>
                <h2 className="mt-2 font-clash text-2xl font-semibold">{mode === "setup" ? "Set Your PIN" : "Ambassador Login"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {mode === "setup"
                    ? "Use the email and ambassador code from your acceptance, then choose a 4-6 digit PIN."
                    : "Use the PIN you created for your ambassador account."}
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ambassador Code</label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))}
                    placeholder="GHAZAL"
                    required
                    className="h-12 font-mono tracking-widest"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">PIN</label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    minLength={4}
                    maxLength={6}
                    autoComplete={mode === "setup" ? "new-password" : "current-password"}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="4-6 digits"
                    required
                    className="h-12"
                  />
                </div>
                {mode === "setup" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm PIN</label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      minLength={4}
                      maxLength={6}
                      autoComplete="new-password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Repeat PIN"
                      required
                      className="h-12"
                    />
                  </div>
                )}
              </div>
              {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <Button type="submit" disabled={loading} className="mt-6 h-12 w-full bg-green-900 text-white hover:bg-green-800">
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> {mode === "setup" ? "Setting PIN..." : "Signing in..."}</>
                  : mode === "setup" ? "Set PIN and Enter Portal" : "Enter Portal"}
              </Button>
              <button
                type="button"
                onClick={() => { setError(""); setPin(""); setConfirmPin(""); setMode((m) => (m === "signin" ? "setup" : "signin")); }}
                className="mt-4 w-full py-2 text-center text-sm font-medium text-green-800"
              >
                {mode === "setup" ? "I already have a PIN" : "First time here? Set your PIN"}
              </button>
              <Link to="/ambassadors" className="mt-2 flex items-center justify-center gap-2 py-2 text-sm font-medium text-green-800">
                Apply to become an ambassador <ChevronRight className="h-4 w-4" />
              </Link>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

function AmbassadorShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = getStoredAmbassadorProfile<any>();

  const signOut = () => {
    clearAmbassadorSession();
    navigate("/ambassador/login", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-[#f6faf6] text-slate-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-green-100 bg-slate-950 px-4 py-5 text-white xl:block xl:w-72">
        <Logo size="md" />
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/8 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Ambassador</p>
          <p className="mt-2 font-semibold">{profile?.fullName || "Kolekto Ambassador"}</p>
          <p className="mt-1 text-sm text-green-200">{profile?.ambassadorCode}</p>
        </div>
        <nav className="mt-6 space-y-1">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? "bg-green-500/18 text-green-100" : "text-white/70 hover:bg-white/8 hover:text-white"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={signOut}
          className="absolute bottom-5 left-4 right-4 flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/70 hover:bg-white/8"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </aside>

      {/* Page layout */}
      <div className="pb-20 xl:pl-72 xl:pb-0">
        {/* Top header */}
        <header className="sticky top-0 z-20 border-b border-green-100 bg-white/90 px-4 py-3 backdrop-blur xl:px-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">Ambassador Portal</p>
              <h1 className="font-clash text-lg font-semibold leading-tight xl:text-xl">Growth and rewards center</h1>
            </div>
            {/* Profile chip — mobile only */}
            <div className="flex items-center gap-2 xl:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-900 text-xs font-bold text-white">
                {(profile?.fullName || "A").charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 xl:px-8 xl:py-6">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-green-100 bg-white/95 backdrop-blur xl:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-center transition-colors ${active ? "text-green-800" : "text-slate-400"}`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-green-800" : ""}`} />
                <span className="text-[9px] font-semibold leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
        {/* Home indicator padding */}
        <div className="h-safe-bottom" />
      </nav>
    </div>
  );
}

function useAmbassadorData<T>(loader: () => Promise<T>, fallback: T, options: { refreshMs?: number } = {}) {
  const navigate = useNavigate();
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      loader()
        .then((result) => {
          if (!mounted) return;
          setData(result);
          setError("");
        })
        .catch((err) => {
          if (!mounted) return;
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            clearAmbassadorSession();
            navigate("/ambassador/login", { replace: true });
            return;
          }
          setError(err?.response?.data?.error || "Unable to load this page.");
        })
        .finally(() => mounted && setLoading(false));
    };

    load(true);
    const interval = options.refreshMs ? window.setInterval(() => load(false), options.refreshMs) : null;
    return () => {
      mounted = false;
      if (interval) window.clearInterval(interval);
    };
  }, [loader, options.refreshMs, navigate]);

  return { data, loading, error };
}

const OverviewPage = () => {
  const loader = useMemo(() => getAmbassadorOverview, []);
  const { data, loading, error } = useAmbassadorData<any>(loader, { profile: {}, metrics: {}, organizers: [] });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const metrics = data.metrics || {};
  const organizers: any[] = data.organizers || [];
  const shareLink = ambassadorShareLink(data.profile?.ambassadorCode);
  const totalOrgs = Number(metrics.totalOrganizersInfluenced) || 0;
  const totalColls = Number(metrics.totalCollectionsInfluenced) || 0;
  const totalEarned = Number(metrics.totalEarnings) || 0;
  const rank = data.profile?.rank || "Ambassador";

  const impactLine = totalOrgs === 0
    ? "Your journey starts with the first referral."
    : totalOrgs < 5
    ? `${totalOrgs} organizer${totalOrgs !== 1 ? "s" : ""} influenced — you're building something real.`
    : totalOrgs < 20
    ? `${totalOrgs} organizers and counting — your network is growing fast.`
    : `${totalOrgs} organizers in your network — you're making a serious impact.`;

  return (
    <div className="space-y-5">
      {/* Hero rank card */}
      <div className="rounded-[24px] border border-green-100 bg-[linear-gradient(135deg,#0f3d17_0%,#1b5e20_100%)] p-5 text-white shadow-xl xl:rounded-[28px] xl:p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-green-100">Your rank</p>
        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="font-clash text-3xl font-semibold xl:text-4xl">{rank}</h2>
            <p className="mt-2 text-sm text-white/70 xl:text-base">{impactLine}</p>
          </div>
          <div className="flex flex-row gap-2 md:flex-col md:items-end">
            <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-1.5 text-sm">{data.profile?.ambassadorCode}</div>
            {totalEarned > 0 && (
              <div className="rounded-2xl border border-green-400/30 bg-green-500/18 px-3 py-1.5 text-sm font-semibold text-green-100">
                {currency.format(totalEarned)} earned
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Referral link */}
      <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Your referral link</p>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">Every organizer who registers through this link is tied to your account.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input value={shareLink} readOnly className="bg-slate-50 text-xs sm:text-sm" />
          <Button type="button" onClick={() => copyText(shareLink)} className="h-10 shrink-0 gap-2 bg-green-900 hover:bg-green-800">
            <Copy className="h-4 w-4" />
            <span className="sm:inline">Copy</span>
          </Button>
        </div>
      </div>

      {/* First milestone callout */}
      {totalOrgs === 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">First milestone</p>
          <p className="mt-2 font-semibold text-slate-950">Refer your first organizer</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Share your referral link. When an organizer registers and starts collecting, your first reward is credited to your account.
          </p>
        </div>
      )}

      {/* Metrics grid */}
      <MetricGrid metrics={metrics} />

      {/* Next rank milestone */}
      {totalColls > 0 && (() => {
        const MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500];
        const next = MILESTONES.find((m) => m > totalColls);
        if (!next) return null;
        const progress = Math.round((totalColls / next) * 100);
        return (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Next badge milestone</p>
            <p className="mt-1 font-semibold text-slate-950">{next - totalColls} more collection{(next - totalColls) !== 1 ? "s" : ""} to the next badge</p>
            <Progress label={`${totalColls} of ${next} collections`} value={progress} />
          </div>
        );
      })()}

      <ReferredOrganizersTable organizers={organizers} />
    </div>
  );
};

const EarningsPage = () => {
  const loader = useMemo(() => getAmbassadorEarnings, []);
  const { data, loading, error } = useAmbassadorData<any>(
    loader,
    { organizers: [], summary: { totalEarnings: 0, availableEarnings: 0, pendingEarnings: 0, totalWithdrawn: 0, totalOrganizers: 0 } },
  );
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const summary = data.summary || {};
  const totalOrganizers = Number(summary.totalOrganizers) || 0;
  const totalEarnings = Number(summary.totalEarnings) || 0;
  const pendingEarnings = Number(summary.pendingEarnings) || 0;
  const availableEarnings = Number(summary.availableEarnings) || 0;

  return (
    <PageCard title="Organizer earnings" subtitle="Your rewards grow as the organizers you refer grow. Track every milestone here.">
      {totalOrganizers > 0 && (
        <>
          <div className="rounded-2xl border border-green-100 bg-[linear-gradient(135deg,#0f3d17_0%,#1b5e20_100%)] p-5 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-green-200">Your impact in numbers</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-bold xl:text-3xl">{currency.format(totalEarnings)}</p>
                <p className="mt-1 text-xs text-green-200 sm:text-sm">Total earned</p>
              </div>
              <div>
                <p className="text-2xl font-bold xl:text-3xl">{currency.format(availableEarnings)}</p>
                <p className="mt-1 text-xs text-green-200 sm:text-sm">Ready to withdraw</p>
              </div>
              <div>
                <p className="text-2xl font-bold xl:text-3xl">{totalOrganizers}</p>
                <p className="mt-1 text-xs text-green-200 sm:text-sm">Organizer{totalOrganizers !== 1 ? "s" : ""} referred</p>
              </div>
            </div>
            {pendingEarnings > 0 && (
              <p className="mt-4 rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-xs text-green-100 sm:text-sm">
                {currency.format(pendingEarnings)} pending — earns when your referred organizers hit their first milestone.
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total Earnings" value={currency.format(totalEarnings)} />
            <SummaryCard label="Pending (Locked)" value={currency.format(pendingEarnings)} />
            <SummaryCard label="Available to Withdraw" value={currency.format(availableEarnings)} highlight />
            <SummaryCard label="Total Withdrawn" value={currency.format(summary.totalWithdrawn || 0)} />
          </div>
        </>
      )}

      <div className="space-y-4">
        {(data.organizers || []).length === 0 && (
          <EmptyState text="No organizer earnings yet. Share your referral link — every organizer who registers through it earns you a reward." />
        )}
        {(data.organizers || []).map((organizer: any) => {
          const rewardProgress = Number(organizer.rewardProgress) || 0;
          const isMaxed = organizer.rewardStatus === "maxed";
          const isEarning = organizer.rewardStatus === "earning";
          return (
            <div key={organizer.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <p className="font-semibold text-slate-950">{organizer.organizerName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {organizer.joinedAt ? `Referred ${new Date(organizer.joinedAt).toLocaleDateString()}` : ""}
                    {organizer.collectionsInfluenced ? ` · ${organizer.collectionsInfluenced} collection${organizer.collectionsInfluenced !== 1 ? "s" : ""}` : ""}
                  </p>
                  {isMaxed && <p className="mt-1.5 text-xs font-semibold text-amber-700">Maximum reward reached for this organizer.</p>}
                  {isEarning && <p className="mt-1.5 text-xs font-medium text-green-700">Active — earning incremental rewards.</p>}
                </div>
                <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end">
                  <RewardStatusBadge status={organizer.rewardStatus} />
                  <p className="text-xl font-semibold text-green-800">{currency.format(organizer.earningsGenerated || 0)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Locked</p>
                  <p className="mt-0.5 font-semibold text-slate-950">{currency.format(organizer.earningsLocked || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Available</p>
                  <p className="mt-0.5 font-semibold text-slate-950">{currency.format(organizer.earningsAvailable || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Paid Out</p>
                  <p className="mt-0.5 font-semibold text-slate-950">{currency.format(organizer.earningsPaid || 0)}</p>
                </div>
              </div>
              <div className="mt-3">
                <Progress label={isMaxed ? "₦5,000 max reward reached" : "Toward ₦5,000 max reward"} value={rewardProgress} />
                {!isMaxed && organizer.remainingToMax > 0 && (
                  <p className="mt-1 text-xs text-slate-400">{currency.format(organizer.remainingToMax)} more to reach the maximum.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageCard>
  );
};

const BadgesPage = () => {
  const loader = useMemo(() => getAmbassadorBadges, []);
  const { data, loading, error } = useAmbassadorData<any>(loader, { badges: [] });
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const badges: any[] = data.badges || [];
  const earned = badges.filter((b) => b.earned);
  const nextBadge = badges.find((b) => !b.earned && b.type === "progression");

  const earnedProgression = earned.filter((b) => b.type === "progression");
  const earnedPrestige = earned.filter((b) => b.type === "prestige");
  const latestBadge = earnedProgression[earnedProgression.length - 1];

  return (
    <PageCard title="Badges and achievements" subtitle="Every badge is a milestone unlocked — your progression and prestige history in one place.">
      {latestBadge && (
        <div className="rounded-[24px] border border-green-100 bg-[linear-gradient(135deg,#0f3d17_0%,#1b5e20_100%)] p-5 text-white xl:p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-green-200">Latest achievement</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <Medal className="h-6 w-6 text-green-200" />
            </div>
            <div>
              <p className="text-xl font-bold">{latestBadge.name}</p>
              <p className="text-sm text-green-200">{latestBadge.description}</p>
            </div>
          </div>
          {earnedPrestige.length > 0 && (
            <p className="mt-4 text-sm text-green-100">
              {earnedPrestige.length} prestige badge{earnedPrestige.length !== 1 ? "s" : ""} also unlocked — you're in elite territory.
            </p>
          )}
        </div>
      )}

      {nextBadge && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Next milestone — {nextBadge.name}</p>
          <p className="mt-1 text-sm text-slate-600">{nextBadge.description}</p>
          {nextBadge.remaining > 0 && (
            <p className="mt-2 text-sm font-semibold text-blue-700">{nextBadge.remaining} collection{nextBadge.remaining !== 1 ? "s" : ""} to go</p>
          )}
          <Progress label="Progress" value={nextBadge.progress || 0} />
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Progression badges ({earnedProgression.length} earned)</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {badges.filter((b) => b.type === "progression").map((badge: any) => (
            <div key={badge.key} className={`rounded-2xl border p-4 transition-colors ${badge.earned ? "border-green-200 bg-green-50" : "border-slate-100 bg-white"}`}>
              <Medal className={`mb-3 h-5 w-5 ${badge.earned ? "text-green-700" : "text-slate-300"}`} />
              <p className="text-sm font-semibold">{badge.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{badge.description}</p>
              {badge.earned && <p className="mt-1.5 text-xs font-bold text-green-700">Unlocked</p>}
              {!badge.earned && badge.remaining > 0 && <p className="mt-1.5 text-xs font-medium text-slate-400">{badge.remaining} to go</p>}
              <Progress label={badge.earned ? "Complete" : "Progress"} value={badge.progress || 0} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Prestige badges ({earnedPrestige.length} earned)</p>
        <p className="mb-4 text-sm leading-6 text-slate-500">
          Prestige badges are earned through exceptional impact — large collections, sustained activity, and opening new communities.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {badges.filter((b) => b.type === "prestige").map((badge: any) => (
            <div key={badge.key} className={`rounded-2xl border p-4 ${badge.earned ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-white"}`}>
              <Medal className={`mb-3 h-5 w-5 ${badge.earned ? "text-amber-600" : "text-slate-300"}`} />
              <p className="text-sm font-semibold">{badge.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{badge.description}</p>
              {badge.earned && <p className="mt-1.5 text-xs font-bold text-amber-700">Earned</p>}
              {!badge.earned && badge.progress > 0 && <Progress label="Progress" value={badge.progress || 0} />}
              {!badge.earned && badge.progress === 0 && <p className="mt-2 text-xs text-slate-400">Keep growing to unlock</p>}
            </div>
          ))}
        </div>
      </div>

      {earned.length === 0 && (
        <EmptyState text="No badges yet — your first badge unlocks the moment you influence a collection. Share your link and get started." />
      )}
    </PageCard>
  );
};

const LeaderboardPage = () => {
  const loader = useMemo(() => getAmbassadorLeaderboard, []);
  const { data, loading, error } = useAmbassadorData<any>(
    loader,
    { leaderboard: [], myRank: null },
    { refreshMs: 10000 },
  );
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const myRank = data.myRank as {
    rank: number;
    name: string;
    leadershipLevel: string;
    organizersInfluenced: number;
    badgeCount: number;
    isInTopTwenty: boolean;
  } | null;

  return (
    <PageCard title="Leaderboard" subtitle="Top 20 ambassadors ranked by organizers referred and collections influenced.">
      {myRank && !myRank.isInTopTwenty && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">Your ranking</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-green-800">#{myRank.rank}</span>
              <span className="text-sm font-semibold text-slate-700">{myRank.name}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>{myRank.leadershipLevel || "Ambassador"}</span>
              <span>{myRank.organizersInfluenced} organizer{myRank.organizersInfluenced !== 1 ? "s" : ""} referred</span>
              <span>
                {myRank.badgeCount > 0
                  ? `${myRank.badgeCount} badge${myRank.badgeCount !== 1 ? "s" : ""}`
                  : "No badges yet"}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Keep referring organizers to climb into the top 20.</p>
        </div>
      )}

      {/* Mobile: card list. Desktop: table */}
      <div className="space-y-3 xl:hidden">
        {(data.leaderboard || []).length === 0 && (
          <EmptyState text="Leaderboard will populate as ambassadors influence organizers and collections." />
        )}
        {(data.leaderboard || []).map((row: any) => (
          <div
            key={`${row.rank}-${row.name}`}
            className={`rounded-2xl border p-4 ${row.isCurrentAmbassador ? "border-green-200 bg-green-50" : "border-slate-100 bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-clash text-xl font-bold text-green-800">#{row.rank}</span>
                <div>
                  <p className="font-semibold text-slate-950">
                    {row.name}
                    {row.isCurrentAmbassador && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">You</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{row.leadershipLevel || "Ambassador"}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Organizers</p>
                <p className="mt-0.5 font-semibold">{row.organizersInfluenced} referred</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Badges</p>
                <p className="mt-0.5 font-semibold">
                  {Number(row.badgeCount || 0) > 0 ? `${row.badgeCount} badge${row.badgeCount !== 1 ? "s" : ""}` : "None yet"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white xl:block">
        <div className="grid border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400 xl:grid-cols-[70px_1fr_160px_140px_160px]">
          <span>Rank</span>
          <span>Ambassador</span>
          <span>Level</span>
          <span>Organizers</span>
          <span>Badges</span>
        </div>
        {(data.leaderboard || []).length === 0 && (
          <EmptyState text="Leaderboard will populate as ambassadors influence organizers and collections." />
        )}
        {(data.leaderboard || []).map((row: any) => (
          <div
            key={`${row.rank}-${row.name}`}
            className={`grid items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-sm last:border-b-0 xl:grid-cols-[70px_1fr_160px_140px_160px] ${row.isCurrentAmbassador ? "bg-green-50" : ""}`}
          >
            <span className="font-bold text-green-800">#{row.rank}</span>
            <span className="font-semibold">
              {row.name}
              {row.isCurrentAmbassador && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">You</span>
              )}
            </span>
            <span className="text-slate-600">{row.leadershipLevel || "Ambassador"}</span>
            <span className="text-slate-600">{row.organizersInfluenced} referred</span>
            <span className="text-slate-600">
              {Number(row.badgeCount || 0) > 0 ? `${row.badgeCount} badge${row.badgeCount !== 1 ? "s" : ""}` : "No badges yet"}
            </span>
          </div>
        ))}
      </div>
    </PageCard>
  );
};

const ResourcesPage = () => {
  const loader = useMemo(() => getAmbassadorResources, []);
  const { data, loading, error } = useAmbassadorData<any>(loader, { resources: [] });
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return (
    <PageCard title="Training center" subtitle="PDFs, marketing assets, posters, handbook, social graphics, and brand guidelines.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(data.resources || []).map((resource: any) => (
          <a
            key={resource.id || resource.title}
            href={resource.file_url || resource.external_url || "#"}
            className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <Download className="mb-4 h-5 w-5 text-green-800" />
            <p className="font-semibold">{resource.title}</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{resource.description}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-green-700">{resource.category}</p>
          </a>
        ))}
      </div>
      {(data.resources || []).length === 0 && (
        <EmptyState text="Training materials and resources will appear here as they are added." />
      )}
    </PageCard>
  );
};

const ProfilePage = () => {
  const profile = getStoredAmbassadorProfile<any>();
  const shareLink = ambassadorShareLink(profile?.ambassadorCode);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [availableAmount, setAvailableAmount] = useState(0);
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);
  const [financeError, setFinanceError] = useState("");
  const [accountForm, setAccountForm] = useState({
    bankName: "",
    bankCode: "",
    accountName: "",
    accountNumber: "",
  });
  const [withdrawalForm, setWithdrawalForm] = useState({
    payoutAccountId: "",
    amount: "",
  });

  const loadFinance = async () => {
    setLoadingFinance(true);
    setFinanceError("");
    try {
      const [accountData, withdrawalData] = await Promise.all([
        getAmbassadorPayoutAccounts(),
        getAmbassadorWithdrawals(),
      ]);
      const nextAccounts = accountData.accounts || [];
      setAccounts(nextAccounts);
      setWithdrawals(withdrawalData.withdrawals || []);
      setAvailableAmount(Number(withdrawalData.availableAmount ?? accountData.availableAmount ?? 0));
      setWithdrawalForm((current) => ({
        ...current,
        payoutAccountId: current.payoutAccountId || nextAccounts[0]?.id || "",
      }));
    } catch (err: any) {
      setFinanceError(err?.response?.data?.error || "Unable to load payout details.");
    } finally {
      setLoadingFinance(false);
    }
  };

  useEffect(() => { loadFinance(); }, []);

  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingAccount(true);
    setFinanceError("");
    try {
      await saveAmbassadorPayoutAccount(accountForm);
      setAccountForm({ bankName: "", bankCode: "", accountName: "", accountNumber: "" });
      await loadFinance();
    } catch (err: any) {
      setFinanceError(err?.response?.data?.error || "Unable to save payout account.");
    } finally {
      setSavingAccount(false);
    }
  };

  const submitWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    setRequestingWithdrawal(true);
    setFinanceError("");
    try {
      await requestAmbassadorWithdrawal({
        payoutAccountId: withdrawalForm.payoutAccountId,
        amount: Number(withdrawalForm.amount),
      });
      setWithdrawalForm((current) => ({ ...current, amount: "" }));
      await loadFinance();
    } catch (err: any) {
      setFinanceError(err?.response?.data?.error || "Unable to request withdrawal.");
    } finally {
      setRequestingWithdrawal(false);
    }
  };

  return (
    <PageCard title="Profile" subtitle="Your ambassador identity and access details.">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Name" value={profile?.fullName || "Ambassador"} />
          <Info label="Email" value={profile?.email || "-"} />
          <Info label="Ambassador Code" value={profile?.ambassadorCode || "-"} />
          <Info label="Access" value="Accepted ambassador" />
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Referral Link</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input value={shareLink} readOnly className="bg-white text-xs sm:text-sm" />
            <Button type="button" onClick={() => copyText(shareLink)} className="h-10 shrink-0 gap-2 bg-green-900 hover:bg-green-800">
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {/* Payout Account */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-800">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-950">Payout Account</h3>
                <p className="text-xs text-slate-500 sm:text-sm">Add where your ambassador earnings should be paid.</p>
              </div>
            </div>

            <form onSubmit={submitAccount} className="mt-5 grid gap-3">
              <FieldText label="Bank Name">
                <Input className="h-11" value={accountForm.bankName} onChange={(e) => setAccountForm((c) => ({ ...c, bankName: e.target.value }))} required />
              </FieldText>
              <FieldText label="Account Name">
                <Input className="h-11" value={accountForm.accountName} onChange={(e) => setAccountForm((c) => ({ ...c, accountName: e.target.value }))} required />
              </FieldText>
              <FieldText label="Account Number">
                <Input
                  className="h-11"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountForm.accountNumber}
                  onChange={(e) => setAccountForm((c) => ({ ...c, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  required
                />
              </FieldText>
              <Button type="submit" disabled={savingAccount} className="h-11 w-full gap-2 bg-green-900 hover:bg-green-800 sm:w-fit">
                {savingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                Save Account
              </Button>
            </form>

            <div className="mt-4 space-y-2">
              {loadingFinance && <LoadingInline />}
              {!loadingFinance && accounts.length === 0 && <EmptyState text="No payout account attached yet." />}
              {!loadingFinance && accounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
                  <p className="font-semibold text-slate-950">{account.bankName}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{account.accountName} - ****{account.accountLast4}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Withdraw */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-950">Withdraw Earnings</h3>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Submit a withdrawal request for admin payout.</p>
              </div>
              <div className="rounded-xl bg-green-50 px-4 py-3 text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">Available</p>
                <p className="mt-1 text-lg font-semibold text-green-950">{currency.format(availableAmount || 0)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:text-sm">
              <span className="font-semibold">Payout schedule:</span> Payouts are processed on the last Friday of every month.
            </div>

            {financeError && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{financeError}</div>}

            <form onSubmit={submitWithdrawal} className="mt-4 grid gap-3">
              <FieldText label="Payout Account">
                <select
                  value={withdrawalForm.payoutAccountId}
                  onChange={(e) => setWithdrawalForm((c) => ({ ...c, payoutAccountId: e.target.value }))}
                  required
                  className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.bankName} - ****{account.accountLast4}</option>
                  ))}
                </select>
              </FieldText>
              <FieldText label="Amount">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, availableAmount)}
                  value={withdrawalForm.amount}
                  onChange={(e) => setWithdrawalForm((c) => ({ ...c, amount: e.target.value }))}
                  required
                  className="h-11"
                />
              </FieldText>
              <Button type="submit" disabled={requestingWithdrawal || !accounts.length || availableAmount <= 0} className="h-11 w-full gap-2 bg-green-900 hover:bg-green-800 sm:w-fit">
                {requestingWithdrawal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Request Withdrawal
              </Button>
            </form>

            <div className="mt-5 space-y-2">
              <h4 className="text-sm font-semibold text-slate-950">Withdrawal History</h4>
              {loadingFinance && <LoadingInline />}
              {!loadingFinance && withdrawals.length === 0 && <EmptyState text="No withdrawal request yet." />}
              {!loadingFinance && withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="rounded-xl border border-slate-100 p-3 sm:p-4">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-slate-950">{currency.format(withdrawal.amount || 0)}</p>
                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{withdrawal.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{withdrawal.requestedAt ? new Date(withdrawal.requestedAt).toLocaleString() : "Recently requested"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageCard>
  );
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function ReferredOrganizersTable({ organizers }: { organizers: any[] }) {
  if (organizers.length === 0) return null;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-clash text-xl font-semibold text-slate-950">Referred Organizers</h3>
        <p className="mt-1 text-sm text-slate-500">{organizers.length} organizer{organizers.length !== 1 ? "s" : ""} linked to your ambassador code.</p>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 xl:hidden">
        {organizers.map((org: any, i: number) => (
          <div key={org.id || i} className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{org.organizerName}</p>
                {org.organizerEmail && <p className="text-xs text-slate-400">{org.organizerEmail}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {org.joinedAt ? `Joined ${new Date(org.joinedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <RewardStatusBadge status={org.rewardStatus} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Collections</p>
                <p className="mt-0.5 font-semibold text-slate-950">{org.collectionsInfluenced || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Earned</p>
                <p className="mt-0.5 font-semibold text-green-800">{currency.format(org.earningsGenerated || 0)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm xl:block">
        {organizers.map((org: any, i: number) => (
          <div key={org.id || i} className="grid items-center gap-3 border-b border-slate-100 p-4 last:border-b-0 xl:grid-cols-[1fr_100px_130px_140px]">
            <div>
              <p className="font-semibold text-slate-950">{org.organizerName}</p>
              {org.organizerEmail && <p className="text-sm text-slate-400">{org.organizerEmail}</p>}
              <p className="mt-0.5 text-xs text-slate-400">
                {org.joinedAt ? `Joined ${new Date(org.joinedAt).toLocaleDateString()}` : ""}
                {org.lastActivityAt ? ` · Active ${new Date(org.lastActivityAt).toLocaleDateString()}` : ""}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Collections</p>
              <p className="mt-1 font-semibold text-slate-950">{org.collectionsInfluenced || 0}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Earned</p>
              <p className="mt-1 font-semibold text-green-800">{currency.format(org.earningsGenerated || 0)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Status</p>
              <RewardStatusBadge status={org.rewardStatus} className="mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-green-200 bg-green-50" : "border-slate-100 bg-white"}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${highlight ? "text-green-800" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: any }) {
  const items = [
    ["Organizers Referred", metrics.totalOrganizersInfluenced || 0, Users],
    ["Collections Influenced", metrics.totalCollectionsInfluenced || 0, BarChart3],
    ["Total Earnings", currency.format(metrics.totalEarnings || 0), CircleDollarSign],
    ["Pending (Locked)", currency.format(metrics.pendingEarnings || 0), Lock],
    ["Available to Withdraw", currency.format(metrics.availableEarnings || 0), ShieldCheck],
    ["Total Withdrawn", currency.format(metrics.totalWithdrawn || 0), Wallet],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value, Icon]: any) => (
        <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm xl:p-5">
          <Icon className="mb-3 h-5 w-5 text-green-800 xl:mb-4" />
          <p className="text-xs text-slate-500 sm:text-sm">{label}</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-950 xl:mt-2 xl:text-2xl">{value}</p>
        </div>
      ))}
    </div>
  );
}

function PageCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-clash text-2xl font-semibold text-slate-950 xl:text-3xl">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <span>{Math.min(100, Math.max(0, value))}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-green-800 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 xl:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1.5 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FieldText({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function LoadingInline() {
  return (
    <div className="flex min-h-20 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
      <Loader2 className="h-5 w-5 animate-spin text-green-800" />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[300px] items-center justify-center xl:min-h-[360px]">
      <Loader2 className="h-7 w-7 animate-spin text-green-800" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{message}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>;
}

function RewardStatusBadge({ status, className = "" }: { status?: string; className?: string }) {
  const s = status || "locked";
  const cls =
    s === "maxed" ? "bg-green-100 text-green-800" :
    s === "earning" ? "bg-blue-50 text-blue-700" :
    "bg-slate-100 text-slate-600";
  const label = s === "maxed" ? "Maxed Out" : s === "earning" ? "Earning" : "Locked";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls} ${className}`}>{label}</span>
  );
}

export default AmbassadorPortal;
