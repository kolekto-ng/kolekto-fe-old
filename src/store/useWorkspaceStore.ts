// useWorkspaceStore.ts — Workspace Phase 1 frontend context.
//
// Minimum viable workspace context (contract §8): hold the list of workspaces
// the user belongs to, remember which one is active, and expose a switch.
//
// ⚠️ THIS STORE IS NOT AN AUTHORIZATION MECHANISM. The active workspace id is a
// UI preference that gets sent as a REQUEST header; the backend independently
// re-verifies membership and capability on every use and rejects what the caller
// is not entitled to. Never gate anything security-relevant on this store —
// filtering in the client is presentation, not protection.
import { create } from "zustand";
import { axiosInstance } from "@/utils/axios";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";
import {
  getActiveWorkspaceId,
  getActiveWorkspaceIdForUser,
  setActiveWorkspaceId,
} from "@/utils/activeWorkspace";

export type WorkspaceType =
  | "personal"
  | "association"
  | "organization"
  | "community"
  | "event"
  | "group";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  status: "active" | "suspended" | "archived";
  owner_id: string;
  description?: string | null;
  created_at?: string;
  role?: "OWNER" | "ADMIN" | "MEMBER";
}

// Re-exported for convenience so callers have one obvious import site.
export { getActiveWorkspaceId };

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  /** @param userId the signed-in user; scopes the persisted selection to them. */
  fetchWorkspaces: (userId?: string | null) => Promise<Workspace[]>;
  switchWorkspace: (id: string, userId?: string | null) => void;
  activeWorkspace: () => Workspace | null;
  createWorkspace: (
    input: { name: string; type: WorkspaceType; description?: string },
    userId?: string | null
  ) => Promise<Workspace>;
  updateWorkspace: (
    id: string,
    patch: { name?: string; description?: string }
  ) => Promise<Workspace>;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: getActiveWorkspaceId(),
  isLoading: false,
  error: null,

  fetchWorkspaces: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get("/workspaces");
      const workspaces: Workspace[] = res?.data?.data ?? [];

      // Reconcile the persisted selection against what the server actually
      // returned. Two independent ways a stored id can be wrong:
      //   1. It belongs to a DIFFERENT user (shared browser) — rejected by
      //      scoping the read to userId.
      //   2. It belongs to this user but is no longer valid (workspace
      //      deleted/suspended, membership revoked) — rejected because the
      //      server did not return it.
      const persisted = getActiveWorkspaceIdForUser(userId);
      const stillValid = persisted && workspaces.some((w) => w.id === persisted);
      const fallback =
        workspaces.find((w) => w.type === "personal")?.id ?? workspaces[0]?.id ?? null;
      const nextActive = stillValid ? persisted : fallback;

      setActiveWorkspaceId(nextActive, userId);

      set({ workspaces, activeWorkspaceId: nextActive, isLoading: false });
      return workspaces;
    } catch (err: any) {
      set({ error: toFriendlyErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  switchWorkspace: (id: string, userId?: string | null) => {
    // Only allow switching to a workspace the server told us about. This is a
    // consistency guard, not a security one — the backend is the real check.
    if (!get().workspaces.some((w) => w.id === id)) return;
    setActiveWorkspaceId(id, userId);
    set({ activeWorkspaceId: id });
  },

  activeWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    if (!activeWorkspaceId) return null;
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  },

  createWorkspace: async (input, userId) => {
    set({ error: null });
    const res = await axiosInstance.post("/workspaces", input);
    const created: Workspace = res?.data?.data;
    if (!created?.id) throw new Error("Workspace was not created. Please try again.");

    // Add locally and make it active so the user lands inside what they just
    // made — the expected outcome of "Create workspace".
    set((state) => ({ workspaces: [...state.workspaces, created] }));
    setActiveWorkspaceId(created.id, userId);
    set({ activeWorkspaceId: created.id });
    return created;
  },

  updateWorkspace: async (id, patch) => {
    set({ error: null });
    const res = await axiosInstance.patch(`/workspaces/${id}`, patch);
    const updated: Workspace = res?.data?.data;
    if (!updated?.id) throw new Error("Workspace was not updated. Please try again.");

    set((state) => ({
      // Preserve the locally-known role: the PATCH response describes the
      // workspace, not the caller's membership.
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, ...updated, role: w.role } : w
      ),
    }));
    return updated;
  },

  reset: () => {
    setActiveWorkspaceId(null);
    set({ workspaces: [], activeWorkspaceId: null, error: null, isLoading: false });
  },
}));
