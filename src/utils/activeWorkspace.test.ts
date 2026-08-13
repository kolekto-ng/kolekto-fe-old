// activeWorkspace.test.ts — Phase 1.5 regression tests.
//
// Covers the cross-user isolation guarantee: a workspace selection persisted by
// one account must never be handed to another account on the same browser.
import { describe, it, expect, beforeEach } from "vitest";
import {
  ACTIVE_WORKSPACE_KEY,
  getActiveWorkspaceId,
  getActiveWorkspaceIdForUser,
  setActiveWorkspaceId,
  clearActiveWorkspace,
} from "./activeWorkspace";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const WS_A = "11111111-1111-1111-1111-111111111111";

describe("activeWorkspace persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a selection for its owner", () => {
    setActiveWorkspaceId(WS_A, USER_A);
    expect(getActiveWorkspaceIdForUser(USER_A)).toBe(WS_A);
    expect(getActiveWorkspaceId()).toBe(WS_A);
  });

  it("ISOLATION: does not return user A's selection to user B", () => {
    // The core Phase 1.5 fix. On a shared browser, B must not inherit A's
    // workspace — it would be sent as a header the backend rejects.
    setActiveWorkspaceId(WS_A, USER_A);
    expect(getActiveWorkspaceIdForUser(USER_B)).toBeNull();
  });

  it("returns null for an unknown/absent user id", () => {
    setActiveWorkspaceId(WS_A, USER_A);
    expect(getActiveWorkspaceIdForUser(undefined)).toBeNull();
    expect(getActiveWorkspaceIdForUser(null)).toBeNull();
  });

  it("clearing removes the stored value entirely", () => {
    setActiveWorkspaceId(WS_A, USER_A);
    clearActiveWorkspace();
    expect(getActiveWorkspaceId()).toBeNull();
    expect(localStorage.getItem(ACTIVE_WORKSPACE_KEY)).toBeNull();
  });

  it("ignores a legacy plain-string value from an older build", () => {
    // Pre-scoping builds stored a bare id. It carries no owner, so it must be
    // treated as absent rather than attributed to whoever is signed in now.
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, WS_A);
    expect(getActiveWorkspaceId()).toBeNull();
    expect(getActiveWorkspaceIdForUser(USER_A)).toBeNull();
  });

  it("ignores corrupted JSON without throwing", () => {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, "{not json");
    expect(() => getActiveWorkspaceId()).not.toThrow();
    expect(getActiveWorkspaceId()).toBeNull();
  });

  it("writing without a user id clears rather than storing an unowned value", () => {
    setActiveWorkspaceId(WS_A, USER_A);
    setActiveWorkspaceId(WS_A, null);
    expect(getActiveWorkspaceId()).toBeNull();
  });
});
