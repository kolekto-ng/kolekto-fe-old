
import React, { useEffect, useState } from 'react';
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
import { Link } from 'react-router-dom';

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
  const [profile, setProfile] = useState();

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]); // ✅ run only when user changes

  const fetchUserProfile = () => {
    axiosInstance
      .get('/settings/profile')
      .then((response) => {
        console.log(response.data, 'response data');
        setProfile(response.data.data);
      })
      .catch((error) => {
        console.error('Error fetching user data:', error);
      });
  };


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

  // if (profile?.bank_verified !== true || profile?.identity_verified !== true || profile?.address_verified !== true) {
  //   return (
  //     <div>
  //       <Dialog open={open} onOpenChange={onOpenChange}>
  //         <DialogContent className="sm:max-w-md">
  //           <DialogHeader>
  //             <DialogTitle>Withdraw Funds</DialogTitle>
  //             <DialogDescription>
  //               To withdraw funds, please complete the verification of your bank details, identity, and address in your profile settings.
  //             </DialogDescription>
  //           </DialogHeader>
  //           <Link className='bg-green-700 rounded-lg py-2 px-2 text-center text-[18px] font-semibold text-white' to="/dashboard/settings">profile</Link>
  //         </DialogContent>
  //       </Dialog>

  //     </div>
  //   )
  // }

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
