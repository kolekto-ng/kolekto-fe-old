import React, { useEffect, useMemo, useState } from 'react';
import { useActivities } from '@/store/useDashboard';
import { useCollectionStore } from '@/store';
import { Loader2, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle } from 'lucide-react';

function relativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    if (diffMs < 0) return 'just now';

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    const weeks = Math.floor(days / 7);
    if (weeks <= 57) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

    return '57 weeks ago';
  } catch {
    return '';
  }
}

function formatCurrency(amount: number) {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Maps the unified activity row from /dashboard/activities to the
// icon/label/colour shape the list renderer uses. Withdrawal `type`
// values (`withdrawal_requested`, `withdrawal_approved`,
// `withdrawal_rejected`, `withdrawal_pending`) come from the BE based on
// the withdrawals.status column — see kolekto-be-old controllers/dashboard.js
// withdrawalStatusToActivityType.
function getActivityMeta(activity: any) {
  const type = activity.type || (activity.status === 'paid' ? 'contribution' : 'contribution');

  if (type === 'withdrawal_requested' || type === 'withdrawal_pending') {
    return {
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      iconBg: 'bg-amber-50 border border-amber-200',
      title: 'Withdrawal Requested',
      amountColor: 'text-amber-700',
      amountPrefix: '−',
      statusLabel: 'Pending admin approval',
    };
  }
  if (type === 'withdrawal_approved' || type === 'withdrawal_completed') {
    return {
      icon: <CheckCircle2 className="w-5 h-5 text-green-700" />,
      iconBg: 'bg-green-50 border border-green-200',
      title: 'Withdrawal Approved',
      amountColor: 'text-green-700',
      amountPrefix: '−',
      statusLabel: 'Paid out',
    };
  }
  if (type === 'withdrawal_rejected') {
    return {
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      iconBg: 'bg-red-50 border border-red-200',
      title: 'Withdrawal Declined',
      amountColor: 'text-red-500',
      amountPrefix: '−',
      statusLabel: 'Funds returned to wallet',
    };
  }
  return {
    icon: <ArrowDownLeft className="w-5 h-5 text-green-700" />,
    iconBg: 'bg-green-50 border border-green-200',
    title: activity.name || 'Contribution',
    amountColor: 'text-green-700',
    amountPrefix: '+',
    statusLabel: null as string | null,
  };
}

type Tab = 'all' | 'contributions' | 'wallet';

const ActivitiesPage: React.FC = () => {
  const { collections } = useCollectionStore();
  const { activities, isLoading, getActivities } = useActivities() as any;
  const [tab, setTab] = useState<Tab>('all');

  // The BE merges contributions + withdrawals into one sorted feed under
  // /dashboard/activities. Previously this page queried Supabase
  // contributions directly, which silently dropped withdrawal activity
  // — the user couldn't see their pending/approved/rejected withdrawals.
  useEffect(() => {
    getActivities();
  }, []);

  const filtered = useMemo(() => {
    const rows = Array.isArray(activities) ? activities : [];
    if (tab === 'all') return rows;
    if (tab === 'contributions') {
      return rows.filter((r: any) => (r.category || 'contribution') === 'contribution');
    }
    return rows.filter((r: any) => r.category === 'wallet');
  }, [activities, tab]);

  const walletCount = useMemo(
    () => (Array.isArray(activities) ? activities.filter((r: any) => r.category === 'wallet').length : 0),
    [activities]
  );
  const contribCount = useMemo(
    () => (Array.isArray(activities) ? activities.filter((r: any) => (r.category || 'contribution') === 'contribution').length : 0),
    [activities]
  );

  const Pill = ({ id, label, count }: { id: Tab; label: string; count: number }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        tab === id
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
      }`}
    >
      {label} <span className="opacity-60">({count})</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
        <p className="text-sm text-gray-500 mt-1">
          Contributions you've received and withdrawals you've requested.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill id="all" label="All" count={(activities as any[] | undefined)?.length || 0} />
        <Pill id="contributions" label="Contributions" count={contribCount} />
        <Pill id="wallet" label="Wallet" count={walletCount} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity in this category yet.</p>
            )}
            {filtered.map((activity: any) => {
              const matchedCollection = collections.find((c: any) => c.id === activity.collection_id);
              const collectionName =
                activity.collection_title || activity.collection?.title || matchedCollection?.title || '';
              const meta = getActivityMeta(activity);
              const isWithdrawal = activity.category === 'wallet';
              const primaryLabel = isWithdrawal
                ? meta.title
                : (activity.name || 'Anonymous Contributor');

              return (
                <div
                  key={activity.id}
                  className="flex items-center bg-gray-50 hover:bg-gray-100 transition-colors py-4 px-4 rounded-xl justify-between gap-4 border border-gray-100"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`p-2 rounded-full shrink-0 ${meta.iconBg}`}>{meta.icon}</div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{primaryLabel}</p>
                      <p className="text-sm text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                        <span className={`font-semibold ${meta.amountColor}`}>
                          {meta.amountPrefix}{formatCurrency(activity.amount)}
                        </span>
                        {collectionName && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-600 font-medium truncate min-w-0">
                              {collectionName}
                            </span>
                          </>
                        )}
                      </p>
                      {meta.statusLabel && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{meta.statusLabel}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-400 shrink-0 whitespace-nowrap bg-white px-2.5 py-1 rounded-md shadow-sm border border-gray-100">
                    {activity.created_at ? relativeTime(activity.created_at) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivitiesPage;
