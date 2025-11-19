import React, { useEffect, useState } from 'react';
import { useAuthStore, useCollectionStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';


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
        available_balance: wallet.available_balance ?? 0,
        pending_balance: wallet.pending_balance ?? 0,
        ...col
      };
    });
    setCollectionEarnings(earnings);

  }, [collections]);

  const pendingBalance = collectionEarnings?.reduce((sum: number, col: any) => sum + (col.pending_balance || 0), 0) || 0;
  const availableBalance = collectionEarnings?.reduce((sum: number, col: any) => sum + (col.available_balance || 0), 0) || 0;

  const totalBalance = availableBalance + pendingBalance;

  console.log(collectionEarnings, 'total balnce', totalBalance);



  const navigate = useNavigate()

  return (
    <div>

      <div className='bg-green-900 text-white rounded-[24px]'>
        <div className="flex justify-between p-6 items-start" onClick={() => navigate('/wallet')} >
          <div>
            <p className="text-sm text-green-200 mb-1">Total Balance</p>
            <h2 className="text-4xl font-bold">{formatCurrency(totalBalance)}</h2>
          </div>

          <svg class="w-[42px] h-[42px] text-white dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" />
          </svg>
        </div>

        <div className="flex justify-between items-center gap-8 px-6 py-4 bg-green-800 rounded-b-[24px]">
          <div className='flex justify-between items-center gap-1  md:gap-4'>
            <p className="text-[14px] text-white">Available</p>
            <p className="text-[16px] md:text-xl text-white font-semibold">{formatCurrency(availableBalance)}</p>
          </div>
          <div className='flex justify-between items-center gap-1 md:gap-4'>
            <p className="text-[14px] text-white ">Pending</p>
            <p className="text-[16px] md:text-xl text-white font-semibold ">{formatCurrency(pendingBalance)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletOverview;