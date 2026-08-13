// workspaceSwitcherState.test.ts
//
// Regression guard for the defect the user actually reported: "I am still not
// seeing anything in the frontend relating to workspace."
//
// ROOT CAUSE of that report: the original WorkspaceSwitcher
//   1. returned `null` whenever no ACTIVE workspace had resolved (which happens
//      whenever /api/workspaces is unreachable — e.g. a backend without the
//      route deployed), and
//   2. rendered inert grey text, not a control, whenever the user had fewer
//      than two workspaces — which is EVERY user, since everyone starts with
//      exactly one personal workspace.
//
// So in the single most common configuration, the feature was invisible. These
// tests pin the rule that fixes it: for a SIGNED-IN user the switcher is never
// hidden, regardless of how many workspaces loaded or whether the fetch failed.
import { describe, it, expect } from "vitest";
import { resolveSwitcherState } from "./switcherState";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("workspace switcher visibility", () => {
  it("THE REGRESSION: a signed-in user with ONE workspace still gets a control", () => {
    // Previously this path rendered inert grey text and read as a breadcrumb.
    expect(resolveSwitcherState({ userId: USER, workspaceCount: 1 })).toBe("ready");
  });

  it("THE REGRESSION: a signed-in user with ZERO workspaces still gets a control", () => {
    // Previously `null`. This is the /api/workspaces-unreachable case, where the
    // user most needs an entry point — not an empty header.
    expect(resolveSwitcherState({ userId: USER, workspaceCount: 0 })).toBe("ready");
  });

  it("is never hidden for a signed-in user at any workspace count", () => {
    for (const count of [0, 1, 2, 5, 50]) {
      expect(
        resolveSwitcherState({ userId: USER, workspaceCount: count })
      ).not.toBe("hidden");
    }
  });

  it("shows a loading placeholder only while fetching with nothing yet loaded", () => {
    expect(
      resolveSwitcherState({ userId: USER, isLoading: true, workspaceCount: 0 })
    ).toBe("loading");
  });

  it("keeps showing the control while refetching if workspaces are already known", () => {
    // A background refresh must not blank out the header.
    expect(
      resolveSwitcherState({ userId: USER, isLoading: true, workspaceCount: 2 })
    ).toBe("ready");
  });

  it("is hidden only when signed out", () => {
    expect(resolveSwitcherState({ userId: null, workspaceCount: 0 })).toBe("hidden");
    expect(resolveSwitcherState({ userId: undefined, workspaceCount: 3 })).toBe("hidden");
    // Even mid-load, a signed-out user gets nothing.
    expect(
      resolveSwitcherState({ userId: null, isLoading: true, workspaceCount: 0 })
    ).toBe("hidden");
  });
});
