// src/pages/dashboard/TransactionHistoryPage.tsx
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { Tooltip } from 'react-tooltip';
import { useCollectionStore, useWithdrawalStore } from '@/store';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';

// Simple currency formatter for NGN
const formatCurrency = (amount: number) =>
  '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 0 });

interface WalletOverview {
  availableBalance: number;
  bookBalance: number;
  ledgerBalance: number;
  pendingDebits: number;
  pendingCredits: number;
  totalGrossEarnings: number;
  totalNetEarnings: number;
  totalWithdrawn: number;
}

interface CollectionEarning {
  id: string;
  name: string;
  amount: number;
  participants: number;
  totalCollected: number;
  grossEarnings: number;
  netEarnings: number;
  balance: number;
  withdrawable: number;
  pendingWithdrawals: number;
}

interface RecentTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
}

const TransactionHistoryPage: React.FC = () => {
  const [walletOverview, setWalletOverview] = useState<WalletOverview | null>(null);
  const [collectionEarnings, setCollectionEarnings] = useState<CollectionEarning[]>([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  const { collections } = useCollectionStore()

  const { withdrawals } = useWithdrawalStore()

  console.log(withdrawals, "Withdrawals from store");


  useEffect(() => {
    // Sort collections by created_at descending (newest first)
    const sortedCollections = [...collections].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    // Map sorted collections to CollectionEarning format
    const earnings = sortedCollections.map((col) => {
      const wallet = Array.isArray(col.wallets) && col.wallets.length > 0 ? col.wallets[0] : {};
      return {
        id: col.id,
        name: col.title || "",
        amount: col.amount || 0,
        participants: col.total_contributions || 0,
        totalCollected: col.amount || 0,
        grossEarnings: wallet.gross_payment || 0,
        netEarnings: wallet.net_payment || 0,
        balance: wallet.ledger_balance || 0,
        withdrawable: wallet.available_balance || 0,
        pendingWithdrawals: wallet.pending_withdrawals ?? 0,
      };
    });
    setCollectionEarnings(earnings);

    // Sort withdrawals by created_at descending (newest first)
    const withdrawalsArray = Array.isArray(withdrawals)
      ? withdrawals
      : withdrawals
        ? [withdrawals]
        : [];

    const sortedWithdrawals = [...withdrawalsArray].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    const withdrawalTransactions = sortedWithdrawals.map((w) => ({
      id: w.id,
      collection: w.collections ? w.collections.title : 'Unknown Collection',
      amount: w.amount,
      date: w.created_at ? w.created_at.split('T')[0] : '',
      status: w.status || 'pending',
      description: w.destination_account
        ? `Withdrawal to ${w.destination_account.accountName} (${w.destination_account.accountNumber})`
        : 'Withdrawal',
    }));

    setRecentTransactions(withdrawalTransactions);
  }, [collections, withdrawals]);

  const handleWithdraw = async (collectionId: string) => {
    alert(`Withdraw from collection ${collectionId} (dummy action)`);
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold text-gray-800 mb-2">Wallet Overview</h1>
      <p className="text-gray-600 mb-4">Manage and track your funds effectively.</p>

      {walletOverview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          <div className="card p-6 flex flex-col justify-between border-l-4 border-green-500">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Available Balance</h3>
                <span data-tip="The total amount you can withdraw right now.">
                  <span className="material-icons info-icon">info_outline</span>
                </span>
              </div>
              <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(walletOverview.availableBalance)}</p>
            </div>
          </div>
          <div className="card p-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Book Balance</h3>
                <span data-tip="Expected balance after pending transactions clear.">
                  <span className="material-icons info-icon">info_outline</span>
                </span>
              </div>
              <p className="text-xl font-semibold text-gray-700 mt-1">{formatCurrency(walletOverview.bookBalance)}</p>
            </div>
          </div>
          <div className="card p-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Ledger Balance</h3>
                <span data-tip="Total confirmed funds in your wallet.">
                  <span className="material-icons info-icon">info_outline</span>
                </span>
              </div>
              <p className="text-xl font-semibold text-gray-700 mt-1">{formatCurrency(walletOverview.ledgerBalance)}</p>
            </div>
          </div>
          <div className="card p-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Pending Debits</h3>
                <span data-tip="Withdrawals currently being processed.">
                  <span className="material-icons info-icon">info_outline</span>
                </span>
              </div>
              <p className="text-xl font-semibold text-yellow-600 mt-1">{formatCurrency(walletOverview.pendingDebits)} <span
                className="material-icons text-sm align-middle text-yellow-500">hourglass_empty</span></p>
            </div>
          </div>
          <div className="card p-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Pending Credits</h3>
                <span data-tip="Incoming funds yet to be confirmed.">
                  <span className="material-icons info-icon">info_outline</span>
                </span>
              </div>
              <p className="text-xl font-semibold text-blue-600 mt-1">{formatCurrency(walletOverview.pendingCredits)} <span
                className="material-icons text-sm align-middle text-blue-500">pending</span></p>
            </div>
          </div>
          <div className="card p-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Gross Earnings</h3>
              <p className="text-xl font-semibold text-gray-700 mt-1">{formatCurrency(walletOverview.totalGrossEarnings)}</p>
            </div>
          </div>
          <div className="card p-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Net Earnings</h3>
              <p className="text-xl font-semibold text-gray-700 mt-1">{formatCurrency(walletOverview.totalNetEarnings)}</p>
            </div>
          </div>
          <div className="card p-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Withdrawn</h3>
              <p className="text-xl font-semibold text-gray-700 mt-1">{formatCurrency(walletOverview.totalWithdrawn)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-full shadow-md rounded-lg mb-8">
        <div className="px-4 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700">Collection Earnings</h2>
        </div>
        {/* Responsive table: horizontal scroll on small screens, compact columns */}
        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Collection</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Participants</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">
                  Earnings
                  <span data-tooltip-id="earnings-tip" data-tooltip-content="Gross: Total before deductions. Net: After fees.">
                    <span className="material-icons info-icon text-xs">info_outline</span>
                  </span>
                  <Tooltip id="earnings-tip" place="top" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">
                  Funds
                  <span data-tip="Balance: Current funds. Withdrawable: Available for withdrawal.">
                    <span className="material-icons info-icon text-xs">info_outline</span>
                  </span>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {collectionEarnings.map((earning, idx) => (
                <tr key={earning.id} className={idx % 2 === 1 ? "bg-gray-50" : ""}>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{earning.name}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(earning.amount)}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{earning.participants}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <div className="text-gray-900 font-medium">{formatCurrency(earning.grossEarnings)} <span className="text-xs text-gray-500">(Gross)</span></div>
                    <div className="text-gray-500">{formatCurrency(earning.netEarnings)} <span className="text-xs text-gray-500">(Net)</span></div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <div className="text-gray-900 font-medium">{formatCurrency(earning.balance)} <span className="text-xs text-gray-500">(Balance)</span></div>
                    <div className="text-green-600 font-semibold">{formatCurrency(earning.withdrawable)} <span className="text-xs text-gray-500">(Withdrawable)</span></div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      className="flex items-center text-green-600 hover:text-green-800 bg-green-100 hover:bg-green-200 px-2 py-1 rounded-md text-xs"
                      onClick={() => handleWithdraw(earning.id)}
                    >
                      <span className="material-icons text-sm mr-1">account_balance_wallet</span> Withdraw
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white w-full max-w-full shadow-md rounded-lg">
        <div className="px-4 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700">Withdrawals Transactions</h2>
        </div>
        {/* Responsive table: horizontal scroll on small screens, compact columns */}
        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Collection</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Description</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" scope="col">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentTransactions.map(transaction => (
                <tr key={transaction.id}>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{transaction.date}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{transaction.collection}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{transaction.description}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(transaction.amount)}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                      transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
