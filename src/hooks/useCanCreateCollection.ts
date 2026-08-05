import { useEffect } from 'react';
import { useAuthStore } from '@/store';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useKycAccess } from '@/hooks/useKycAccess';

export interface CanCreateCollection {
  /** KYC-verified users have no limit. */
  isVerified: boolean;
  collectionCount: number;
  /** Unverified AND already owns at least one collection. */
  limitReached: boolean;
  /** Convenience inverse of limitReached. */
  canCreate: boolean;
  /** User-facing reason when blocked, else null. */
  message: string | null;
}

const LIMIT_MESSAGE =
  'Unverified accounts can create only one collection. Complete identity verification to create more.';

/**
 * Frontend gate for "unverified users may own at most one collection".
 *
 * The BACKEND is the authority — both the Express CollectionService (behind
 * requireVerifiedOrganizer) and the create-collection edge function reject
 * independently with `KYC_REQUIRED`. This hook only drives consistent *early*
 * UX so the restriction behaves identically at every creation entry point
 * rather than only on the Collections page.
 *
 * The access decision itself now comes from useKycAccess — the single reader
 * of /settings/kyc/access-status — instead of this hook re-reading kycData and
 * re-deriving the rule. The local collection-count derivation below survives
 * only as a fallback for the brief window before that payload arrives, so a
 * deep link straight into the wizard isn't blank.
 */
export function useCanCreateCollection(): CanCreateCollection {
  const { user } = useAuthStore() as { user?: { id?: string } };
  const { collections, fetchCollections } = useCollectionStore() as {
    collections: unknown[];
    fetchCollections: (userId?: string, opts?: { silent?: boolean }) => Promise<unknown>;
  };
  const { isVerified, canCreateCollection, isLoading } = useKycAccess();

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    if (!Array.isArray(collections) || collections.length === 0) {
      void Promise.resolve(fetchCollections?.(userId, { silent: true })).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const collectionCount = Array.isArray(collections) ? collections.length : 0;

  // Prefer the backend-computed flag — it is the actual authority and also
  // correctly accounts for legacy users. Fall back to the local derivation
  // only while the access payload hasn't loaded yet.
  const limitReached = isLoading
    ? Boolean(userId) && !isVerified && collectionCount >= 1
    : Boolean(userId) && !canCreateCollection;

  return {
    isVerified,
    collectionCount,
    limitReached,
    canCreate: !limitReached,
    message: limitReached ? LIMIT_MESSAGE : null,
  };
}

export default useCanCreateCollection;
