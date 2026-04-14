import React from 'react'
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { Bell } from 'lucide-react';
import { SidebarTrigger } from '../ui/sidebar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '../Logo';

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

  const getPageTitle = () => {
    if (location.pathname.startsWith('/dashboard/collections/')) return 'Collection Details';
    return PAGE_TITLES[location.pathname] ?? 'Dashboard';
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.user_metadata?.firstName
    || user?.email?.split('@')[0]
    || 'there';

  if (isMobile) {
    // Mobile: compact sticky header with logo + greeting + bell
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
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
            </Button>
          </div>
        </div>
      </header>
    );
  }

  // Desktop: sidebar trigger + page title + notifications
  return (
    <div className="sticky top-0 z-30 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="hidden md:flex" />
          <h1 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardNavbar;
