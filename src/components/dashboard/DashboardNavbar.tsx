import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { Bell } from 'lucide-react';
import { SidebarTrigger } from '../ui/sidebar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '../Logo';
import { useActivities } from '@/store/useDashboard';
import { supabase } from '@/integrations/supabase/client';
import {
  countUnseenContributorActivities,
  getLastSeenContributorsAt,
  getNotificationUserId,
  markContributorsSeen,
} from '@/utils/contributorNotifications';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Home',
  '/dashboard/collections': 'Collections',
  '/dashboard/create-collection': 'Create Collection',
  '/dashboard/settings': 'Profile',
  '/dashboard/transactions': 'Wallet',
  '/dashboard/activities': 'Activity',
};

const DashboardNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const user = useAuthStore((state) => state.user);
  const { activities, getActivities } = useActivities();
  const notificationUserId = getNotificationUserId(user);
  const [lastSeenContributorsAt, setLastSeenContributorsAt] = useState(() =>
    getLastSeenContributorsAt(notificationUserId),
  );

  useEffect(() => {
    void getActivities();
  }, [getActivities]);

  useEffect(() => {
    let refreshTimeout: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }

      refreshTimeout = window.setTimeout(() => {
        void getActivities({ force: true });
      }, 350);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void getActivities({ force: true });
      }
    }, 30_000);

    const handleFocus = () => {
      void getActivities({ force: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void getActivities({ force: true });
      }
    };

    const channel = supabase
      .channel('dashboard-activities-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions' },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'withdrawals' },
        scheduleRefresh,
      )
      .subscribe();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [getActivities]);

  useEffect(() => {
    setLastSeenContributorsAt(getLastSeenContributorsAt(notificationUserId));
  }, [notificationUserId]);

  const activityCount = useMemo(
    () =>
      countUnseenContributorActivities(
        activities as any[],
        lastSeenContributorsAt,
      ),
    [activities, lastSeenContributorsAt],
  );

  const openActivities = () => {
    setLastSeenContributorsAt(markContributorsSeen(notificationUserId));
    navigate('/dashboard/activities');
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/dashboard/collections/')) return 'Collection Details';
    return PAGE_TITLES[location.pathname] ?? 'Dashboard';
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.user_metadata?.firstName
    || user?.email?.split('@')[0]
    || 'there';

  const BellButton = () => (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9"
      onClick={openActivities}
      aria-label={`Contributor notifications${activityCount > 0 ? ` (${activityCount})` : ''}`}
    >
      <Bell className="h-5 w-5 text-gray-600" />
      {activityCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 ring-2 ring-white">
          {activityCount > 99 ? '99+' : activityCount}
        </span>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <header
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <BellButton />
          </div>
        </div>
      </header>
    );
  }

  return (
    <div className="sticky top-0 z-30 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="hidden md:flex" />
          <h1 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h1>
        </div>
        <div className="flex items-center gap-2">
          <BellButton />
        </div>
      </div>
    </div>
  );
};

export default DashboardNavbar;
