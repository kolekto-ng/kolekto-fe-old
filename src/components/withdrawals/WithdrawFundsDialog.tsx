
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
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft } from 'lucide-react';

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
  const [step, setStep] = useState(collectionId ? 2 : 1);
  const [selectedCollectionId, setSelectedCollectionId] = useState(collectionId);
  const [selectedCollectionTitle, setSelectedCollectionTitle] = useState(collectionTitle);
  const [selectedAvailableBalance, setSelectedAvailableBalance] = useState(availableBalance);
  const [collections, setCollections] = useState<any[]>([]);
  const [loadingCols, setLoadingCols] = useState(false);

  useEffect(() => {
    if (open) {
      if (collectionId) {
        setStep(2);
        setSelectedCollectionId(collectionId);
        setSelectedCollectionTitle(collectionTitle);
        setSelectedAvailableBalance(availableBalance);
      } else {
        setStep(1);
        setSelectedCollectionId(undefined);
        fetchCollections();
      }
    }
  }, [open, collectionId, collectionTitle, availableBalance]);

  const fetchCollections = async () => {
    if (!user) return;
    setLoadingCols(true);
    try {
      const { data } = await supabase
        .from('collections')
        .select('id, title, wallets(available_balance)')
        .eq('user_id', user.id);
      
      if (data) {
        const withBal = data.filter((c: any) => {
          const w = Array.isArray(c.wallets) ? c.wallets[0] : c.wallets;
          return w && Number(w.available_balance) > 0;
        });
        setCollections(withBal);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCols(false);
    }
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
        collection_id: selectedCollectionId,
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
          {step === 2 && !collectionId && (
            <button onClick={() => setStep(1)} className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2 w-fit">
              <ArrowLeft className="w-4 h-4 mr-1"/> Back to collections
            </button>
          )}
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Select a collection to withdraw from.' : (
              selectedCollectionTitle
                ? `Withdraw from "${selectedCollectionTitle}" collection.`
                : 'Withdraw from your account balance.'
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          loadingCols ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : collections.length === 0 ? (
            <p className="text-gray-500 py-8 text-center text-sm">No collections with available funds to withdraw.</p>
          ) : (
            <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-2">
              {collections.map(c => {
                 const w = Array.isArray(c.wallets) ? c.wallets[0] : c.wallets;
                 const bal = Number(w?.available_balance || 0);
                 return (
                   <div 
                     key={c.id} 
                     onClick={() => {
                        setSelectedCollectionId(c.id);
                        setSelectedCollectionTitle(c.title);
                        setSelectedAvailableBalance(bal);
                        setStep(2);
                     }}
                     className="p-3 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer flex justify-between items-center transition-colors"
                   >
                     <p className="font-medium text-sm text-gray-900">{c.title}</p>
                     <p className="font-bold text-green-700">₦{bal.toLocaleString('en-NG')}</p>
                   </div>
                 );
              })}
            </div>
          )
        ) : (
          <WithdrawForm
            availableBalance={selectedAvailableBalance}
            onSubmit={handleWithdraw}
            isLoading={isLoading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
