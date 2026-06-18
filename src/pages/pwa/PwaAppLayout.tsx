import React, { useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { Home, Grid3X3, Wallet, User, Plus } from 'lucide-react';
import { DashboardHomeSkeleton } from '@/components/ui/page-skeletons';

const PwaAppLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isLoading: authLoading, signOut } = useAuthStore();

    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { icon: Home, label: 'Home', path: '/dashboard' },
        { icon: Grid3X3, label: 'Collections', path: '/collections' },
        { icon: Wallet, label: 'Wallet', path: '/wallet' },
        { icon: User, label: 'Profile', path: '/profile' },
    ];

    const handleSignOut = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login', { replace: true });
        }
    }, [user, authLoading, navigate]);

    if (authLoading) {
        return <DashboardHomeSkeleton />;
    }

    if (!user) return null;

    return (
        <div className="min-h-screen py-4 px-2 bg-gray-50 relative">

            {/* Main Content - render nested routes via Outlet */}
            <main className="mb-[65px]">
                <Outlet />
            </main>

            {/* Pill nav + FAB on top of rectangle */}
            <nav className="fixed left-0 right-0 bottom-0 z-50 backdrop-blur-xl flex justify-center pointer-events-none w-full max-w-4xl rounded-t-xl h-24 bg-[#00994D]/10 items-center shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="relative w-full mx-4 flex items-center justify-center gap-4">
                    {/* Pill container */}
                    <div
                        className="pointer-events-auto rounded-full px-4 py-1 flex items-center justify-between w-full max-w-[60%] bg-gradient-to-br from-[#00994D]/85 to-[#00994D]/85 backdrop-blur-md border border-white/80"
                        style={{
                            maxWidth: '920px',
                            boxShadow:
                                '0 10px 30px rgba(6,95,70,0.18), inset 0 2px 8px rgba(255,255,255,0.03)',
                        }}
                    >
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    aria-label={item.label}
                                    className={`pointer-events-auto flex flex-col items-center justify-center gap-1 transition-all rounded-lg p-2 ${active
                                        ? 'transform scale-110'
                                        : 'hover:scale-105'
                                        } focus:outline-none`}
                                >
                                    <span
                                        className={`flex items-center justify-center rounded-full ${active ? 'bg-white/12' : 'bg-white/6'
                                            } p-3`}
                                        style={{
                                            filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.35))',
                                        }}
                                    >
                                        <Icon
                                            className={`${active ? 'text-white' : 'text-white/90'}`}
                                            strokeWidth={1.6}
                                            style={{ width: 24, height: 24 }}
                                        />
                                    </span>
                                    <span className="text-[12px] font-medium text-white/95 opacity-90 hidden md:block">
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Floating Action Button (FAB) */}
                    <div className="right-0 -top-6 pointer-events-auto">
                        <button
                            onClick={() => navigate('/create-collection')}
                            className="bg-[#00994D]/95 hover:bg-[#00994D]/95 text-white rounded-full p-5 shadow-xl transform transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#00994D]"
                            aria-label="Create new collection"
                        >
                            <Plus className="h-8 w-8" strokeWidth={2} />
                        </button>
                    </div>
                </div>
            </nav>
        </div>
    );
};

export default PwaAppLayout;
