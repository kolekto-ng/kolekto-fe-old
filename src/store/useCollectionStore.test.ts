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

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      functions: { invoke: invokeMock },
    },
  };
});

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
