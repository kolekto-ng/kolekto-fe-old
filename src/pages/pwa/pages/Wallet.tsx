import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useCollectionStore, useWithdrawalStore, useAuthStore } from '@/store';
import {
    Wallet,
    Clock,
    AlertCircle,
    CheckCircle,
    XCircle,
    Search,
    X,
    Lock,
    Layers,
    Waves,
    Ticket,
    Heart,
    ChevronRight,
    MoreVertical,
    SlidersHorizontal,
} from 'lucide-react';
import {
    isCompletedWithdrawal,
    isPendingWithdrawal,
    isRejectedWithdrawal,
    withdrawalStatusBucket,
    withdrawalStatusLabel,
} from '@/utils/withdrawalStatus';

const formatCurrency = (amount: number) =>
    '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 0 });

interface WalletOverview {
    availableBalance: number;
    bookBalance: number;
    ledgerBalance: number;
    pendingDebits: number;
    pendingCredits: number;
    totalGrossEarnings: number;
    totalNetEarnings: number;
    totalWithdrawn: number;
}

interface CollectionEarning {
    id: string;
    name: string;
    type: string;
    typeKey: string;
    amount: number;
    participants: number;
    totalCollected: number;
    grossEarnings: number;
    netEarnings: number;
    balance: number;
    withdrawable: number;
    pendingWithdrawals: number;
}

interface RecentTransaction {
    id: string;
    collection: string;
    amount: number;
    date: string;
    // Bucketed status — `withdrawalStatusBucket()` collapses approved/
    // completed/successful into `completed`, rejected/declined/failed
    // /reversed into `rejected`, and pending/processing into `pending`.
    status: 'pending' | 'completed' | 'rejected' | 'unknown';
    rawStatus?: string;
    description: string;
}

const normalizeCollectionType = (type?: string) =>
    (type || 'fixed').toLowerCase().replace(/\s+/g, '_');

const COLLECTION_TYPE_META: Record<
    string,
    {
        label: string;
        icon: React.ElementType;
        iconClassName: string;
        pillClassName: string;
    }
> = {
    fixed: {
        label: 'Fixed',
        icon: Lock,
        iconClassName: 'bg-emerald-50 text-emerald-700',
        pillClassName: 'bg-emerald-50 text-emerald-700',
    },
    flat: {
        label: 'Fixed',
        icon: Lock,
        iconClassName: 'bg-emerald-50 text-emerald-700',
        pillClassName: 'bg-emerald-50 text-emerald-700',
    },
    tiered: {
        label: 'Tiered',
        icon: Layers,
        iconClassName: 'bg-emerald-50 text-emerald-700',
        pillClassName: 'bg-emerald-50 text-emerald-700',
    },
    open_pool: {
        label: 'Open Pool',
        icon: Waves,
        iconClassName: 'bg-emerald-50 text-emerald-700',
        pillClassName: 'bg-emerald-50 text-emerald-700',
    },
    ticket: {
        label: 'Ticketing',
        icon: Ticket,
        iconClassName: 'bg-emerald-50 text-emerald-700',
        pillClassName: 'bg-emerald-50 text-emerald-700',
    },
    fundraising: {
        label: 'Fundraising',
        icon: Heart,
        iconClassName: 'bg-emerald-50 text-emerald-700',
        pillClassName: 'bg-emerald-50 text-emerald-700',
    },
};

const getCollectionTypeMeta = (type?: string) =>
    COLLECTION_TYPE_META[normalizeCollectionType(type)] || COLLECTION_TYPE_META.fixed;

const PwaWallet: React.FC = () => {
    const [walletOverview, setWalletOverview] = useState<WalletOverview | null>(null);
    const [collectionEarnings, setCollectionEarnings] = useState<CollectionEarning[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [collectionSearch, setCollectionSearch] = useState('');
    const [transactionSearch, setTransactionSearch] = useState('');
    const [transactionStatusFilter, setTransactionStatusFilter] = useState<string>('all');

    const { collections, fetchCollections } = useCollectionStore() as any;
    const { withdrawals, fetchWithdrawals } = useWithdrawalStore() as any;
    const { user } = useAuthStore() as any;

    // Bootstrap the page from a cold start: load BOTH collections and
    // withdrawals in parallel. Previously this page only read from stores
    // that were assumed to be pre-populated by other pages — when the user
    // navigated directly to /pwa/wallet (or reloaded), the "Collection
    // Earnings" table and the "Total Withdrawn" totals were empty until
    // something else happened to fill the stores.
    useEffect(() => {
        if (!user?.id) return;
        void Promise.allSettled([
            fetchCollections?.(user.id),
            fetchWithdrawals?.(user.id),
        ]);
    }, [user?.id]);

    useEffect(() => {
        // Calculate wallet overview
        let totalAvailable = 0;
        let totalBook = 0;
        let totalLedger = 0;
        let totalGross = 0;
        let totalNet = 0;
        let totalWithdrawn = 0;
        let pendingDebits = 0;
        let pendingCredits = 0;

        // Sort collections by created_at descending (newest first)
        const sortedCollections = [...collections].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        });

        // Map sorted collections to CollectionEarning format
        const earnings = sortedCollections.map((col) => {
            const typeKey = normalizeCollectionType(col.collection_type || col.type || 'fixed');
            const typeMeta = getCollectionTypeMeta(typeKey);
            const wallet = Array.isArray(col.wallets) && col.wallets.length > 0 ? col.wallets[0] : {};

            const available = wallet.available_balance || 0;
            const gross = wallet.gross_payment || 0;
            const net = wallet.net_payment || 0;
            const ledger = wallet.ledger_balance || 0;

            totalAvailable += available;
            totalGross += gross;
            totalNet += net;
            totalLedger += ledger;
            pendingDebits += wallet.pending_withdrawals ?? 0;

            return {
                id: col.id,
                name: col.title || 'Untitled Collection',
                type: typeMeta.label,
                typeKey,
                amount: col.amount || 0,
                participants: col.total_contributions || 0,
                totalCollected: col.amount || 0,
                grossEarnings: gross,
                netEarnings: net,
                balance: ledger,
                withdrawable: available,
                pendingWithdrawals: wallet.pending_withdrawals ?? 0,
            };
        });

        setCollectionEarnings(earnings);

        // Calculate total withdrawn from withdrawals. Uses the shared
        // helper that treats "approved" (manual flow) and "completed/
        // successful/success" (legacy Paystack flow) as equivalent.
        const withdrawalsArray = Array.isArray(withdrawals) ? withdrawals : withdrawals ? [withdrawals] : [];
        const completedWithdrawals = withdrawalsArray.filter(w => isCompletedWithdrawal(w.status));
        totalWithdrawn = completedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
        // Pending withdrawals reduce the user's effective available
        // balance. Surface as "Pending Debits".
        pendingDebits = withdrawalsArray
            .filter(w => isPendingWithdrawal(w.status))
            .reduce((sum, w) => sum + (w.amount || 0), 0);

        setWalletOverview({
            availableBalance: totalAvailable,
            bookBalance: totalAvailable + pendingDebits,
            ledgerBalance: totalLedger,
            pendingDebits,
            pendingCredits,
            totalGrossEarnings: totalGross,
            totalNetEarnings: totalNet,
            totalWithdrawn,
        });

        // Sort withdrawals by created_at descending (newest first)
        const sortedWithdrawals = [...withdrawalsArray].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        });

        // Map every raw status into the coarse bucket the UI styling
        // helpers know — so an "approved" row no longer renders as "Unknown".
        const withdrawalTransactions = sortedWithdrawals.map((w) => ({
            id: w.id,
            collection: w.collections ? w.collections.title : 'Unknown Collection',
            amount: w.amount,
            date: w.created_at ? new Date(w.created_at).toLocaleDateString('en-NG') : '',
            status: withdrawalStatusBucket(w.status),
            rawStatus: w.status,
            description: w.destination_account
                ? `Withdrawal to ${w.destination_account.accountName} (${w.destination_account.accountNumber})`
                : 'Withdrawal',
        }));

        setRecentTransactions(withdrawalTransactions);
    }, [collections, withdrawals]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            case 'rejected':
                return <XCircle className="h-4 w-4 text-red-600" />;
            default:
                return <AlertCircle className="h-4 w-4 text-gray-600" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
        }
    };

    // Filter collections based on search
    const filteredCollections = collectionEarnings.filter((earning) =>
        earning.name.toLowerCase().includes(collectionSearch.toLowerCase())
    );

    // Filter transactions based on search and status
    const filteredTransactions = recentTransactions.filter((transaction) => {
        const matchesSearch = 
            transaction.collection.toLowerCase().includes(transactionSearch.toLowerCase()) ||
            transaction.description.toLowerCase().includes(transactionSearch.toLowerCase()) ||
            formatCurrency(transaction.amount).includes(transactionSearch);
        
        const matchesStatus = transactionStatusFilter === 'all' || transaction.status === transactionStatusFilter;
        
        return matchesSearch && matchesStatus;
    });

    const summary = walletOverview ?? {
        availableBalance: 0,
        bookBalance: 0,
        ledgerBalance: 0,
        pendingDebits: 0,
        pendingCredits: 0,
        totalGrossEarnings: 0,
        totalNetEarnings: 0,
        totalWithdrawn: 0,
    };

    return (
        <div className="space-y-5 pb-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <section className="min-w-0 overflow-hidden rounded-[22px] bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white shadow-[0_12px_24px_rgba(4,120,87,0.18)]">
                    <div className="relative p-4 sm:p-5">
                        <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_18%_18%,white_0,transparent_28%),linear-gradient(135deg,transparent_20%,rgba(255,255,255,.22)_60%,transparent_80%)]" />
                        <div className="relative space-y-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-emerald-50 sm:text-sm">Wallet Balance</p>
                                <p className="mt-1.5 break-words text-[clamp(1.35rem,6vw,2.35rem)] font-semibold leading-tight tracking-normal">
                                    {formatCurrency(summary.availableBalance)}
                                </p>
                                <p className="mt-1.5 text-xs font-normal leading-snug text-emerald-50 sm:text-sm">Available to withdraw</p>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="flex min-h-12 w-full items-center justify-between gap-2 bg-emerald-800/70 px-4 py-3 text-left text-xs font-semibold text-white transition hover:bg-emerald-900/70 sm:text-sm"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <Wallet className="h-4 w-4 shrink-0" />
                            Withdraw Funds
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0" />
                    </button>
                </section>

                <section className="min-w-0 rounded-[22px] border border-gray-100 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.07)] sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h2 className="break-words text-base font-semibold leading-snug text-gray-950 sm:text-lg">Wallet Summary</h2>
                            <p className="mt-1 hidden text-xs text-gray-500 sm:block">Balance activity at a glance</p>
                        </div>
                        <button
                            type="button"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                            aria-label="Wallet summary options"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-3 divide-y divide-gray-100">
                        <div className="flex items-center justify-between gap-2 py-2">
                            <span className="flex min-w-0 items-center gap-2 text-xs text-gray-700 sm:text-sm">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                Available
                            </span>
                            <span className="min-w-0 break-words text-right text-sm font-semibold leading-tight text-gray-950 sm:text-base">
                                {formatCurrency(summary.availableBalance)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-2">
                            <span className="flex min-w-0 items-center gap-2 text-xs text-gray-700 sm:text-sm">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                Pending
                            </span>
                            <span className="min-w-0 break-words text-right text-sm font-semibold leading-tight text-gray-950 sm:text-base">
                                {formatCurrency(summary.pendingDebits)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-2">
                            <span className="flex min-w-0 items-center gap-2 text-xs text-gray-700 sm:text-sm">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                Withdrawn
                            </span>
                            <span className="min-w-0 break-words text-right text-sm font-semibold leading-tight text-gray-950 sm:text-base">
                                {formatCurrency(summary.totalWithdrawn)}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setActiveTab('transactions')}
                        className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-3 text-left text-xs font-semibold leading-tight text-emerald-700 transition hover:bg-emerald-100 sm:text-sm"
                    >
                        <span className="min-w-0">View withdrawal transactions</span>
                        <ChevronRight className="h-4 w-4 shrink-0" />
                    </button>
                </section>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="pb-1">
                    <TabsList className="grid h-auto w-full grid-cols-2 rounded-[22px] border border-gray-100 bg-white p-1 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
                        <TabsTrigger
                            value="overview"
                            className="min-h-12 gap-1.5 rounded-[16px] px-2 py-2 text-[11px] font-semibold leading-tight text-gray-500 transition-all data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm sm:text-sm"
                        >
                            <Wallet className="h-4 w-4 shrink-0" />
                            <span className="text-center">Collections Overview</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="transactions"
                            className="min-h-12 gap-1.5 rounded-[16px] px-2 py-2 text-[11px] font-semibold leading-tight text-gray-500 transition-all data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm sm:text-sm"
                        >
                            <Clock className="h-4 w-4 shrink-0" />
                            <span className="text-center">Withdrawal Transactions</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="mt-5 space-y-5">
                    <Card className="overflow-hidden rounded-[24px] border-gray-100 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                        <CardContent className="p-0">
                            <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h2 className="text-2xl font-semibold tracking-normal text-gray-950">Collection Earnings</h2>
                                    <p className="mt-1 text-sm text-gray-500">Swipe sideways to view all balance columns.</p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                        <Input
                                            placeholder="Search collections..."
                                            value={collectionSearch}
                                            onChange={(e) => setCollectionSearch(e.target.value)}
                                            className="h-11 w-full rounded-2xl border-gray-200 pl-10 pr-10 sm:w-64"
                                        />
                                        {collectionSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setCollectionSearch('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                                                aria-label="Clear collection search"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                                        aria-label="Collection filters"
                                    >
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Filter
                                    </button>
                                </div>
                            </div>

                            {filteredCollections.length > 0 ? (
                                <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
                                    <div className="min-w-[960px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                                                    <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Collection Name</TableHead>
                                                    <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Collection Type</TableHead>
                                                    <TableHead className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Gross Earnings</TableHead>
                                                    <TableHead className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Net Earnings</TableHead>
                                                    <TableHead className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Withdrawable</TableHead>
                                                    <TableHead className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Open</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredCollections.map((earning) => {
                                                    const typeMeta = getCollectionTypeMeta(earning.typeKey);
                                                    const TypeIcon = typeMeta.icon;

                                                    return (
                                                        <TableRow key={earning.id} className="transition hover:bg-emerald-50/35">
                                                            <TableCell className="px-5 py-4">
                                                                <div className="flex min-w-[260px] items-center gap-3">
                                                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${typeMeta.iconClassName}`}>
                                                                        <TypeIcon className="h-5 w-5" />
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <p className="max-w-[280px] whitespace-normal break-words text-sm font-medium leading-snug text-gray-950">
                                                                            {earning.name}
                                                                        </p>
                                                                        <p className="mt-1 text-xs text-gray-500">
                                                                            {earning.participants} contributor{earning.participants === 1 ? '' : 's'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="px-4 py-4">
                                                                <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${typeMeta.pillClassName}`}>
                                                                    {earning.type}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium text-gray-950">
                                                                {formatCurrency(earning.grossEarnings)}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm text-gray-600">
                                                                {formatCurrency(earning.netEarnings)}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-emerald-700">
                                                                {formatCurrency(earning.withdrawable)}
                                                            </TableCell>
                                                            <TableCell className="px-5 py-4 text-right text-gray-400">
                                                                <ChevronRight className="ml-auto h-5 w-5" />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <p className="px-5 py-8 text-center text-sm text-gray-500">
                                    {collectionSearch ? 'No collections match your search' : 'No collections yet'}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="transactions" className="mt-5">
                    <Card className="overflow-hidden rounded-[24px] border-gray-100 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                        <CardContent className="p-0">
                            <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h2 className="text-2xl font-semibold tracking-normal text-gray-950">Withdrawal Transactions</h2>
                                    <p className="mt-1 text-sm text-gray-500">Swipe sideways to view full transaction details.</p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                        <Input
                                            placeholder="Search transactions..."
                                            value={transactionSearch}
                                            onChange={(e) => setTransactionSearch(e.target.value)}
                                            className="h-11 w-full rounded-2xl border-gray-200 pl-10 pr-10 sm:w-64"
                                        />
                                        {transactionSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setTransactionSearch('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                                                aria-label="Clear transaction search"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={transactionStatusFilter}
                                        onChange={(e) => setTransactionStatusFilter(e.target.value)}
                                        className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="completed">Approved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>

                            {filteredTransactions.length > 0 ? (
                                <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
                                    <div className="min-w-[900px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                                                    <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Date</TableHead>
                                                    <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Collection</TableHead>
                                                    <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Description</TableHead>
                                                    <TableHead className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</TableHead>
                                                    <TableHead className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredTransactions.map((transaction) => (
                                                    <TableRow key={transaction.id} className="transition hover:bg-emerald-50/35">
                                                        <TableCell className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">{transaction.date}</TableCell>
                                                        <TableCell className="px-4 py-4 text-sm font-medium text-gray-950">
                                                            <span className="block max-w-[240px] whitespace-normal break-words leading-snug">{transaction.collection}</span>
                                                        </TableCell>
                                                        <TableCell className="px-4 py-4 text-sm text-gray-600">
                                                            <span className="block max-w-[320px] whitespace-normal break-words leading-snug">{transaction.description}</span>
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-gray-950">
                                                            {formatCurrency(transaction.amount)}
                                                        </TableCell>
                                                        <TableCell className="px-5 py-4 text-center text-sm">
                                                            <div className="inline-flex items-center justify-center gap-1.5">
                                                                {getStatusIcon(transaction.status)}
                                                                {getStatusBadge(transaction.status)}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <p className="px-5 py-8 text-center text-sm text-gray-500">
                                    {transactionSearch || transactionStatusFilter !== 'all'
                                        ? 'No transactions match your search or filters'
                                        : 'No transactions yet'}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default PwaWallet;
