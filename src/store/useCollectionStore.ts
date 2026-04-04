import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Collection, FormField, PriceTier } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";

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
  error: null as string | null,

  // ── Fetch all collections for the current user ──────────────────────────────
  fetchCollections: async (userId?: string) => {
    set({ isLoading: true, error: null });
    try {
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

      let query = supabase
        .from("collections")
        .select("*, contributions(id, amount, status), wallets(*)")
        .order("created_at", { ascending: false });

      if (uid) query = query.eq("user_id", uid);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const formatted = (data ?? []).map(formatCollection);
      set({ collections: formatted, isLoading: false });
      return formatted;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  // ── Fetch single collection by ID ───────────────────────────────────────────
  fetchCollectionById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // Try memory first
      const cached = (get().collections as Collection[]).find((c) => c.id === id);
      if (cached) {
        set({ currentCollection: cached, isLoading: false });
        return cached;
      }

      const { data, error } = await supabase
        .from("collections")
        .select("*, contributions(*), wallets(*)")
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message);

      const formatted = formatCollection(data);
      set({ currentCollection: formatted, isLoading: false });
      return formatted;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
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

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const newCollection = formatCollection(data.data);

      set((state: any) => ({
        collections: [newCollection, ...state.collections],
        isLoading: false,
      }));

      return newCollection;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
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

      if (error) throw new Error(error.message);
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
      }));

      return updated;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  // ── Update collection status ────────────────────────────────────────────────
  updateCollectionStatus: async (id: string, newStatus: string) => {
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
        "update-collection-status",
        {
          body: { id, status: newStatus, user_id: userId },
          headers: authHeaders(),
        }
      );

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      set((state: any) => ({
        collections: state.collections.map((c: Collection) =>
          c.id === id ? { ...c, status: newStatus } : c
        ),
        currentCollection:
          state.currentCollection?.id === id
            ? { ...state.currentCollection, status: newStatus }
            : state.currentCollection,
        isLoading: false,
      }));

      return data.data;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },
}));
