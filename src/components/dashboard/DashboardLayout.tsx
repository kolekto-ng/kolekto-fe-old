import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import DashboardSidebar from './DashboardSidebar';
import MobileBottomNav from './MobileBottomNav';
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthStore } from '@/store/useAuthStore';
import { useProfileStore } from '@/store/useProfileStore';
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
  const fetchKYCStatus = useProfileStore((s) => s.fetchKYCStatus);
  const kycStatusResolved = useProfileStore((s) => s.kycStatusResolved);
  const kycStatusResolvedFor = useProfileStore((s) => s.kycStatusResolvedFor);

  // Resolve verification state BEFORE the dashboard (and the KYC banner
  // inside it) ever paints, so "Verify your account" can never flash in a
  // beat after the rest of the page has already rendered. Every other
  // consumer of KYC data (useKycAccess, KYCSection, the realtime
  // subscription, ...) still calls fetchKYCStatus independently for their
  // own reasons — this effect's only job is to kick the very first fetch off
  // as early as auth allows, since DashboardLayout is the outermost mount
  // point for every protected route.
  //
  // Gated on kycStatusResolvedFor !== user.id (not just kycStatusResolved)
  // so switching accounts — sign out, sign in as someone else — correctly
  // re-blocks on the new user's status instead of reusing the previous
  // user's resolved flag (see useAuthStore.signOut, which resets both).
  const isResolvedForCurrentUser = kycStatusResolved && kycStatusResolvedFor === user?.id;

  useEffect(() => {
    if (user?.id && kycStatusResolvedFor !== user.id) {
      fetchKYCStatus(user.id);
    }
  }, [user?.id, kycStatusResolvedFor, fetchKYCStatus]);

  if (isLoading) {
    return <DashboardShellSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isResolvedForCurrentUser) {
    return <DashboardShellSkeleton />;
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
