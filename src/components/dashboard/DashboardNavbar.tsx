import React from 'react'
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { Bell, Search, ChevronDown, Users } from 'lucide-react';
import { SidebarTrigger } from '../ui/sidebar';
import { useLocation } from 'react-router-dom';

const DashboardNavbar: React.FC = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'Home';
      case '/dashboard/collections':
        return 'Collections';
      case '/dashboard/create-collection':
        return 'Create Collection';
      case '/dashboard/settings':
        return 'Profile';
      case '/dashboard/transactions':
        return 'Wallet';
      default:
        if (location.pathname.startsWith('/dashboard/collections/')) {
          return 'Collection Details';
        }
        return 'Dashboard';
    }
  };

  return (
    <div className='space-y-6 mt-3 mx-[24px]'>
      {/* Header Section */}
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="md:hidden" />
          <div className="ml-2 md:ml-0 text-2xl font-bold">{getPageTitle()}</div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          {/* <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a collection"
              className="pl-10 pr-4 bg-[#D9D9D9] placeholder:font-semibold"
            />
          </div> */}

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </Button>

          {/* Account Dropdown */}
          {/* <Button variant="outline" className="flex items-center gap-2">
            <Users />
            <span className="text-sm">{user?.name || 'User'}</span>
            <ChevronDown className="h-4 w-4" />
          </Button> */}
        </div>

      </div>
    </div>
  )
};

export default DashboardNavbar
