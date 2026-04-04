import React, { useEffect } from 'react';
import WalletOverview from '../WalletOverview';
import CollectionsOverview from './CollectionOverview';
import ActivityFeed from './ActivityOverview';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import DashboardSidebar from './DashboardSidebar';
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Loader2, Plus, TrendingUp, Users, DollarSign, Eye, Lock, Layers, Waves, Ticket, Heart } from 'lucide-react';

import DashboardNavbar from './DashboardNavbar';

const DashboardContent = () => {
  const location = useLocation();
  const { setOpen } = useSidebar();
  const isMobile = useIsMobile();

  // Close sidebar when route changes
  useEffect(() => {
    // Always close sidebar on mobile when route changes
    if (isMobile) {
      setOpen(false);
    }
  }, [location.pathname, setOpen, isMobile]);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'Dashboard';
      case '/dashboard/collections':
        return 'Collections';
      case '/dashboard/create-collection':
        return 'Create Collection';
      case '/dashboard/settings':
        return 'Settings';
      case '/dashboard/transactions':
        return 'Wallet Overview';
      default:
        if (location.pathname.startsWith('/dashboard/collections/')) {
          return 'Collection Details';
        }
        return 'Dashboard';
    }
  };

  return (
    <div className="flex-1 w-full w-max-[] flex flex-col bg-gray-50">
      <DashboardNavbar />
      <div className="p-3 sm:p-6 lg:p-8">
        {/* <div className="flex items-center mb-4">
          <SidebarTrigger className="md:hidden" />
          <div className="ml-2 md:ml-0 text-xl font-bold">{getPageTitle()}</div>
        </div> */}


        {/* NEW TWO-COLUMN LAYOUT */}
        {location.pathname === '/dashboard' ? (
          <div className="flex flex-col md:flex-row justify-between w-full items-start gap-6">
            {/* LEFT COLUMN - Account Overview + Collections */}
            <div className="space-y-6 w-full md:w-[55%]">
              <WalletOverview />
              <div>
                <h2 className='text-[24px] font-semibold mb-4'>Quick actions</h2>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'Fixed', icon: Lock, desc: 'Fixed amount' },
                    { label: 'Tiered', icon: Layers, desc: 'Multiple tiers' },
                    { label: 'Open Pool', icon: Waves, desc: 'Any amount' },
                    { label: 'Ticket', icon: Ticket, desc: 'Event tickets' },
                    { label: 'Fundraising', icon: Heart, desc: 'Crowdfunding' },
                  ].map(({ label, icon: Icon, desc }) => (
                    <Link
                      key={label}
                      to="/dashboard/create-collection"
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white
                        cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className="p-2 rounded-lg bg-gray-100 border border-gray-200">
                        <Icon className="h-5 w-5 text-gray-700" />
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] font-bold text-gray-800 leading-tight">{label}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5 hidden sm:block">{desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <CollectionsOverview />
            </div>

            {/* RIGHT COLUMN - Activity */}
            <div className="w-full md:w-[40%]">
              <ActivityFeed />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
};

const DashboardLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-kolekto" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen max-w-[1440px] m-auto flex w-full overflow-hidden">
        <DashboardSidebar />
        <DashboardContent />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
