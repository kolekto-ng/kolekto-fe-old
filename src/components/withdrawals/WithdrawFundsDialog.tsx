
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import WithdrawForm from './WithdrawForm';
import { toast } from 'sonner';
import { useWithdrawalStore } from '@/store';
import { useAuthStore } from '@/store';
import { axiosInstance } from '@/utils/axios';

interface WithdrawFundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  collectionId?: string;
  collectionTitle?: string;
  availableBalance: number;
}

export const WithdrawFundsDialog: React.FC<WithdrawFundsDialogProps> = ({
  open,
  onOpenChange,
  onComplete,
  collectionId,
  collectionTitle,
  availableBalance,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { createWithdrawal } = useWithdrawalStore();
  const { user } = useAuthStore();

  const handleWithdraw = async (data: {
    amount: number;
    accountName: string;
    accountNumber: string;
    bankName: string;
  }) => {
    if (!user) {
      toast.error('You must be logged in to withdraw funds');
      return;
    }

    setIsLoading(true);

    try {
      await createWithdrawal({
        amount: data.amount,
        collection_id: collectionId,
        account_name: data.accountName,
        account_number: data.accountNumber,
        bank_name: data.bankName,
        organizer_id: user.id
      });

      onOpenChange(false);
      if (onComplete) onComplete();
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error('Failed to process withdrawal request. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>
            {collectionTitle
              ? `Withdraw from "${collectionTitle}" collection.`
              : 'Withdraw from your account balance.'}
          </DialogDescription>
        </DialogHeader>

        <WithdrawForm
          availableBalance={availableBalance}
          onSubmit={handleWithdraw}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};
