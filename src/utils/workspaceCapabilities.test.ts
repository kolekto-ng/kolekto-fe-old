// workspaceCapabilities.test.ts — Workspace Wave 6.6.
//
// The UI must gate on the capability list the SERVER attached to the active
// workspace, never on a client-side reading of `role`. These pin the three
// role profiles the product spec describes, plus the edge cases that decide
// whether a transient load or a deploy skew breaks the app.
//
// Tests target the pure module rather than the hook: this project has no
// @testing-library/react, and adding a dependency to exercise a `useMemo`
// would be the wrong trade. The hook is a one-line wrapper over this.
import { describe, it, expect } from "vitest";

import {
  computeWorkspaceCapabilities,
  hasCapability,
  CAPABILITY,
} from "./workspaceCapabilities";
import type { Workspace } from "@/store/useWorkspaceStore";

const WS = "ws-1";

/** Capability sets exactly as the backend's role map emits them. */
const OWNER_CAPS = [
  "workspace:read",
  "workspace:update",
  "workspace:members.manage",
  "collection:create",
  "collection:read",
  "collection:update",
  "collection:delete",
  "transaction:read",
  "withdrawal:create",
  "reports:read",
];
const ADMIN_CAPS = [
  "workspace:read",
  "workspace:update",
  "workspace:members.manage",
  "collection:create",
  "collection:read",
  "collection:update",
  "transaction:read",
  "reports:read",
];
const MEMBER_CAPS = ["workspace:read", "collection:read"];

function workspace(
  id: string,
  role: string,
  capabilities: string[] | undefined,
): Workspace {
  return {
    id,
    name: "Team",
    slug: "team",
    type: "organization",
    status: "active",
    owner_id: "u1",
    role,
    capabilities,
  } as Workspace;
}

describe("computeWorkspaceCapabilities (Wave 6.6)", () => {
  it("OWNER: everything, including withdrawal", () => {
    const caps = computeWorkspaceCapabilities([workspace(WS, "OWNER", OWNER_CAPS)], WS);

    expect(caps.canSeeMoney).toBe(true);
    expect(caps.canViewWallet).toBe(true);
    expect(caps.canCreateCollection).toBe(true);
    expect(caps.canRequestWithdrawal).toBe(true);
    expect(caps.canManageMembers).toBe(true);
  });

  it("ADMIN: money and collections, but NOT withdrawal", () => {
    const caps = computeWorkspaceCapabilities([workspace(WS, "ADMIN", ADMIN_CAPS)], WS);

    expect(caps.canSeeMoney).toBe(true);
    expect(caps.canViewWallet).toBe(true);
    expect(caps.canCreateCollection).toBe(true);
    expect(caps.canManageMembers).toBe(true);
    // The boundary Wave 6 exists to protect: seeing money is not moving it.
    expect(caps.canRequestWithdrawal).toBe(false);
  });

  it("MEMBER: no money, no wallet, no creating, no managing, no withdrawing", () => {
    const caps = computeWorkspaceCapabilities([workspace(WS, "MEMBER", MEMBER_CAPS)], WS);

    expect(caps.canSeeMoney).toBe(false);
    expect(caps.canViewWallet).toBe(false);
    expect(caps.canCreateCollection).toBe(false);
    expect(caps.canRequestWithdrawal).toBe(false);
    expect(caps.canManageMembers).toBe(false);
  });

  it("capabilities follow the ACTIVE workspace, so switching re-evaluates them", () => {
    const workspaces = [
      workspace("ws-owner", "OWNER", OWNER_CAPS),
      workspace("ws-member", "MEMBER", MEMBER_CAPS),
    ];

    const asOwner = computeWorkspaceCapabilities(workspaces, "ws-owner");
    const asMember = computeWorkspaceCapabilities(workspaces, "ws-member");

    // Same user, same workspace list — only the active id differs.
    expect(asOwner.canRequestWithdrawal).toBe(true);
    expect(asOwner.canSeeMoney).toBe(true);
    expect(asMember.canRequestWithdrawal).toBe(false);
    expect(asMember.canSeeMoney).toBe(false);
    expect(asMember.canCreateCollection).toBe(false);
  });

  it("no active workspace yet (bootstrap in flight) stays permissive, not blank", () => {
    // Denying during load would blank the dashboard on every refresh. The
    // backend is the real gate, so an optimistic default is the safer bug.
    const caps = computeWorkspaceCapabilities([], null);

    expect(caps.canSeeMoney).toBe(true);
    expect(caps.role).toBeNull();
  });

  it("a workspace with no capabilities field falls back to its ROLE, not to 'allow'", () => {
    // Deploy-skew case (old backend, new frontend). Falling back to the role
    // reproduces pre-Wave-6.3 behaviour exactly, which is the only answer
    // that is never a regression in either direction. Defaulting to PERMIT
    // here would show a MEMBER the manage/invite controls Wave 5 hides.
    const asOwner = computeWorkspaceCapabilities([workspace(WS, "OWNER", undefined)], WS);
    expect(asOwner.canCreateCollection).toBe(true);
    expect(asOwner.canSeeMoney).toBe(true);
    expect(asOwner.canRequestWithdrawal).toBe(true);

    const asMember = computeWorkspaceCapabilities([workspace(WS, "MEMBER", undefined)], WS);
    expect(asMember.canCreateCollection).toBe(false);
    expect(asMember.canSeeMoney).toBe(false);
    expect(asMember.canManageMembers).toBe(false);

    const asAdmin = computeWorkspaceCapabilities([workspace(WS, "ADMIN", undefined)], WS);
    expect(asAdmin.canSeeMoney).toBe(true);
    expect(asAdmin.canRequestWithdrawal).toBe(false);
  });

  it("an unknown role with no capabilities grants nothing (fails closed)", () => {
    const caps = computeWorkspaceCapabilities([workspace(WS, "SUPERUSER", undefined)], WS);

    expect(caps.canSeeMoney).toBe(false);
    expect(caps.canCreateCollection).toBe(false);
    expect(caps.canManageMembers).toBe(false);
  });

  it("hasCapability prefers the server array over the role fallback", () => {
    expect(
      hasCapability(
        { role: "OWNER", capabilities: ["collection:read"] },
        CAPABILITY.WITHDRAWAL_CREATE,
      ),
    ).toBe(false);
    expect(
      hasCapability(
        { role: "MEMBER", capabilities: ["withdrawal:create"] },
        CAPABILITY.WITHDRAWAL_CREATE,
      ),
    ).toBe(true);
  });

  it("an empty capabilities array denies — that is the server saying 'nothing'", () => {
    const caps = computeWorkspaceCapabilities([workspace(WS, "MEMBER", [])], WS);

    expect(caps.canSeeMoney).toBe(false);
    expect(caps.canCreateCollection).toBe(false);
    expect(caps.canRequestWithdrawal).toBe(false);
  });

  it("reports the role for display but never derives permissions from it", () => {
    // A role string that disagrees with the capability list must lose: the
    // capabilities are the server's decision, the role is just a label.
    const caps = computeWorkspaceCapabilities([workspace(WS, "OWNER", MEMBER_CAPS)], WS);

    expect(caps.role).toBe("OWNER");
    expect(caps.canRequestWithdrawal).toBe(false);
    expect(caps.canSeeMoney).toBe(false);
  });
});
