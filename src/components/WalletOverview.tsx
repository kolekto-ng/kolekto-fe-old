import React, { useEffect, useState } from 'react';
import { useAuthStore, useCollectionStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const WalletOverview: React.FC = () => {
  const { collections } = useCollectionStore();
  const navigate = useNavigate();

  const [totalBalance, setTotalBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  useEffect(() => {
    if (!collections.length) {
      setTotalBalance(0);
      setAvailableBalance(0);
      setPendingBalance(0);
      return;
    }

    const computeBalance = async () => {
      const collectionIds = collections.map((c: any) => c.id);

      // 1. Total Raised = sum of paid contribution amounts (authoritative source)
      const { data: paidContribs } = await supabase
        .from('contributions')
        .select('amount')
        .in('collection_id', collectionIds)
        .eq('status', 'paid');

      const totalRaised = (paidContribs || []).reduce(
        (sum: number, c: any) => sum + Number(c.amount || 0), 0,
      );

      // 2. Withdrawals — completed and pending
      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('amount, status')
        .in('collection_id', collectionIds);

      const totalWithdrawn = (withdrawals || [])
        .filter((w: any) => w.status === 'completed')
        .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);

      const pendingWd = (withdrawals || [])
        .filter((w: any) => w.status === 'pending')
        .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);

      const available = Math.max(0, totalRaised - totalWithdrawn - pendingWd);

      setAvailableBalance(available);
      setPendingBalance(pendingWd);
      setTotalBalance(available + pendingWd);
    };

    computeBalance();
  }, [collections]);

  return (
    <div>
      <div className="bg-green-900 text-white rounded-[24px]">
        <div
          className="flex justify-between p-6 items-start cursor-pointer"
          onClick={() => navigate('/wallet')}
        >
          <div>
            <p className="text-sm text-green-200 mb-1">Total Balance</p>
            <h2 className="text-4xl font-bold">{formatCurrency(totalBalance)}</h2>
          </div>
          <svg
            className="w-[42px] h-[42px] text-white"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m9 5 7 7-7 7"
            />
          </svg>
        </div>

        <div className="flex justify-between items-center gap-4 px-6 py-4 bg-green-800 rounded-b-[24px]">
          <div className="flex gap-4 md:gap-8 overflow-x-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-1 md:gap-2">
              <p className="text-[12px] md:text-[14px] text-white">Available</p>
              <p className="text-[14px] md:text-xl text-white font-semibold">
                {formatCurrency(availableBalance)}
              </p>
            </div>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-1 md:gap-2">
              <p className="text-[12px] md:text-[14px] text-white">Pending</p>
              <p className="text-[14px] md:text-xl text-white font-semibold">
                {formatCurrency(pendingBalance)}
              </p>
            </div>
          </div>
          
          <Button
            onClick={(e) => { e.stopPropagation(); setIsWithdrawOpen(true); }}
            className="bg-white text-green-900 hover:bg-gray-100 rounded-full font-bold shadow-sm whitespace-nowrap shrink-0 ml-auto h-10 px-5"
          >
            <Download className="w-4 h-4 mr-2" />
            Withdrawal
          </Button>
        </div>
      </div>

      <WithdrawFundsDialog 
        open={isWithdrawOpen} 
        onOpenChange={setIsWithdrawOpen} 
        onComplete={() => setIsWithdrawOpen(false)} 
      />
    </div>
  );
};

export default WalletOverview;
