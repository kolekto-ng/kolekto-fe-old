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

const { invokeMock, postMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  postMock: vi.fn(),
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
    (supabase.from as any).mockReset();
    localStorage.clear();
  });

  describe("fetchCollections", () => {
    it("excludes soft-deleted collections (status='deleted') from the query", async () => {
      const builder = createQueryBuilderMock({ data: [], error: null });
      (supabase.from as any).mockReturnValue(builder);

      await useCollectionStore.getState().fetchCollections("user-1", { force: true });

      expect(supabase.from).toHaveBeenCalledWith("collections");
      const neqCalls = builder._calls.filter((c: any) => c.method === "neq");
      expect(neqCalls).toContainEqual({ method: "neq", args: ["status", "deleted"] });
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
