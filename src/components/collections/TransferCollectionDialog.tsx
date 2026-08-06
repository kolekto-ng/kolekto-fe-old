import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, ArrowRight, Loader2, Mail, MailCheck, X } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useCollectionStore } from '@/store/useCollectionStore';

interface TransferCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  collectionTitle: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TransferCollectionDialog: React.FC<TransferCollectionDialogProps> = ({
  open,
  onOpenChange,
  collectionId,
  collectionTitle,
}) => {
  const {
    transferStep,
    transferError,
    otpSentToEmail,
    transferStatus,
    transferStatusLoading,
    fetchCollectionTransferStatus,
    requestCollectionTransfer,
    verifyCollectionTransferOTP,
    cancelCollectionTransfer,
    resetTransferState,
  } = useCollectionStore() as any;

  const [recipientEmail, setRecipientEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [localError, setLocalError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      fetchCollectionTransferStatus(collectionId);
    }
  }, [open, collectionId, fetchCollectionTransferStatus]);

  useEffect(() => {
    if (!open) {
      resetTransferState();
      setRecipientEmail('');
      setOtp(['', '', '', '', '', '']);
      setLocalError('');
    }
  }, [open, resetTransferState]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleRequest = async () => {
    setLocalError('');
    if (!EMAIL_RE.test(recipientEmail)) {
      setLocalError('Enter a valid email address');
      return;
    }
    const ok = await requestCollectionTransfer(collectionId, recipientEmail);
    if (ok) toast.success('OTP sent to your email');
  };

  const handleVerify = async () => {
    setLocalError('');
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setLocalError('Please enter the complete 6-digit OTP');
      return;
    }
    const ok = await verifyCollectionTransferOTP(collectionId, otpString);
    if (ok) toast.success('Invite sent to recipient');
  };

  const handleCancelPending = async () => {
    setCancelling(true);
    const ok = await cancelCollectionTransfer(collectionId);
    setCancelling(false);
    if (ok) {
      toast.success('Transfer request cancelled');
    } else {
      toast.error('Could not cancel the transfer request');
    }
  };

  const currentError = localError || transferError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription>
            Transfer "{collectionTitle}" to another Kolekto account by email.
          </DialogDescription>
        </DialogHeader>

        {transferStatusLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : transferStatus ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
              A transfer to <span className="font-semibold">{transferStatus.to_email}</span> is pending acceptance.
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancelPending}
                disabled={cancelling}
                className="w-full border-gray-200"
              >
                {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                Cancel Transfer Request
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {currentError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{currentError}</p>
              </div>
            )}

            {(transferStep === 'idle' || transferStep === 'requesting' || transferStep === 'error') && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient's Email
                  </Label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="recipient@gmail.com"
                    className="border-gray-200"
                  />
                  <p className="text-xs text-gray-500">
                    They'll need an existing Kolekto account and must accept before ownership moves.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleRequest}
                    disabled={transferStep === 'requesting' || !recipientEmail}
                    className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                  >
                    {transferStep === 'requesting' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Send Verification Code
                  </Button>
                </DialogFooter>
              </>
            )}

            {(transferStep === 'otp-sent' || transferStep === 'verifying') && (
              <>
                <div className="p-4 rounded-xl bg-[#E8F5E9]/50 border border-[#E8F5E9]">
                  <p className="text-sm text-gray-600">
                    A 6-digit code has been sent to <span className="font-semibold text-gray-900">{otpSentToEmail || 'your email'}</span> to confirm this transfer.
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200 rounded-lg focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/20 outline-none transition-all"
                    />
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleVerify}
                    disabled={transferStep === 'verifying' || otp.join('').length !== 6}
                    className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                  >
                    {transferStep === 'verifying' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4 mr-2" />
                    )}
                    Verify &amp; Send Invite
                  </Button>
                </DialogFooter>
              </>
            )}

            {transferStep === 'link-sent' && (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                  <MailCheck className="w-7 h-7 text-[#1B5E20]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Invite sent</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    The recipient can accept or decline from the link we emailed them. Ownership won't change until they accept.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-gray-200"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TransferCollectionDialog;
