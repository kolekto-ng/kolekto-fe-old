import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useActivities } from '@/store/useDashboard';
import { Loader2 } from 'lucide-react';

interface Activity {
  id: string;
  userName: string;
  action: string;
  amount: number;
  timestamp: string;
  avatar?: string;
}

interface ActivityFeedProps {
  activities?: Activity[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activitiess = [
    { id: '1', userName: 'Lana Steiner', action: 'Paid', amount: 9000000, timestamp: '3 mins ago' },
    { id: '2', userName: 'Lana Steiner', action: 'Paid', amount: 9000000, timestamp: '3 mins ago' },
    { id: '3', userName: 'Lana Steiner', action: 'Paid', amount: 9000000, timestamp: '3 mins ago' },
    { id: '4', userName: 'Lana Steiner', action: 'Paid', amount: 9000000, timestamp: '3 mins ago' },
    { id: '5', userName: 'Lana Steiner', action: 'Paid', amount: 9000000, timestamp: '3 mins ago' },
    { id: '6', userName: 'Lana Steiner', action: 'Paid', amount: 9000000, timestamp: '3 mins ago' },
    { id: '7', userName: 'Lana Steiner', action: 'Paid', amount: 9000000, timestamp: '3 mins ago' },
    { id: '8', userName: 'Lana Steiner', action: 'Paid', amount: 9000000, timestamp: '3 mins ago' },
  ]
}) => {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const { activities, isLoading, getActivities } = useActivities()
  useEffect(() => {
    // Fetch activities from an API or data source if needed
    getActivities();
  }, []);

  // const getInitials = (name: string) => {
  //   return name.split(' ').map(n => n[0]).join('').toUpperCase();
  // };

  console.log(activities, 'activite');


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Activity</h3>
        <Button variant="link" className="text-sm">
          see more
        </Button>
      </div>

      <div className="space-y-4 max-h-screen h-full overflow-y-auto">
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        )}
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center bg-white py-4 px-4 rounded-xl justify-between ">
            <div className="flex items-center gap-3">

              <div className='bg-gray-200 p-1 rounded-[50px]  text-gray-700 text-sm'>
                <svg class="w-6 h-6 text-green-600 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19V5m0 14-4-4m4 4 4-4" />
                </svg>

              </div>

              <div>
                <p className="font-medium text-sm">{activity.name}</p>
                <p className="text-xs text-muted-foreground">
                  {activity.status} {formatCurrency(activity.amount)}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{''}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;