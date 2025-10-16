import React from 'react';
import { useAuthStore } from '@/store';
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

   const user = useAuthStore((state) => state.user); 

  const formatCurrency = (amount: number) => {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};




  return (
     <div>
      <p className="text-xl text-gray-600 font-bold mb-3">
      Hi {user?.name || user?.firstName || 'User'}, Welcome back.
    </p>
      <Card className="bg-green-900 text-white p-6 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <div>
            <h2 className='text-xl font-semibold mb-2'>Wallet </h2>
          <p className="text-sm text-green-200 mb-1">Total balance</p>
          <h2 className="text-4xl font-bold">{formatCurrency(balance)}</h2>
        </div>
        <Button 
          variant="secondary" 
          className="bg-green-950 text-white px-10 hover:bg-green-500"
        >
          Withdraw
        </Button>
      </div>
      
    </Card>
    <div className="flex justify-between items-center pt-5  bg-[#00700D] rounded-lg">
        <div className='flex gap-4'>
          <p className="text-xl text-white mb-2 pl-3">Available</p>
          <p className="text-xl text-white font-semibold">{formatCurrency(available)}</p>
        </div>
        <div className='flex gap-4'>
          <p className="text-xl text-white mb-2 ">Pending</p>
          <p className="text-xl text-white font-semibold pr-5">{formatCurrency(pending)}</p>
        </div>
      </div>
     </div>
  );
};

export default WalletOverview;