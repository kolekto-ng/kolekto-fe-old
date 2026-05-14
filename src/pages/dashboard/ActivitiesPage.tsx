import React, { useEffect } from 'react';
import { useActivities } from '@/store/useDashboard';
import { useCollectionStore } from '@/store';
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

import { supabase } from '@/integrations/supabase/client';

const ActivitiesPage: React.FC = () => {
  const { collections } = useCollectionStore();
  const [activities, setActivities] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    const fetchAllActivities = async () => {
      setIsLoading(true);
      try {
        if (!collections || collections.length === 0) {
          setActivities([]);
          return;
        }

        const collectionIds = collections.map((c: any) => c.id);
        const { data, error } = await supabase
          .from('contributions')
          .select('*')
          .in('collection_id', collectionIds)
          .eq('status', 'paid')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Error fetching all activities:", error);
        } else {
          setActivities(data || []);
        }
      } catch (err) {
        console.error("Activities fetch exception:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllActivities();
  }, [collections]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
        <p className="text-sm text-gray-500 mt-1">A complete history of all collection contributions.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {activities.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
            {activities.map((activity: any) => {
              const matchedCollection = collections.find((c: any) => c.id === activity.collection_id);
              const collectionName = activity.collection_title || activity.collection?.title || matchedCollection?.title || '';

              return (
                <div key={activity.id} className="flex items-center bg-gray-50 hover:bg-gray-100 transition-colors py-4 px-4 rounded-xl justify-between gap-4 border border-gray-100">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="bg-green-100 p-2 rounded-full text-green-700 shrink-0">
                      <ArrowDownLeft className="w-5 h-5 text-green-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {activity.name || 'Anonymous Contributor'}
                      </p>
                      <p className="text-sm text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-gray-700">{formatCurrency(activity.amount)}</span>
                        {collectionName && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-green-600 font-medium truncate min-w-0">
                              ✅ {collectionName}
                            </span>
                          </>
                        )}
                      </p>
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
