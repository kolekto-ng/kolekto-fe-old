import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/button'
import { useAuthStore } from '../../../store'
import {
  Loader2, Plus, Lock, Layers, Waves, Ticket, Heart,
  Bell,
} from 'lucide-react'
import WalletOverview from '../../../components/WalletOverview'
import CollectionsOverview from '../../../components/dashboard/CollectionOverview'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import ActivityFeed from '../../../components/dashboard/ActivityOverview'
import { useActivities } from '../../../store/useDashboard'

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
  const { activities, getActivities } = useActivities()

  useEffect(() => {
    getActivities()
  }, [])

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
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => navigate('/create-collection')} 
                className="bg-[#16a34a] hover:bg-green-700 text-white rounded-full font-medium h-9 px-4 shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Create Collection</span>
                <span className="sm:hidden">Create</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate('/dashboard/activities')}
                aria-label={`Notifications${(activities as any[]).length > 0 ? ` (${(activities as any[]).length})` : ''}`}
              >
                <Bell className="h-5 w-5" />
                {(activities as any[]).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 shadow-sm">
                    {(activities as any[]).length > 99 ? '99+' : (activities as any[]).length}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* ── Wallet Balance ──────────────────────────────────────── */}
          <WalletOverview />

          {/* ── Quick Actions ──────────────────────────────────────── */}
          <div>
            <h2 className="text-[18px] md:text-[24px] font-semibold mb-4">Create a Collection</h2>
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_ACTIONS.map(({ label, icon: Icon, color, bg }) => (
                <Link
                  key={label}
                  to="/create-collection"
                  className="flex flex-col items-center gap-2 min-w-[60px] flex-1 py-2 px-1 rounded-2xl active:scale-95 transition-transform"
                >
                  <div className={`flex items-center justify-center w-[52px] h-[52px] rounded-2xl ${bg} shadow-sm`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                  <span className={`text-[11px] font-semibold ${color} text-center leading-tight`}>{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Prominent Create Collection CTA ────────────────────── */}
          <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-green-50/50 transform origin-left transition-transform group-hover:scale-x-100"></div>
            <div className="relative z-10 flex text-center sm:text-left flex-col items-center sm:items-start gap-1">
              <h3 className="font-bold text-gray-900 text-lg">Start a New Collection</h3>
              <p className="text-sm text-gray-500">Pick a template or start from scratch and gather funds effortlessly.</p>
            </div>
            <Button 
              onClick={() => navigate('/create-collection')}
              className="relative z-10 bg-[#16a34a] hover:bg-green-700 text-white rounded-xl px-6 py-5 shadow-md w-full sm:w-auto font-semibold flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Create Collection
            </Button>
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
