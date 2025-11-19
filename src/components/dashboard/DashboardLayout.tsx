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
import { Loader2, Plus, TrendingUp, Users, DollarSign, Eye } from 'lucide-react';

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
                <div className='flex gap-4 mb-6'>
                  <Button asChild className="bg-green-700 text-[16px] hover:bg-green-800">
                    <Link to="/dashboard/create-collection">
                      <Plus className="mr-2 h-4 w-4 " />
                      Create collection
                    </Link>
                  </Button>
                  {/* <Button
                    variant="secondary"
                    className="bg-green-600 text-white px-10 hover:bg-kolekto/90"
                  >
                    Withdraw
                  </Button> */}
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
