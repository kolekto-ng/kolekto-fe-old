import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Collection, FormField, PriceTier } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";
import { axiosInstance } from "@/utils/axios";

// `supabase.functions.invoke` surfaces a generic FunctionsHttpError
// ("Edge Function returned a non-2xx status code") and hides the real reason
// inside `error.context` (the raw Response). Without reading that body, a real
// failure (e.g. a DB column/type error on the fundraising insert) looks like a
// silent "nothing happened". This pulls the actual `{ error }` message out.
async function extractFunctionError(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).clone === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      try {
        const text = await (ctx as Response).clone().text();
        if (text) return text;
      } catch {
        /* fall through */
      }
    }
  }
  const message = (error as { message?: string })?.message;
  return message && !/non-2xx status code/i.test(message) ? message : fallback;
}

// ─── Auth token helper ────────────────────────────────────────────────────────
// The app uses a custom JWT stored in localStorage. We pass it to Edge Functions
// so they can identify the caller without needing a Supabase session.

function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem("kolekto-auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.token || null;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Shape helpers ────────────────────────────────────────────────────────────

function formatCollection(c: any): Collection {
  // Derive accurate totals from actual paid contributions when amount data exists
  const contribs = Array.isArray(c.contributions) ? c.contributions : [];
  const paidContribs = contribs.filter((ct: any) => ct.status === 'paid');
  const hasMoney = paidContribs.length > 0 && paidContribs[0].amount !== undefined;

  return {
    ...c,
    formattedAmount: formatCurrency(c.amount ?? 0),
    formattedDate: formatDate(c.created_at),
    form_fields: Array.isArray(c.contributions_fields)
      ? (c.contributions_fields as FormField[])
      : [],
    pricing_tiers: Array.isArray(c.price_tiers)
      ? (c.price_tiers as PriceTier[])
      : [],
    // Only count paid contributions
    participants_count: paidContribs.length || (c.total_contributions ?? 0),
    total_contributions: paidContribs.length || (c.total_contributions ?? 0),
    // Compute raised from paid contribution amounts when available
    total_amount: hasMoney
      ? paidContribs.reduce((sum: number, ct: any) => sum + Number(ct.amount || 0), 0)
      : (c.total_amount ?? 0),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCollectionStore = create((set, get: any) => ({
  collections: [] as Collection[],
  currentCollection: null as Collection | null,
  isLoading: false,
  isRefreshing: false,
  error: null as string | null,
  lastFetchedAt: 0,
  lastFetchKey: "",
  inFlight: null as Promise<Collection[]> | null,

  // ── Fetch all collections for the current user ──────────────────────────────
  fetchCollections: async (
    userId?: string,
    opts: { force?: boolean; silent?: boolean } = {},
  ) => {
    // Resolve user_id
    let uid = userId;
    if (!uid) {
      try {
        const raw = localStorage.getItem("kolekto-auth-token");
        if (raw) {
          const parsed = JSON.parse(raw);
          uid = parsed?.user?.id || parsed?.id || undefined;
        }
      } catch {}
    }

    const key = uid || "all";
    const state = get();
    const hasCachedData =
      state.lastFetchKey === key &&
      Array.isArray(state.collections) &&
      state.collections.length > 0;
    const isFresh =
      hasCachedData && Date.now() - Number(state.lastFetchedAt || 0) < 30_000;

    if (!opts.force && state.inFlight && state.lastFetchKey === key) {
      return state.inFlight;
    }
    if (!opts.force && isFresh) {
      return state.collections;
    }

    const request = (async () => {
      set({
        isLoading: !hasCachedData && !opts.silent,
        isRefreshing: hasCachedData || !!opts.silent,
        error: null,
        lastFetchKey: key,
      });
      try {

      // Cast through `any`: the generated Database types are stale for this
      // embedded `wallets(*)` join (pre-existing — same "wallets" mismatch
      // shows up anywhere this select string is used), which otherwise blows
      // up the filter-chain type instantiation once enough .eq/.neq/.order
      // calls stack on top of it.
      let query: any = (supabase.from("collections") as any)
        .select("*, contributions(id, amount, status), wallets(*)")
        .neq("status", "deleted")
        .order("created_at", { ascending: false });

      if (uid) query = query.eq("user_id", uid);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const formatted = (data ?? []).map(formatCollection);
      set({
        collections: formatted,
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: Date.now(),
      });
      return formatted;
    } catch (err: any) {
      set({ error: toFriendlyErrorMessage(err), isLoading: false, isRefreshing: false });
      throw err;
    } finally {
      set({ inFlight: null });
    }
    })();

    set({ inFlight: request });
    return request;
  },

  // ── Fetch single collection by ID ───────────────────────────────────────────
  fetchCollectionById: async (id: string) => {
    const cached = (get().collections as Collection[]).find((c) => c.id === id);
    if (cached) {
      set({ currentCollection: cached, isLoading: false, error: null });
      return cached;
    }

    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("collections")
        .select("*, contributions(*), wallets(*)")
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message);

      const formatted = formatCollection(data);
      set((state: any) => ({
        currentCollection: formatted,
        collections: [
          formatted,
          ...(state.collections || []).filter((c: Collection) => c.id !== id),
        ],
        isLoading: false,
      }));
      return formatted;
    } catch (err: any) {
      set({ error: toFriendlyErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  // ── Create collection via Edge Function ─────────────────────────────────────
  createCollection: async (collectionData: any) => {
    set({ isLoading: true, error: null });
    try {
      // Resolve user_id from storage as a fallback for the Edge Function
      let userId: string | undefined;
      try {
        const raw = localStorage.getItem("kolekto-auth-token");
        if (raw) {
          const parsed = JSON.parse(raw);
          userId = parsed?.user?.id || parsed?.id || undefined;
        }
      } catch {}

      const { data, error } = await supabase.functions.invoke(
        "create-collection",
        {
          body: { ...collectionData, user_id: userId },
          headers: authHeaders(),
        }
      );

      if (error) {
        throw new Error(await extractFunctionError(error, "Could not create collection. Please try again."));
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.data?.id) {
        throw new Error("Collection was not created. Please try again.");
      }

      const newCollection = formatCollection(data.data);

      set((state: any) => ({
        collections: [newCollection, ...state.collections],
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: Date.now(),
      }));

      return newCollection;
    } catch (err: any) {
      set({ error: toFriendlyErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  // ── Update collection via Edge Function ─────────────────────────────────────
  updateCollection: async (id: string, collectionData: any) => {
    set({ isLoading: true, error: null });
    try {
      let userId: string | undefined;
      try {
        const raw = localStorage.getItem("kolekto-auth-token");
        if (raw) {
          const parsed = JSON.parse(raw);
          userId = parsed?.user?.id || parsed?.id || undefined;
        }
      } catch {}

      const { data, error } = await supabase.functions.invoke(
        "update-collection",
        {
          body: { id, ...collectionData, user_id: userId },
          headers: authHeaders(),
        }
      );

      if (error) {
        throw new Error(await extractFunctionError(error, "Could not update collection. Please try again."));
      }
      if (data?.error) throw new Error(data.error);

      const updated = formatCollection(data.data);

      set((state: any) => ({
        collections: state.collections.map((c: Collection) =>
          c.id === id ? { ...c, ...updated } : c
        ),
        currentCollection:
          state.currentCollection?.id === id
            ? { ...state.currentCollection, ...updated }
            : state.currentCollection,
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: Date.now(),
      }));

      return updated;
    } catch (err: any) {
      set({ error: toFriendlyErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  // ── Remove a collection from the in-memory cache ────────────────────────────
  // Called right after a successful delete so it disappears from any open list
  // immediately, instead of waiting on the 30s fetchCollections cache TTL.
  removeCollection: (id: string) => {
    set((state: any) => ({
      collections: (state.collections || []).filter((c: Collection) => c.id !== id),
      currentCollection:
        state.currentCollection?.id === id ? null : state.currentCollection,
    }));
  },

  // ── Delete (soft) a collection via the delete-collection Edge Function ──────
  // Always archives (collections.status = 'deleted') — never a destructive
  // hard delete — and cleans up the orphaned in-app notification feed
  // server-side. See supabase/functions/delete-collection/index.ts.
  deleteCollection: async (id: string) => {
    let userId: string | undefined;
    try {
      const raw = localStorage.getItem("kolekto-auth-token");
      if (raw) {
        const parsed = JSON.parse(raw);
        userId = parsed?.user?.id || parsed?.id || undefined;
      }
    } catch {}

    const { data, error } = await supabase.functions.invoke("delete-collection", {
      body: { id, user_id: userId },
      headers: authHeaders(),
    });

    if (error) {
      throw new Error(await extractFunctionError(error, "Could not delete collection. Please try again."));
    }
    if (data?.error) throw new Error(data.error);

    get().removeCollection(id);
    return data?.data;
  },

  // ── Update collection status ────────────────────────────────────────────────
  updateCollectionStatus: async (id: string, newStatus: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.put(`/collections/status/${id}`, {
        newStatus,
      });

      set((state: any) => ({
        collections: state.collections.map((c: Collection) =>
          c.id === id ? { ...c, status: newStatus } : c
        ),
        currentCollection:
          state.currentCollection?.id === id
            ? { ...state.currentCollection, status: newStatus }
            : state.currentCollection,
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: Date.now(),
      }));

      return data;
    } catch (err: any) {
      set({ error: toFriendlyErrorMessage(err), isLoading: false });
      throw err;
    }
  },
}));
