import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Clock, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useKycGateStore, type KycGatedFeature } from '@/store/useKycGateStore';
import { useProfileStore } from '@/store/useProfileStore';

/**
 * Global "Identity verification required" modal.
 *
 * Mounted ONCE near the app root (see App.tsx). The axios response
 * interceptor opens this whenever ANY backend response carries
 * `{ code: "KYC_REQUIRED" }` (see utils/axios.tsx), so every KYC-gated
 * endpoint — present or future, Express or edge function — gets this
 * consistent UX for free instead of a generic 403 or an error toast.
 *
 * Three things this deliberately does beyond echoing the backend's message:
 *   1. Names the specific action that was blocked, so "why am I seeing this"
 *      is answered before the user has to ask.
 *   2. Reassures that existing collections and balances are untouched. That
 *      is the first fear this modal raises, especially for a legacy user who
 *      has been operating normally for months.
 *   3. Reflects real progress. If documents are already under review, the
 *      call to action becomes "Check status" rather than "Verify Identity" —
 *      telling someone to start something they finished three days ago reads
 *      as though their submission was lost.
 */

/** Why this particular action needs verification, in the user's terms. */
const FEATURE_COPY: Record<KycGatedFeature, { title: string; why: string }> = {
  create_collection: {
    title: 'Verify your identity to create another collection',
    why: 'Financial regulations require us to verify who is collecting money before an account can run more than one collection.',
  },
  withdraw: {
    title: 'Verify your identity to withdraw funds',
    why: 'We are required to confirm your identity before releasing funds. Your balance is safe and stays exactly where it is until then.',
  },
  manage_bank_account: {
    title: 'Verify your identity to manage payout accounts',
    why: 'Adding or changing where your money is paid out requires a verified identity, so funds can never be redirected by someone else.',
  },
  publish_collection: {
    title: 'Verify your identity to publish this collection',
    why: 'Taking a new collection live requires a verified identity. Collections you are already running are unaffected.',
  },
};

const DEFAULT_COPY = {
  title: 'Identity verification required',
  why: 'Financial regulations require us to verify your identity before you can use this feature.',
};

export const KycRequiredModal: React.FC = () => {
  const { isOpen, message, feature, close } = useKycGateStore();
  const setActiveSection = useProfileStore((s) => s.setActiveSection);
  const { kycData } = useProfileStore() as {
    kycData?: { journey?: { phase?: string; title?: string; message?: string } | null };
  };
  const navigate = useNavigate();

  const phase = kycData?.journey?.phase;
  const inReview = phase === 'under_review';
  const started = Boolean(phase) && phase !== 'not_started';

  const copy = (feature && FEATURE_COPY[feature]) || DEFAULT_COPY;

  const handleStartVerification = () => {
    close();
    // Deep link straight into the KYC tab rather than dropping the user on
    // Settings to find it themselves.
    setActiveSection('kyc');
    navigate('/dashboard/settings');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              inReview ? 'bg-blue-50' : 'bg-amber-50'
            }`}
          >
            {inReview ? (
              <Clock className="h-6 w-6 text-blue-600" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <DialogTitle className="text-center">{copy.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">{copy.why}</p>

          {/* Real progress, when there is any — never a fabricated status. */}
          {inReview ? (
            <div className="rounded-xl bg-blue-50 p-3 text-center">
              <p className="text-sm font-medium text-blue-800">
                {kycData?.journey?.title || 'Your verification is being reviewed'}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                {kycData?.journey?.message ||
                  "We'll notify you as soon as a decision is made."}
              </p>
            </div>
          ) : (
            message && (
              <p className="text-center text-xs text-muted-foreground">{message}</p>
            )
          )}

          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-emerald-800">
              Your existing collections, contributors, and balances are safe and
              unchanged. You can keep viewing everything while you verify.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={close}>
            Not now
          </Button>
          <Button
            onClick={handleStartVerification}
            className="bg-kolekto hover:bg-kolekto/90"
          >
            {inReview ? 'Check status' : started ? 'Continue verification' : 'Verify Identity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KycRequiredModal;
