import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useActivities } from '@/store/useDashboard';
import { useNavigate } from 'react-router-dom';
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
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks <= 57) return `${weeks}w ago`;

    return '57w ago';
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

// Determine activity type and styling
function getActivityMeta(activity: any) {
  const type = activity.type || 'contribution';

  if (type === 'withdrawal_requested') {
    return {
      icon: <ArrowUpRight className="w-5 h-5 text-amber-600" />,
      iconBg: 'bg-amber-50 border border-amber-200',
      label: 'Withdrawal Requested',
      sublabel: `Your withdrawal request of ${formatCurrency(activity.amount)} has been placed`,
      amountColor: 'text-amber-700',
      amountPrefix: '−',
    };
  }
  if (type === 'withdrawal_approved' || type === 'withdrawal_completed') {
    return {
      icon: <CheckCircle2 className="w-5 h-5 text-green-700" />,
      iconBg: 'bg-green-50 border border-green-200',
      label: 'Withdrawal Approved',
      sublabel: `Your withdrawal of ${formatCurrency(activity.amount)} has been approved`,
      amountColor: 'text-green-700',
      amountPrefix: '−',
    };
  }
  if (type === 'withdrawal_rejected') {
    return {
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      iconBg: 'bg-red-50 border border-red-200',
      label: 'Withdrawal Declined',
      sublabel: `Your withdrawal request was declined`,
      amountColor: 'text-red-500',
      amountPrefix: '−',
    };
  }
  if (type === 'withdrawal_pending') {
    return {
      icon: <Clock className="w-5 h-5 text-amber-500" />,
      iconBg: 'bg-amber-50 border border-amber-200',
      label: 'Withdrawal Pending',
      sublabel: `Withdrawal of ${formatCurrency(activity.amount)} is being processed`,
      amountColor: 'text-amber-600',
      amountPrefix: '−',
    };
  }
  // Default: contribution / payment received
  return {
    icon: <ArrowDownLeft className="w-5 h-5 text-green-600" />,
    iconBg: 'bg-green-50 border border-green-200',
    label: activity.name || 'Unknown',
    sublabel: null,
    amountColor: 'text-green-700',
    amountPrefix: '+',
  };
}

const PREVIEW_COUNT = 5;

const ActivityFeed: React.FC = () => {
  const { activities, isLoading, getActivities } = useActivities();
  const { collections } = useCollectionStore();
  const navigate = useNavigate();

  useEffect(() => {
    getActivities();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin h-6 w-6 text-gray-400" />
      </div>
    );
  }

  const preview = (activities as any[]).slice(0, PREVIEW_COUNT);

  return (
    <div className="p-0 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[18px] md:text-[24px] font-semibold">Recent Activities</h3>
        {(activities as any[]).length > 0 && (
          <Button
            variant="ghost"
            className="text-[13px] font-semibold text-[#16a34a] hover:text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg h-auto"
            onClick={() => navigate('/dashboard/activities')}
          >
            Show More →
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {preview.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No recent activity yet.
          </div>
        )}
        {preview.map((activity: any) => {
          const matchedCollection = collections.find((c: any) => c.id === activity.collection_id);
          const collectionName = activity.collection_title || activity.collection?.title || matchedCollection?.title || '';
          const meta = getActivityMeta(activity);

          return (
            <div
              key={activity.id}
              className="flex items-center bg-white py-3.5 px-4 rounded-2xl justify-between gap-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`p-2 rounded-full shrink-0 ${meta.iconBg}`}>
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] text-gray-900 truncate">{meta.label}</p>
                  {meta.sublabel ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{meta.sublabel}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      Paid {formatCurrency(activity.amount)}
                      {collectionName && (
                        <span className="text-green-600 font-medium ml-1">· {collectionName}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[13px] font-bold ${meta.amountColor}`}>
                  {meta.amountPrefix}{formatCurrency(activity.amount)}
                </span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {activity.created_at ? relativeTime(activity.created_at) : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {(activities as any[]).length > PREVIEW_COUNT && (
        <Button
          variant="outline"
          className="w-full mt-4 text-[13px] font-semibold border-gray-200 hover:border-green-300 hover:text-green-700 rounded-xl h-11"
          onClick={() => navigate('/dashboard/activities')}
        >
          Show All {(activities as any[]).length} Activities
        </Button>
      )}
    </div>
  );
};

export default ActivityFeed;
