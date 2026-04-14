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
  LogOut,
  PlusCircle,
  History,
  Home,
  BarChart2,
  Settings,
  Layers3,
  MessageCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthStore } from '@/store';
import { useProfileStore } from '@/store/useProfileStore';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const primaryNavItems: NavItem[] = [
  { label: 'Home', path: '/dashboard', icon: Home },
  { label: 'Collections', path: '/dashboard/collections', icon: BarChart2 },
  { label: 'Activities', path: '/dashboard/activities', icon: History },
  { label: 'Wallet', path: '/dashboard/transactions', icon: Layers3 },
];

const secondaryNavItems: NavItem[] = [
  { label: 'Profile', path: '/dashboard/settings', icon: Settings },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const user = useAuthStore((state) => state.user);
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { setActiveSection } = useProfileStore();

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== '/dashboard' && location.pathname.startsWith(path));

  const close = () => { if (isMobile) setOpenMobile(false); };

  const handleNav = (path: string) => {
    navigate(path);
    close();
  };

  const handleSignOut = async () => {
    await signOut();
    close();
  };

  const handleKycNavigation = () => {
    setActiveSection('kyc');
    handleNav('/dashboard/settings');
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() || '')
    .join('');

  return (
    <Sidebar className="border-r border-gray-100">
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <SidebarHeader className="px-4 py-5 bg-white">
        <Link to="/dashboard" onClick={close}>
          <Logo size="md" />
        </Link>
      </SidebarHeader>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <SidebarContent className="px-3 py-4 flex flex-col gap-6 bg-white">
        {/* Primary nav */}
        <nav className="space-y-1">
          <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
            Menu
          </p>
          {primaryNavItems.map(({ label, path, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => handleNav(path)}
                className={`
                  group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150 outline-none
                  ${active
                    ? 'bg-kolekto text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span className="flex-1 text-left">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </button>
            );
          })}
        </nav>

        {/* Create CTA */}
        <div className="px-1">
          <button
            onClick={() => handleNav('/dashboard/create-collection')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold
              transition-all duration-150 border
              ${isActive('/dashboard/create-collection')
                ? 'bg-kolekto text-white border-kolekto shadow-sm'
                : 'text-kolekto border-kolekto/30 bg-kolekto/5 hover:bg-kolekto hover:text-white hover:border-kolekto'
              }
            `}
          >
            <PlusCircle className="w-4 h-4 flex-shrink-0" />
            Create Collection
          </button>
        </div>

        {/* Secondary nav */}
        <nav className="space-y-1">
          <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
            Account
          </p>
          {secondaryNavItems.map(({ label, path, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => handleNav(path)}
                className={`
                  group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${active
                    ? 'bg-kolekto text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span className="flex-1 text-left">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </button>
            );
          })}

          <button
            onClick={handleKycNavigation}
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150"
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
            KYC Verification
          </button>
        </nav>
      </SidebarContent>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <SidebarFooter className="px-3 py-4 bg-white border-t border-gray-100">
        {/* Support link */}
        <a
          href="https://wa.me/+2349019840377"
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150 mb-1"
        >
          <MessageCircle className="w-4 h-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
          Support
        </a>

        {/* User card */}
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-kolekto flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold leading-none">{initials || '?'}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{userName}</p>
              <p className="text-xs text-gray-400 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default DashboardSidebar;
