import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import {
  Lock,
  Layers,
  Waves,
  Ticket,
  Heart,
  Target,
  TrendingUp,
  Wallet,
  BarChart3,
  ChevronRight,
  Plus,
  Share2,
  Users,
  CalendarDays,
  WalletCards,
  History,
  Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WithdrawFundsDialog } from "@/components/withdrawals/WithdrawFundsDialog";
import { KycEnforcementBanner } from "@/components/kyc/KycEnforcementBanner";
import { useAuthStore } from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardHomeStore } from "@/store/useDashboardHomeStore";
import { getCollectionStatusMeta } from "@/utils/collectionStatus";
import { ActiveWorkspaceBadge } from "@/components/workspace/WorkspaceSwitcher";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useWorkspaceCapabilities } from "@/hooks/useWorkspaceCapabilities";
import {
  createCoalescer,
  collectionIdSet,
  shouldHandleRealtimeEvent,
} from "@/utils/realtimeScope";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function fmtDateTime(d: string) {
  try {
    return new Date(d).toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem("kolekto-auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user?.id || parsed?.id || null;
  } catch {
    return null;
  }
}

// ── Collection-type visual config ────────────────────────────────────────────

const TYPE_META: Record<
  string,
  {
    label: string;
    description: string;
    IconEl: React.ElementType;
    gradient: string;
    accentBorder: string;
    amountCls: string;
    iconColor: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  fixed: {
    label: "Fixed",
    description: "One fixed amount per contributor",
    IconEl: Lock,
    gradient: "from-blue-500 to-blue-700",
    accentBorder: "border-l-blue-500",
    amountCls: "text-blue-700",
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  tiered: {
    label: "Tiered",
    description: "Multiple pricing tiers",
    IconEl: Layers,
    gradient: "from-purple-500 to-purple-700",
    accentBorder: "border-l-purple-500",
    amountCls: "text-purple-700",
    iconColor: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  open_pool: {
    label: "Open Pool",
    description: "Contributors choose their amount",
    IconEl: Waves,
    gradient: "from-cyan-500 to-cyan-700",
    accentBorder: "border-l-cyan-500",
    amountCls: "text-cyan-700",
    iconColor: "text-cyan-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
  },
  ticket: {
    label: "Ticket",
    description: "Event tickets with QR codes",
    IconEl: Ticket,
    gradient: "from-orange-500 to-orange-600",
    accentBorder: "border-l-orange-500",
    amountCls: "text-orange-700",
    iconColor: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  fundraising: {
    label: "Fundraising",
    description: "Campaign-style crowdfunding",
    IconEl: Heart,
    gradient: "from-rose-500 to-rose-700",
    accentBorder: "border-l-rose-500",
    amountCls: "text-rose-700",
    iconColor: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
};

const RECENT_COLLECTION_LIMIT = 3;
const RECENT_ACTIVITY_LIMIT = 5;

// ── Interfaces ───────────────────────────────────────────────────────────────

interface DashStats {
  totalCollections: number;
  activeCollections: number;
  totalBalance: number;
  availableBalance: number;
  pendingBalance: number;
}

interface Activity {
  id: string;
  name: string;
  email: string;
  amount: number;
  created_at: string;
  collection_title: string;
  relative_time: string;
}

// ── Section-level loading primitives (performance wave, 2026-08-20) ──────────
//
// Each is sized to the content it stands in for, so a section resolving does
// not shift the page. Deliberately small and local: this is the only screen
// with these exact shapes, and the shared page-skeletons module holds the
// FULL-PAGE variants, which is exactly what this screen no longer uses.

/** A single figure inside an already-rendered stat card. */
function StatValue({
  loading,
  children,
  className,
}: {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (loading) return <Skeleton className="h-7 w-28 my-0.5" />;
  return <div className={className}>{children}</div>;
}

/** Placeholder cards for "My Collections" while /collections is in flight. */
function CollectionCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-44 rounded-2xl" />
      ))}
    </div>
  );
}

/** Placeholder rows for the activity feed, matching its 3.5rem row height. */
function ActivityRowsSkeleton() {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="shrink-0 space-y-1.5 text-right">
            <Skeleton className="ml-auto h-3.5 w-16" />
            <Skeleton className="ml-auto h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.user_metadata?.firstName ||
    user?.email?.split("@")[0] ||
    "there";
  // Performance wave (2026-08-20): per-section flags instead of one page-wide
  // `isLoading`. The three dashboard requests resolve at different times, so
  // each section now renders the moment ITS data lands — see
  // useDashboardHomeStore's PROGRESSIVE COMMIT note. The page shell, greeting,
  // workspace badge and action buttons are never replaced by a skeleton, which
  // is what makes a workspace switch feel immediate rather than like a reload.
  const {
    stats,
    activities,
    recentCollections,
    statsLoading,
    collectionsLoading,
    activitiesLoading,
    loadDashboardHome,
  } = useDashboardHomeStore();
  const [isGlobalWithdrawOpen, setIsGlobalWithdrawOpen] = useState(false);
  // Wave 6.2 — drives reload + realtime re-keying on workspace switch.
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  // Wave 6.6 — which actions this workspace entitles the user to.
  const { canCreateCollection, canRequestWithdrawal, canSeeMoney } =
    useWorkspaceCapabilities();

  useEffect(() => {
    const userId = user?.id || getStoredUserId();
    void loadDashboardHome(userId);

    // ── Realtime (wave 6.7F.8) ───────────────────────────────────────────────
    //
    // Refreshes are COALESCED and WORKSPACE-SCOPED. Previously every event on
    // contributions/wallets/collections fired its own forced reload of all
    // three dashboard endpoints, unfiltered — so a burst of contributions
    // produced a burst of identical request triples, and a user with
    // collections in more than one workspace refetched workspace A every time
    // something happened in workspace B.
    //
    // The refresh stays `silent: true`, so figures already on screen are
    // updated in place rather than being replaced by skeletons.
    const refresh = createCoalescer(() => {
      void loadDashboardHome(userId, { force: true, silent: true });
    });

    // Read the scope at EVENT TIME, not effect time: the collection list
    // arrives after this effect runs, and a stale closure would leave the set
    // permanently empty (which fails open — correct, but pointless).
    const inScope = (payload: unknown) =>
      shouldHandleRealtimeEvent(
        payload as any,
        collectionIdSet(useDashboardHomeStore.getState().workspaceCollectionIds),
      );

    const onScopedChange = (payload: unknown) => {
      if (!inScope(payload)) return;
      refresh.schedule();
    };

    const rtChannel = supabase
      .channel(`dashboard-rt-${userId || "guest"}-${activeWorkspaceId ?? "none"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contributions" },
        onScopedChange,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contributions" },
        onScopedChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets" },
        onScopedChange,
      )
      .on(
        // Collection status/target/limit changes refresh the dashboard cards.
        //
        // This is the ONE subscription that can be scoped server-side:
        // `collections` actually has a `workspace_id` column, so Realtime can
        // filter it before the event ever reaches the browser. The other three
        // tables carry only `collection_id` and are scoped client-side above.
        // When no workspace has resolved yet the filter is omitted rather than
        // guessed, preserving the previous unfiltered behaviour for that case.
        "postgres_changes",
        activeWorkspaceId
          ? {
              event: "UPDATE",
              schema: "public",
              table: "collections",
              filter: `workspace_id=eq.${activeWorkspaceId}`,
            }
          : { event: "UPDATE", schema: "public", table: "collections" },
        () => {
          refresh.schedule();
        },
      )
      .subscribe();

    return () => {
      refresh.cancel();
      supabase.removeChannel(rtChannel);
    };
    // Wave 6.2: activeWorkspaceId is a dependency so a switch re-runs this —
    // reloading the dashboard under the new workspace and re-keying the
    // realtime channel. The store reset has already cleared `stats` etc., so
    // the skeleton shows rather than the previous workspace's figures.
  }, [user?.id, activeWorkspaceId, loadDashboardHome]);

  // NOTE: there is deliberately no `if (loading) return <DashboardHomeSkeleton/>`
  // early return here any more. Replacing the whole page — greeting, workspace
  // badge, create-collection shortcuts and all — with a skeleton on every
  // workspace switch is precisely the "I clicked and the page vanished"
  // experience this wave set out to remove. The static shell renders
  // immediately and only the data-backed sections below show skeletons.

  return (
    <div className="space-y-8 pb-8">
      <KycEnforcementBanner />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Good day,</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize">
            {firstName} 👋
          </h1>
          {/* Which workspace this dashboard's numbers belong to. Shown here
              because the figures below are workspace-scoped, and a user acting
              in the wrong workspace should be able to notice immediately. */}
          <ActiveWorkspaceBadge className="mt-2" />
        </div>
        {/* Wave 6.6 — capability-gated actions. Both are enforced server-side
            regardless: /withdrawals/request keeps its collection-ownership
            check, and create-collection asserts collection:create. */}
        <div className="flex items-center gap-2">
          {canRequestWithdrawal && (
            <Button
              size="sm"
              onClick={() => setIsGlobalWithdrawOpen(true)}
              className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
            >
              <Banknote className="w-4 h-4" />
              Withdrawal
            </Button>
          )}
          {canCreateCollection && (
            <Button
              size="sm"
              className="bg-kolekto hover:bg-kolekto/90 flex items-center gap-1.5 shadow-sm hidden md:flex"
              onClick={() => navigate("/dashboard/create-collection")}
            >
              <Plus className="w-4 h-4" /> Create Collection
            </Button>
          )}
        </div>
      </div>

      {/* ── Wallet Summary ──────────────────────────────────────────────────────── */}
      {/* Wave 6.6 — the three balance cards render only with transaction:read.
          The backend already omits these fields for callers without it, so
          without this guard they would format as "₦NaN". The Collections card
          below is NOT gated: counts are not money, and a money-free dashboard
          must still be a useful one. */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {canSeeMoney && (
          <>
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">
              Total Balance
            </CardTitle>
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <WalletCards className="h-4 w-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <StatValue loading={statsLoading} className="text-xl font-bold text-gray-900">
              {fmt(stats.totalBalance)}
            </StatValue>
            <p className="text-xs text-gray-400 mt-0.5">
              across all collections
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-green-700">
              Available Balance
            </CardTitle>
            <div className="p-1.5 bg-green-100 rounded-lg">
              <Wallet className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <StatValue loading={statsLoading} className="text-xl font-bold text-green-700">
              {fmt(stats.availableBalance)}
            </StatValue>
            <p className="text-xs text-green-600/70 mt-0.5">
              ready to withdraw
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-yellow-700">
              Pending Balance
            </CardTitle>
            <div className="p-1.5 bg-yellow-100 rounded-lg">
              <History className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <StatValue loading={statsLoading} className="text-xl font-bold text-yellow-700">
              {fmt(stats.pendingBalance)}
            </StatValue>
            <p className="text-xs text-yellow-600/70 mt-0.5">
              awaiting settlement
            </p>
          </CardContent>
        </Card>
          </>
        )}

        <Card
          className="border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between group cursor-pointer"
          onClick={() => navigate("/dashboard/collections")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Target className="w-16 h-16 text-kolekto" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 relative z-10">
            <CardTitle className="text-xs font-medium text-gray-500">
              Your Collections
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 relative z-10">
            {/* Counts come from EITHER /dashboard/stats or, while that is
                still in flight, the /collections list — so this card waits
                only for whichever answers first. */}
            <StatValue
              loading={statsLoading && collectionsLoading}
              className="text-2xl font-bold text-gray-900"
            >
              {stats.totalCollections}
            </StatValue>
            {statsLoading && collectionsLoading ? (
              <Skeleton className="mt-1.5 h-3 w-20" />
            ) : (
              <p className="text-xs text-kolekto font-medium mt-0.5 flex items-center gap-1 hover:underline">
                {stats.activeCollections} active{" "}
                <ChevronRight className="w-3 h-3" />
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions — Create a Collection ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Create a Collection
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose a type to get started
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1">
          {Object.entries(TYPE_META).map(([key, m]) => {
            const Icon = m.IconEl;
            return (
              <Link
                key={key}
                to={`/dashboard/create-collection?type=${key}`}
                state={{ skipToBasicInfo: true }}
                className="flex flex-col items-center gap-2 flex-1 min-w-0 py-2 px-1 rounded-2xl active:scale-95 transition-transform hover:opacity-80"
              >
                <div
                  className={`flex items-center justify-center w-[50px] h-[50px] rounded-2xl ${m.bgColor} shadow-sm`}
                >
                  <Icon className={`h-6 w-6 ${m.iconColor}`} />
                </div>
                <span
                  className={`text-[11px] font-semibold ${m.iconColor} text-center leading-tight`}
                >
                  {m.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── My Collections ────────────────────────────────────────────────────── */}
      {/* While /collections is in flight the heading and three placeholder
          cards render, so the section holds its place instead of the rest of
          the page jumping up and then back down when the data lands. */}
      {collectionsLoading && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              My Collections
            </h2>
          </div>
          <CollectionCardsSkeleton />
        </div>
      )}

      {!collectionsLoading && recentCollections.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              My Collections
            </h2>
            <Link
              to="/dashboard/collections"
              className="text-xs font-medium text-kolekto hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentCollections.map((col) => {
              const m = TYPE_META[col.collection_type] ?? TYPE_META.fixed;
              const Icon = m.IconEl;
              // Canonical status (folds full/expired into the raw lifecycle
              // status) — never print collections.status directly, see
              // src/utils/collectionStatus.ts.
              const { label: sLabel, className: sCls } = getCollectionStatusMeta({
                status: col.status,
                deadline: col.deadline,
                collection_type: col.collection_type,
                maxParticipants: col.maxParticipants ?? null,
                participantsCount: col.participants,
                goalAmount: col.goalAmount ?? null,
                totalRaised: col.totalRaised,
              });

              return (
                <div
                  key={col.id}
                  onClick={() => navigate(`/dashboard/collections/${col.id}`)}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md
                    transition-all cursor-pointer flex flex-col overflow-hidden
                    border-l-4 ${m.accentBorder}`}
                >
                  {/* Coloured header */}
                  <div
                    className={`bg-gradient-to-r ${m.gradient} px-4 py-2.5 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-2 text-white/90">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">
                        {m.label}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sCls}`}
                    >
                      {sLabel}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3 flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1 mb-2">
                      {col.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className={`font-bold ${m.amountCls}`}>
                        {fmt(col.totalRaised)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {col.participants}
                      </span>
                    </div>
                    {col.deadline && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1.5">
                        <CalendarDays className="w-3 h-3" />
                        {fmtDate(col.deadline)}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="px-4 pb-3 pt-1.5 flex items-center justify-between border-t border-gray-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-gray-400">
                      {fmtDate(col.created_at)}
                    </span>
                    <button
                      className={`text-[11px] font-medium flex items-center gap-1 ${m.amountCls} hover:opacity-80`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/collections/${col.id}?share=true`);
                      }}
                    >
                      <Share2 className="w-3 h-3" /> Share
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-green-100 text-green-700 hover:bg-green-50 hover:text-green-800"
              onClick={() => navigate("/dashboard/collections")}
            >
              View All Collections <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Recent Activity ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Recent Activities
          </h2>
          {!activitiesLoading && activities.length > 0 && (
            <button
              onClick={() => navigate("/dashboard/activities")}
              className="text-xs font-semibold text-green-600 hover:text-green-700 flex items-center gap-1"
            >
              Show More →
            </button>
          )}
        </div>
        <Card className="border-gray-200">
          <CardContent className="p-0">
            {/* The empty state and the loading state must be distinguishable:
                showing "No contributions yet" while the feed is still loading
                tells the user something false about their own money. */}
            {activitiesLoading ? (
              <ActivityRowsSkeleton />
            ) : activities.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">
                  No contributions yet
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Share your collection link to receive payments
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {activities.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-4 py-3.5 gap-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-700 font-semibold text-xs">
                          {(a.name || a.email || "A")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {a.name || a.email || "Anonymous"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          paid to{" "}
                          <span className="font-medium text-gray-600">
                            {a.collection_title}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-600">
                        +{fmt(a.amount)}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {a.relative_time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!activitiesLoading && activities.length > 5 && (
              <div className="border-t border-gray-50 p-3">
                <button
                  onClick={() => navigate("/dashboard/activities")}
                  className="w-full text-xs font-semibold text-gray-500 hover:text-green-600 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                >
                  Show All {activities.length} Activities →
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <WithdrawFundsDialog
        open={isGlobalWithdrawOpen}
        onOpenChange={setIsGlobalWithdrawOpen}
        availableBalance={0} // Not used for global since we'll require collection selection
        onComplete={() => {
          setIsGlobalWithdrawOpen(false);
          void loadDashboardHome(user?.id || getStoredUserId(), {
            force: true,
            silent: true,
          });
        }}
      />
    </div>
  );
};

export default DashboardPage;
