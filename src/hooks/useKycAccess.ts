import { useEffect } from 'react';
import { useAuthStore } from '@/store';
import { useProfileStore } from '@/store/useProfileStore';

/**
 * SINGLE frontend reader of the backend's KYC access status.
 *
 * The BACKEND is the authority — every gated endpoint independently returns
 * `{ code: "KYC_REQUIRED" }` and the axios interceptor turns that into the
 * shared modal. This hook exists only so the UI can gate *early* (disable a
 * button, show a lock, explain why) instead of letting the user fill in a
 * whole form and then fail. Nothing here decides access; it only mirrors
 * `GET /settings/kyc/access-status` (services/featureAccessService.js).
 *
 * Every feature-specific hook in the app should build on this one rather than
 * re-reading `kycData` and re-deriving rules, so the frontend has exactly one
 * place that knows the shape of the access payload.
 */

export type KycPhase =
  | 'not_started'
  | 'in_progress'
  | 'under_review'
  | 'needs_more_info'
  | 'rejected'
  | 'verified';

export interface KycAccess {
  /** True only when the backend says the account is verified. */
  isVerified: boolean;
  /** Migration group: A = verified, B = legacy unverified, C = new unverified. */
  group: 'A' | 'B' | 'C' | null;
  isLegacyUser: boolean;
  canCreateCollection: boolean;
  canManageBankAccount: boolean;
  canWithdraw: boolean;
  /** Where the user is in the verification flow, for progress UI. */
  phase: KycPhase | null;
  /** True once documents have been submitted and a decision is pending. */
  isUnderReview: boolean;
  /** True while the access payload has not arrived yet. */
  isLoading: boolean;
}

export function useKycAccess(): KycAccess {
  const { user } = useAuthStore() as { user?: { id?: string } };
  const { kycData, fetchKYCStatus } = useProfileStore() as {
    kycData?: Record<string, unknown> | null;
    fetchKYCStatus: (userId: string) => void;
  };

  const userId = user?.id;

  useEffect(() => {
    if (userId) fetchKYCStatus?.(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const phase = ((kycData?.journey as { phase?: KycPhase } | null)?.phase ??
    null) as KycPhase | null;

  const isLoading = Boolean(userId) && !kycData;

  // `!== false` — permitted unless the backend has EXPLICITLY said no.
  //
  // This is deliberately fail-open, and it is safe: the backend rejects every
  // gated action independently, so the worst case is that a button stays
  // enabled and pressing it opens the KYC modal. Failing closed instead would
  // lock a legitimately verified user out of their own Withdraw button
  // whenever /access-status happened to error — a real outage caused by a
  // non-authoritative read. Consumers that want to avoid the enabled-then-
  // blocked flicker should gate on `isLoading` rather than assuming denial.
  return {
    isVerified: kycData?.isVerified === true,
    group: (kycData?.group as 'A' | 'B' | 'C' | undefined) ?? null,
    isLegacyUser: kycData?.isLegacyUser === true,
    canCreateCollection: kycData?.canCreateCollection !== false,
    canManageBankAccount: kycData?.canManageBankAccount === true,
    canWithdraw: kycData?.canWithdraw !== false,
    phase,
    isUnderReview: phase === 'under_review',
    isLoading,
  };
}

export default useKycAccess;
