import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Collection, FormField, PriceTier } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";
import { axiosInstance } from "@/utils/axios";
import { getCreateCollectionPath } from "@/lib/featureFlags";
import { useKycGateStore } from "@/store/useKycGateStore";

// `supabase.functions.invoke` surfaces a generic FunctionsHttpError
// ("Edge Function returned a non-2xx status code") and hides the real reason
// inside `error.context` (the raw Response). Without reading that body, a real
// failure (e.g. a DB column/type error on the fundraising insert) looks like a
// silent "nothing happened". This pulls the actual `{ error }` message out.
//
// Also extracts `code` (e.g. "KYC_REQUIRED") — this matters because
// supabase.functions.invoke() never goes through axiosInstance, so the
// global KYC_REQUIRED interceptor in utils/axios.tsx CANNOT see edge-function
// responses at all. Every call site that hits an edge function directly must
// check this `code` itself and open useKycGateStore, or the same block that
// correctly opens the "Identity verification required" modal on the Express
// path silently falls through to a generic error toast on the edge path —
// which is the DEFAULT production path today (see lib/featureFlags.ts).
async function extractFunctionError(
  error: unknown,
  fallback: string
): Promise<{ message: string; code?: string }> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).clone === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return { message: String(body.error), code: body?.code };
      if (body?.message) return { message: String(body.message), code: body?.code };
    } catch {
      try {
        const text = await (ctx as Response).clone().text();
        if (text) return { message: text };
      } catch {
        /* fall through */
      }
    }
  }
  const message = (error as { message?: string })?.message;
  return { message: message && !/non-2xx status code/i.test(message) ? message : fallback };
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

  // ── Create collection ───────────────────────────────────────────────────────
  // Canary-switched between the legacy Edge function (default, today's prod
  // behavior) and the new Express CollectionService (single write authority).
  // The switch is a runtime feature flag (see @/lib/featureFlags) so enabling
  // the Express path — and rolling back — needs no redeploy. Both paths accept
  // the same flat payload and return { data: collection }.
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

      let collectionRow: any;

      if (getCreateCollectionPath() === "express") {
        // Express CollectionService. Auth is the Bearer token on axiosInstance;
        // the user_id in the body is ignored server-side (taken from the JWT).
        const res = await axiosInstance.post("/create-collection", {
          ...collectionData,
          user_id: userId,
        });
        const body = res?.data;
        if (body?.error) throw new Error(body.error);
        if (!body?.data?.id) {
          throw new Error("Collection was not created. Please try again.");
        }
        collectionRow = body.data;
      } else {
        // Legacy Supabase Edge function (default production path).
        const { data, error } = await supabase.functions.invoke(
          "create-collection",
          {
            body: { ...collectionData, user_id: userId },
            headers: authHeaders(),
          }
        );

        if (error) {
          const extracted = await extractFunctionError(error, "Could not create collection. Please try again.");
          if (extracted.code === "KYC_REQUIRED") {
            useKycGateStore.getState().open(extracted.message);
          }
          const thrown = new Error(extracted.message) as Error & { code?: string };
          thrown.code = extracted.code;
          throw thrown;
        }
        if (data?.error) {
          if (data?.code === "KYC_REQUIRED") {
            useKycGateStore.getState().open(data.error);
          }
          const thrown = new Error(data.error) as Error & { code?: string };
          thrown.code = data?.code;
          throw thrown;
        }
        if (!data?.data?.id) {
          throw new Error("Collection was not created. Please try again.");
        }
        collectionRow = data.data;
      }

      const newCollection = formatCollection(collectionRow);

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
        const extracted = await extractFunctionError(error, "Could not update collection. Please try again.");
        throw new Error(extracted.message);
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
      const extracted = await extractFunctionError(error, "Could not delete collection. Please try again.");
      throw new Error(extracted.message);
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

  // ── Collection ownership transfer ───────────────────────────────────────────
  transferStep: "idle" as "idle" | "requesting" | "otp-sent" | "verifying" | "link-sent" | "error",
  transferError: null as string | null,
  pendingTransferEmail: null as string | null,
  otpSentToEmail: null as string | null,
  transferStatus: null as { to_email: string; status: string; created_at: string } | null,
  transferStatusLoading: false,

  fetchCollectionTransferStatus: async (collectionId: string) => {
    set({ transferStatusLoading: true });
    try {
      const { data } = await axiosInstance.get(`/collections/${collectionId}/transfer/status`);
      set({ transferStatus: data?.pending || null, transferStatusLoading: false });
      return data?.pending || null;
    } catch (err) {
      set({ transferStatusLoading: false });
      return null;
    }
  },

  requestCollectionTransfer: async (collectionId: string, recipientEmail: string) => {
    set({ transferStep: "requesting", transferError: null });
    try {
      const { data } = await axiosInstance.post(`/collections/${collectionId}/transfer/request`, {
        recipientEmail,
      });
      set({
        transferStep: "otp-sent",
        pendingTransferEmail: recipientEmail,
        otpSentToEmail: data?.email || null,
        transferError: null,
      });
      return true;
    } catch (err: any) {
      const msg = toFriendlyErrorMessage(err, "Could not start transfer. Please try again.");
      set({ transferStep: "error", transferError: msg });
      return false;
    }
  },

  verifyCollectionTransferOTP: async (collectionId: string, otp: string) => {
    set({ transferStep: "verifying", transferError: null });
    try {
      await axiosInstance.post(`/collections/${collectionId}/transfer/verify`, { otp });
      set({ transferStep: "link-sent", transferError: null });
      return true;
    } catch (err: any) {
      const msg = toFriendlyErrorMessage(err, "Could not verify OTP. Please try again.");
      set({ transferStep: "error", transferError: msg });
      return false;
    }
  },

  cancelCollectionTransfer: async (collectionId: string) => {
    try {
      await axiosInstance.post(`/collections/${collectionId}/transfer/cancel`);
      set({ transferStatus: null });
      return true;
    } catch (err: any) {
      return false;
    }
  },

  resetTransferState: () => {
    set({
      transferStep: "idle",
      transferError: null,
      pendingTransferEmail: null,
      otpSentToEmail: null,
    });
  },

  // Standalone — used by the recipient's accept/decline page, independent of
  // the request/verify state above.
  respondToCollectionTransfer: async (token: string, action: "accept" | "decline") => {
    try {
      const { data } = await axiosInstance.post(`/collection-transfer/respond`, { token, action });
      return { success: true, status: data?.status };
    } catch (err: any) {
      return { success: false, error: toFriendlyErrorMessage(err, "Could not respond to this transfer.") };
    }
  },
}));
