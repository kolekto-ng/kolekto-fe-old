import React, { useState, useEffect, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';
import { useCollectionStore, useWithdrawalStore, useAuthStore } from '@/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wallet,
  History,
  Lock,
  Layers,
  Waves,
  Ticket,
  Heart,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import {
  isCompletedWithdrawal,
  withdrawalStatusBucket,
} from '@/utils/withdrawalStatus';
import { TableRowsSkeleton } from '@/components/ui/page-skeletons';

// Simple currency formatter for NGN
const formatCurrency = (amount: number) =>
  '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 0 });

interface CollectionEarning {
  id: string;
  name: string;
  type: string;
  typeKey: string;
  totalRaised: number;
  currentBalance: number;
  amountWithdrawn: number;
  availableBalance: number;
  pendingBalance: number;
}

interface RecentTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  collection: string;
  amount: number;
  date: string;
  status: 'pending' | 'successful' | 'failed' | string;
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

const TransactionHistoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('collections');
  const { collections, fetchCollections, isLoading: collectionsLoading } = useCollectionStore() as any;
  const { withdrawals, fetchWithdrawals, isLoading: withdrawalsLoading } = useWithdrawalStore() as any;
  const { user } = useAuthStore() as any;

  // Ensure collections are available when user lands directly on this page.
  useEffect(() => {
    if (user?.id && (!Array.isArray(collections) || collections.length === 0)) {
      void fetchCollections(user.id);
    }
  }, [user?.id, collections?.length, fetchCollections]);

  // Defer withdrawals fetch until the withdrawals tab is opened.
  // This keeps initial wallet page render fast for Collection Overview.
  useEffect(() => {
    if (activeTab === 'withdrawals' && user?.id) {
      void fetchWithdrawals(user.id);
    }
  }, [activeTab, user?.id, fetchWithdrawals]);

  const withdrawalsArray = useMemo(
    () =>
      Array.isArray(withdrawals)
        ? withdrawals
        : withdrawals
          ? [withdrawals]
          : [],
    [withdrawals],
  );

  const completedByCollection = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const w of withdrawalsArray) {
      if (!isCompletedWithdrawal(w?.status)) continue;
      const collectionId = w?.collection_id;
      if (!collectionId) continue;
      totals[collectionId] = (totals[collectionId] || 0) + Number(w.amount || 0);
    }
    return totals;
  }, [withdrawalsArray]);

  const collectionEarnings: CollectionEarning[] = useMemo(() => {
    const sortedCollections = [...(collections || [])].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return sortedCollections.map((col: any) => {
      const typeKey = normalizeCollectionType(col.collection_type || col.type || 'fixed');
      const typeMeta = getCollectionTypeMeta(typeKey);
      const wallet = col.wallets
        ? (Array.isArray(col.wallets) ? col.wallets[0] || {} : col.wallets)
        : {};
      const walletWithdrawn = Number(wallet.withdrawn || 0);
      const withdrawnFromRows = Number(completedByCollection[col.id] || 0);
      const withdrawnTotal = Math.max(walletWithdrawn, withdrawnFromRows);
      const totalRaised = Number(wallet.gross_payment || col.total_amount || 0);
      const currentBalance = Number(
        wallet.ledger_balance !== undefined
          ? wallet.ledger_balance
          : Math.max(0, totalRaised - withdrawnTotal),
      );

      return {
        id: col.id,
        name: col.title || '',
        type: typeMeta.label,
        typeKey,
        totalRaised,
        currentBalance,
        amountWithdrawn: withdrawnTotal,
        availableBalance:
          wallet.available_balance !== undefined
            ? Number(wallet.available_balance)
            : currentBalance,
        pendingBalance: Number(wallet.pending_withdrawals ?? 0),
      };
    });
  }, [collections, completedByCollection]);

  const walletSummary = useMemo(
    () =>
      collectionEarnings.reduce(
        (totals, earning) => ({
          availableBalance: totals.availableBalance + earning.availableBalance,
          pendingBalance: totals.pendingBalance + earning.pendingBalance,
          amountWithdrawn: totals.amountWithdrawn + earning.amountWithdrawn,
          currentBalance: totals.currentBalance + earning.currentBalance,
        }),
        {
          availableBalance: 0,
          pendingBalance: 0,
          amountWithdrawn: 0,
          currentBalance: 0,
        },
      ),
    [collectionEarnings],
  );

  const recentTransactions: RecentTransaction[] = useMemo(() => {
    const sortedWithdrawals = [...withdrawalsArray].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return sortedWithdrawals.map((w: any) => {
      const bucketedStatus = withdrawalStatusBucket(w.status);
      const mappedStatus =
        bucketedStatus === 'completed'
          ? 'successful'
          : bucketedStatus === 'pending'
            ? 'pending'
            : bucketedStatus === 'rejected'
              ? 'failed'
              : (w.status || 'pending');

      return {
        id: w.id,
        type: 'withdrawal',
        collection: w.collections ? w.collections.title : 'Unknown Collection',
        amount: Number(w.amount || 0),
        date: w.created_at
          ? new Date(w.created_at).toLocaleString('en-NG', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
        status: mappedStatus,
        description: w.destination_account
          ? `Withdrawal to ${w.destination_account.accountName} (${w.destination_account.accountNumber})`
          : 'Withdrawal',
      };
    });
  }, [withdrawalsArray]);

  const handleWithdraw = async (collectionId: string) => {
    alert(`Withdraw from collection ${collectionId} (dummy action)`);
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
                <div className="mt-1.5 min-w-0">
                  <p className="break-words text-[clamp(1.35rem,6vw,2.35rem)] font-semibold leading-tight tracking-normal">
                    {formatCurrency(walletSummary.availableBalance)}
                  </p>
                </div>
                <p className="mt-1.5 text-xs font-normal leading-snug text-emerald-50 sm:text-sm">Available to withdraw</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('collections')}
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
              <p className="mt-1 hidden text-xs text-gray-500 sm:block">Balances across your collections</p>
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
                {formatCurrency(walletSummary.availableBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-2">
              <span className="flex min-w-0 items-center gap-2 text-xs text-gray-700 sm:text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                Pending
              </span>
              <span className="min-w-0 break-words text-right text-sm font-semibold leading-tight text-gray-950 sm:text-base">
                {formatCurrency(walletSummary.pendingBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-2">
              <span className="flex min-w-0 items-center gap-2 text-xs text-gray-700 sm:text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                Withdrawn
              </span>
              <span className="min-w-0 break-words text-right text-sm font-semibold leading-tight text-gray-950 sm:text-base">
                {formatCurrency(walletSummary.amountWithdrawn)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('withdrawals')}
            className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-3 text-left text-xs font-semibold leading-tight text-emerald-700 transition hover:bg-emerald-100 sm:text-sm"
          >
            <span className="min-w-0">View withdrawal transactions</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </section>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <div className="pb-1">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-[22px] border border-gray-100 bg-white p-1 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
            <TabsTrigger
              value="collections"
              className="min-h-12 gap-1.5 rounded-[16px] px-2 py-2 text-[11px] font-semibold leading-tight text-gray-500 transition-all data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm sm:text-sm"
            >
              <Wallet className="h-4 w-4 shrink-0" />
              <span className="text-center">Collections Overview</span>
            </TabsTrigger>
            <TabsTrigger
              value="withdrawals"
              className="min-h-12 gap-1.5 rounded-[16px] px-2 py-2 text-[11px] font-semibold leading-tight text-gray-500 transition-all data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm sm:text-sm"
            >
              <History className="h-4 w-4 shrink-0" />
              <span className="text-center">Withdrawal Transactions</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="collections" className="m-0 focus-visible:outline-none focus-visible:ring-0">

      <div className="w-full max-w-full overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-gray-950">Collection Earnings</h2>
            <p className="mt-1 text-sm text-gray-500">Swipe sideways to view all balance columns.</p>
          </div>
        </div>
        <div className="relative max-h-[620px] w-full overflow-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[980px] divide-y divide-gray-100">
            <thead className="sticky top-0 z-10 bg-gray-50/95 outline outline-1 outline-gray-100 backdrop-blur">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Collection Name</th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Collection Type</th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Total Raised</th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Current Balance</th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Withdrawn</th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Available</th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Pending</th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {collectionsLoading && <TableRowsSkeleton rows={6} columns={8} />}
              {!collectionsLoading && collectionEarnings.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-sm text-gray-500 text-center"
                  >
                    No collections found.
                  </td>
                </tr>
              )}
              {collectionEarnings.map((earning) => {
                const typeMeta = getCollectionTypeMeta(earning.typeKey);
                const TypeIcon = typeMeta.icon;

                return (
                <tr key={earning.id} className="transition hover:bg-emerald-50/35">
                  <td className="px-5 py-4 text-sm font-medium text-gray-950">
                    <div className="flex min-w-[260px] items-center gap-3">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${typeMeta.iconClassName}`}>
                        <TypeIcon className="h-5 w-5" />
                      </span>
                      <span className="max-w-[260px] whitespace-normal break-words leading-snug">{earning.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${typeMeta.pillClassName}`}>
                      {earning.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-950">{formatCurrency(earning.totalRaised)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{formatCurrency(earning.currentBalance)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{formatCurrency(earning.amountWithdrawn)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-emerald-700">{formatCurrency(earning.availableBalance)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-amber-700">{formatCurrency(earning.pendingBalance)}</td>
                  <td className="px-5 py-4 text-right text-gray-400">
                    <ChevronRight className="ml-auto h-5 w-5" />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </TabsContent>

      <TabsContent value="withdrawals" className="m-0 focus-visible:outline-none focus-visible:ring-0">
      <div className="w-full max-w-full overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
        <div className="border-b border-gray-100 px-4 py-5 sm:px-5">
          <h2 className="text-2xl font-semibold tracking-normal text-gray-950">Withdrawal Transactions</h2>
          <p className="mt-1 text-sm text-gray-500">Swipe sideways to view status and dates.</p>
        </div>
        <div className="relative max-h-[620px] w-full overflow-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[820px] divide-y divide-gray-100">
            <thead className="sticky top-0 z-10 bg-gray-50/95 outline outline-1 outline-gray-100 backdrop-blur">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Collection Title</th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Amount</th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Status</th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {withdrawalsLoading && <TableRowsSkeleton rows={6} columns={4} />}
              {!withdrawalsLoading && recentTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-sm text-gray-500 text-center"
                  >
                    No withdrawal transactions yet.
                  </td>
                </tr>
              )}
              {recentTransactions.map(transaction => (
                <tr key={transaction.id} className="transition hover:bg-emerald-50/35">
                  <td className="px-5 py-4 text-sm font-medium text-gray-950">
                    <span className="block max-w-[320px] whitespace-normal break-words leading-snug">{transaction.collection}</span>
                    <span className="mt-1 block max-w-[360px] whitespace-normal break-words text-xs font-normal text-gray-500">{transaction.description}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-gray-950">{formatCurrency(transaction.amount)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                      transaction.status === 'successful' || transaction.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      transaction.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">{transaction.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </TabsContent>
      </Tabs>

      {/* {currentCollection && (
        <WithdrawFundsDialog
          open={isWithdrawDialogOpen}
          onOpenChange={setIsWithdrawDialogOpen}
          onComplete={onWithdrawComplete}
          availableBalance={currentCollection.wallets[0].available_balance || 0}
          collectionId={id || ''}
          collectionTitle={currentCollection?.title || ''}
        />
      )} */}

      <Tooltip place="top" />
    </div>
  );
};

export default TransactionHistoryPage;
