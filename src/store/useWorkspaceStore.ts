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

/** An ADMIN/MEMBER-granting invitation (Workspace Wave 4). Never carries a token. */
export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
  invited_by: string;
  expires_at: string;
  created_at: string;
}

/** The pre-auth preview shape from GET /invites/:token/preview. Deliberately
 * has no `email` field — the backend never reveals the targeted address
 * before the visitor has authenticated and proven control of it. */
export interface InvitePreview {
  valid: boolean;
  workspaceName?: string;
  workspaceType?: WorkspaceType;
  role?: "ADMIN" | "MEMBER";
  expiresAt?: string;
}

// Re-exported for convenience so callers have one obvious import site.
export { getActiveWorkspaceId };

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  pendingInvites: WorkspaceInvite[];
  invitesLoading: boolean;
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
  // ── Invitations (Wave 4) ──────────────────────────────────────────────
  fetchPendingInvites: (workspaceId: string) => Promise<WorkspaceInvite[]>;
  createInvite: (
    workspaceId: string,
    input: { email: string; role: "ADMIN" | "MEMBER" }
  ) => Promise<WorkspaceInvite>;
  revokeInvite: (workspaceId: string, inviteId: string) => Promise<void>;
  /**
   * Accept an invitation by token AND make the resulting workspace active —
   * in that specific order. Lives in the store (not the accept page's own
   * component logic) so the ordering itself — accept, THEN fetchWorkspaces,
   * THEN switchWorkspace — is a single, unit-testable unit rather than
   * something a page component could get wrong or reorder. See
   * switchWorkspace's own comment: it silently no-ops on a workspace id the
   * server hasn't returned yet, which is exactly what calling it before
   * fetchWorkspaces resolves would do.
   */
  acceptInviteAndActivate: (
    token: string,
    userId?: string | null
  ) => Promise<{ workspace_id: string }>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: getActiveWorkspaceId(),
  isLoading: false,
  error: null,
  pendingInvites: [],
  invitesLoading: false,

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
    set({ workspaces: [], activeWorkspaceId: null, error: null, isLoading: false, pendingInvites: [] });
  },

  // ── Invitations (Wave 4) ─────────────────────────────────────────────────
  // Backend authorization (workspace:members.manage) remains authoritative —
  // this store's `role` field is presentation only, same disclaimer as the
  // rest of this file.

  fetchPendingInvites: async (workspaceId: string) => {
    set({ invitesLoading: true });
    try {
      const res = await axiosInstance.get(`/workspaces/${workspaceId}/invites`);
      const invites: WorkspaceInvite[] = res?.data?.data ?? [];
      set({ pendingInvites: invites, invitesLoading: false });
      return invites;
    } catch (err) {
      set({ invitesLoading: false });
      throw err;
    }
  },

  createInvite: async (workspaceId: string, input: { email: string; role: "ADMIN" | "MEMBER" }) => {
    const res = await axiosInstance.post(`/workspaces/${workspaceId}/invites`, input);
    const invite: WorkspaceInvite = res?.data?.data;
    if (!invite?.id) throw new Error("Invitation was not created. Please try again.");
    set((state) => ({
      // A reissue (same email) replaces the prior PENDING row in the list
      // rather than duplicating it — mirrors the backend's revoke-and-replace
      // behavior for the same (workspace, email) pair.
      pendingInvites: [invite, ...state.pendingInvites.filter((i) => i.email !== invite.email)],
    }));
    return invite;
  },

  revokeInvite: async (workspaceId: string, inviteId: string) => {
    await axiosInstance.delete(`/workspaces/${workspaceId}/invites/${inviteId}`);
    set((state) => ({
      pendingInvites: state.pendingInvites.filter((i) => i.id !== inviteId),
    }));
  },

  acceptInviteAndActivate: async (token: string, userId?: string | null) => {
    const member = await acceptInviteByToken(token);
    // MUST resolve before switchWorkspace — see the interface comment above
    // and switchWorkspace's own "only switch to a workspace the server
    // actually returned" guard.
    await get().fetchWorkspaces(userId);
    get().switchWorkspace(member.workspace_id, userId);
    return member;
  },
}));

// ── Public, token-scoped invitation actions (Wave 4) ────────────────────────
// Deliberately standalone functions, not store state: the accept page
// (/invite/:token) is reachable pre-authentication, before any workspace
// context exists, so these have no dependency on the store's auth-gated
// state. They still use axiosInstance for consistency with the rest of the
// app's API-client conventions. acceptInviteAndActivate above (a store
// action) is the one that also needs get()/set(), which is why it lives on
// the store while these three do not.

export async function previewInviteByToken(token: string): Promise<InvitePreview> {
  const res = await axiosInstance.get(`/invites/${token}/preview`);
  return res?.data?.data ?? { valid: false };
}

export async function acceptInviteByToken(token: string): Promise<{ workspace_id: string }> {
  const res = await axiosInstance.post(`/invites/${token}/accept`);
  return res?.data?.data;
}

export async function declineInviteByToken(token: string): Promise<void> {
  await axiosInstance.post(`/invites/${token}/decline`);
}
