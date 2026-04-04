import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useActivities } from '@/store/useDashboard';
import { Loader2, ArrowDownLeft } from 'lucide-react';

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

const ActivityFeed: React.FC = () => {
  const { activities, isLoading, getActivities } = useActivities();

  useEffect(() => {
    getActivities();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-0 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[18px] md:text-[24px] font-semibold">Activities</h3>
        <Button variant="link" className="text-[16px]">
          see more
        </Button>
      </div>

      <div className="space-y-4 max-h-screen h-full overflow-y-auto">
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        )}
        {activities.map((activity: any) => {
          const collectionName = activity.collection_title || activity.collection?.title || '';

          return (
            <div key={activity.id} className="flex items-center bg-white py-4 px-4 rounded-xl justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="bg-gray-200 p-1 rounded-full text-gray-700 text-sm shrink-0">
                  <ArrowDownLeft className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{activity.name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    paid {formatCurrency(activity.amount)}
                    {collectionName && (
                      <span className="text-gray-500"> · {collectionName}</span>
                    )}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                {activity.created_at ? relativeTime(activity.created_at) : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityFeed;
