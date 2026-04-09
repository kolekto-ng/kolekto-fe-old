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
  Wallet, Share2, Edit, QrCode, ScanLine, Download, Search, ChevronDown,
  Loader2, ArrowLeft, Users, Calendar, Clock, TrendingUp,
  CheckCircle2, AlertCircle, LogIn, LogOut, MoreVertical, Copy, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCollectionStore } from '@/store/useCollectionStore';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import QRCodeDisplay from '@/components/collections/QRCodeDisplay';
import EditCollectionDialog from '@/components/collections/EditCollectionDialog';

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
      <p className={`font-bold text-lg leading-tight ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
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
  const { updateCollectionStatus } = useCollectionStore();

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

  const colType: string = col?.collection_type || (col?.type === 'tiered' ? 'tiered' : 'fixed');
  const formFields: any[] = col?.form_fields || [];
  const priceTiers: any[] = col?.pricing_tiers || [];
  // Pick the most-recently-updated wallet row (guards against duplicate rows)
  const walletRows: any[] = Array.isArray(col?.wallets) ? col.wallets : (col?.wallets ? [col.wallets] : []);
  const wallet = walletRows.slice().sort((a: any, b: any) =>
    new Date(b?.updated_at || 0).getTime() - new Date(a?.updated_at || 0).getTime()
  )[0] || {};
  const ledgerBalance = Number(wallet?.ledger_balance ?? 0);
  const availableBalance = Number(wallet?.available_balance ?? 0);
  const pendingBalance = Number(wallet?.pending_balance ?? 0);
  const shareUrl = `${window.location.origin}/contribute/${col?.slug || id}`;

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
    setContributions(data || []);
    setLoadingContribs(false);
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
  };

  useEffect(() => {
    if (!id) return;
    loadCollection();
    loadContributions();

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
        () => { loadContributions(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `collection_id=eq.${id}` },
        () => { loadWallet(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Computed values ─────────────────────────────────────────────────────────

  const paidContributions = contributions.filter(c => c.status === 'paid');
  // Authoritative: sum contributions.amount (net, no fees) from paid rows.
  // This is correct even when wallet hasn't been created yet or upsert failed.
  // Wallet balances (ledger/available/pending) still come from the wallet row
  // since they incorporate the T+1 settlement cutoff which is computed server-side.
  const totalRaised = paidContributions.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
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

  // ── Export CSV ──────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const filtered = getFilteredContributors();
    if (!filtered.length) { toast.info('No contributor data to export'); return; }

    const dynamicFields = Array.from(
      new Set(
        filtered.flatMap(c =>
          Object.keys((c.contributor_information || [])[0] || {}).filter(k => k !== 'TierAmount')
        )
      )
    );

    const hasUniqueCode = filtered.some(c => c.contributor_unique_code);
    const tierCol = colType === 'tiered' || colType === 'ticket';
    const headers = [...dynamicFields, ...(tierCol ? ['Tier'] : []), ...(hasUniqueCode ? ['Unique Code'] : [])];

    let csv = headers.join(',') + '\n';
    filtered.forEach(c => {
      const info = (c.contributor_information || [])[0] || {};
      const tierName = getTierForContribution(c)?.name || '';
      const row = [
        ...dynamicFields.map(f => info[f] || ''),
        ...(tierCol ? [tierName] : []),
        ...(hasUniqueCode ? [c.contributor_unique_code || ''] : []),
      ];
      csv += row.map(v => (String(v).includes(',') ? `"${v}"` : v)).join(',') + '\n';
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `${col?.title || 'collection'}-contributors.csv`;
    link.click();
    toast.success('Exported successfully');
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const statusLabel = col?.status === 'pending_review' ? 'Pending Review'
    : col?.status ? col.status.charAt(0).toUpperCase() + col.status.slice(1) : 'Active';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

      {/* ── Back ───────────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/dashboard/collections')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Collections
      </button>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-gray-900">{col.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[col.status] || 'bg-gray-100 text-gray-700'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {statusLabel}
              </span>
              {colType === 'ticket' && col.event_date && (
                <span className="text-xs text-gray-500">
                  Event: {fmtDate(col.event_date)}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {colType === 'ticket' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setScanInput(''); setScannedTicket(null); setIsScanOpen(true); }}
                className="flex items-center gap-1.5"
              >
                <ScanLine className="w-4 h-4" />
                Scan QR
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => setIsWithdrawOpen(true)}
              disabled={availableBalance <= 0}
              className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-1.5"
            >
              <Wallet className="w-4 h-4" />
              Withdraw
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsShareOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>

            {/* Status management menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="px-2">
                  <MoreVertical className="w-4 h-4" />
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
        </div>

        {/* Share link + QR inline */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">Collection Link</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 truncate">{shareUrl}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied!'); }}
                className="flex-shrink-0 text-gray-400 hover:text-gray-700"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex-shrink-0 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            title="View QR Code"
          >
            <QrCode className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {col.status === 'paused' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
            This collection is currently paused — contributors cannot make payments.
          </div>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 p-1 rounded-xl h-auto">
          {tabs.map(t => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="rounded-lg px-5 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {loadingContribs ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
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

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label={colType === 'fundraising' ? 'Total Donated' : colType === 'ticket' ? 'Total Revenue' : 'Total Raised'}
                  value={fmtCurrency(totalRaised)}
                  highlight
                />
                <StatCard
                  icon={<Users className="w-5 h-5" />}
                  label={colType === 'fundraising' ? 'Donors' : colType === 'ticket' ? 'Tickets Sold' : 'Contributors'}
                  value={paidContributions.length.toString()}
                />
                <StatCard
                  icon={<Calendar className="w-5 h-5" />}
                  label="Deadline"
                  value={deadline ? fmtDate(deadline) : 'No deadline'}
                />
                <StatCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Time Remaining"
                  value={remaining === null ? '—' : remaining <= 0 ? 'Ended' : `${remaining} day${remaining !== 1 ? 's' : ''}`}
                  sub={remaining !== null && remaining <= 0 ? 'Collection has ended' : undefined}
                />
              </div>

              {/* Fixed amount */}
              {colType === 'fixed' && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Fixed Amount per Contributor</p>
                  <p className="text-2xl font-bold text-gray-900">{fmtCurrency(Number(col.amount || 0))}</p>
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

              {/* Open pool info */}
              {colType === 'open_pool' && col.min_contribution > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Minimum Contribution</p>
                  <p className="text-xl font-bold text-gray-900">{fmtCurrency(Number(col.min_contribution))}</p>
                </div>
              )}

              {/* Wallet Summary Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Total Balance</p>
                  <p className="text-xl font-bold text-gray-900">{fmtCurrency(ledgerBalance)}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-green-700 mb-1">Available to Withdraw</p>
                    <p className="text-xl font-bold text-green-700">{fmtCurrency(availableBalance)}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={availableBalance <= 0}
                    onClick={() => setIsWithdrawOpen(true)}
                    className="bg-green-700 hover:bg-green-800 text-white"
                  >
                    <Wallet className="w-4 h-4 mr-1.5" /> Withdraw
                  </Button>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-yellow-700 mb-1">Pending Balance</p>
                  <p className="text-xl font-bold text-yellow-700">{fmtCurrency(pendingBalance)}</p>
                </div>
              </div>
            </>
          )}
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

              <Button variant="outline" size="sm" onClick={exportCSV} className="flex items-center gap-1.5">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>

            {/* Table */}
            {loadingContribs ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      {colType === 'tiered' && <TableHead>Tier</TableHead>}
                      {formFields.length > 0
                        ? formFields.map(f => <TableHead key={f.id}>{f.name}</TableHead>)
                        : (
                          <>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                          </>
                        )
                      }
                      {paidContributions.some(c => c.contributor_unique_code) && (
                        <TableHead>Unique Code</TableHead>
                      )}
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredContributors().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10 text-gray-400">
                          No contributors yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      getFilteredContributors().map(c => {
                        const info = (c.contributor_information || [])[0] || {};
                        const tier = getTierForContribution(c);
                        return (
                          <TableRow key={c.id}>
                            {colType === 'tiered' && (
                              <TableCell>
                                <Badge variant="outline">{tier?.name || '—'}</Badge>
                              </TableCell>
                            )}
                            {formFields.length > 0
                              ? formFields.map(f => (
                                  <TableCell key={f.id}>{info[f.name] || '—'}</TableCell>
                                ))
                              : (
                                <>
                                  <TableCell>{c.name || '—'}</TableCell>
                                  <TableCell>{c.email || '—'}</TableCell>
                                  <TableCell>{c.phone || '—'}</TableCell>
                                </>
                              )
                            }
                            {paidContributions.some(pc => pc.contributor_unique_code) && (
                              <TableCell>
                                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                  {c.contributor_unique_code || '—'}
                                </span>
                              </TableCell>
                            )}
                            <TableCell className="text-gray-500 text-xs whitespace-nowrap">
                              {fmtDate(c.created_at)}
                            </TableCell>
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
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
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
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm ${
                            i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : 'bg-orange-400'
                          }`}>
                            {isAnon(c) ? '?' : displayName(c)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-base leading-none">{MEDAL[i]}</span>
                              <p className="text-xs font-semibold text-gray-900 truncate">{displayName(c)}</p>
                            </div>
                            <p className="text-sm font-bold text-green-700 mt-0.5">{fmtCurrency(Number(c.amount))}</p>
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
                                <span className="text-sm font-bold text-green-700">{fmtCurrency(Number(c.amount))}</span>
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
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
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
                        <span className="text-sm font-bold text-green-700">{fmtCurrency(displayAmount)}</span>
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
                      <span className="text-sm font-bold text-gray-900">{fmtCurrency(displayAmount)}</span>
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
        onComplete={() => { setIsWithdrawOpen(false); toast.success('Withdrawal submitted!'); }}
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
