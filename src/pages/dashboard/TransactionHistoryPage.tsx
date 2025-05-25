
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import { useTransactionStore } from '@/store/useTransactionStore';
import { useWithdrawalStore } from '@/store/useWithdrawalStore';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const TransactionHistoryPage: React.FC = () => {
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const { user } = useAuth();
  const { fetchTransactions, transactions } = useTransactionStore();
  const { createWithdrawal } = useWithdrawalStore();

  useEffect(() => {
    if (user) {
      fetchTransactions(user.id);
    }
  }, [user, fetchTransactions]);

  const onWithdrawComplete = async (data: {
    amount: number;
    accountName: string;
    accountNumber: string;
    bankName: string;
  }) => {
    if (!user?.id) {
      toast.error('Unable to process withdrawal. Please try again.');
      return;
    }

    try {
      await createWithdrawal({
        organizer_id: user.id,
        amount: data.amount,
        account_name: data.accountName,
        account_number: data.accountNumber,
        bank_name: data.bankName
      });
      
      setIsWithdrawDialogOpen(false);
      toast.success('Withdrawal request submitted successfully!');
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error(error.message || 'Failed to submit withdrawal request');
      setIsWithdrawDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <Button 
          onClick={() => setIsWithdrawDialogOpen(true)}
          className="bg-kolekto hover:bg-kolekto/90"
        >
          Withdraw Funds
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {transaction.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₦{transaction.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {transaction.type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-4 text-center">No transactions found.</div>
          )}
        </CardContent>
      </Card>

      <WithdrawFundsDialog 
        open={isWithdrawDialogOpen}
        onOpenChange={setIsWithdrawDialogOpen}
        onComplete={onWithdrawComplete}
        availableBalance={0}
        collectionId=""
        collectionTitle=""
      />
    </div>
  );
};

export default TransactionHistoryPage;
