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
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Main Content */}
      <main className="px-4 py-6 pb-20 space-y-6">
        <div className="space-y-6 w-full md:w-[55%]">
          <WalletOverview />
          <div>
            <h2 className='text-[24px] font-semibold mb-4'>Quick actions</h2>
            <div className='flex gap-4 mb-6'>
              <Button asChild className="bg-green-600 text-[16px] hover:bg-green-700">
                <Link to="/create-collection">
                  <Plus className="mr-2 h-4 w-4" />
                  Create collection
                </Link>
              </Button>
            </div>
          </div>
          <CollectionsOverview />
        </div>
      </main>

    </div>
  )
}

export default PwaDashboard

