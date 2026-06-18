
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
import { useActivities } from '@/store/useDashboard';
import { axiosInstance } from '@/utils/axios';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
  // Refreshing the activities feed immediately after submit makes the new
  // pending row appear without the user having to navigate. Without this
  // the user would only see the row on the next page load.
  const { getActivities } = useActivities() as any;
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
      // Single source of truth: the backend refreshes each wallet from
      // contributions + withdrawals (source-of-truth math) and returns the
      // strict withdrawable cap (available_balance − sum of pending
      // withdrawal requests). Reading wallets directly via Supabase would
      // show a cached/drifted available_balance and let the user attempt
      // amounts the BE will then reject — the exact mismatch this picker
      // used to surface as "Insufficient balance" mid-flow.
      const { data } = await axiosInstance.get('/withdrawals/eligible-collections');
      setCollections(Array.isArray(data?.collections) ? data.collections : []);
    } catch (err) {
      console.error('Failed to load eligible collections:', err);
      setCollections([]);
    } finally {
      setLoadingCols(false);
    }
  };




  const handleWithdraw = async (data: {
    amount: number;
    payoutAccountId?: string;
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
  }) => {
    if (!user) {
      toast.error('You must be logged in to withdraw funds');
      return;
    }

    setIsLoading(true);

    try {
      // `account_number` from a saved payout account is not available in
      // plaintext on the client — the table only stores the encrypted cipher
      // + last-4. We pass `payout_account_id` so the backend can decrypt
      // server-side and store the readable number on the withdrawal row for
      // admin review.
      await createWithdrawal({
        amount: data.amount,
        collection_id: selectedCollectionId,
        payout_account_id: data.payoutAccountId,
        account_name: data.accountName,
        account_number: data.accountNumber,
        bank_name: data.bankName,
        bank_code: data.bankCode,
        organizer_id: user.id
      });

      // Close the dialog first so the user gets immediate feedback. The
      // post-submit refreshes run in the background; serialize them via
      // requestIdleCallback (falling back to setTimeout) so they don't
      // race the BE's cookie-based token refresh — three parallel calls
      // on a stale Bearer token could each try to refresh and one would
      // lose, causing a spurious 401 → logout.
      onOpenChange(false);
      if (onComplete) onComplete();

      const runRefreshes = () => {
        void (async () => {
          try {
            await fetchCollections();
          } catch (e) { /* non-fatal */ }
          try {
            await getActivities?.();
          } catch (e) { /* non-fatal */ }
        })();
      };
      if (typeof (window as any).requestIdleCallback === 'function') {
        (window as any).requestIdleCallback(runRefreshes, { timeout: 1500 });
      } else {
        setTimeout(runRefreshes, 0);
      }
    } catch (error: any) {
      // Surface the actual error from the backend instead of a generic
      // "Please try again later" message. createWithdrawal already shows a
      // toast with the specific reason; we only fire a fallback toast here
      // if the inner call somehow didn't (e.g. non-axios error).
      console.error('Withdrawal error:', error);
      const backendMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message;
      if (backendMessage && !String(backendMessage).includes('Network')) {
        // The store-level toast already showed this — no need to double-toast.
      } else {
        toast.error('Failed to process withdrawal request. Please try again later.');
      }
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
            <div className="space-y-2 py-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : collections.length === 0 ? (
            <p className="text-gray-500 py-8 text-center text-sm">No collections with available funds to withdraw.</p>
          ) : (
            <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-2">
              {collections.map(c => {
                 // `withdrawable_amount` is the strict cap returned by
                 // GET /withdrawals/eligible-collections (= refreshed
                 // available_balance − sum of pending withdrawal requests).
                 // This is the same number the BE validates against in
                 // POST /withdrawals/request, so the picker and the
                 // submitter cannot disagree.
                 const cap = Number(c.withdrawable_amount || 0);
                 const pendingBlocked = Number(c.pending_withdrawal_requests || 0);
                 return (
                   <div
                     key={c.id}
                     onClick={() => {
                        setSelectedCollectionId(c.id);
                        setSelectedCollectionTitle(c.title);
                        setSelectedAvailableBalance(cap);
                        setStep(2);
                     }}
                     className="p-3 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer flex justify-between items-center transition-colors"
                   >
                     <div>
                       <p className="font-medium text-sm text-gray-900">{c.title}</p>
                       {pendingBlocked > 0 && (
                         <p className="text-xs text-gray-500 mt-0.5">
                           ₦{pendingBlocked.toLocaleString('en-NG')} pending approval
                         </p>
                       )}
                     </div>
                     <p className="font-bold text-green-700">₦{cap.toLocaleString('en-NG')}</p>
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
