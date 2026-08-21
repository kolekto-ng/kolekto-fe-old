// realtimeScope.ts — workspace scoping and burst coalescing for realtime events.
//
// ── WHAT THIS FIXES (wave 6.7F.8, 2026-08-20) ────────────────────────────────
//
// DashboardPage and TransactionHistoryPage subscribe to `contributions`,
// `wallets`, `withdrawals` and `collections` with NO filter, and every event
// triggers a FORCED refetch of up to three endpoints. Two distinct costs:
//
//   1. CROSS-WORKSPACE NOISE. A user who owns collections in Workspace A and
//      Workspace B, sitting on A's dashboard, was refetching A every time
//      anything happened in B. The refetch is not wrong — it re-reads A and
//      gets A — it is simply pure waste, and it is the thing the wave brief
//      names explicitly. Admin accounts (see `admin_users`) can SELECT every
//      row on the platform, so for them this was every contribution
//      system-wide.
//   2. BURSTS. Twenty contributions arriving together produced twenty forced
//      refetches of the same endpoints.
//
// ── WHAT THIS DELIBERATELY DOES *NOT* DO ─────────────────────────────────────
//
// It does not add `workspace_id=eq.…` to the contribution/wallet/withdrawal
// subscriptions, because THOSE TABLES HAVE NO `workspace_id` COLUMN (verified
// against TEST: they carry `collection_id` only). Supabase Realtime filters
// are a single column comparison on the changed row — no joins, no `IN` — so
// a server-side workspace filter is not expressible for them. `collections`
// DOES have `workspace_id`, and that subscription is filtered server-side; it
// is the only one that can be.
//
// It is also NOT a security boundary and must never be mistaken for one. RLS
// already decides which events a client is allowed to receive at all. This
// only suppresses REFETCHES for rows the client can see but that cannot affect
// the workspace currently on screen. Every suppressed event would have
// resulted in a request that returned data for the active workspace anyway.
//
// ── THE FAIL-OPEN RULE ───────────────────────────────────────────────────────
//
// When scope cannot be determined the event is HANDLED, never dropped. On a
// payments product, one wasted request is trivially cheap; a silently
// swallowed "your money arrived" update is not. Every ambiguous case below
// resolves to `true`.

/**
 * Ids of the collections in the currently active workspace, or `null` when
 * that is not yet known (list still loading, request failed, page that never
 * loads collections). `null` means "unknown" and forces fail-open.
 */
export type ActiveCollectionIds = ReadonlySet<string> | null;

interface RealtimePayloadish {
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}

/**
 * Extract `collection_id` from a realtime payload.
 *
 * `new` is empty on DELETE and `old` is empty on INSERT, so both are consulted.
 * `old` is only fully populated when the table has REPLICA IDENTITY FULL —
 * `database/realtime.sql` sets that for all four tables, but this must not
 * assume it: a missing id returns `null`, which fails open upstream.
 */
export function collectionIdFromPayload(payload: RealtimePayloadish): string | null {
  const fromNew = payload?.new?.collection_id;
  if (typeof fromNew === "string" && fromNew) return fromNew;
  const fromOld = payload?.old?.collection_id;
  if (typeof fromOld === "string" && fromOld) return fromOld;
  return null;
}

/**
 * Should this event trigger a refetch of the active workspace's data?
 *
 * TRUE (handle) when:
 *   • the active collection set is unknown            → fail open
 *   • the set is empty                                → fail open (a brand-new
 *     workspace's first contribution must still land; an empty set is far more
 *     likely to mean "not loaded" than "genuinely has no collections")
 *   • the payload carries no collection_id            → fail open
 *   • the row's collection IS in the active workspace → genuinely relevant
 *
 * FALSE (ignore) in exactly one case: we positively know the active
 * workspace's collections, and this row belongs to a different one.
 */
export function shouldHandleRealtimeEvent(
  payload: RealtimePayloadish,
  activeCollectionIds: ActiveCollectionIds,
): boolean {
  if (!activeCollectionIds || activeCollectionIds.size === 0) return true;
  const collectionId = collectionIdFromPayload(payload);
  if (!collectionId) return true;
  return activeCollectionIds.has(collectionId);
}

// Stores keep the active workspace's collection ids as a plain array (it is
// serialisable state); the scope check wants a Set. Rebuilding one per event
// would be wasteful during exactly the bursts this module exists to damp, so
// the last conversion is memoised on array IDENTITY — the stores replace the
// array wholesale when it changes, never mutate it in place.
let lastIdsRef: readonly string[] | null = null;
let lastIdsSet: ReadonlySet<string> | null = null;

/**
 * Convert the stored id array into a Set for `shouldHandleRealtimeEvent`.
 * An empty or missing array returns `null` — "unknown", which fails open.
 */
export function collectionIdSet(ids: readonly string[] | null | undefined): ActiveCollectionIds {
  if (!ids || ids.length === 0) return null;
  if (ids === lastIdsRef && lastIdsSet) return lastIdsSet;
  lastIdsRef = ids;
  lastIdsSet = new Set(ids);
  return lastIdsSet;
}

export interface Coalescer {
  /** Request a run. Repeated calls inside the window collapse into one. */
  schedule: () => void;
  /** Drop any pending run. Call from effect cleanup. */
  cancel: () => void;
}

/**
 * Collapse a burst of calls into a single trailing invocation.
 *
 * `waitMs` is the quiet period after the last event. `maxWaitMs` bounds the
 * total delay so a CONTINUOUS stream of events still refreshes on a predictable
 * cadence instead of being starved forever by a rolling debounce — the failure
 * mode a naive debounce has under sustained load, which on this product would
 * mean a dashboard that stops updating during exactly the busiest moment.
 *
 * Both windows are deliberately short. This is a financial surface: the point
 * is to remove duplicate requests, not to make a payment take visibly longer
 * to appear.
 */
export function createCoalescer(
  run: () => void,
  { waitMs = 400, maxWaitMs = 2000 }: { waitMs?: number; maxWaitMs?: number } = {},
): Coalescer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstScheduledAt = 0;

  const fire = () => {
    timer = null;
    firstScheduledAt = 0;
    run();
  };

  return {
    schedule() {
      const now = Date.now();
      if (firstScheduledAt === 0) firstScheduledAt = now;

      if (timer) clearTimeout(timer);

      const elapsed = now - firstScheduledAt;
      const remainingBeforeMax = Math.max(0, maxWaitMs - elapsed);
      timer = setTimeout(fire, Math.min(waitMs, remainingBeforeMax));
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      firstScheduledAt = 0;
    },
  };
}
