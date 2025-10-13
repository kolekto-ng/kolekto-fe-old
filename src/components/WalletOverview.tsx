import React from 'react';
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
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <Card className="bg-green-900 text-white p-6 rounded-lg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-sm text-green-200 mb-1">Total balance</p>
          <h2 className="text-4xl font-bold">{formatCurrency(balance)}</h2>
        </div>
        <Button 
          variant="secondary" 
          className="bg-white text-green-900 hover:bg-gray-100"
        >
          Withdraw
        </Button>
      </div>
      
      <div className="flex gap-8 pt-4 border-t border-green-700">
        <div>
          <p className="text-sm text-green-200 mb-1">Available</p>
          <p className="text-xl font-semibold">{formatCurrency(available)}</p>
        </div>
        <div>
          <p className="text-sm text-green-200 mb-1">Pending</p>
          <p className="text-xl font-semibold">{formatCurrency(pending)}</p>
        </div>
      </div>
    </Card>
  );
};

export default WalletOverview;