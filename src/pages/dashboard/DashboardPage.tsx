import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lock, Layers, Waves, Ticket, Heart, Target,
  TrendingUp, Wallet, BarChart3, Loader2, ChevronRight,
  Plus, Share2, Users, CalendarDays, WalletCards, History, Banknote
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import { useAuthStore } from '@/store/useAuthStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
}

function fmtDateTime(d: string) {
  try {
    return new Date(d).toLocaleString('en-NG', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return d;
  }
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem('kolekto-auth-token');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user?.id || parsed?.id || null;
  } catch {
    return null;
  }
}

// ── Collection-type visual config ────────────────────────────────────────────

const TYPE_META: Record<string, {
  label: string;
  description: string;
  IconEl: React.ElementType;
  gradient: string;
  accentBorder: string;
  amountCls: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
}> = {
  fixed: {
    label: 'Fixed',
    description: 'One fixed amount per contributor',
    IconEl: Lock,
    gradient: 'from-blue-500 to-blue-700',
    accentBorder: 'border-l-blue-500',
    amountCls: 'text-blue-700',
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  tiered: {
    label: 'Tiered',
    description: 'Multiple pricing tiers',
    IconEl: Layers,
    gradient: 'from-purple-500 to-purple-700',
    accentBorder: 'border-l-purple-500',
    amountCls: 'text-purple-700',
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  open_pool: {
    label: 'Open Pool',
    description: 'Contributors choose their amount',
    IconEl: Waves,
    gradient: 'from-cyan-500 to-cyan-700',
    accentBorder: 'border-l-cyan-500',
    amountCls: 'text-cyan-700',
    iconColor: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
  ticket: {
    label: 'Ticket',
    description: 'Event tickets with QR codes',
    IconEl: Ticket,
    gradient: 'from-orange-500 to-orange-600',
    accentBorder: 'border-l-orange-500',
    amountCls: 'text-orange-700',
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  fundraising: {
    label: 'Fundraising',
    description: 'Campaign-style crowdfunding',
    IconEl: Heart,
    gradient: 'from-rose-500 to-rose-700',
    accentBorder: 'border-l-rose-500',
    amountCls: 'text-rose-700',
    iconColor: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-200 text-gray-600',
  deleted: 'bg-gray-300 text-gray-600',
  pending_review: 'bg-amber-100 text-amber-700',
};

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
}

interface CollectionPreview {
  id: string;
  title: string;
  status: string;
  collection_type: string;
  totalRaised: number;
  participants: number;
  deadline?: string;
  created_at: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const firstName = (user?.user_metadata?.full_name?.split(' ')[0]
    || user?.user_metadata?.firstName
    || user?.email?.split('@')[0]
    || 'there');
  const [stats, setStats] = useState<DashStats>({
    totalCollections: 0, activeCollections: 0, totalBalance: 0, availableBalance: 0, pendingBalance: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentCollections, setRecentCollections] = useState<CollectionPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGlobalWithdrawOpen, setIsGlobalWithdrawOpen] = useState(false);

  useEffect(() => {
    const userId = getStoredUserId();
    if (!userId) { setLoading(false); return; }

    const load = async () => {
      try {
        /* ── 1. Fetch user collections (light query) ─────────────────────── */
        const { data: collectionsRaw, error: colErr } = await supabase
          .from('collections')
          .select('id, title, status, collection_type, deadline, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (colErr) console.error('Collections fetch error:', colErr.message);

        const cols: any[] = collectionsRaw || [];
        const totalCollections = cols.length;
        const activeCollections = cols.filter((c: any) => c.status === 'active').length;
        const collectionIds: string[] = cols.map((c: any) => c.id);
        const titleMap: Record<string, string> = {};
        for (const c of cols) titleMap[c.id] = c.title;

        /* ── 2. Authoritative figures from paid contributions ───────────────
           Total balance = sum of net amounts received (same source as
           individual collection pages — wallet.ledger_balance can be stale
           if the wallet upsert fails after a payment, so contributions.amount
           is the ground truth). ─────────────────────────────────────────── */
        const { data: paidContribs } = await supabase
          .from('contributions')
          .select('amount, collection_id')
          .in('collection_id', collectionIds.length > 0 ? collectionIds : ['_none_'])
          .eq('status', 'paid');

        // Total received = authoritative sum of contribution net amounts
        const totalBalance = (paidContribs || []).reduce(
          (s: number, c: any) => s + Number(c.amount || 0), 0
        );

        /* ── Fetch wallets for settlement-state balances (available / pending).
           These depend on T+1 cutoff logic computed server-side so they must
           come from the wallet rows, not contributions. ─────────────────── */
        let availableBalance = 0;
        let pendingBalance = 0;

        if (collectionIds.length > 0) {
          const { data: walletRows } = await supabase
            .from('wallets')
            .select('collection_id, available_balance, pending_balance, updated_at')
            .in('collection_id', collectionIds)
            .order('updated_at', { ascending: false });

          const latestWalletByCol: Record<string, any> = {};
          for (const w of walletRows || []) {
            if (!latestWalletByCol[w.collection_id]) latestWalletByCol[w.collection_id] = w;
          }
          for (const w of Object.values(latestWalletByCol) as any[]) {
            availableBalance += Number(w.available_balance || 0);
            pendingBalance += Number(w.pending_balance || 0);
          }
        }

          /* ── 4. Build per-collection preview data ─────────────────────── */
          const contribsByCol: Record<string, any[]> = {};
          for (const c of (paidContribs || [])) {
            if (!contribsByCol[c.collection_id]) contribsByCol[c.collection_id] = [];
            contribsByCol[c.collection_id].push(c);
          }

          setRecentCollections(
            cols.slice(0, 6).map((c: any) => {
              const cList = contribsByCol[c.id] || [];
              // totalRaised: sum contributions.amount (authoritative net figure, no fees).
              // Do NOT use wallet.net_payment — wallet may be zero if upsert failed.
              const totalRaised = cList.reduce((s: number, contrib: any) => s + Number(contrib.amount || 0), 0);
              return {
                id: c.id,
                title: c.title,
                status: c.status,
                collection_type: c.collection_type || 'fixed',
                totalRaised,
                participants: cList.length,
                deadline: c.deadline,
                created_at: c.created_at,
              };
            }),
          );

          /* ── 5. Recent activity feed ──────────────────────────────────── */
          const { data: contribs } = await supabase
            .from('contributions')
            .select('id, name, email, amount, gross_amount, created_at, collection_id')
            .in('collection_id', collectionIds)
            .eq('status', 'paid')
            .order('created_at', { ascending: false })
            .limit(10);

          setActivities(
            (contribs || []).map((cn: any) => ({
              id: cn.id,
              name: cn.name || '',
              email: cn.email || '',
              // Activity section shows full checkout amount (including fees) per spec.
              // gross_amount = totalPayable; fallback to amount for legacy rows.
              amount: Number(cn.gross_amount || cn.amount) || 0,
              created_at: cn.created_at,
              collection_title: titleMap[cn.collection_id] || 'Unknown',
            })),
          );

        setStats({ totalCollections, activeCollections, totalBalance, availableBalance, pendingBalance });
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();

    // ── Real-time: re-run load() whenever a contribution or wallet changes ──
    // This ensures the host dashboard updates automatically after every payment
    // without requiring a manual refresh.
    const userId2 = userId; // capture for closure
    const rtChannel = supabase
      .channel(`dashboard-rt-${userId2}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contributions' },
        () => { load(); }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contributions' },
        () => { load(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'wallets' },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(rtChannel); };
  }, []);

  /* ── Loading state ────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-8 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Good day,</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize">{firstName} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsGlobalWithdrawOpen(true)}
            className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
          >
            <Banknote className="w-4 h-4" />
            <span className="hidden sm:inline">Withdraw</span>
          </Button>
          <Button
            size="sm"
            className="bg-kolekto hover:bg-kolekto/90 flex items-center gap-1.5 shadow-sm hidden md:flex"
            onClick={() => navigate('/dashboard/create-collection')}
          >
            <Plus className="w-4 h-4" /> Create Collection
          </Button>
        </div>
      </div>

      {/* ── Wallet Summary ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Total Balance</CardTitle>
            <div className="p-1.5 bg-gray-100 rounded-lg"><WalletCards className="h-4 w-4 text-gray-500" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-gray-900">{fmt(stats.totalBalance)}</div>
            <p className="text-xs text-gray-400 mt-0.5">across all collections</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-green-700">Available Balance</CardTitle>
            <div className="p-1.5 bg-green-100 rounded-lg"><Wallet className="h-4 w-4 text-green-600" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-green-700">{fmt(stats.availableBalance)}</div>
            <p className="text-xs text-green-600/70 mt-0.5">ready to withdraw</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-yellow-700">Pending Balance</CardTitle>
            <div className="p-1.5 bg-yellow-100 rounded-lg"><History className="h-4 w-4 text-yellow-600" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-yellow-700">{fmt(stats.pendingBalance)}</div>
            <p className="text-xs text-yellow-600/70 mt-0.5">awaiting settlement</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between group cursor-pointer" onClick={() => navigate('/dashboard/collections')}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Target className="w-16 h-16 text-kolekto" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 relative z-10">
            <CardTitle className="text-xs font-medium text-gray-500">Your Collections</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 relative z-10">
            <div className="text-2xl font-bold text-gray-900">{stats.totalCollections}</div>
            <p className="text-xs text-kolekto font-medium mt-0.5 flex items-center gap-1 hover:underline">
              {stats.activeCollections} active <ChevronRight className="w-3 h-3" />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions — Create a Collection ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create a Collection</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose a collection type to get started</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(TYPE_META).map(([key, m]) => {
            const Icon = m.IconEl;
            return (
              <Link
                key={key}
                to={`/dashboard/create-collection?type=${key}`}
                state={{ skipToBasicInfo: true }}
                className={`group flex flex-col items-center gap-2.5 p-4 rounded-xl border
                  ${m.borderColor} ${m.bgColor} cursor-pointer transition-all
                  hover:shadow-md hover:scale-[1.02] active:scale-[0.98]`}
              >
                <div className={`p-2.5 rounded-xl bg-white shadow-sm border ${m.borderColor}`}>
                  <Icon className={`h-5 w-5 ${m.iconColor}`} />
                </div>
                <div className="text-center">
                  <p className={`text-xs font-bold ${m.iconColor} leading-tight`}>{m.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug hidden sm:block">
                    {m.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── My Collections ────────────────────────────────────────────────────── */}
      {recentCollections.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">My Collections</h2>
            <Link
              to="/dashboard/collections"
              className="text-xs font-medium text-kolekto hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentCollections.map(col => {
              const m = TYPE_META[col.collection_type] ?? TYPE_META.fixed;
              const Icon = m.IconEl;
              const sCls = STATUS_COLORS[col.status] ?? 'bg-gray-100 text-gray-700';
              const sLabel = col.status
                ? col.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                : '—';

              return (
                <div
                  key={col.id}
                  onClick={() => navigate(`/dashboard/collections/${col.id}`)}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md
                    transition-all cursor-pointer flex flex-col overflow-hidden
                    border-l-4 ${m.accentBorder}`}
                >
                  {/* Coloured header */}
                  <div className={`bg-gradient-to-r ${m.gradient} px-4 py-2.5 flex items-center justify-between`}>
                    <div className="flex items-center gap-2 text-white/90">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">{m.label}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sCls}`}>
                      {sLabel}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3 flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1 mb-2">
                      {col.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className={`font-bold ${m.amountCls}`}>{fmt(col.totalRaised)}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{col.participants}</span>
                    </div>
                    {col.deadline && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1.5">
                        <CalendarDays className="w-3 h-3" />{fmtDate(col.deadline)}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="px-4 pb-3 pt-1.5 flex items-center justify-between border-t border-gray-50"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-gray-400">{fmtDate(col.created_at)}</span>
                    <button
                      className={`text-[11px] font-medium flex items-center gap-1 ${m.amountCls} hover:opacity-80`}
                      onClick={e => {
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
        </div>
      )}

      {/* ── Recent Activity ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <Card className="border-gray-200">
          <CardContent className="p-0">
            {activities.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">No contributions yet</p>
                <p className="text-xs text-gray-400 mt-1">Share your collection link to receive payments</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {activities.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3.5 gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-700 font-semibold text-xs">
                          {(a.name || a.email || 'A')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {a.name || a.email || 'Anonymous'}
                        </p>
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                          ✅ <span className="font-medium text-gray-600">{a.collection_title}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-600">{fmt(a.amount)}</p>
                      <p className="text-[11px] text-gray-400">
                        {(() => {
                          try {
                            return formatDistanceToNow(new Date(a.created_at), { addSuffix: true });
                          } catch {
                            return fmtDateTime(a.created_at);
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                ))}
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
          // Could refresh dashboard state here
          setTimeout(() => window.location.reload(), 1500);
        }}
      />
    </div>
  );
};

export default DashboardPage;
