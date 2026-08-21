// workspaceCapabilities.ts — Workspace Wave 6.3 / 6.6.
//
// Thin helpers over the `capabilities` array the SERVER returns on each
// workspace (GET /workspaces). Deliberately dependency-free at runtime (it
// imports only a TYPE from the store) so it can be unit-tested without
// dragging in axios and the Supabase client.
//
// ⚠️ NOT A SECURITY BOUNDARY. Everything here answers "what should the UI
// draw?", never "is this allowed?". The backend re-derives capabilities from
// the caller's membership row on every request and rejects what they are not
// entitled to, regardless of what the client believes.
import type { Workspace } from "@/store/useWorkspaceStore";

export const CAPABILITY = {
  WORKSPACE_READ: "workspace:read",
  WORKSPACE_UPDATE: "workspace:update",
  WORKSPACE_MEMBERS_MANAGE: "workspace:members.manage",
  COLLECTION_CREATE: "collection:create",
  COLLECTION_READ: "collection:read",
  COLLECTION_UPDATE: "collection:update",
  COLLECTION_DELETE: "collection:delete",
  TRANSACTION_READ: "transaction:read",
  WITHDRAWAL_CREATE: "withdrawal:create",
  WITHDRAWAL_APPROVE: "withdrawal:approve",
  REPORTS_READ: "reports:read",
} as const;

export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];

/**
 * COMPATIBILITY SHIM ONLY — consulted when the server did not send a
 * `capabilities` array for a workspace.
 *
 * This mirrors services/workspaceAuthorizationService.js's ROLE_CAPABILITIES.
 * Duplicating it is a cost, taken deliberately and narrowly: the alternatives
 * were both worse. Defaulting to PERMIT would show a MEMBER the manage/invite
 * controls Wave 5 was built to hide from them whenever a response lagged;
 * defaulting to DENY would blank a legitimate owner's dashboard for the same
 * reason. Falling back to the role reproduces exactly the behaviour the app
 * had before capabilities were sent, which is the only answer that is never
 * a regression.
 *
 * The live path does NOT use this: when the server sends capabilities (it
 * always does as of Wave 6.3) that array wins outright. If you change the
 * backend's role map, this only needs updating to keep the skew window
 * accurate — the authoritative decision is still made server-side.
 */
const ROLE_CAPABILITIES_FALLBACK: Record<string, Capability[]> = {
  OWNER: [
    CAPABILITY.WORKSPACE_READ,
    CAPABILITY.WORKSPACE_UPDATE,
    CAPABILITY.WORKSPACE_MEMBERS_MANAGE,
    CAPABILITY.COLLECTION_CREATE,
    CAPABILITY.COLLECTION_READ,
    CAPABILITY.COLLECTION_UPDATE,
    CAPABILITY.COLLECTION_DELETE,
    CAPABILITY.TRANSACTION_READ,
    CAPABILITY.WITHDRAWAL_CREATE,
    // Wave 6.7F.3 — OWNER-only: approving an ADMIN's pending_owner_approval
    // withdrawal in this workspace. See CAPABILITIES.WITHDRAWAL_APPROVE's
    // own doc in the backend's workspaceAuthorizationService.js.
    CAPABILITY.WITHDRAWAL_APPROVE,
    CAPABILITY.REPORTS_READ,
  ],
  ADMIN: [
    CAPABILITY.WORKSPACE_READ,
    CAPABILITY.WORKSPACE_UPDATE,
    CAPABILITY.WORKSPACE_MEMBERS_MANAGE,
    CAPABILITY.COLLECTION_CREATE,
    CAPABILITY.COLLECTION_READ,
    CAPABILITY.COLLECTION_UPDATE,
    CAPABILITY.TRANSACTION_READ,
    // Wave 6.7F.4 (backend services/workspaceAuthorizationService.js
    // ROLE_CAPABILITIES) grants ADMIN withdrawal:create — an ADMIN-initiated
    // withdrawal lands at 'pending_owner_approval' rather than skipping
    // approval, so this is safe to mirror here. WITHDRAWAL_APPROVE stays
    // OWNER-only below; ADMIN never holds it.
    CAPABILITY.WITHDRAWAL_CREATE,
    CAPABILITY.REPORTS_READ,
  ],
  MEMBER: [CAPABILITY.WORKSPACE_READ, CAPABILITY.COLLECTION_READ],
};

/**
 * Does the caller hold `capability` in this workspace?
 *
 * Server-sent capabilities win. When absent, falls back to the role (see
 * ROLE_CAPABILITIES_FALLBACK). An unknown role grants nothing — fail closed.
 */
export function hasCapability(
  workspace: Pick<Workspace, "capabilities" | "role"> | null | undefined,
  capability: Capability
): boolean {
  if (!workspace) return false;
  if (Array.isArray(workspace.capabilities)) {
    return workspace.capabilities.includes(capability);
  }
  const fallback = workspace.role ? ROLE_CAPABILITIES_FALLBACK[workspace.role] : undefined;
  return Array.isArray(fallback) ? fallback.includes(capability) : false;
}

/** Workspaces in which the caller may create a collection (Wave 6.3 picker). */
export function workspacesWithCapability(
  workspaces: Workspace[],
  capability: Capability
): Workspace[] {
  return (workspaces || []).filter((w) => hasCapability(w, capability));
}

/** What the UI is allowed to render for the active workspace (Wave 6.6). */
export interface WorkspaceCapabilities {
  /** Show balances, wallet figures, transaction amounts. */
  canSeeMoney: boolean;
  /** Show the wallet/transactions navigation and page. */
  canViewWallet: boolean;
  /** Show "Create collection" entry points. */
  canCreateCollection: boolean;
  /** Show withdrawal request UI. Granted to OWNER and ADMIN (Wave 6.7F.4). */
  canRequestWithdrawal: boolean;
  /**
   * Show the workspace OWNER-approval queue (Wave 6.7F.5) — withdrawals an
   * ADMIN initiated that are sitting at 'pending_owner_approval'. OWNER-only
   * by the backend's role map; ADMIN never holds this, including for their
   * own withdrawal.
   */
  canApproveWithdrawals: boolean;
  /** Show member-management UI (invite, roles, suspend, remove). */
  canManageMembers: boolean;
  /** Show workspace settings editing. */
  canUpdateWorkspace: boolean;
  /** The active workspace's role, for DISPLAY only — never for gating. */
  role: string | null;
}

/**
 * The pure computation behind useWorkspaceCapabilities, exported so it can be
 * unit-tested without rendering.
 */
export function computeWorkspaceCapabilities(
  workspaces: Workspace[],
  activeWorkspaceId: string | null
): WorkspaceCapabilities {
  const active = (workspaces || []).find((w) => w.id === activeWorkspaceId) ?? null;

  // No active workspace resolved YET — bootstrap still in flight, or the list
  // failed to load. Permissive on purpose: the backend is the real gate, and
  // blanking the whole dashboard during a transient load would be a worse bug
  // than briefly showing a control that would return 403 if used. Note this
  // is the "we know nothing at all" case; a workspace that merely omits
  // `capabilities` falls back to its ROLE instead (see hasCapability).
  if (!active) {
    return {
      canSeeMoney: true,
      canViewWallet: true,
      canCreateCollection: true,
      canRequestWithdrawal: true,
      canApproveWithdrawals: true,
      canManageMembers: true,
      canUpdateWorkspace: true,
      role: null,
    };
  }

  const canSeeMoney = hasCapability(active, CAPABILITY.TRANSACTION_READ);
  return {
    canSeeMoney,
    // The wallet page is entirely financial, so it follows the same
    // capability rather than having one of its own.
    canViewWallet: canSeeMoney,
    canCreateCollection: hasCapability(active, CAPABILITY.COLLECTION_CREATE),
    canRequestWithdrawal: hasCapability(active, CAPABILITY.WITHDRAWAL_CREATE),
    canApproveWithdrawals: hasCapability(active, CAPABILITY.WITHDRAWAL_APPROVE),
    canManageMembers: hasCapability(active, CAPABILITY.WORKSPACE_MEMBERS_MANAGE),
    canUpdateWorkspace: hasCapability(active, CAPABILITY.WORKSPACE_UPDATE),
    role: active.role ?? null,
  };
}
