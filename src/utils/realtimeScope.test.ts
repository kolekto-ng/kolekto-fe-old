// realtimeScope.test.ts — wave 6.7F.8.
//
// These tests exist because the FAIL-OPEN rule is the whole safety argument for
// this module. Suppressing a realtime event on a payments product means a user
// does not see that their money arrived; the only acceptable direction to be
// wrong in is "refetched unnecessarily". Every ambiguous input must resolve to
// "handle", and that is what most of this file asserts.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shouldHandleRealtimeEvent,
  collectionIdFromPayload,
  collectionIdSet,
  createCoalescer,
} from "./realtimeScope";

const IN_WORKSPACE = "11111111-1111-1111-1111-111111111111";
const OTHER_WORKSPACE_COLLECTION = "22222222-2222-2222-2222-222222222222";
const active = new Set([IN_WORKSPACE]);

describe("collectionIdFromPayload", () => {
  it("reads collection_id from `new` (INSERT/UPDATE)", () => {
    expect(collectionIdFromPayload({ new: { collection_id: IN_WORKSPACE } })).toBe(IN_WORKSPACE);
  });

  it("falls back to `old` (DELETE, where `new` is empty)", () => {
    expect(collectionIdFromPayload({ old: { collection_id: IN_WORKSPACE } })).toBe(IN_WORKSPACE);
  });

  it("returns null when the row carries no collection_id", () => {
    // Possible without REPLICA IDENTITY FULL — must not throw or guess.
    expect(collectionIdFromPayload({ new: { id: "x" } })).toBeNull();
    expect(collectionIdFromPayload({})).toBeNull();
  });
});

describe("shouldHandleRealtimeEvent — the one case it suppresses", () => {
  it("IGNORES a row belonging to a collection outside the active workspace", () => {
    const payload = { new: { collection_id: OTHER_WORKSPACE_COLLECTION } };
    expect(shouldHandleRealtimeEvent(payload, active)).toBe(false);
  });

  it("HANDLES a row belonging to a collection in the active workspace", () => {
    const payload = { new: { collection_id: IN_WORKSPACE } };
    expect(shouldHandleRealtimeEvent(payload, active)).toBe(true);
  });
});

describe("shouldHandleRealtimeEvent — fail open (never drop a money event)", () => {
  it("handles when the active set is unknown (null)", () => {
    expect(shouldHandleRealtimeEvent({ new: { collection_id: OTHER_WORKSPACE_COLLECTION } }, null)).toBe(true);
  });

  it("handles when the active set is empty — empty means 'not loaded', not 'no collections'", () => {
    expect(
      shouldHandleRealtimeEvent({ new: { collection_id: OTHER_WORKSPACE_COLLECTION } }, new Set()),
    ).toBe(true);
  });

  it("handles when the payload has no collection_id at all", () => {
    expect(shouldHandleRealtimeEvent({ new: { id: "x" } }, active)).toBe(true);
  });

  it("handles a DELETE identified only by `old`", () => {
    expect(shouldHandleRealtimeEvent({ old: { collection_id: IN_WORKSPACE } }, active)).toBe(true);
  });

  it("handles a completely empty payload", () => {
    expect(shouldHandleRealtimeEvent({}, active)).toBe(true);
  });
});

describe("collectionIdSet", () => {
  it("treats empty/missing as UNKNOWN (null) so callers fail open", () => {
    expect(collectionIdSet([])).toBeNull();
    expect(collectionIdSet(null)).toBeNull();
    expect(collectionIdSet(undefined)).toBeNull();
  });

  it("builds a membership set", () => {
    const set = collectionIdSet([IN_WORKSPACE]);
    expect(set?.has(IN_WORKSPACE)).toBe(true);
    expect(set?.has(OTHER_WORKSPACE_COLLECTION)).toBe(false);
  });

  it("memoises on array identity but re-derives for a new array", () => {
    const ids = [IN_WORKSPACE];
    expect(collectionIdSet(ids)).toBe(collectionIdSet(ids));
    const next = [OTHER_WORKSPACE_COLLECTION];
    expect(collectionIdSet(next)?.has(OTHER_WORKSPACE_COLLECTION)).toBe(true);
  });
});

// The measured claim in the wave report, exercised through the REAL exported
// functions rather than a model of them: how many dashboard refetches does a
// burst of realtime events actually cause? Each refetch is three HTTP requests
// (/dashboard/stats + /collections + /dashboard/activities).
describe("request volume under a realtime burst (the wave's headline metric)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Drive `events` through the exact scope + coalesce path the pages use. */
  function refetchCount(
    events: { collection_id: string }[],
    activeIds: ReadonlySet<string> | null,
    { coalesce }: { coalesce: boolean },
  ): number {
    let refetches = 0;
    const c = createCoalescer(() => refetches++, { waitMs: 400, maxWaitMs: 2000 });
    for (const ev of events) {
      const payload = { new: { collection_id: ev.collection_id } };
      if (activeIds !== undefined && !shouldHandleRealtimeEvent(payload, activeIds)) continue;
      if (coalesce) c.schedule();
      else refetches++;
      vi.advanceTimersByTime(50); // events 50 ms apart
    }
    vi.advanceTimersByTime(2000); // let any pending run fire
    return refetches;
  }

  const ACTIVE = ["cA1", "cA2", "cA3"];
  const OTHER = ["cB1", "cB2"];
  const activeSet = new Set(ACTIVE);
  const burst = (ids: string[]) =>
    Array.from({ length: 20 }, (_, i) => ({ collection_id: ids[i % ids.length] }));

  it("20 events in the ACTIVE workspace: 20 refetches → 1", () => {
    // BEFORE: unfiltered + uncoalesced.
    expect(refetchCount(burst(ACTIVE), null, { coalesce: false })).toBe(20);
    // AFTER: scoped + coalesced.
    expect(refetchCount(burst(ACTIVE), activeSet, { coalesce: true })).toBe(1);
  });

  it("20 events in ANOTHER workspace the user owns: 20 refetches → 0", () => {
    expect(refetchCount(burst(OTHER), null, { coalesce: false })).toBe(20);
    expect(refetchCount(burst(OTHER), activeSet, { coalesce: true })).toBe(0);
  });

  it("a mixed burst still refetches once — relevant events are never lost", () => {
    const mixed = Array.from({ length: 20 }, (_, i) => ({
      collection_id: i % 4 === 0 ? ACTIVE[0] : OTHER[i % OTHER.length],
    }));
    expect(refetchCount(mixed, activeSet, { coalesce: true })).toBe(1);
  });
});

describe("createCoalescer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("collapses a burst into ONE call", () => {
    const run = vi.fn();
    const c = createCoalescer(run, { waitMs: 400, maxWaitMs: 2000 });
    for (let i = 0; i < 20; i++) c.schedule();
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("still runs within maxWaitMs under a CONTINUOUS stream", () => {
    // A rolling debounce alone would starve forever here — which on this
    // product means the dashboard stops updating during the busiest moment.
    const run = vi.fn();
    const c = createCoalescer(run, { waitMs: 400, maxWaitMs: 1000 });
    for (let i = 0; i < 10; i++) {
      c.schedule();
      vi.advanceTimersByTime(300); // always shorter than waitMs
    }
    expect(run).toHaveBeenCalled();
  });

  it("runs again for a second, separate burst", () => {
    const run = vi.fn();
    const c = createCoalescer(run, { waitMs: 400, maxWaitMs: 2000 });
    c.schedule();
    vi.advanceTimersByTime(400);
    expect(run).toHaveBeenCalledTimes(1);
    c.schedule();
    vi.advanceTimersByTime(400);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("cancel() drops a pending run (effect cleanup / workspace switch)", () => {
    const run = vi.fn();
    const c = createCoalescer(run, { waitMs: 400 });
    c.schedule();
    c.cancel();
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
  });

  it("does not fire on its own without a schedule()", () => {
    const run = vi.fn();
    createCoalescer(run, { waitMs: 400 });
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
  });
});
