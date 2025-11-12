import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { formatCurrency } from '../../utils/formatters'
import { useAuthStore } from '../../store'
import { useCollectionStore } from '../../store/useCollectionStore'
import { useContributionStore } from '../../store/useContributionStore'
import { useWithdrawalStore } from '../../store/useWithdrawalStore'
import { useDashboard } from '../../store/useDashboardStore'
import { Loader2, Plus, TrendingUp, Eye, Menu, LogOut, Settings, Wallet } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'

const PwaDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, isLoading: authLoading, signOut } = useAuthStore()
  const { collections, fetchCollections, isLoading: collectionsLoading } = useCollectionStore()
  const { contributions, fetchContributions } = useContributionStore()
  const { withdrawals, fetchWithdrawals } = useWithdrawalStore()

  const { stats, recentPayments, isLoading } = useDashboard(collections, contributions, user?.id)

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (user?.id) {
      fetchCollections(user.id)
      fetchWithdrawals(user.id)
    }
  }, [user, user?.id, fetchCollections, fetchWithdrawals, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Show loader if any relevant data is loading
  if (authLoading || collectionsLoading || isLoading) {
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

  // Sort collections by created_at descending (newest first)
  const sortedCollections = [...collections].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime()
    const dateB = new Date(b.created_at).getTime()
    return dateB - dateA
  })

  // Calculate wallet balance
  const totalBalance = withdrawals?.reduce((sum: number, w: any) => {
    return sum + (w.status === 'pending' ? w.amount : 0)
  }, 0) || 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#16a34a]">Kolekto</h1>
            <p className="text-xs text-gray-500">Dashboard</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user?.email}</p>
                  <p className="text-xs text-gray-500 font-normal">
                    {user?.user_metadata?.full_name || 'User'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 pb-20 space-y-6">
        {/* Wallet Card */}
        <Card className="bg-gradient-to-br from-[#16a34a] to-[#15803d] text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <p className="text-sm opacity-90">Wallet Balance</p>
              </div>
            </div>
            <p className="text-3xl font-bold mb-4">{formatCurrency(totalBalance)}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => {
                  // Navigate to withdraw page (to be created)
                }}
              >
                Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_collections || 0}</div>
              <p className="text-xs text-gray-500">Collections</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.active_collections || 0}</div>
              <p className="text-xs text-gray-500">Collections</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Action */}
        <Button
          className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white"
          size="lg"
          onClick={() => {
            // Navigate to create collection (to be created)
          }}
        >
          <Plus className="mr-2 h-5 w-5" />
          Create New Collection
        </Button>

        {/* Recent Collections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Collections</CardTitle>
          </CardHeader>
          <CardContent>
            {collections.length > 0 ? (
              <div className="space-y-4">
                {sortedCollections.slice(0, 5).map((collection) => (
                  <div
                    key={collection.id}
                    className="flex items-start justify-between pb-4 border-b last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1">{collection.title}</p>
                      <p className="text-sm text-gray-600">{collection.formattedAmount}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">
                          {collection.total_contributions || 0} contributions
                        </span>
                        <span className="text-xs">•</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            collection.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : collection.deadline && new Date(collection.deadline) > new Date()
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {collection.status === 'completed'
                            ? 'Completed'
                            : collection.deadline && new Date(collection.deadline) > new Date()
                            ? 'Active'
                            : 'Expired'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                      onClick={() => {
                        // Navigate to collection details
                      }}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No collections yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Navigate to create collection
                  }}
                >
                  Create Your First Collection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex items-center justify-around py-3">
          <button className="flex flex-col items-center gap-1 text-[#16a34a]">
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs font-medium">Dashboard</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-gray-400"
            onClick={() => {
              // Navigate to collections
            }}
          >
            <Eye className="h-5 w-5" />
            <span className="text-xs">Collections</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-gray-400"
            onClick={() => {
              // Navigate to wallet/transactions
            }}
          >
            <Wallet className="h-5 w-5" />
            <span className="text-xs">Wallet</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

export default PwaDashboard

