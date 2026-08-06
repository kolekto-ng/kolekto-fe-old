import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store';
import { useProfileStore } from '@/store/useProfileStore';

const MIN_REFETCH_INTERVAL_MS = 30_000;

/**
 * Part 5 (realtime sync): the primary mechanism is the Supabase realtime
 * subscription already set up in useProfileStore.fetchKYCStatus
 * (ensureKycSubscription) — it re-fetches automatically the instant an
 * admin's approve/reject write lands on kyc_verifications, so this is NOT a
 * replacement for that. It's a resilience fallback: websocket subscriptions
 * are known to silently drop when a mobile browser tab is backgrounded/put
 * to sleep and then resumed. Refetching once on window focus (throttled)
 * costs one cheap request and guarantees the user never has to manually
 * refresh even if the realtime channel died while they were away.
 *
 * Mounted once near the app root (see App.tsx) — never per-page, so it can't
 * multiply into redundant listeners.
 */
export function useKycFocusRefetch() {
  const { user } = useAuthStore() as { user?: { id?: string } };
  const fetchKYCStatus = useProfileStore((s) => s.fetchKYCStatus);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (!user?.id) return;

    const refetchIfStale = () => {
      const now = Date.now();
      if (now - lastFetchRef.current < MIN_REFETCH_INTERVAL_MS) return;
      lastFetchRef.current = now;
      fetchKYCStatus(user.id!);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetchIfStale();
    };

    window.addEventListener('focus', refetchIfStale);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', refetchIfStale);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id, fetchKYCStatus]);
}

export default useKycFocusRefetch;
