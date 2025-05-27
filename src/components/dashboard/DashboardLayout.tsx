import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import DashboardSidebar from './DashboardSidebar';
import { useIsMobile } from "@/hooks/use-mobile";
import { initializeAuth, useAuthStore } from '@/store';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from "lucide-react";

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
      case '/dashboard/profile':
        return 'Profile';
      case '/dashboard/transactions':
        return 'Transaction History';
      default:
        if (location.pathname.startsWith('/dashboard/collections/')) {
          return 'Collection Details';
        }
        return 'Dashboard';
    }
  };

  return (
    <div className="flex-1 w-full">
      <div className="p-3 sm:p-6 lg:p-8">
        <div className="flex items-center mb-4">
          <SidebarTrigger className="md:hidden" />
          <div className="ml-2 md:ml-0 text-xl font-bold">{getPageTitle()}</div>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

const DashboardLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const { user, isLoading } = useAuth();

  // Initialize auth store when component mounts
  useEffect(() => {
    initializeAuth();
  }, []);

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
      <div className="min-h-screen flex w-full overflow-hidden">
        <DashboardSidebar />
        <DashboardContent />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
