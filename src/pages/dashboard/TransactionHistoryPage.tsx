import React, { useState, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';
import { useCollectionStore, useWithdrawalStore } from '@/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, History } from 'lucide-react';

// Simple currency formatter for NGN
const formatCurrency = (amount: number) =>
  '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 0 });

interface CollectionEarning {
  id: string;
  name: string;
  type: string;
  totalRaised: number;
  currentBalance: number;
  amountWithdrawn: number;
  availableBalance: number;
  pendingBalance: number;
}

interface RecentTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  collection: string;
  amount: number;
  date: string;
  status: 'pending' | 'successful' | 'failed' | string;
  description: string;
}

const TransactionHistoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('collections');
  const [collectionEarnings, setCollectionEarnings] = useState<CollectionEarning[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);

  const { collections } = useCollectionStore()

  const { withdrawals } = useWithdrawalStore()

  useEffect(() => {
    // Sort collections by created_at descending (newest first)
    const sortedCollections = [...collections].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    // Map sorted collections to CollectionEarning format
    const withdrawalsArray = Array.isArray(withdrawals)
      ? withdrawals
      : withdrawals
        ? [withdrawals]
        : [];

    const earnings = sortedCollections.map((col) => {
      // Supabase 1-to-1 relationships return an object, 1-to-many return an array
      const wallet = col.wallets ? (Array.isArray(col.wallets) ? col.wallets[0] || {} : col.wallets) : {};

      // Compute withdrawn amount for this collection specifically from the withdrawals store
      const colWithdrawals = withdrawalsArray.filter((w: any) => w.collection_id === col.id && (w.status === 'completed' || w.status === 'successful'));
      const withdrawnTotal = colWithdrawals.reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);
      
      const totalRaised = wallet.gross_payment || col.total_amount || 0;
      const currentBalance = wallet.ledger_balance || Math.max(0, totalRaised - withdrawnTotal);

      return {
        id: col.id,
        name: col.title || "",
        type: col.collection_type || col.type || 'Fixed',
        totalRaised: totalRaised,
        currentBalance: currentBalance,
        amountWithdrawn: withdrawnTotal || 0,
        availableBalance: wallet.available_balance !== undefined ? wallet.available_balance : currentBalance,
        pendingBalance: wallet.pending_withdrawals ?? 0,
      };
    });
    setCollectionEarnings(earnings);

    // Sort withdrawals by created_at descending (newest first)
    const sortedWithdrawals = [...withdrawalsArray].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    const withdrawalTransactions: RecentTransaction[] = sortedWithdrawals.map((w: any) => {
      // Map 'completed' back into 'successful' if needed visually
      const mappedStatus = (w.status === 'completed') ? 'successful' : w.status;

      return {
        id: w.id,
        type: 'withdrawal',
        collection: w.collections ? w.collections.title : 'Unknown Collection',
        amount: w.amount,
        date: w.created_at ? new Date(w.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        status: mappedStatus || 'pending',
        description: w.destination_account
          ? `Withdrawal to ${w.destination_account.accountName} (${w.destination_account.accountNumber})`
          : 'Withdrawal',
      };
    });

    setRecentTransactions(withdrawalTransactions);
  }, [collections, withdrawals]);

  const handleWithdraw = async (collectionId: string) => {
    alert(`Withdraw from collection ${collectionId} (dummy action)`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Wallet & Transactions</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your collections balance and track withdrawals.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-100/80 p-1 w-full sm:w-auto inline-flex h-auto rounded-xl">
          <TabsTrigger 
            value="collections" 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm transition-all"
          >
            <Wallet className="w-4 h-4" />
            Collections Overview
          </TabsTrigger>
          <TabsTrigger 
            value="withdrawals"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm transition-all"
          >
            <History className="w-4 h-4" />
            Withdrawal Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="m-0 focus-visible:outline-none focus-visible:ring-0">

      <div className="bg-white w-full max-w-full shadow-md rounded-lg mb-8">
        <div className="px-4 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700">Collection Earnings</h2>
        </div>
        {/* Responsive table: horizontal and vertical scroll with sticky header */}
        <div className="overflow-auto w-full max-h-[600px] relative">
          <table className="min-w-[1000px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10 outline outline-1 outline-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Collection Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Collection Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Total Amount Raised</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Current Balance</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Amount Withdrawn</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Available Balance</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Pending Balance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {collectionEarnings.map((earning, idx) => (
                <tr key={earning.id} className={idx % 2 === 1 ? "bg-gray-50 hover:bg-gray-100" : "hover:bg-gray-50"}>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{earning.name}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{earning.type}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{formatCurrency(earning.totalRaised)}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(earning.currentBalance)}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(earning.amountWithdrawn)}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">{formatCurrency(earning.availableBalance)}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">{formatCurrency(earning.pendingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </TabsContent>

      <TabsContent value="withdrawals" className="m-0 focus-visible:outline-none focus-visible:ring-0">
      <div className="bg-white w-full max-w-full shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700">Withdrawal Transactions</h2>
        </div>
        {/* Responsive table: horizontal and vertical scroll with sticky header */}
        <div className="overflow-auto w-full max-h-[600px] relative">
          <table className="min-w-[800px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10 outline outline-1 outline-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Collection Title</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Date & Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentTransactions.map(transaction => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{transaction.collection}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{formatCurrency(transaction.amount)}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                      transaction.status === 'successful' || transaction.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                      transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                        'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{transaction.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </TabsContent>
      </Tabs>

      {/* {currentCollection && (
        <WithdrawFundsDialog
          open={isWithdrawDialogOpen}
          onOpenChange={setIsWithdrawDialogOpen}
          onComplete={onWithdrawComplete}
          availableBalance={currentCollection.wallets[0].available_balance || 0}
          collectionId={id || ''}
          collectionTitle={currentCollection?.title || ''}
        />
      )} */}

      <Tooltip place="top" />
    </div>
  );
};

export default TransactionHistoryPage;
