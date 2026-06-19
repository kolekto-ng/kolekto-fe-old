import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { toast } from 'sonner';
import {
  Wallet, Share2, Edit, ScanLine, Download, Search, ChevronDown,
  ArrowLeft, Users, Calendar, Clock, TrendingUp,
  CheckCircle2, AlertCircle, LogIn, LogOut, MoreVertical, Copy, X,
  Link2, Tag, Flag, MessageCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { axiosInstance } from '@/utils/axios';
import { useCollectionStore } from '@/store/useCollectionStore';
import {
  getCollectionContributorFields,
  getContributorFieldValue,
  normalizeContributions,
} from '@/utils/contributions';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import QRCodeDisplay from '@/components/collections/QRCodeDisplay';
import EditCollectionDialog from '@/components/collections/EditCollectionDialog';
import FundraisingShareDialog from '@/components/collections/FundraisingShareDialog';
import {
  ActivityListSkeleton,
  CollectionDetailsSkeleton,
  TableRowsSkeleton,
} from '@/components/ui/page-skeletons';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NG', { dateStyle: 'long' });
}

function fmtDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function daysLeft(deadline?: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-200 text-gray-700',
  deleted: 'bg-gray-300 text-gray-800',
  pending_review: 'bg-amber-100 text-amber-800',
};

const CHECK_IN_COLORS: Record<string, string> = {
  not_checked_in: 'bg-gray-100 text-gray-600',
  checked_in: 'bg-green-100 text-green-700',
  checked_out: 'bg-blue-100 text-blue-700',
};

const CHECK_IN_LABELS: Record<string, string> = {
  not_checked_in: 'Not Checked In',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}> = ({ icon, label, value, sub, highlight }) => (
  <div className={`rounded-xl border p-4 flex items-start gap-3 ${highlight ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
    <div className={`p-2 rounded-lg ${highlight ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold leading-tight ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Progress Bar ────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ raised: number; target: number }> = ({ raised, target }) => {
  const pct = Math.min((raised / target) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-900">{fmtCurrency(raised)} raised</span>
        <span className="text-gray-500">of {fmtCurrency(target)} target</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-600 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 text-right">{pct.toFixed(1)}% funded</p>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const CollectionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { updateCollectionStatus, collections } = useCollectionStore() as any;

  const [col, setCol] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingContribs, setLoadingContribs] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scannedTicket, setScannedTicket] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isFlierOpen, setIsFlierOpen] = useState(false);
  const [balanceStats, setBalanceStats] = useState<{
    totalRaised: number;
    totalBalance: number;
    availableBalance: number;
    pendingBalance: number;
    withdrawn: number;
    pendingWithdrawalRequests: number;
  } | null>(null);

  const colType: string = col?.collection_type || (col?.type === 'tiered' ? 'tiered' : 'fixed');
  const visibleContributorFields = getCollectionContributorFields(col);
  const priceTiers: any[] = col?.pricing_tiers || [];
  // Pick the most-recently-updated wallet row (guards against duplicate rows)
  const walletRows: any[] = Array.isArray(col?.wallets) ? col.wallets : (col?.wallets ? [col.wallets] : []);
  const wallet = walletRows.slice().sort((a: any, b: any) =>
    new Date(b?.updated_at || 0).getTime() - new Date(a?.updated_at || 0).getTime()
  )[0] || {};
  const ledgerBalance = Number(balanceStats?.totalBalance ?? wallet?.ledger_balance ?? 0);
  const availableBalance = Number(balanceStats?.availableBalance ?? wallet?.available_balance ?? 0);
  const pendingBalance = Number(balanceStats?.pendingBalance ?? wallet?.pending_balance ?? 0);
  // `withdrawn` is the running total of all completed/approved withdrawals
  // for this collection — sourced from /dashboard/collections/:id/stats so
  // it stays consistent with the same source-of-truth math the wallet
  // refresher uses. Falls back to wallets.withdrawn for legacy rows that
  // haven't been hit by a stats fetch yet.
  const withdrawnAmount = Number(balanceStats?.withdrawn ?? wallet?.withdrawn ?? 0);
  const pendingWithdrawalRequests = Number(balanceStats?.pendingWithdrawalRequests ?? 0);
  const shareUrl = `${window.location.origin}/contribute/${col?.slug || id}`;

  const handleWhatsAppShare = () => {
    const collectionName = col?.title || 'this collection';
    const message = `Hi, please make your contribution for ${collectionName} using this Kolekto link: ${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const loadWallet = async () => {
    if (!id) return;
    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('collection_id', id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCol((prev: any) => prev ? { ...prev, wallets: walletData ? [walletData] : [] } : prev);
  };

  const loadContributions = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('contributions')
      .select('*')
      .eq('collection_id', id)
      .order('created_at', { ascending: false });
    setContributions(normalizeContributions(data));
    setLoadingContribs(false);
  };

  const loadBalanceStats = async () => {
    if (!id) return;
    try {
      const { data } = await axiosInstance.get(`/dashboard/collections/${id}/stats`);
      const stats = data?.data || data || {};
      setBalanceStats({
        totalRaised: Number(stats.totalRaised || 0),
        totalBalance: Number(stats.totalBalance || 0),
        availableBalance: Number(stats.availableBalance || 0),
        pendingBalance: Number(stats.pendingBalance || 0),
        withdrawn: Number(stats.withdrawn || 0),
        pendingWithdrawalRequests: Number(stats.pendingWithdrawalRequests || 0),
      });
    } catch (err) {
      console.error('Collection stats load error:', err);
    }
  };

  // ── Fetch data (always fresh — bypass store cache) ──────────────────────────

  const loadCollection = async () => {
    if (!id) return;
    // Load collection WITHOUT contributions join (loaded separately below)
    // Load wallet separately to get the latest row (sorted by updated_at)
    const [{ data, error }, { data: walletData }] = await Promise.all([
      supabase.from('collections').select('*').eq('id', id).single(),
      supabase.from('wallets').select('*').eq('collection_id', id)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (error) { toast.error('Failed to load collection'); setLoading(false); return; }
    setCol({
      ...data,
      wallets: walletData ? [walletData] : [],
      form_fields: Array.isArray(data.contributions_fields) ? data.contributions_fields : [],
      pricing_tiers: Array.isArray(data.price_tiers) ? data.price_tiers : [],
    });
    setLoading(false);
    loadBalanceStats();
  };

  useEffect(() => {
    if (!id) return;
    const cachedCollection = Array.isArray(collections)
      ? collections.find((collection: any) => collection.id === id)
      : null;

    if (cachedCollection) {
      setCol(cachedCollection);
      setLoading(false);
    } else {
      setLoading(true);
    }

    loadCollection();
    loadContributions();
    loadBalanceStats();

    const params = new URLSearchParams(location.search);
    if (params.get('share') === 'true') setIsShareOpen(true);
  }, [id]);

  // ── Real-time: refresh contributions + wallet on any change ─────────────────
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`col-details-${id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'contributions', filter: `collection_id=eq.${id}` },
        () => { loadContributions(); loadBalanceStats(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `collection_id=eq.${id}` },
        () => { loadWallet(); loadBalanceStats(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Computed values ─────────────────────────────────────────────────────────

  const paidContributions = contributions.filter(c => c.status === 'paid');
  const hasUniqueCode = paidContributions.some(c => c.contributor_unique_code);
  const contributorColumnCount =
    visibleContributorFields.length +
    (colType === 'tiered' ? 1 : 0) +
    (hasUniqueCode ? 1 : 0);
  // Authoritative: sum contributions.amount (net, no fees) from paid rows.
  // This is correct even when wallet hasn't been created yet or upsert failed.
  // Wallet balances (ledger/available/pending) still come from the wallet row
  // since they incorporate the T+1 settlement cutoff which is computed server-side.
  const totalRaised = balanceStats?.totalRaised ?? paidContributions.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const targetAmount = col?.target_amount ? Number(col.target_amount) : null;
  const deadline = col?.deadline || null;
  const remaining = daysLeft(deadline);

  // Tier matching — prefer stored Tier name in contributor_information, fall back to amount
  const getTierForContribution = (c: any): any => {
    if (!priceTiers.length) return null;
    const tierName = (c.contributor_information?.[0] as any)?.Tier;
    if (tierName) return priceTiers.find(t => t.name === tierName) || null;
    return priceTiers.find(t => Math.abs(Number(t.price) - Number(c.amount)) < 1) || null;
  };
  // Legacy helper used in CSV export
  const getTierForAmount = (amount: number): any => {
    if (!priceTiers.length) return null;
    return priceTiers.find(t => Math.abs(Number(t.price) - amount) < 1) || null;
  };

  // ── Tabs config ─────────────────────────────────────────────────────────────

  const tabs =
    colType === 'fundraising'
      ? [{ id: 'overview', label: 'Overview' }, { id: 'contributors', label: 'Contributors' }, { id: 'activities', label: 'Activities' }]
      : colType === 'ticket'
      ? [{ id: 'overview', label: 'Overview' }, { id: 'tickets', label: 'Tickets' }, { id: 'activities', label: 'Activities' }]
      : [{ id: 'overview', label: 'Overview' }, { id: 'contributors', label: 'Contributors' }, { id: 'activities', label: 'Activities' }];

  // ── Ticket check-in ─────────────────────────────────────────────────────────

  const updateCheckIn = async (contributionId: string, newStatus: string) => {
    const { error } = await supabase
      .from('contributions')
      .update({ check_in_status: newStatus })
      .eq('id', contributionId);
    if (error) { toast.error('Failed to update ticket status'); return; }
    setContributions(prev =>
      prev.map(c => c.id === contributionId ? { ...c, check_in_status: newStatus } : c)
    );
    toast.success(`Ticket marked as ${CHECK_IN_LABELS[newStatus]}`);
  };

  // ── QR Scan / ticket lookup ─────────────────────────────────────────────────

  const handleScanLookup = () => {
    const ticket = paidContributions.find(
      c => c.contributor_unique_code === scanInput.trim()
    );
    if (ticket) {
      setScannedTicket(ticket);
    } else {
      toast.error('No ticket found with that ID');
      setScannedTicket(null);
    }
  };

  // ── Export PDF ──────────────────────────────────────────────────────────────

  const exportPDF = async () => {
    const filtered = getFilteredContributors();
    if (!filtered.length) { toast.info('No contributor data to export'); return; }

    const exportFields = visibleContributorFields;
    const tierCol = colType === 'tiered' || colType === 'ticket';
    const exportHasUniqueCode = filtered.some(c => c.contributor_unique_code);
    if (exportFields.length === 0 && !tierCol && !exportHasUniqueCode) {
      toast.info('No host-defined contributor fields to export for this collection');
      return;
    }

    const headers = [
      ...exportFields.map((field: any) => field.name),
      ...(tierCol ? ['Tier'] : []),
      ...(exportHasUniqueCode ? ['Unique Code'] : []),
    ];

    const rows = filtered.map(c => {
      const tierName = getTierForContribution(c)?.name || '';
      return [
        ...exportFields.map((field: any) => getContributorFieldValue(c, field) || ''),
        ...(tierCol ? [tierName] : []),
        ...(exportHasUniqueCode ? [c.contributor_unique_code || ''] : []),
      ];
    });

    const exportDate = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
    const totalAmount = filtered.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    const tableRows = rows.map(row =>
      `<tr>${row.map(cell => `<td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:12px;color:#374151;">${cell}</td>`).join('')}</tr>`
    ).join('');

    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;padding:32px;background:#fff;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:20px;border-bottom:3px solid #16a34a;margin-bottom:24px;">
          <div>
            <div style="font-size:26px;font-weight:900;color:#16a34a;letter-spacing:-0.5px;">Kolekto</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px;">Contributors Export Report</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#6B7280;">Generated on</div>
            <div style="font-size:12px;font-weight:600;color:#111827;">${exportDate}</div>
          </div>
        </div>
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <div style="font-size:18px;font-weight:800;color:#14532D;margin-bottom:8px;">${col?.title || 'Collection'}</div>
          <div style="display:flex;gap:24px;">
            <div>
              <span style="font-size:11px;color:#6B7280;display:block;">Total Contributors</span>
              <span style="font-size:15px;font-weight:700;color:#166534;">${filtered.length}</span>
            </div>
            <div>
              <span style="font-size:11px;color:#6B7280;display:block;">Total Collected</span>
              <span style="font-size:15px;font-weight:700;color:#166534;">₦${totalAmount.toLocaleString('en-NG')}</span>
            </div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#16a34a;">
              ${headers.map(h => `<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;">
          <span style="font-size:11px;color:#9CA3AF;">Powered by Kolekto · kolekto.com.ng</span>
          <span style="font-size:11px;color:#9CA3AF;">Confidential — For authorized use only</span>
        </div>
      </div>
    `;

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = document.createElement('div');
      el.innerHTML = html;
      document.body.appendChild(el);
      await html2pdf().set({
        margin: 0,
        filename: `${col?.title || 'collection'}-contributors.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }).from(el).save();
      document.body.removeChild(el);
      toast.success('PDF exported successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF');
    }
  };

  // ── Filter helpers ──────────────────────────────────────────────────────────

  const getFilteredContributors = () => {
    let data = paidContributions;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(c => {
        const info = (c.contributor_information || [])[0] || {};
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          Object.values(info).some(v => String(v).toLowerCase().includes(q))
        );
      });
    }
    if (tierFilter !== 'all') {
      data = data.filter(c => getTierForContribution(c)?.name === tierFilter);
    }
    return data;
  };

  const getFilteredTickets = () => {
    let data = paidContributions;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.contributor_unique_code?.toLowerCase().includes(q)
      );
    }
    if (tierFilter !== 'all') {
      data = data.filter(c => getTierForContribution(c)?.name === tierFilter);
    }
    return data;
  };

  // ── Status actions ──────────────────────────────────────────────────────────

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateCollectionStatus(id!, newStatus);
      setCol((prev: any) => prev ? { ...prev, status: newStatus } : prev);
      toast.success(`Collection ${newStatus === 'active' ? 'resumed' : newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (!loading && !col) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-gray-400" />
        <p className="text-gray-500">Collection not found</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/collections')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Collections
        </Button>
      </div>
    );
  }

  if (loading) {
    return <CollectionDetailsSkeleton />;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const statusLabel = col?.status === 'pending_review' ? 'Pending Review'
    : col?.status ? col.status.charAt(0).toUpperCase() + col.status.slice(1) : 'Active';
  const collectionTypeLabel =
    colType === 'open_pool' ? 'Open Pool'
      : colType === 'fundraising' ? 'Fundraising'
      : colType === 'ticket' ? 'Ticketing'
      : colType === 'tiered' ? 'Tiered'
      : 'Fixed Amount';
  const createdDisplay = col?.created_at ? fmtDate(col.created_at) : 'Recently created';
  const deadlineDisplay = deadline ? fmtDate(deadline) : 'No deadline';
  const remainingLabel = remaining === null ? 'Open' : remaining <= 0 ? 'Ended' : `${remaining} day${remaining !== 1 ? 's' : ''}`;
  const remainingSub = remaining !== null && remaining <= 0 ? 'Collection has ended' : 'Time remaining';
  const amountLabel =
    colType === 'tiered' || colType === 'ticket'
      ? `${priceTiers.length} tier${priceTiers.length === 1 ? '' : 's'}`
      : colType === 'open_pool'
        ? fmtCurrency(Number(col.min_contribution || col.amount || 0))
        : fmtCurrency(Number(col.amount || 0));

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">

      {/* ── Back ───────────────────────────────────────────────────────────── */}


      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard/collections')}
          aria-label="Back to all collections"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-900 transition-all hover:bg-gray-100 active:scale-[0.96]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 text-xl font-semibold leading-tight text-gray-900 sm:text-2xl">Collection Details</h1>
      </div>

      <div className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm transition-shadow sm:p-5">
        <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-xl font-semibold leading-snug text-gray-950 sm:text-2xl">{col.title}</h2>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${STATUS_COLORS[col.status] || 'bg-gray-100 text-gray-700'}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {statusLabel}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Created on {createdDisplay}</p>
            {colType === 'ticket' && col.event_date && (
              <p className="mt-1 text-xs font-medium text-gray-500">Event: {fmtDate(col.event_date)}</p>
            )}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2.5 min-[380px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_3.25rem_3.25rem]">
          <Button
            size="sm"
            onClick={() => setIsWithdrawOpen(true)}
            disabled={availableBalance <= 0}
            className="min-h-12 min-w-0 justify-center gap-1.5 rounded-2xl bg-green-700 px-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-green-800 active:scale-[0.98] min-[380px]:px-3"
            aria-label="Withdraw"
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span className="hidden truncate min-[380px]:inline">Withdraw</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsShareOpen(true)}
            className="min-h-12 min-w-0 justify-center gap-1.5 rounded-2xl border-gray-200 px-2 text-sm font-medium text-gray-900 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98] min-[380px]:px-3"
            aria-label="Share collection"
          >
            <Share2 className="h-4 w-4 shrink-0" />
            <span className="hidden min-[380px]:inline">Share</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="min-h-12 min-w-0 justify-center rounded-2xl border-gray-200 px-2 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
            aria-label="Edit collection"
          >
            <Edit className="h-4 w-4 shrink-0" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="min-h-12 min-w-0 justify-center rounded-2xl border-gray-200 px-2 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]" aria-label="More collection actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {col.status !== 'active' && col.status !== 'pending_review' && (
                <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Resume Collection
                </DropdownMenuItem>
              )}
              {col.status === 'active' && (
                <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
                  <AlertCircle className="w-4 h-4 mr-2 text-yellow-600" /> Pause Collection
                </DropdownMenuItem>
              )}
              {col.status !== 'closed' && (
                <DropdownMenuItem onClick={() => handleStatusChange('closed')}>
                  <X className="w-4 h-4 mr-2 text-gray-600" /> Close Collection
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  if (paidContributions.length > 0) {
                    toast.error('Cannot delete a collection with existing payments. Close it instead.');
                  } else {
                    setDeleteConfirmOpen(true);
                  }
                }}
              >
                Delete Collection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(colType === 'ticket' || colType === 'fundraising') && (
          <div className="mt-3 flex flex-wrap gap-2">
            {colType === 'ticket' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setScanInput(''); setScannedTicket(null); setIsScanOpen(true); }}
                className="min-h-10 justify-center gap-1.5 rounded-xl border-gray-200"
              >
                <ScanLine className="w-4 h-4" />
                Scan QR
              </Button>
            )}

            {colType === 'fundraising' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsFlierOpen(true)}
                className="min-h-10 justify-center gap-1.5 rounded-xl border-green-600 text-green-700 hover:bg-green-50"
              >
                <Download className="w-4 h-4" />
                Campaign Flyer
              </Button>
            )}
          </div>
        )}

        {col.status === 'paused' && (
          <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            This collection is currently paused - contributors cannot make payments.
          </div>
        )}
      </div>

      <div className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-600">
              <Link2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-500">Collection Link</p>
              <p className="mt-1 break-all text-sm font-medium leading-relaxed text-gray-950 sm:text-base">{shareUrl}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="outline"
              onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied!'); }}
              className="min-h-12 justify-center gap-2 rounded-2xl border-gray-200 px-4 text-green-700 shadow-sm hover:bg-green-50"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="outline"
              onClick={handleWhatsAppShare}
              className="min-h-12 justify-center gap-2 rounded-2xl border-gray-200 px-4 text-green-700 shadow-sm hover:bg-green-50"
              aria-label="Share collection link on WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-gray-100 p-1">
          {tabs.map(t => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="min-h-11 rounded-xl px-2 py-2 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm sm:px-5 sm:text-sm"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-5">
      <div className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-gray-100">
          <div className="space-y-2 lg:pr-5">
            <p className="text-sm font-medium text-gray-500">Total Raised</p>
            <p className="break-words text-xl font-semibold leading-snug text-green-700">{fmtCurrency(totalRaised)}</p>
          </div>
          <div className="space-y-2 lg:px-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-700">
              <Users className="h-4 w-4" />
            </span>
            <p className="break-words text-xl font-semibold leading-snug text-gray-950">{paidContributions.length}</p>
            <p className="text-sm font-medium text-gray-500">
              {colType === 'fundraising' ? 'Donor' : colType === 'ticket' ? 'Ticket' : 'Contributor'}{paidContributions.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="space-y-2 lg:px-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-700">
              <Calendar className="h-4 w-4" />
            </span>
            <p className="break-words text-base font-semibold leading-snug text-gray-950">{deadlineDisplay}</p>
            <p className="text-sm font-medium text-gray-500">Deadline</p>
          </div>
          <div className="space-y-2 lg:pl-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-700">
              <Clock className="h-4 w-4" />
            </span>
            <p className="break-words text-xl font-semibold leading-snug text-gray-950">{remainingLabel}</p>
            <p className="text-sm font-medium text-gray-500">{remainingSub}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-green-100 bg-green-50/40 p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-gray-950">Wallet</h2>
        <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 divide-y divide-gray-100 min-[380px]:grid-cols-3 min-[380px]:gap-0 min-[380px]:divide-x min-[380px]:divide-y-0">
            <div className="min-w-0 pb-4 min-[380px]:pb-0 min-[380px]:pr-3">
              <p className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
                Available
              </p>
              <p className="mt-2 break-words text-lg font-semibold leading-snug text-green-700">{fmtCurrency(availableBalance)}</p>
            </div>
            <div className="min-w-0 py-4 min-[380px]:px-3 min-[380px]:py-0">
              <p className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Pending
              </p>
              <p className="mt-2 break-words text-lg font-semibold leading-snug text-amber-700">{fmtCurrency(pendingBalance)}</p>
              {pendingWithdrawalRequests > 0 && (
                <p className="mt-1 text-[10px] leading-tight text-amber-700">{fmtCurrency(pendingWithdrawalRequests)} awaiting approval</p>
              )}
            </div>
            <div className="min-w-0 pt-4 min-[380px]:pl-3 min-[380px]:pt-0">
              <p className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                Withdrawn
              </p>
              <p className="mt-2 break-words text-lg font-semibold leading-snug text-slate-600">{fmtCurrency(withdrawnAmount)}</p>
            </div>
          </div>
        </div>
        <Button
          disabled={availableBalance <= 0}
          onClick={() => setIsWithdrawOpen(true)}
          className="mt-4 min-h-[3.25rem] w-full justify-center gap-2 rounded-2xl bg-green-700 text-sm font-medium text-white shadow-sm hover:bg-green-800"
        >
          <Wallet className="h-5 w-5" />
          Withdraw Funds
        </Button>
      </div>

      <div className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-gray-950">Collection Information</h2>
        <div className="mt-4 divide-y divide-gray-100">
          <div className="flex flex-col gap-2 py-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500">
              <Tag className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 text-sm font-medium text-gray-500">Contribution Type</p>
            <p className="w-full break-words text-left text-sm font-medium text-gray-950 min-[380px]:max-w-[50%] min-[380px]:text-right">{collectionTypeLabel}</p>
          </div>
          <div className="flex flex-col gap-2 py-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500">
              <Wallet className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 text-sm font-medium text-gray-500">
              {colType === 'tiered' || colType === 'ticket' ? 'Pricing Structure' : colType === 'open_pool' ? 'Minimum Contribution' : 'Amount per Contributor'}
            </p>
            <p className="w-full break-words text-left text-sm font-medium text-gray-950 min-[380px]:max-w-[50%] min-[380px]:text-right">{amountLabel}</p>
          </div>
          <div className="flex flex-col gap-2 py-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500">
              <Calendar className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 text-sm font-medium text-gray-500">Collection Deadline</p>
            <p className="w-full break-words text-left text-sm font-medium text-gray-950 min-[380px]:max-w-[50%] min-[380px]:text-right">{deadlineDisplay}</p>
          </div>
          <div className="flex flex-col gap-2 py-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
              <Flag className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 text-sm font-medium text-gray-500">Status</p>
            <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[col.status] || 'bg-gray-100 text-gray-700'}`}>
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

          <div className="space-y-5">
          {loadingContribs ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <>
              {/* Fundraising banner + summary */}
              {colType === 'fundraising' && col.campaign_summary && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Campaign Summary</p>
                  <p className="text-gray-600 text-sm">{col.campaign_summary}</p>
                </div>
              )}

              {/* Ticket event info */}
              {colType === 'ticket' && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
                  {col.description && <p className="text-sm text-gray-600">{col.description}</p>}
                  {col.event_date && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Event Date:</span> {fmtDate(col.event_date)}
                    </p>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {targetAmount && targetAmount > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <ProgressBar raised={totalRaised} target={targetAmount} />
                </div>
              )}

              {/* Tiered breakdown */}
              {(colType === 'tiered' || (colType === 'ticket' && priceTiers.length > 0)) && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {colType === 'ticket' ? 'Ticket Sales by Tier' : 'Contributors by Tier'}
                  </p>
                  <div className="space-y-3">
                    {priceTiers.map(tier => {
                      const tierContribs = paidContributions.filter(c => getTierForContribution(c)?.name === tier.name);
                      const count = tierContribs.length;
                      const revenue = count * Number(tier.price);
                      return (
                        <div key={tier.id || tier.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{tier.name}</p>
                            <p className="text-xs text-gray-500">{fmtCurrency(Number(tier.price))} each</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">{count} {colType === 'ticket' ? 'tickets' : 'contributors'}</p>
                            <p className="text-xs text-green-600">{fmtCurrency(revenue)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </>
          )}
          </div>
        </TabsContent>

        {/* ── CONTRIBUTORS ────────────────────────────────────────────────── */}
        {colType !== 'fundraising' && colType !== 'ticket' && (
          <TabsContent value="contributors" className="mt-6 space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, phone…"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {colType === 'tiered' && priceTiers.length > 0 && (
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Filter by tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    {priceTiers.map(t => (
                      <SelectItem key={t.id || t.name} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" size="sm" onClick={exportPDF} className="flex items-center gap-1.5 border-green-300 text-green-700 hover:bg-green-50">
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
            </div>

            {/* Table */}
            {loadingContribs ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <Table>
                  <TableBody>
                    <TableRowsSkeleton rows={6} columns={Math.max(contributorColumnCount, 1)} />
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      {visibleContributorFields.map((field: any) => (
                        <TableHead key={field.id || field.name}>{field.name}</TableHead>
                      ))}
                      {colType === 'tiered' && <TableHead>Tier</TableHead>}
                      {hasUniqueCode && <TableHead>Unique Code</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contributorColumnCount === 0 ? (
                      <TableRow>
                        <TableCell colSpan={1} className="text-center py-10 text-gray-400">
                          No host-defined contributor fields were requested for this collection
                        </TableCell>
                      </TableRow>
                    ) : getFilteredContributors().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={contributorColumnCount} className="text-center py-10 text-gray-400">
                          No contributors yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      getFilteredContributors().map(c => {
                        const tier = getTierForContribution(c);
                        return (
                          <TableRow key={c.id}>
                            {visibleContributorFields.map((field: any) => (
                              <TableCell key={field.id || field.name}>
                                {getContributorFieldValue(c, field) || '-'}
                              </TableCell>
                            ))}
                            {colType === 'tiered' && (
                              <TableCell>
                                <Badge variant="outline">{tier?.name || '-'}</Badge>
                              </TableCell>
                            )}
                            {hasUniqueCode && (
                              <TableCell>
                                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                  {c.contributor_unique_code || '—'}
                                </span>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {/* ── FUNDRAISING CONTRIBUTORS ────────────────────────────────────── */}
        {colType === 'fundraising' && (
          <TabsContent value="contributors" className="mt-6 space-y-5">
            {loadingContribs ? (
              <ActivityListSkeleton count={5} />
            ) : paidContributions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">No contributors yet</p>
                <p className="text-gray-400 text-sm mt-1">Share your fundraising link to start receiving donations</p>
              </div>
            ) : (() => {
              const sortedByAmount = [...paidContributions].sort((a, b) => Number(b.amount) - Number(a.amount));
              const top3 = sortedByAmount.slice(0, 3);

              const isAnon = (c: any) => !c.name || c.name.trim() === '' || c.name.toLowerCase() === 'anonymous';
              const displayName = (c: any) => isAnon(c) ? 'Anonymous' : c.name;

              const searchFiltered = searchTerm
                ? sortedByAmount.filter(c => {
                    const q = searchTerm.toLowerCase();
                    return displayName(c).toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
                  })
                : sortedByAmount;

              const MEDAL = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

              return (
                <>
                  {/* Top Contributors */}
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Top Contributors</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {top3.map((c, i) => (
                        <div
                          key={c.id}
                          className={`flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border ${
                            i === 0 ? 'border-yellow-300' : i === 1 ? 'border-gray-300' : 'border-orange-200'
                          }`}
                        >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white text-sm ${
                            i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : 'bg-orange-400'
                          }`}>
                            {isAnon(c) ? '?' : displayName(c)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-base leading-none">{MEDAL[i]}</span>
                              <p className="text-xs font-medium text-gray-900 break-words">{displayName(c)}</p>
                            </div>
                            <p className="text-sm font-semibold text-green-700 mt-0.5">{fmtCurrency(Number(c.amount))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Search */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search by name or email…"
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {searchFiltered.length} of {paidContributions.length} contributor{paidContributions.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Full list */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Contributor</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchFiltered.map((c) => {
                          const anon = isAnon(c);
                          const rank = sortedByAmount.findIndex(x => x.id === c.id) + 1;
                          return (
                            <TableRow key={c.id} className="hover:bg-gray-50/50">
                              <TableCell>
                                <span className="text-xs font-mono text-gray-400">#{rank}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                                    anon ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {anon ? '?' : displayName(c)[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-medium ${anon ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                                      {displayName(c)}
                                      {anon && (
                                        <span className="ml-1.5 text-[10px] not-italic font-normal bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                          Anonymous
                                        </span>
                                      )}
                                    </p>
                                    {!anon && c.email && (
                                      <p className="text-[11px] text-gray-400">{c.email}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-semibold text-green-700">{fmtCurrency(Number(c.amount))}</span>
                              </TableCell>
                              <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                                {fmtDate(c.created_at)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {searchFiltered.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-gray-400">
                              No results for &ldquo;{searchTerm}&rdquo;
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </TabsContent>
        )}

        {/* ── TICKETS ─────────────────────────────────────────────────────── */}
        {colType === 'ticket' && (
          <TabsContent value="tickets" className="mt-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or ticket ID…"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {priceTiers.length > 0 && (
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Filter by tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    {priceTiers.map(t => (
                      <SelectItem key={t.id || t.name} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredTickets().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                        No tickets sold yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    getFilteredTickets().map(c => {
                      const tier = getTierForAmount(Number(c.amount));
                      const checkIn = c.check_in_status || 'not_checked_in';
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                              {c.contributor_unique_code || c.id.slice(0, 8).toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.email}</p>
                          </TableCell>
                          <TableCell>
                            {tier ? (
                              <Badge variant="outline">{tier.name}</Badge>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${CHECK_IN_COLORS[checkIn]}`}>
                              {CHECK_IN_LABELS[checkIn]}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {fmtDate(c.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 px-2">
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={checkIn === 'checked_in'}
                                  onClick={() => updateCheckIn(c.id, 'checked_in')}
                                >
                                  <LogIn className="w-4 h-4 mr-2 text-green-600" /> Check In
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={checkIn !== 'checked_in'}
                                  onClick={() => updateCheckIn(c.id, 'checked_out')}
                                >
                                  <LogOut className="w-4 h-4 mr-2 text-blue-600" /> Check Out
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={checkIn === 'not_checked_in'}
                                  onClick={() => updateCheckIn(c.id, 'not_checked_in')}
                                >
                                  <X className="w-4 h-4 mr-2 text-gray-500" /> Reset Status
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* ── ACTIVITIES ──────────────────────────────────────────────────── */}
        <TabsContent value="activities" className="mt-6 space-y-4">
          {loadingContribs ? (
            <ActivityListSkeleton count={6} />
          ) : paidContributions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TrendingUp className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No payments yet</p>
              <p className="text-gray-400 text-sm mt-1">Share your collection link to start receiving contributions</p>
            </div>
          ) : (
            <div className="space-y-1">
              {paidContributions.map(c => {
                const tier = getTierForAmount(Number(c.amount));
                const isAnon = colType === 'fundraising' && (!c.name || c.name.toLowerCase() === 'anonymous');
                const displayName = isAnon ? 'Anonymous' : c.name;
                const verb = colType === 'fundraising' ? 'donated' : colType === 'ticket' ? 'purchased a ticket for' : 'paid';
                // Activities show the full checkout amount (gross_amount = totalPayable incl. fees).
                // Fall back to amount for legacy rows that pre-date gross_amount column.
                const displayAmount = Number(c.gross_amount || c.amount || 0);

                return (
                  <div key={c.id} className="flex items-start gap-4 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-700 font-semibold text-sm">
                        {isAnon ? '?' : (displayName?.[0] || '?').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                        <span className="text-sm text-gray-500">{verb}</span>
                        <span className="text-sm font-semibold text-green-700">{fmtCurrency(displayAmount)}</span>
                        {tier && (
                          <Badge variant="outline" className="text-xs">{tier.name}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{fmtDateTime(c.created_at)}</span>
                        {c.payment_reference && (
                          <span className="text-xs text-gray-400">Ref: {c.payment_reference}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-semibold text-gray-900">{fmtCurrency(displayAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Withdraw */}
      <WithdrawFundsDialog
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        collectionId={id}
        collectionTitle={col.title}
        availableBalance={availableBalance}
        onComplete={() => {
          setIsWithdrawOpen(false);
          // Re-fetch the wallet row + stats so the "Available", "Pending
          // approval" annotation, and "Withdrawn" tile reflect the new
          // pending request without requiring a manual reload.
          loadWallet();
          loadBalanceStats();
          toast.success('Withdrawal submitted!');
        }}
      />

      {/* Share / QR */}
      <Drawer open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Share Collection</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <QRCodeDisplay
              collectionId={id!}
              collectionTitle={col.title}
              shareUrl={shareUrl}
            />
          </div>
          <DrawerClose asChild>
            <div className="px-4 pb-6">
              <Button variant="outline" className="w-full" onClick={() => setIsShareOpen(false)}>Close</Button>
            </div>
          </DrawerClose>
        </DrawerContent>
      </Drawer>

      {/* Edit */}
      <EditCollectionDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        collectionId={id!}
        initialData={(() => {
          // Compute sold quantity per tier from paid contributions
          const soldByTier = new Map<string, number>();
          for (const c of paidContributions) {
            const info = Array.isArray(c.contributor_information)
              ? c.contributor_information[0] || {}
              : (c.contributor_information || {});
            const tierId = info?.TierId ? String(info.TierId) : '';
            const tierName = info?.Tier ? String(info.Tier) : '';
            const key = tierId || tierName;
            if (!key) continue;
            soldByTier.set(key, (soldByTier.get(key) || 0) + 1);
          }
          const enrichedTiers = (col.pricing_tiers || []).map((tier: any) => ({
            ...tier,
            sold_quantity:
              soldByTier.get(String(tier.id || '')) ||
              soldByTier.get(String(tier.name || '')) ||
              0,
          }));
          return {
            title: col.title || '',
            description: (colType === 'fundraising' ? col.campaign_summary : col.description) || '',
            amount: Number(col.amount || 0),
            deadline: col.deadline || '',
            fee_bearer: col.fee_bearer || 'contributor',
            max_contributions: col.max_contributions || undefined,
            code_prefix: col.code_prefix || '',
            contributions_fields: col.form_fields || [],
            total_contributions: col.total_contributions || 0,
            type: col.collection_type === 'tiered' ? 'tiered' : 'fixed',
            price_tiers: enrichedTiers,
            collection_type: col.collection_type || col.type || 'fixed',
            banner_image: col.banner_url || '',
            story_what: col.story?.what || '',
            story_why: col.story?.why || '',
            story_impact: col.story?.impact || '',
            story_images: Array.isArray(col.story_images) ? col.story_images : [],
            event_date: col.event_date || '',
          };
        })()}
        onSuccess={() => {
          setIsEditOpen(false);
          loadCollection();
          toast.success('Collection updated');
        }}
      />

      {/* QR / Ticket Scanner (Ticket type only) */}
      <Dialog open={isScanOpen} onOpenChange={setIsScanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-green-700" />
              Ticket Scanner
            </DialogTitle>
            <DialogDescription>
              Enter a ticket ID or scan a QR code to look up a ticket.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter ticket ID…"
                value={scanInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScanInput(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleScanLookup()}
              />
              <Button onClick={handleScanLookup} className="bg-green-700 hover:bg-green-800 text-white">
                Look Up
              </Button>
            </div>

            {scannedTicket && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{scannedTicket.name}</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CHECK_IN_COLORS[scannedTicket.check_in_status || 'not_checked_in']}`}>
                    {CHECK_IN_LABELS[scannedTicket.check_in_status || 'not_checked_in']}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="text-gray-400">Email:</span> {scannedTicket.email}</p>
                  <p><span className="text-gray-400">Ticket ID:</span> <span className="font-mono">{scannedTicket.contributor_unique_code || '—'}</span></p>
                  <p><span className="text-gray-400">Amount:</span> {fmtCurrency(Number(scannedTicket.amount))}</p>
                  {getTierForAmount(Number(scannedTicket.amount)) && (
                    <p><span className="text-gray-400">Tier:</span> {getTierForAmount(Number(scannedTicket.amount))?.name}</p>
                  )}
                  {scannedTicket.payment_id && (
                    <p><span className="text-gray-400">Ref:</span> {scannedTicket.payment_id}</p>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-700 hover:bg-green-800 text-white"
                    disabled={(scannedTicket.check_in_status || 'not_checked_in') === 'checked_in'}
                    onClick={async () => {
                      await updateCheckIn(scannedTicket.id, 'checked_in');
                      setScannedTicket({ ...scannedTicket, check_in_status: 'checked_in' });
                    }}
                  >
                    <LogIn className="w-4 h-4 mr-1.5" /> Check In
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={(scannedTicket.check_in_status || 'not_checked_in') !== 'checked_in'}
                    onClick={async () => {
                      await updateCheckIn(scannedTicket.id, 'checked_out');
                      setScannedTicket({ ...scannedTicket, check_in_status: 'checked_out' });
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-1.5" /> Check Out
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fundraising Share / Flyer Dialog */}
      {colType === 'fundraising' && (
        <FundraisingShareDialog
          open={isFlierOpen}
          onOpenChange={setIsFlierOpen}
          collection={col}
          totalRaised={totalRaised}
          donorCount={paidContributions.length}
          shareUrl={shareUrl}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The collection and all its data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                await handleStatusChange('deleted');
                navigate('/dashboard/collections');
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CollectionDetailsPage;

