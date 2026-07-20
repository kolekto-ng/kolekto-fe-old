import { useEffect } from 'react';
import { useAuthStore } from '@/store';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useProfileStore } from '@/store/useProfileStore';

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
  'Unverified accounts can create only one collection. Complete KYC verification to create more.';

/**
 * SINGLE frontend source of truth for the "unverified users may own at most one
 * collection" rule. The BACKEND is the authority (both the Express
 * CollectionService and the create-collection edge function return 403); this
 * hook only drives consistent *early* UX so the restriction behaves identically
 * at every creation entry point instead of only on the Collections page.
 *
 * Mirrors the backend gate: verified ⇒ unlimited; otherwise blocked once the
 * user already owns ≥ 1 collection. It self-fetches the backing data so it works
 * even when a wizard route is opened directly (deep link) rather than via the
 * Collections page.
 */
export function useCanCreateCollection(): CanCreateCollection {
  const { user } = useAuthStore() as { user?: { id?: string } };
  const { collections, fetchCollections } = useCollectionStore() as {
    collections: unknown[];
    fetchCollections: (userId?: string, opts?: { silent?: boolean }) => Promise<unknown>;
  };
  const { kycData, fetchKYCStatus } = useProfileStore() as {
    kycData?: { overallStatus?: string };
    fetchKYCStatus: (userId: string) => void;
  };

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    if (!Array.isArray(collections) || collections.length === 0) {
      void Promise.resolve(fetchCollections?.(userId, { silent: true })).catch(() => {});
    }
    fetchKYCStatus?.(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const isVerified = kycData?.overallStatus === 'verified';
  const collectionCount = Array.isArray(collections) ? collections.length : 0;
  const limitReached = Boolean(userId) && !isVerified && collectionCount >= 1;

  return {
    isVerified,
    collectionCount,
    limitReached,
    canCreate: !limitReached,
    message: limitReached ? LIMIT_MESSAGE : null,
  };
}

export default useCanCreateCollection;
