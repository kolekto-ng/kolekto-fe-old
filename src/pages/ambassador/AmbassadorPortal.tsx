import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import Logo from "@/components/Logo";
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
  signInAmbassador,
  setupAmbassadorPin,
} from "@/utils/ambassadorApi";

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

async function copyText(value: string) {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
}

const AmbassadorPortal: React.FC = () => {
  const location = useLocation();
  const path = normalizePath(location.pathname);
  const isLogin = path === "/ambassador/login";
  const isAuthenticated = Boolean(getAmbassadorToken());

  if (location.pathname === "/ambassador" || location.pathname === "/ambassador/") {
    return <Navigate to="/ambassador/dashboard" replace />;
  }

  if (!isAuthenticated && !isLogin) {
    return <Navigate to="/ambassador/login" replace />;
  }

  if (isAuthenticated && isLogin) {
    return <Navigate to="/ambassador/dashboard" replace />;
  }

  if (isLogin) return <AmbassadorLogin />;

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
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_0.82fr]">
          <div className="flex flex-col justify-center">
            <Logo size="lg" />
            <div className="mt-10 space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-green-200">
                <ShieldCheck className="h-4 w-4" />
                Ambassador-only portal
              </div>
              <h1 className="font-clash text-4xl font-semibold leading-tight sm:text-5xl">Leadership, rewards, resources, and recognition in one place.</h1>
              <p className="max-w-xl text-base leading-8 text-white/65">
                Sign in with your email, ambassador code, and private PIN. First-time accepted ambassadors can create their PIN before entering the portal.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="rounded-[28px] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
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
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ambassador Code</label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))} placeholder="GHAZAL" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="4-6 digits"
                  required
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
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Repeat PIN"
                    required
                  />
                </div>
              )}
            </div>
            {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <Button type="submit" disabled={loading} className="mt-6 w-full bg-green-900 text-white hover:bg-green-800">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {mode === "setup" ? "Setting PIN..." : "Signing in..."}</> : mode === "setup" ? "Set PIN and Enter Portal" : "Enter Portal"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setPin("");
                setConfirmPin("");
                setMode((current) => (current === "signin" ? "setup" : "signin"));
              }}
              className="mt-4 w-full text-center text-sm font-medium text-green-800"
            >
              {mode === "setup" ? "I already have a PIN" : "First time here? Set your PIN"}
            </button>
            <Link to="/ambassadors" className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-green-800">
              Apply to become an ambassador <ChevronRight className="h-4 w-4" />
            </Link>
          </form>
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
    <div className="min-h-screen bg-[#f6faf6] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-green-100 bg-slate-950 px-4 py-5 text-white lg:block">
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
              <Link key={path} to={path} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? "bg-green-500/18 text-green-100" : "text-white/70 hover:bg-white/8 hover:text-white"}`}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="absolute bottom-5 left-4 right-4 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/70 hover:bg-white/8">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-green-100 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">Ambassador Portal</p>
              <h1 className="font-clash text-xl font-semibold">Growth and rewards center</h1>
            </div>
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {navItems.slice(0, 5).map(({ label, path }) => (
                <Link key={path} to={path} className="rounded-full border border-green-100 bg-white px-3 py-2 text-xs font-medium text-green-900">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function useAmbassadorData<T>(loader: () => Promise<T>, fallback: T, options: { refreshMs?: number } = {}) {
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
        .catch((err) => mounted && setError(err?.response?.data?.error || "Unable to load this page."))
        .finally(() => mounted && setLoading(false));
    };

    load(true);
    const interval = options.refreshMs ? window.setInterval(() => load(false), options.refreshMs) : null;
    return () => {
      mounted = false;
      if (interval) window.clearInterval(interval);
    };
  }, [loader, options.refreshMs]);

  return { data, loading, error };
}

const OverviewPage = () => {
  const loader = useMemo(() => getAmbassadorOverview, []);
  const { data, loading, error } = useAmbassadorData<any>(loader, { profile: {}, metrics: {}, organizers: [] });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const metrics = data.metrics || {};
  const shareLink = ambassadorShareLink(data.profile?.ambassadorCode);
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-green-100 bg-[linear-gradient(135deg,#0f3d17_0%,#1b5e20_100%)] p-6 text-white shadow-xl">
        <p className="text-sm uppercase tracking-[0.22em] text-green-100">Current rank</p>
        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="font-clash text-4xl font-semibold">{data.profile?.rank || "Ambassador"}</h2>
            <p className="mt-2 text-white/70">Code: {data.profile?.ambassadorCode}</p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm">Status: {data.profile?.status || "accepted"}</div>
        </div>
      </div>
      <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Shareable referral link</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
          <Input value={shareLink} readOnly className="bg-slate-50" />
          <Button type="button" onClick={() => copyText(shareLink)} className="gap-2 bg-green-900 hover:bg-green-800">
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
      </div>
      <MetricGrid metrics={metrics} />
    </div>
  );
};

const EarningsPage = () => {
  const loader = useMemo(() => getAmbassadorEarnings, []);
  const { data, loading, error } = useAmbassadorData<any>(loader, { organizers: [] });
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <PageCard title="Organizer earnings" subtitle="Organizer transaction volumes stay private. You only see reward progress and earnings.">
      <div className="space-y-4">
        {(data.organizers || []).length === 0 && <EmptyState text="No influenced organizers are tracked yet. Referral attribution can start populating this table when the referral system ships." />}
        {(data.organizers || []).map((organizer: any) => (
          <div key={organizer.id} className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <p className="font-semibold">{organizer.organizerName}</p>
                <p className="text-sm text-slate-500">{organizer.rewardStatus}</p>
              </div>
              <p className="font-semibold text-green-800">{currency.format(organizer.earningsGenerated || 0)}</p>
            </div>
            <Progress label="Unlock progress" value={organizer.unlockProgress || 0} />
            <Progress label="NGN5,000 max reward" value={organizer.rewardProgress || 0} />
          </div>
        ))}
      </div>
    </PageCard>
  );
};

const BadgesPage = () => {
  const loader = useMemo(() => getAmbassadorBadges, []);
  const { data, loading, error } = useAmbassadorData<any>(loader, { badges: [] });
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return (
    <PageCard title="Badges and achievements" subtitle="Earned badges, locked milestones, and your next visible goal.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data.badges || []).map((badge: any) => (
          <div key={badge.key} className={`rounded-2xl border p-5 ${badge.earned ? "border-green-200 bg-green-50" : "border-slate-100 bg-white"}`}>
            <Medal className={`mb-4 h-6 w-6 ${badge.earned ? "text-green-700" : "text-slate-400"}`} />
            <p className="font-semibold">{badge.name}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{badge.description}</p>
            <Progress label={badge.earned ? "Earned" : "Progress"} value={badge.progress || 0} />
          </div>
        ))}
      </div>
    </PageCard>
  );
};

const LeaderboardPage = () => {
  const loader = useMemo(() => getAmbassadorLeaderboard, []);
  const { data, loading, error } = useAmbassadorData<any>(loader, { leaderboard: [] }, { refreshMs: 10000 });
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return (
    <PageCard title="Leaderboard" subtitle="National, state, and campus ranking signals for ambassador performance.">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        {(data.leaderboard || []).length === 0 && <EmptyState text="Leaderboard will populate as ambassadors influence organizers and collections." />}
        {(data.leaderboard || []).map((row: any) => (
          <div key={`${row.rank}-${row.name}`} className={`grid gap-3 border-b border-slate-100 p-4 text-sm last:border-b-0 md:grid-cols-[70px_1fr_120px_120px_150px] ${row.isCurrentAmbassador ? "bg-green-50" : ""}`}>
            <span className="font-bold text-green-800">#{row.rank}</span>
            <span className="font-semibold">{row.name}</span>
            <span>{row.organizersInfluenced} organizers</span>
            <span>{row.collectionsInfluenced} collections</span>
            <span>{currency.format(row.volumeGenerated || 0)}</span>
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data.resources || []).map((resource: any) => (
          <a key={resource.id || resource.title} href={resource.file_url || resource.external_url || "#"} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Download className="mb-4 h-5 w-5 text-green-800" />
            <p className="font-semibold">{resource.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{resource.description}</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-green-700">{resource.category}</p>
          </a>
        ))}
      </div>
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

  useEffect(() => {
    loadFinance();
  }, []);

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
        <div className="grid gap-4 md:grid-cols-2">
          <Info label="Name" value={profile?.fullName || "Ambassador"} />
          <Info label="Email" value={profile?.email || "-"} />
          <Info label="Ambassador Code" value={profile?.ambassadorCode || "-"} />
          <Info label="Access" value="Accepted ambassador" />
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Referral Link</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <Input value={shareLink} readOnly className="bg-white" />
            <Button type="button" onClick={() => copyText(shareLink)} className="gap-2 bg-green-900 hover:bg-green-800">
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-800">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-950">Payout Account</h3>
                <p className="text-sm text-slate-500">Add where your ambassador earnings should be paid.</p>
              </div>
            </div>

            <form onSubmit={submitAccount} className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldText label="Bank Name">
                  <Input value={accountForm.bankName} onChange={(event) => setAccountForm((current) => ({ ...current, bankName: event.target.value }))} required />
                </FieldText>
                <FieldText label="Bank Code">
                  <Input value={accountForm.bankCode} onChange={(event) => setAccountForm((current) => ({ ...current, bankCode: event.target.value }))} />
                </FieldText>
              </div>
              <FieldText label="Account Name">
                <Input value={accountForm.accountName} onChange={(event) => setAccountForm((current) => ({ ...current, accountName: event.target.value }))} required />
              </FieldText>
              <FieldText label="Account Number">
                <Input
                  inputMode="numeric"
                  maxLength={10}
                  value={accountForm.accountNumber}
                  onChange={(event) => setAccountForm((current) => ({ ...current, accountNumber: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  required
                />
              </FieldText>
              <Button type="submit" disabled={savingAccount} className="min-h-11 w-full gap-2 bg-green-900 hover:bg-green-800 sm:w-fit">
                {savingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                Save Account
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              {loadingFinance && <LoadingInline />}
              {!loadingFinance && accounts.length === 0 && <EmptyState text="No payout account attached yet." />}
              {!loadingFinance && accounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{account.bankName}</p>
                  <p className="mt-1 text-sm text-slate-500">{account.accountName} - ****{account.accountLast4}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-950">Withdraw Earnings</h3>
                <p className="mt-1 text-sm text-slate-500">Submit a withdrawal request for admin payout.</p>
              </div>
              <div className="rounded-xl bg-green-50 px-4 py-3 text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">Available</p>
                <p className="mt-1 text-lg font-semibold text-green-950">{currency.format(availableAmount || 0)}</p>
              </div>
            </div>

            {financeError && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{financeError}</div>}

            <form onSubmit={submitWithdrawal} className="mt-5 grid gap-4">
              <FieldText label="Payout Account">
                <select
                  value={withdrawalForm.payoutAccountId}
                  onChange={(event) => setWithdrawalForm((current) => ({ ...current, payoutAccountId: event.target.value }))}
                  required
                  className="min-h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
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
                  min={1}
                  max={Math.max(1, availableAmount)}
                  value={withdrawalForm.amount}
                  onChange={(event) => setWithdrawalForm((current) => ({ ...current, amount: event.target.value }))}
                  required
                />
              </FieldText>
              <Button type="submit" disabled={requestingWithdrawal || !accounts.length || availableAmount <= 0} className="min-h-11 w-full gap-2 bg-green-900 hover:bg-green-800 sm:w-fit">
                {requestingWithdrawal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Request Withdrawal
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-semibold text-slate-950">Withdrawal History</h4>
              {loadingFinance && <LoadingInline />}
              {!loadingFinance && withdrawals.length === 0 && <EmptyState text="No withdrawal request yet." />}
              {!loadingFinance && withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-slate-950">{currency.format(withdrawal.amount || 0)}</p>
                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{withdrawal.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{withdrawal.requestedAt ? new Date(withdrawal.requestedAt).toLocaleString() : "Recently requested"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageCard>
  );
};

function MetricGrid({ metrics }: { metrics: any }) {
  const items = [
    ["Organizers Influenced", metrics.totalOrganizersInfluenced || 0, Users],
    ["Collections Influenced", metrics.totalCollectionsInfluenced || 0, BarChart3],
    ["Total Earnings", currency.format(metrics.totalEarnings || 0), CircleDollarSign],
    ["Pending Earnings", currency.format(metrics.pendingEarnings || 0), Lock],
    ["Available Earnings", currency.format(metrics.availableEarnings || 0), ShieldCheck],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map(([label, value, Icon]: any) => (
        <div key={label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <Icon className="mb-4 h-5 w-5 text-green-800" />
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  );
}

function PageCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-clash text-3xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <span>{Math.min(100, Math.max(0, value))}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-green-800" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FieldText({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
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
  return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-green-800" /></div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{message}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>;
}

export default AmbassadorPortal;
