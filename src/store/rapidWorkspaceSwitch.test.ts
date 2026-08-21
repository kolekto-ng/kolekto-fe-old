// rapidWorkspaceSwitch.test.ts — wave 6.7F.8, brief §14.
//
// THE SCENARIO: a user switches A → B → C → A faster than the network
// responds, so several dashboard loads are in flight at once and they resolve
// OUT OF ORDER. The requirement is absolute: whatever finally sits in the
// store must belong to the workspace that is active NOW. A late response from
// a workspace the user has left must be discarded, never rendered under the
// current workspace's name.
//
// This is the failure mode earlier workspace waves were built to prevent, and
// wave 6.7F.8 changed the code that enforces it: the dashboard store went from
// ONE commit after `Promise.all` to THREE independent per-section commits, so
// the stale-response guard now has to hold at three separate points instead of
// one. These tests pin that it still does.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/utils/axios", () => ({
  axiosInstance: { get: getMock, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));

// The store reads the active workspace through this module on every commit,
// so driving it here is exactly how a real switch looks to the store.
let currentWorkspace: string | null = null;
vi.mock("@/utils/activeWorkspace", () => ({
  getActiveWorkspaceId: () => currentWorkspace,
  getActiveWorkspaceIdForUser: () => currentWorkspace,
  setActiveWorkspaceId: (id: string | null) => {
    currentWorkspace = id;
  },
  clearActiveWorkspace: () => {
    currentWorkspace = null;
  },
  ACTIVE_WORKSPACE_KEY: "kolekto-active-workspace-id",
}));

import { useDashboardHomeStore } from "./useDashboardHomeStore";

const USER = "user-1";
const WS = { A: "ws-aaaa", B: "ws-bbbb", C: "ws-cccc" };

/** A response whose resolution we control, tagged with its workspace. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function statsFor(ws: string) {
  return { data: { totalCollections: 1, activeCollections: 1, totalBalance: BALANCES[ws], availableBalance: BALANCES[ws], pendingBalance: 0 } };
}
function collectionsFor(ws: string) {
  return { data: { data: [{ id: `col-${ws}`, title: `Collection ${ws}`, status: "active", contributions: [] }] } };
}
function activitiesFor(ws: string) {
  return { data: { data: [{ id: `act-${ws}`, name: ws, created_at: new Date().toISOString(), collection_title: `Collection ${ws}` }] } };
}

const BALANCES: Record<string, number> = { [WS.A]: 111, [WS.B]: 222, [WS.C]: 333 };

beforeEach(() => {
  getMock.mockReset();
  currentWorkspace = null;
  useDashboardHomeStore.setState({
    stats: { totalCollections: 0, activeCollections: 0, totalBalance: 0, availableBalance: 0, pendingBalance: 0 },
    activities: [],
    recentCollections: [],
    workspaceCollectionIds: [],
    lastFetchedAt: 0,
    lastUserId: null,
    lastWorkspaceId: null,
    inFlight: null,
  } as any);
});

describe("rapid workspace switching (A → B → C → A)", () => {
  it("a LATE response from an abandoned workspace never lands", async () => {
    // A's requests are held open. We switch to B before they resolve.
    const aStats = deferred<any>();
    const aCollections = deferred<any>();
    const aActivities = deferred<any>();

    getMock.mockImplementation((url: string) => {
      if (url.includes("/dashboard/stats")) return aStats.promise;
      if (url.includes("/collections")) return aCollections.promise;
      if (url.includes("/dashboard/activities")) return aActivities.promise;
      return Promise.resolve({ data: {} });
    });

    currentWorkspace = WS.A;
    const aLoad = useDashboardHomeStore.getState().loadDashboardHome(USER);

    // User switches away while A is still airborne.
    currentWorkspace = WS.B;

    // Now A's responses arrive — every one of them is stale.
    aStats.resolve(statsFor(WS.A));
    aCollections.resolve(collectionsFor(WS.A));
    aActivities.resolve(activitiesFor(WS.A));
    await aLoad;

    const state = useDashboardHomeStore.getState();
    expect(state.stats.totalBalance).toBe(0);           // A's 111 rejected
    expect(state.recentCollections).toHaveLength(0);    // A's card rejected
    expect(state.activities).toHaveLength(0);           // A's activity rejected
    expect(state.workspaceCollectionIds).toHaveLength(0);
  });

  it("each of the THREE commit points is guarded independently", async () => {
    // Stats resolves while A is still active; the other two resolve after the
    // switch. Only the first may land — this is the case a single end-of-
    // Promise.all guard would have got wrong in the opposite direction.
    const stats = deferred<any>();
    const collections = deferred<any>();
    const activities = deferred<any>();
    getMock.mockImplementation((url: string) => {
      if (url.includes("/dashboard/stats")) return stats.promise;
      if (url.includes("/collections")) return collections.promise;
      return activities.promise;
    });

    currentWorkspace = WS.A;
    const load = useDashboardHomeStore.getState().loadDashboardHome(USER);

    stats.resolve(statsFor(WS.A));
    // The commit sits several `.then()` hops down the promise chain, so yield
    // to the macrotask queue rather than counting microticks.
    await new Promise((r) => setTimeout(r, 0));
    expect(useDashboardHomeStore.getState().stats.totalBalance).toBe(111);

    currentWorkspace = WS.C; // switch mid-flight
    collections.resolve(collectionsFor(WS.A));
    activities.resolve(activitiesFor(WS.A));
    await load;

    // The two post-switch commits were dropped.
    expect(useDashboardHomeStore.getState().recentCollections).toHaveLength(0);
    expect(useDashboardHomeStore.getState().activities).toHaveLength(0);
  });

  it("after A → B → C → A the store holds A's data, not C's", async () => {
    // Every request answers according to whichever workspace was active when
    // it was issued, and all resolve immediately — the realistic ordering.
    getMock.mockImplementation((url: string) => {
      const ws = currentWorkspace!;
      if (url.includes("/dashboard/stats")) return Promise.resolve(statsFor(ws));
      if (url.includes("/collections")) return Promise.resolve(collectionsFor(ws));
      return Promise.resolve(activitiesFor(ws));
    });

    for (const ws of [WS.A, WS.B, WS.C, WS.A]) {
      currentWorkspace = ws;
      await useDashboardHomeStore.getState().loadDashboardHome(USER, { force: true });
    }

    const state = useDashboardHomeStore.getState();
    expect(state.lastWorkspaceId).toBe(WS.A);
    expect(state.stats.totalBalance).toBe(BALANCES[WS.A]);
    expect(state.recentCollections[0]?.id).toBe(`col-${WS.A}`);
    expect(state.workspaceCollectionIds).toEqual([`col-${WS.A}`]);
    // Nothing from the workspaces passed through on the way.
    expect(state.stats.totalBalance).not.toBe(BALANCES[WS.C]);
  });

  it("workspaceCollectionIds always describes the CURRENT workspace", async () => {
    // The realtime scope check reads this set. If it ever held another
    // workspace's ids, events would be scoped against the wrong workspace —
    // suppressing real updates or admitting irrelevant ones.
    getMock.mockImplementation((url: string) => {
      const ws = currentWorkspace!;
      if (url.includes("/dashboard/stats")) return Promise.resolve(statsFor(ws));
      if (url.includes("/collections")) return Promise.resolve(collectionsFor(ws));
      return Promise.resolve(activitiesFor(ws));
    });

    currentWorkspace = WS.A;
    await useDashboardHomeStore.getState().loadDashboardHome(USER, { force: true });
    expect(useDashboardHomeStore.getState().workspaceCollectionIds).toEqual([`col-${WS.A}`]);

    currentWorkspace = WS.B;
    await useDashboardHomeStore.getState().loadDashboardHome(USER, { force: true });
    expect(useDashboardHomeStore.getState().workspaceCollectionIds).toEqual([`col-${WS.B}`]);
  });
});
