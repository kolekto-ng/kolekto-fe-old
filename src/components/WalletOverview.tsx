import React, { useEffect, useState } from 'react';
import { useAuthStore, useCollectionStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';


interface WalletOverviewProps {
  balance?: number;
  available?: number;
  pending?: number;
}

const WalletOverview: React.FC<WalletOverviewProps> = ({
  balance = 120000.00,
  available = 80000,
  pending = 40000.00
}) => {

  const { user_metadata: user } = useAuthStore((state) => state.user);
  // const [wihdrawals,] useState();
  const [collectionEarnings, setCollectionEarnings] = useState();
  console.log(user);

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const { collections } = useCollectionStore()

  // const { withdrawals } = useWithdrawalStore()

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

  }, [collections]);

  const totalBalance = collectionEarnings?.reduce((sum: number, col: any) => sum + (col.balance || 0), 0) || 0;

  console.log(collectionEarnings, 'total balnce', totalBalance);




  return (
    <div>
      <p className="text-xl text-gray-600 font-bold mb-3">
        Hi {user?.full_name.split(' ')[1] || user?.firstName || 'User'}, Welcome back.
      </p>
      <div className='bg-green-900 text-white rounded-[24px]'>
        <div className="flex justify-between p-6 items-start mb-2">
          <div>
            <h2 className='text-xl font-semibold mb-2'>Wallet </h2>
            <p className="text-sm text-green-200 mb-1">Total balance</p>
            <h2 className="text-4xl font-bold">{formatCurrency(totalBalance)}</h2>
          </div>
          {/* <Button
            variant="secondary"
            className="bg-green-950 text-white px-10 hover:bg-green-500"
          >
            Withdraw
          </Button> */}
        </div>

        <div className="flex justify-between items-center px-6 py-4 bg-[#00700D] rounded-b-[24px]">
          <div className='flex gap-4'>
            <p className="text-xl text-white">Available</p>
            <p className="text-xl text-white font-semibold">{formatCurrency(totalBalance)}</p>
          </div>
          {/* <div className='flex gap-4'>
          <p className="text-xl text-white mb-2 ">Pending</p>
          <p className="text-xl text-white font-semibold pr-5">{formatCurrency(pending)}</p>
        </div> */}
        </div>
      </div>
    </div>
  );
};

export default WalletOverview;