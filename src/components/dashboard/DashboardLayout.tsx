import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import DashboardSidebar from './DashboardSidebar';
import MobileBottomNav from './MobileBottomNav';
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthStore } from '@/store/useAuthStore';
import DashboardNavbar from './DashboardNavbar';
import { DashboardShellSkeleton } from '@/components/ui/page-skeletons';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';

const DashboardContent = () => {
  const location = useLocation();
  const { setOpen } = useSidebar();
  const isMobile = useIsMobile();

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setOpen(false);
    }
  }, [location.pathname, setOpen, isMobile]);

  return (
    <div className="flex-1 w-full flex flex-col bg-gray-50 min-w-0">
      <DashboardNavbar />
      <PushNotificationPrompt />
      <main className="p-3 sm:p-6 lg:p-8 pb-24 md:pb-8">
        <div
          key={location.pathname}
          className="animate-in fade-in-0 slide-in-from-bottom-1 duration-150 ease-out"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const DashboardLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return <DashboardShellSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen max-w-[1440px] m-auto flex w-full overflow-hidden">
        {/* Sidebar: desktop only */}
        {!isMobile && <DashboardSidebar />}
        <DashboardContent />
      </div>
      {/* Bottom nav: mobile only */}
      <MobileBottomNav />
    </SidebarProvider>
  );
};

export default DashboardLayout;
