import React, { useEffect, useState } from 'react';
import { useAuthStore, useCollectionStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/utils/axios';
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
    let isActive = true;
    const computeBalance = async () => {
      try {
        const { data } = await axiosInstance.get('/dashboard/stats');
        const stats = data?.data || data || {};

        if (!isActive) return;
        setAvailableBalance(Number(stats.availableBalance || 0));
        setPendingBalance(Number(stats.pendingBalance || 0));
        setTotalBalance(Number(stats.totalBalance || 0));
      } catch (err) {
        console.error('Wallet overview stats error:', err);
        if (!isActive) return;

        // Fallback when /dashboard/stats itself is unreachable: derive a
        // total from the collections already in the store, NOT a fresh
        // direct-Supabase query. GET /collections already applies the same
        // transaction:read gate /dashboard/stats does — each collection's
        // embedded `contributions` carries an `amount` field only when the
        // caller holds transaction:read (see collectionScopeRepository.js's
        // listCollectionsForScope). A MEMBER's contributions therefore have
        // no `amount` at all here, so `Number(c.amount || 0)` degrades to 0
        // for them automatically — the same money-free result the primary
        // path gives, without a second, independently-authorized query.
        const totalRaised = collections.reduce((sum: number, collection: any) => {
          const paid = Array.isArray(collection.contributions)
            ? collection.contributions.filter((c: any) => c.status === 'paid')
            : [];
          return sum + paid.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
        }, 0);

        setAvailableBalance(0);
        setPendingBalance(totalRaised);
        setTotalBalance(totalRaised);
      }
    };

    computeBalance();
    return () => {
      isActive = false;
    };
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
