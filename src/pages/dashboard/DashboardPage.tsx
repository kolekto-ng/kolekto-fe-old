import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/utils/formatters';

import { useDashboard, useDashboardStore } from '@/store/useDashboardStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useContributionStore } from '@/store/useContributionStore';
import { useWithdrawalStore } from '@/store/useWithdrawalStore';
import { Loader2, Plus, TrendingUp, Users, DollarSign, Eye } from 'lucide-react';
import { useAuthStore } from '@/store';
import { ContributionTransactions } from '@/components/dashboard/ContributionTransactions';

const DashboardPage: React.FC = () => {
  const { user, isLoading: authloading } = useAuthStore();
  const { collections, fetchCollections, isLoading: collectionsLoading } = useCollectionStore();
  const { contributions, fetchContributions } = useContributionStore();
  const { withdrawals, fetchWithdrawals } = useWithdrawalStore();

  const { stats, recentPayments, isLoading } = useDashboard(collections, contributions, user?.id);

  useEffect(() => {
    if (user?.id) {
      fetchCollections(user.id);
      fetchWithdrawals(user.id);
    }
  }, [user?.id, fetchCollections, fetchWithdrawals]);

  // Show loader if any relevant data is loading
  if (authloading || collectionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Sort collections by created_at ascending (oldest first)
  const sortedCollections = [...collections].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA; // Newest first
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild className="bg-kolekto hover:bg-kolekto/90">
          <Link to="/dashboard/create-collection">
            <Plus className="mr-2 h-4 w-4" />
            New Collection
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collections</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_collections || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Collections</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_collections || 0}</div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contributions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_contributions || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.total_amount || 0)}</div>
          </CardContent>
        </Card> */}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Collections</CardTitle>
          </CardHeader>
          <CardContent>
            {collections.length > 0 ? (
              <div className="space-y-4">
                {sortedCollections.slice(0, 5).map(collection => (
                  <div key={collection.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{collection.title}</p>
                      <p className="text-sm text-gray-500">{collection.formattedAmount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{collection.total_contributions || 0} Contributions</p>
                      <p className="text-xs text-gray-500">
                        {collection.status === "completed"
                          ? "completed"
                          : collection.deadline && new Date(collection.deadline) > new Date()
                            ? "active"
                            : "expired"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No collections yet</p>
            )}
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length > 0 ? (
              <div className="space-y-4">
                {recentPayments.map(payment => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{payment.description}</p>
                      <p className="text-sm text-gray-500">{payment.collections?.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No payments yet</p>
            )}
          </CardContent>
        </Card> */}
        {/* <ContributionTransactions /> */}
      </div>
    </div>
  );
};

export default DashboardPage;
