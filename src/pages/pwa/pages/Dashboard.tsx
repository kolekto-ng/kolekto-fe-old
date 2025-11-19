import React, { useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { formatCurrency } from '../../../utils/formatters'
import { useAuthStore } from '../../../store'
import { useCollectionStore } from '../../../store/useCollectionStore'
import { useContributionStore } from '../../../store/useContributionStore'
import { useWithdrawalStore } from '../../../store/useWithdrawalStore'
import { useDashboard } from '../../../store/useDashboardStore'
import { Loader2, Plus, TrendingUp, Eye, Menu, LogOut, Settings, Wallet, Home, Grid3X3, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import DashboardLayout from '../../../components/dashboard/DashboardLayout'
import WalletOverview from '../../../components/WalletOverview'
import CollectionsOverview from '../../../components/dashboard/CollectionOverview'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Search, ChevronDown, Users } from 'lucide-react';
import ActivityFeed from '../../../components/dashboard/ActivityOverview'
const PwaDashboard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading: authLoading, signOut } = useAuthStore()

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Grid3X3, label: 'Collections', path: '/collections' },
    { icon: Wallet, label: 'Wallet', path: '/wallet' },
    { icon: User, label: 'Profile', path: '/profile' },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Show loader if any relevant data is loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#16a34a]" />
      </div>
    )
  }

  // Redirect if no user
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <main className=" space-y-6">
        <div className="space-y-6 w-full md:w-[55%]">
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-4' onClick={() => navigate('/profile')}>
              <Avatar className="h-14 w-14">
                {user?.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user?.email || "User"} />
                ) : (
                  <AvatarFallback>{(user?.user_metadata.full_name.split(' ')[1] || user?.email || "U").charAt(0)}</AvatarFallback>
                )}
              </Avatar>
              <p className="text-xl font-bold mb-3">
                Hi, {user?.user_metadata.full_name.split(' ')[1] || user?.user_metadata.firstName || 'User'}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>
          </div>
          <WalletOverview />
          <div>
            <h2 className='text-[18px] md:text-[24px] font-semibold mb-4'>Quick actions</h2>
            <div className='flex gap-4 mb-6'>
              <Button asChild className="bg-green-600 text-[16px] font-semibold hover:bg-green-700">
                <Link to="/create-collection">
                  <Plus className="mr-2 h-4 w-4" />
                  Create collection
                </Link>
              </Button>
            </div>
          </div>
          <CollectionsOverview />
          <ActivityFeed />
        </div>
      </main>

    </div>
  )
}

export default PwaDashboard

