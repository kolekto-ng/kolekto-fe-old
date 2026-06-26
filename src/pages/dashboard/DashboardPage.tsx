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
import { useAuthStore } from "@/store/useAuthStore";
import { DashboardHomeSkeleton } from "@/components/ui/page-skeletons";
import { useDashboardHomeStore } from "@/store/useDashboardHomeStore";
import { getCollectionStatusMeta } from "@/utils/collectionStatus";

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

// ── Component ────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.user_metadata?.firstName ||
    user?.email?.split("@")[0] ||
    "there";
  const {
    stats,
    activities,
    recentCollections,
    isLoading: loading,
    loadDashboardHome,
  } = useDashboardHomeStore();
  const [isGlobalWithdrawOpen, setIsGlobalWithdrawOpen] = useState(false);

  useEffect(() => {
    const userId = user?.id || getStoredUserId();
    void loadDashboardHome(userId);

    const rtChannel = supabase
      .channel(`dashboard-rt-${userId || "guest"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contributions" },
        () => {
          void loadDashboardHome(userId, { force: true, silent: true });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contributions" },
        () => {
          void loadDashboardHome(userId, { force: true, silent: true });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets" },
        () => {
          void loadDashboardHome(userId, { force: true, silent: true });
        },
      )
      .on(
        // Collection status/target/limit changes refresh the dashboard cards.
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "collections" },
        () => {
          void loadDashboardHome(userId, { force: true, silent: true });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rtChannel);
    };
  }, [user?.id, loadDashboardHome]);

  if (loading) {
    return <DashboardHomeSkeleton />;
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Good day,</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize">
            {firstName} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsGlobalWithdrawOpen(true)}
            className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
          >
            <Banknote className="w-4 h-4" />
            Withdrawal
          </Button>
          <Button
            size="sm"
            className="bg-kolekto hover:bg-kolekto/90 flex items-center gap-1.5 shadow-sm hidden md:flex"
            onClick={() => navigate("/dashboard/create-collection")}
          >
            <Plus className="w-4 h-4" /> Create Collection
          </Button>
        </div>
      </div>

      {/* ── Wallet Summary ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
            <div className="text-xl font-bold text-gray-900">
              {fmt(stats.totalBalance)}
            </div>
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
            <div className="text-xl font-bold text-green-700">
              {fmt(stats.availableBalance)}
            </div>
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
            <div className="text-xl font-bold text-yellow-700">
              {fmt(stats.pendingBalance)}
            </div>
            <p className="text-xs text-yellow-600/70 mt-0.5">
              awaiting settlement
            </p>
          </CardContent>
        </Card>

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
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalCollections}
            </div>
            <p className="text-xs text-kolekto font-medium mt-0.5 flex items-center gap-1 hover:underline">
              {stats.activeCollections} active{" "}
              <ChevronRight className="w-3 h-3" />
            </p>
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
      {recentCollections.length > 0 && (
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
          {activities.length > 0 && (
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
            {activities.length === 0 ? (
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
            {activities.length > 5 && (
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
