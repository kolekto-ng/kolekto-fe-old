// workspaceInvalidation.test.ts — Workspace Wave 6.2.
//
// The behaviour under test is the one the Wave 6 brief singles out: after
// switching Workspace A → Workspace B, none of A's data may remain visible.
// Both defence layers are covered — the reset subscription, and the cache
// keys that make a MISSED reset degrade to a refetch rather than to showing
// the wrong workspace's rows.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/utils/axios", () => ({
  axiosInstance: { get: getMock, post: postMock, patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));

import { useWorkspaceStore } from "./useWorkspaceStore";
import { useCollectionStore as useCollectionStoreUntyped } from "./useCollectionStore";
import { useDashboardHomeStore } from "./useDashboardHomeStore";
import { useActivities as useActivitiesUntyped } from "./useDashboard";
import { useWithdrawalStore as useWithdrawalStoreUntyped } from "./useWithdrawalStore";
import { useTransactionStore } from "./useTransactionStore";
import {
  resetWorkspaceScopedStores,
  subscribeWorkspaceInvalidation,
} from "./workspaceInvalidation";
import { setActiveWorkspaceId } from "@/utils/activeWorkspace";

const useCollectionStore = useCollectionStoreUntyped as any;
const useActivities = useActivitiesUntyped as any;
const useWithdrawalStore = useWithdrawalStoreUntyped as any;

const WS_A = "ws-aaaa";
const WS_B = "ws-bbbb";
const USER = "user-1";

/** Seed every workspace-scoped store as if Workspace A's data were loaded. */
function seedWorkspaceAData() {
  useCollectionStore.setState({
    collections: [{ id: "col-A1" }, { id: "col-A2" }],
    currentCollection: { id: "col-A1" },
    lastFetchedAt: Date.now(),
    lastFetchKey: `${USER}:${WS_A}`,
  });
  useDashboardHomeStore.setState({
    stats: {
      totalCollections: 9,
      activeCollections: 4,
      totalBalance: 500_000,
      availableBalance: 250_000,
      pendingBalance: 250_000,
    },
    activities: [{ id: "act-A1" }],
    recentCollections: [{ id: "col-A1" }],
    lastFetchedAt: Date.now(),
    lastUserId: USER,
    lastWorkspaceId: WS_A,
  } as any);
  useActivities.setState({
    activities: [{ id: "act-A1" }],
    lastFetchedAt: Date.now(),
    lastFetchKey: WS_A,
  });
  useWithdrawalStore.setState({
    withdrawals: [{ id: "wd-A1", amount: 1000 }],
    lastFetchedAt: Date.now(),
    lastFetchKey: `${USER}:all:${WS_A}`,
  });
  useTransactionStore.setState({
    transactions: [{ id: "txn-A1" } as any],
    financialSummary: { totalRaised: 1, totalWithdrawn: 0, availableBalance: 1, pendingWithdrawals: 0 } as any,
  });
}

describe("Wave 6.2 — workspace switch invalidation", () => {
  beforeEach(() => {
    localStorage.clear();
    getMock.mockReset();
    useWorkspaceStore.setState({
      workspaces: [
        { id: WS_A, name: "Personal", slug: "p", type: "personal", status: "active", owner_id: USER },
        { id: WS_B, name: "Team", slug: "t", type: "organization", status: "active", owner_id: USER },
      ] as any,
      activeWorkspaceId: WS_A,
    });
  });

  describe("resetWorkspaceScopedStores", () => {
    it("clears every workspace-scoped store so no Workspace A data survives", () => {
      seedWorkspaceAData();

      resetWorkspaceScopedStores();

      expect(useCollectionStore.getState().collections).toEqual([]);
      expect(useCollectionStore.getState().currentCollection).toBeNull();
      expect(useDashboardHomeStore.getState().recentCollections).toEqual([]);
      expect(useDashboardHomeStore.getState().activities).toEqual([]);
      expect(useActivities.getState().activities).toEqual([]);
      expect(useWithdrawalStore.getState().withdrawals).toEqual([]);
      expect(useTransactionStore.getState().transactions).toEqual([]);
    });

    it("zeroes financial figures rather than leaving another workspace's money on screen", () => {
      seedWorkspaceAData();

      resetWorkspaceScopedStores();

      expect(useDashboardHomeStore.getState().stats).toEqual({
        totalCollections: 0,
        activeCollections: 0,
        totalBalance: 0,
        availableBalance: 0,
        pendingBalance: 0,
      });
      expect(useTransactionStore.getState().financialSummary).toBeNull();
    });

    it("invalidates freshness so the next read is a genuine miss, not a cache hit", () => {
      seedWorkspaceAData();

      resetWorkspaceScopedStores();

      expect(useCollectionStore.getState().lastFetchedAt).toBe(0);
      expect(useCollectionStore.getState().lastFetchKey).toBe("");
      expect(useDashboardHomeStore.getState().lastFetchedAt).toBe(0);
      expect(useDashboardHomeStore.getState().lastWorkspaceId).toBeNull();
      expect(useActivities.getState().lastFetchedAt).toBe(0);
      expect(useWithdrawalStore.getState().lastFetchedAt).toBe(0);
    });

    it("drops in-flight promises so a request issued under A is never adopted under B", () => {
      useCollectionStore.setState({ inFlight: Promise.resolve([]) });
      useActivities.setState({ inFlight: Promise.resolve() });

      resetWorkspaceScopedStores();

      expect(useCollectionStore.getState().inFlight).toBeNull();
      expect(useActivities.getState().inFlight).toBeNull();
    });
  });

  describe("subscribeWorkspaceInvalidation", () => {
    it("clears stale data when the active workspace actually changes", () => {
      const unsubscribe = subscribeWorkspaceInvalidation();
      seedWorkspaceAData();

      useWorkspaceStore.getState().switchWorkspace(WS_B, USER);

      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(WS_B);
      expect(useCollectionStore.getState().collections).toEqual([]);
      expect(useDashboardHomeStore.getState().activities).toEqual([]);
      expect(useWithdrawalStore.getState().withdrawals).toEqual([]);
      unsubscribe();
    });

    it("does NOT wipe good caches when the id is re-set to the same value", () => {
      // fetchWorkspaces re-sets activeWorkspaceId on every bootstrap. Resetting
      // on that would clear a valid cache on every page load.
      const unsubscribe = subscribeWorkspaceInvalidation();
      seedWorkspaceAData();

      useWorkspaceStore.setState({ activeWorkspaceId: WS_A });

      expect(useCollectionStore.getState().collections).toHaveLength(2);
      unsubscribe();
    });

    it("stops reacting once unsubscribed", () => {
      const unsubscribe = subscribeWorkspaceInvalidation();
      unsubscribe();
      seedWorkspaceAData();

      useWorkspaceStore.getState().switchWorkspace(WS_B, USER);

      expect(useCollectionStore.getState().collections).toHaveLength(2);
    });
  });

  describe("cache keys include the workspace (second line of defence)", () => {
    it("useActivities refetches under B even if the reset were missed", async () => {
      // Simulate a stale, still-'fresh' Workspace A feed that a missed reset
      // would have left behind, then switch to B WITHOUT resetting.
      useActivities.setState({
        activities: [{ id: "act-A1" }],
        lastFetchedAt: Date.now(),
        lastFetchKey: WS_A,
        inFlight: null,
      });
      setActiveWorkspaceId(WS_B, USER);
      getMock.mockResolvedValue({ data: { data: [{ id: "act-B1" }] } });

      await useActivities.getState().getActivities();

      expect(getMock).toHaveBeenCalled();
      expect(useActivities.getState().activities).toEqual([{ id: "act-B1" }]);
    });

    it("useActivities still serves a fresh cache within the SAME workspace", async () => {
      setActiveWorkspaceId(WS_A, USER);
      useActivities.setState({
        activities: [{ id: "act-A1" }],
        lastFetchedAt: Date.now(),
        lastFetchKey: WS_A,
        inFlight: null,
      });

      await useActivities.getState().getActivities();

      expect(getMock).not.toHaveBeenCalled();
    });

    it("useWithdrawalStore keys its cache on the active workspace", async () => {
      setActiveWorkspaceId(WS_A, USER);
      getMock.mockResolvedValue({ data: { withdrawals: [{ id: "wd-A1" }] } });
      await useWithdrawalStore.getState().fetchWithdrawals(USER, undefined, { force: true });

      expect(useWithdrawalStore.getState().lastFetchKey).toBe(`${USER}:all:${WS_A}`);
    });
  });

  describe("stale in-flight responses", () => {
    it("a response that arrives after switching A → B does not overwrite B's state", async () => {
      setActiveWorkspaceId(WS_A, USER);

      // The request leaves under A and resolves only after the switch to B.
      let releaseResponse: (v: any) => void = () => {};
      getMock.mockImplementation(
        () => new Promise((resolve) => { releaseResponse = resolve; }),
      );

      const pending = useActivities.getState().getActivities({ force: true });

      // User switches to B while the A request is still airborne.
      setActiveWorkspaceId(WS_B, USER);
      useActivities.setState({ activities: [{ id: "act-B1" }] });

      releaseResponse({ data: { data: [{ id: "act-A1" }] } });
      await pending;

      expect(useActivities.getState().activities).toEqual([{ id: "act-B1" }]);
    });
  });
});
