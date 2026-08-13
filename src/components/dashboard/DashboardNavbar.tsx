import React from 'react'
import { useAuthStore } from '@/store/useAuthStore';
import { SidebarTrigger } from '../ui/sidebar';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '../Logo';
import NotificationCenter from './NotificationCenter';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher';

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
  const isMobile = useIsMobile();
  // Touch the auth store so the navbar re-renders on sign-in/out; the
  // NotificationCenter reads the user independently for its own feed.
  useAuthStore((state) => state.user);

  const getPageTitle = () => {
    if (location.pathname.startsWith('/dashboard/collections/')) return 'Collection Details';
    return PAGE_TITLES[location.pathname] ?? 'Dashboard';
  };

  if (isMobile) {
    return (
      <header
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex min-w-0 items-center gap-2">
            <Logo size="sm" />
            {/* Which workspace am I acting as? Kept visible on mobile too —
                organizers manage collections from their phones, and acting in
                the wrong workspace is exactly the mistake this prevents. */}
            <WorkspaceSwitcher className="min-w-0 max-w-[45vw]" />
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
          </div>
        </div>
      </header>
    );
  }

  return (
    <div className="sticky top-0 z-30 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="hidden md:flex" />
          <h1 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h1>
          <span className="text-gray-300" aria-hidden="true">/</span>
          {/* Active workspace context, adjacent to the page title so the answer
              to "who am I acting as?" is always on screen. */}
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter />
        </div>
      </div>
    </div>
  );
};

export default DashboardNavbar;
