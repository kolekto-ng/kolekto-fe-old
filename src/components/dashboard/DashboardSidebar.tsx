
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../Logo';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import {
  Users,
  CreditCard,
  LogOut,
  PlusCircle,
  BarChart3,
  History,
  Home,
  BarChart2,
  Flag,
  Settings,
} from 'lucide-react';

import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthStore } from '@/store';
import { Layers3 } from 'lucide-react';

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const user = useAuthStore((state) => state.user);
  const { setOpen } = useSidebar();
  const isMobile = useIsMobile();

  const isActive = (path: string) => {
    return location.pathname === path ||
      (path !== '/dashboard' && location.pathname.startsWith(path));
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="py-4 px-3">
        <Logo size="md" />
      </SidebarHeader>

      <SidebarContent className="px-3">
        <div className="space-y-2">
          <Button
            variant={isActive('/dashboard') ? 'default' : 'ghost'}
            className={`w-full justify-start transition-all duration-200 ${isActive('/dashboard')
              ? 'bg-kolekto text-white font-semibold border-l-4 border-kolekto-dark scale-105'
              : 'hover:bg-kolekto/10 hover:text-kolekto'
              }`}
            size="sm"
            onClick={() => handleNavigation('/dashboard')}
          >
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>

          <Button
            variant={isActive('/dashboard/collections') ? 'default' : 'ghost'}
            className={`w-full justify-start transition-all duration-200 ${isActive('/dashboard/collections')
              ? 'bg-kolekto text-white font-semibold border-l-4 border-kolekto-dark scale-105'
              : 'hover:bg-kolekto/10 hover:text-kolekto'
              }`}
            size="sm"
            onClick={() => handleNavigation('/dashboard/collections')}
          >
            <BarChart2 className="mr-2 h-4 w-4" />
            Collections
          </Button>

          <Button
            variant={isActive('/dashboard/create-collection') ? 'default' : 'ghost'}
            className={`w-full justify-start transition-all duration-200 ${isActive('/dashboard/create-collection')
              ? 'bg-kolekto text-white font-semibold border-l-4 border-kolekto-dark scale-105'
              : 'hover:bg-kolekto/10 hover:text-kolekto'
              }`}
            size="sm"
            onClick={() => handleNavigation('/dashboard/create-collection')}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Collection
          </Button>


          {/* <Button
            variant={isActive('/dashboard/create-collection') ? 'default' : 'ghost'}
            className={`w-full justify-start transition-all duration-200 ${isActive('/dashboard/create-collection')
              ? 'bg-kolekto text-white font-semibold border-l-4 border-kolekto-dark scale-105'
              : 'hover:bg-kolekto/10 hover:text-kolekto'
              }`}
            size="sm"
            onClick={() => handleNavigation('/dashboard/create-collection')}
          >
            <Flag className="mr-2 h-4 w-4" />
            Referall
          </Button> */}

          <Button
            variant={isActive('/dashboard/settings') ? 'default' : 'ghost'}
            className={`w-full justify-start transition-all duration-200 ${isActive('/dashboard/profile')
              ? 'bg-kolekto text-white font-semibold border-l-4 border-kolekto-dark scale-105'
              : 'hover:bg-kolekto/10 hover:text-kolekto'
              }`}
            size="sm"
            onClick={() => handleNavigation('/dashboard/settings')}
          >
            <Users className="mr-2 h-4 w-4" />
            Profile
          </Button>

          <Button
            variant={isActive('/dashboard/transactions') ? 'default' : 'ghost'}
            className={`w-full justify-start transition-all duration-200 ${isActive('/dashboard/transactions')
              ? 'bg-kolekto text-white font-semibold border-l-4 border-kolekto-dark scale-105'
              : 'hover:bg-kolekto/10 hover:text-kolekto'
              }`}
            size="sm"
            onClick={() => handleNavigation('/dashboard/transactions')}
          >
            <Layers3 className="mr-2 h-4 w-4" />
            Wallet 
          </Button>
        </div>
      </SidebarContent>

      <SidebarFooter className="px-3 py-6">
        <div className='space-y-2'>
          <Button
          variant="ghost"
          className="w-full justify-start hover:bg-kolekto/10 hover:text-kolekto"
          size="sm"
          onClick={() => handleNavigation('/dashboard/support')}
          >
            <BarChart2 className="mr-2 h-4 w-4"/>
              Support
          </Button>

          <Button
          variant="ghost"
           className="w-full justify-start hover:bg-kolekto/10 hover:text-kolekto"
          size="sm"
           onClick={() => handleNavigation('/dashboard/settings')}
          >
            <Settings className="mr-2 h-4 w-4"/>
              Setting
          </Button>

          <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-kolekto/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-kolekto/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-kolekto" />
          </div>
          <div className="flex flex-col">
           <span className="text-sm font-medium text-foreground text-white">
            {user?.name || 'Reel Mein'}
              </span>
            <span className="text-xs text-muted-foreground text-white">
              {user?.email || 'olivia@untitledui.com'}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default DashboardSidebar;
