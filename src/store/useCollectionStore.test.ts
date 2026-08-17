import { describe, it, expect, vi, beforeEach } from "vitest";

// Build a chainable query-builder mock: every `.from/.select/.eq/.neq/.order(...)`
// call returns `this` so call chains resolve, while letting tests assert which
// filters were actually applied (the bug this whole feature fixes was a missing
// filter, so asserting the filter is present is the point of these tests).
function createQueryBuilderMock(resolved: { data: any; error: any }) {
  const calls: { method: string; args: any[] }[] = [];
  const builder: any = {
    select: vi.fn((...args: any[]) => { calls.push({ method: "select", args }); return builder; }),
    eq: vi.fn((...args: any[]) => { calls.push({ method: "eq", args }); return builder; }),
    neq: vi.fn((...args: any[]) => { calls.push({ method: "neq", args }); return builder; }),
    order: vi.fn((...args: any[]) => { calls.push({ method: "order", args }); return builder; }),
    single: vi.fn(() => Promise.resolve(resolved)),
    // The real PostgrestFilterBuilder stays chainable after every filter and
    // only resolves once awaited — make this mock thenable so `await query`
    // works no matter what order .eq/.neq/.order were chained in.
    then: (resolve: any, reject: any) => Promise.resolve(resolved).then(resolve, reject),
    _calls: calls,
  };
  return builder;
}

const { invokeMock, postMock, getMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  postMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      functions: { invoke: invokeMock },
    },
  };
});

vi.mock("@/utils/axios", () => ({
  axiosInstance: {
    post: postMock,
    get: getMock,
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { useCollectionStore as useCollectionStoreUntyped } from "./useCollectionStore";

// The store has no generic type argument (matches its other consumers across
// the app, which all read it via `useCollectionStore() as any`), so its
// inferred type is `unknown` — cast once here the same way.
const useCollectionStore = useCollectionStoreUntyped as any;

describe("useCollectionStore", () => {
  beforeEach(() => {
    useCollectionStore.setState({
      collections: [],
      currentCollection: null,
      lastFetchKey: "",
      lastFetchedAt: 0,
      inFlight: null,
    } as any);
    invokeMock.mockReset();
    postMock.mockReset();
    getMock.mockReset();
    (supabase.from as any).mockReset();
    localStorage.clear();
  });

  describe("fetchCollections", () => {
    // Wave 6.3 migrated this read from a browser-side Supabase query to the
    // Express endpoint, so the backend can apply workspace scoping and the
    // transaction:read financial gate. The soft-delete exclusion that this
    // suite used to assert here moved with it — it is now enforced (and
    // tested) in the backend's collectionScopeRepository.
    it("reads through the backend endpoint, not the browser Supabase client", async () => {
      getMock.mockResolvedValue({ data: { data: [] } });

      await useCollectionStore.getState().fetchCollections("user-1", { force: true });

      expect(getMock).toHaveBeenCalledWith("/collections");
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("maps the backend's `data` array through formatCollection", async () => {
      getMock.mockResolvedValue({
        data: {
          data: [
            {
              id: "col-1",
              title: "Dues",
              amount: 5000,
              created_at: "2026-08-15T00:00:00.000Z",
              contributions: [{ id: "c1", amount: 5000, status: "paid" }],
            },
          ],
        },
      });

      const result = await useCollectionStore.getState().fetchCollections("user-1", { force: true });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("col-1");
      expect(result[0].participants_count).toBe(1);
      expect(result[0].total_amount).toBe(5000);
    });

    it("renders a money-free payload without breaking (MEMBER redaction)", async () => {
      // What a caller without transaction:read receives: contribution rows
      // with no `amount`, and no `wallets` block at all. The list must still
      // render — counts intact, figures simply absent — rather than throw.
      getMock.mockResolvedValue({
        data: {
          data: [
            {
              id: "col-1",
              title: "Dues",
              created_at: "2026-08-15T00:00:00.000Z",
              total_contributions: 3,
              contributions: [{ id: "c1", status: "paid" }],
            },
          ],
        },
      });

      const result = await useCollectionStore.getState().fetchCollections("user-1", { force: true });

      expect(result[0].wallets).toBeUndefined();
      expect(result[0].total_amount).toBe(0);
      expect(result[0].participants_count).toBe(1);
    });
  });

  describe("createCollection", () => {
    it("routes fundraising submissions through Express even when the generic create flag is set to edge", async () => {
      localStorage.setItem("kolekto-ff-create-path", "edge");
      localStorage.setItem("kolekto-auth-token", JSON.stringify({ user: { id: "user-1" }, access_token: "token" }));
      postMock.mockResolvedValue({
        data: {
          data: {
            id: "fund-1",
            title: "Save the Hall",
            collection_type: "fundraising",
            status: "pending_review",
            created_at: "2026-08-08T00:00:00.000Z",
          },
        },
      });
      invokeMock.mockResolvedValue({ data: { data: { id: "wrong-path" } }, error: null });

      const result = await useCollectionStore.getState().createCollection({
        title: "Save the Hall",
        collection_type: "fundraising",
      });

      expect(postMock).toHaveBeenCalledWith(
        "/create-collection",
        expect.objectContaining({
          title: "Save the Hall",
          collection_type: "fundraising",
          user_id: "user-1",
        }),
      );
      expect(invokeMock).not.toHaveBeenCalled();
      expect(result.id).toBe("fund-1");
    });

    it("sends an explicit workspaceId as the X-Workspace-Id header when the caller provides one", async () => {
      localStorage.setItem("kolekto-auth-token", JSON.stringify({ user: { id: "user-1" }, access_token: "token" }));
      postMock.mockResolvedValue({
        data: { data: { id: "col-1", title: "Club Dues", collection_type: "fixed", created_at: "2026-08-13T00:00:00.000Z" } },
      });

      await useCollectionStore.getState().createCollection(
        { title: "Club Dues", collection_type: "fixed" },
        "ws-explicit-123",
      );

      expect(postMock).toHaveBeenCalledWith(
        "/create-collection",
        expect.objectContaining({ title: "Club Dues", user_id: "user-1" }),
        { headers: { "X-Workspace-Id": "ws-explicit-123" } },
      );
    });

    it("omits the third axios argument entirely when no workspaceId is known (backwards compatible)", async () => {
      localStorage.setItem("kolekto-auth-token", JSON.stringify({ user: { id: "user-1" }, access_token: "token" }));
      postMock.mockResolvedValue({
        data: { data: { id: "col-2", title: "No Workspace Yet", collection_type: "fixed", created_at: "2026-08-13T00:00:00.000Z" } },
      });

      await useCollectionStore.getState().createCollection({ title: "No Workspace Yet", collection_type: "fixed" });

      expect(postMock).toHaveBeenCalledWith(
        "/create-collection",
        expect.objectContaining({ title: "No Workspace Yet", user_id: "user-1" }),
      );
      // Exactly 2 args — no explicit `undefined` third arg that would silently
      // rely on axios' default config while looking like an explicit no-op.
      expect(postMock.mock.calls[0].length).toBe(2);
    });
  });

  describe("removeCollection", () => {
    it("removes the collection from the cached list", () => {
      useCollectionStore.setState({
        collections: [{ id: "a" }, { id: "b" }],
        currentCollection: null,
      } as any);

      useCollectionStore.getState().removeCollection("a");

      expect(useCollectionStore.getState().collections).toEqual([{ id: "b" }]);
    });

    it("clears currentCollection if it matches the deleted id", () => {
      useCollectionStore.setState({
        collections: [{ id: "a" }],
        currentCollection: { id: "a" },
      } as any);

      useCollectionStore.getState().removeCollection("a");

      expect(useCollectionStore.getState().currentCollection).toBeNull();
    });

    it("leaves currentCollection untouched when it does not match", () => {
      useCollectionStore.setState({
        collections: [{ id: "a" }, { id: "b" }],
        currentCollection: { id: "b" },
      } as any);

      useCollectionStore.getState().removeCollection("a");

      expect(useCollectionStore.getState().currentCollection).toEqual({ id: "b" });
    });
  });

  describe("deleteCollection", () => {
    it("invokes the delete-collection edge function and removes the collection from cache on success", async () => {
      useCollectionStore.setState({ collections: [{ id: "a" }, { id: "b" }] } as any);
      invokeMock.mockResolvedValue({ data: { data: { archived: true } }, error: null });

      const result = await useCollectionStore.getState().deleteCollection("a");

      expect(invokeMock).toHaveBeenCalledWith(
        "delete-collection",
        expect.objectContaining({ body: expect.objectContaining({ id: "a" }) }),
      );
      expect(useCollectionStore.getState().collections).toEqual([{ id: "b" }]);
      expect(result).toEqual({ archived: true });
    });

    it("throws and does not touch the cache when the edge function returns an error", async () => {
      useCollectionStore.setState({ collections: [{ id: "a" }] } as any);
      invokeMock.mockResolvedValue({ data: { error: "Unauthorized: you do not own this collection" }, error: null });

      await expect(useCollectionStore.getState().deleteCollection("a")).rejects.toThrow(/Unauthorized/);
      expect(useCollectionStore.getState().collections).toEqual([{ id: "a" }]);
    });
  });
});
