import React, { useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { Loader2, Menu, LogOut, Home, Grid3X3, Wallet, User, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

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
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-emerald-700/10 relative">


            {/* Main Content - render nested routes via Outlet */}
            <main className="">
                <Outlet />
            </main>

            {/* Pill nav + FAB on top of rectangle */}
            <nav className="fixed left-0 right-0 bottom-0 z-5 backdrop-blur-xl bg-transparent flex justify-center pointer-events-none  w-full max-w-4xl rounded-t-xl h-24 bg-emerald-700 items-center shadow-2xl">
                <div className="relative w-full mx-4 flex items-center justify-center gap-4">
                    {/* Pill container */}
                    <div
                        className="pointer-events-auto rounded-full px-4 py-1 flex items-center justify-between w-full max-w-[60%] bg-gradient-to-br from-emerald-600/85 to-emerald-500/85 backdrop-blur-md border border-white/10"
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
                            className="bg-emerald-500/95 hover:bg-emerald-600/95 text-white rounded-full p-5 shadow-xl transform transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
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