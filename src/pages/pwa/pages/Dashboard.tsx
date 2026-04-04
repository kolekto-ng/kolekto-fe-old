import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/button'
import { useAuthStore } from '../../../store'
import {
  Loader2, Plus, Lock, Layers, Waves, Ticket, Heart,
  Bell, Home, Grid3X3, Wallet, User,
} from 'lucide-react'
import WalletOverview from '../../../components/WalletOverview'
import CollectionsOverview from '../../../components/dashboard/CollectionOverview'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import ActivityFeed from '../../../components/dashboard/ActivityOverview'

const QUICK_ACTIONS = [
  { label: 'Fixed', icon: Lock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', desc: 'Fixed amount' },
  { label: 'Tiered', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', desc: 'Multiple tiers' },
  { label: 'Open Pool', icon: Waves, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', desc: 'Any amount' },
  { label: 'Ticket', icon: Ticket, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', desc: 'Event tickets' },
  { label: 'Fundraising', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', desc: 'Crowdfunding' },
] as const;

const PwaDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuthStore()

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#16a34a]" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="space-y-6">
        <div className="space-y-6 w-full md:w-[55%]">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4" onClick={() => navigate('/profile')}>
              <Avatar className="h-14 w-14">
                {user?.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user?.email || "User"} />
                ) : (
                  <AvatarFallback>
                    {(user?.user_metadata?.full_name?.split(' ')[1] || user?.email || "U").charAt(0)}
                  </AvatarFallback>
                )}
              </Avatar>
              <p className="text-xl font-bold mb-3">
                Hi, {user?.user_metadata?.full_name?.split(' ')[1] || user?.user_metadata?.firstName || 'User'}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>
          </div>

          {/* ── Wallet Balance ──────────────────────────────────────── */}
          <WalletOverview />

          {/* ── Quick Actions ──────────────────────────────────────── */}
          <div>
            <h2 className="text-[18px] md:text-[24px] font-semibold mb-4">Quick actions</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
              {QUICK_ACTIONS.map(({ label, icon: Icon, color, bg, border, desc }) => (
                <Link
                  key={label}
                  to="/create-collection"
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${border} ${bg}
                    cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]`}
                >
                  <div className={`p-2 rounded-lg bg-white shadow-sm border ${border}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-[11px] font-bold ${color} leading-tight`}>{label}</p>
                    <p className="text-[9px] text-gray-500 mt-0.5 hidden sm:block">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Collections ────────────────────────────────────────── */}
          <CollectionsOverview />

          {/* ── Activity Feed ──────────────────────────────────────── */}
          <ActivityFeed />
        </div>
      </main>
    </div>
  )
}

export default PwaDashboard
