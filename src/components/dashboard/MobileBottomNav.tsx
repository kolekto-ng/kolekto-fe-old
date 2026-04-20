import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, Wallet, User, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Collections', icon: LayoutGrid, path: '/dashboard/collections' },
  { label: 'Wallet', icon: Wallet, path: '/dashboard/transactions' },
  { label: 'Profile', icon: User, path: '/dashboard/settings' },
];

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(path);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" />

      <div className="relative flex items-center justify-around px-2 pt-2 pb-1">
        {NAV_ITEMS.map(({ label, icon: Icon, path }, idx) => {
          const active = isActive(path);

          // Insert FAB in the middle (after index 1)
          const showFab = idx === 2;

          return (
            <React.Fragment key={path}>
              {showFab && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate('/dashboard/create-collection')}
                  className="relative -top-5 flex-shrink-0 w-14 h-14 bg-kolekto rounded-full flex items-center justify-center shadow-lg shadow-kolekto/30 border-4 border-white"
                  aria-label="Create Collection"
                >
                  <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
                </motion.button>
              )}

              <button
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-0.5 min-w-[56px] py-1 px-2 rounded-xl transition-colors"
                aria-label={label}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    active ? 'bg-kolekto/10' : ''
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors duration-200 ${
                      active ? 'text-kolekto' : 'text-gray-400'
                    }`}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    active ? 'text-kolekto' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-dot"
                    className="w-1 h-1 rounded-full bg-kolekto mt-0.5"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
