// WorkspacePage component tests — Workspace Wave 5 member management.
//
// These close the gap the Wave 5 pre-commit audit found: the existing Wave 5
// frontend tests were STORE-level only, so nothing exercised how WorkspacePage
// actually renders for a given role. That blind spot let a real defect ship to
// review — a plain MEMBER could never reach "Leave workspace", because the page
// fetched the manager-only roster for everyone and rendered the leave action
// inside the (empty, 403'd) roster list.
//
// Rendering uses react-dom/client + act directly rather than adding
// @testing-library/react: vitest + jsdom are already configured, React 18 is
// already a dependency, and no new testing dependency is introduced.
//
// Only the HTTP boundary (@/utils/axios) and auth/toast are mocked — the REAL
// useWorkspaceStore is used, so these tests cover the genuine page↔store
// integration, not a re-implementation of it.
//
// ⚠️ These assert PRESENTATION, never security. The backend independently
// enforces workspace:members.manage, OWNER protection, and the self-action
// rules; a hidden button is a UX affordance, not an authorization boundary.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

// Tells React this is an act()-aware environment; without it React logs
// "current testing environment is not configured to support act(...)" and
// does not flush effects deterministically.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { setSession: vi.fn(), signOut: vi.fn() }, from: vi.fn(), functions: { invoke: vi.fn() } },
}));

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/utils/axios", () => ({
  axiosInstance: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock },
}));

const { authUserId } = vi.hoisted(() => ({ authUserId: { current: "u-self" } }));
vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: () => ({ user: { id: authUserId.current } }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import WorkspacePage from "./WorkspacePage";
import { useWorkspaceStore as useWorkspaceStoreUntyped } from "@/store/useWorkspaceStore";

const useWorkspaceStore = useWorkspaceStoreUntyped as any;

// Radix primitives used on this page expect these; jsdom lacks them.
beforeEach(() => {
  (globalThis as any).ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (!(Element.prototype as any).hasPointerCapture) {
    (Element.prototype as any).hasPointerCapture = () => false;
    (Element.prototype as any).setPointerCapture = () => {};
    (Element.prototype as any).releasePointerCapture = () => {};
  }
  (Element.prototype as any).scrollIntoView ||= () => {};
});

const ORG_WS = {
  id: "ws-1",
  name: "Acme Org",
  slug: "acme-org",
  type: "organization",
  status: "active",
  owner_id: "u-owner",
  created_at: "2026-01-01T00:00:00Z",
};

const ROSTER = [
  {
    id: "m-owner", workspace_id: "ws-1", user_id: "u-owner", role: "OWNER", status: "active",
    joined_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z",
    full_name: "Olive Owner", email: "owner@example.com",
  },
  {
    id: "m-admin", workspace_id: "ws-1", user_id: "u-self", role: "ADMIN", status: "active",
    joined_at: "2026-01-02T00:00:00Z", created_at: "2026-01-02T00:00:00Z",
    full_name: "Adam Admin", email: "admin@example.com",
  },
  {
    id: "m-member", workspace_id: "ws-1", user_id: "u-member", role: "MEMBER", status: "active",
    joined_at: "2026-01-03T00:00:00Z", created_at: "2026-01-03T00:00:00Z",
    full_name: "Mary Member", email: "member@example.com",
  },
];

let container: HTMLDivElement;
let root: Root;

async function renderPage() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<WorkspacePage />);
  });
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

/** Page + any Radix portal content (dialogs render outside `container`). */
const visibleText = () => document.body.textContent ?? "";

function findButton(label: string | RegExp): HTMLButtonElement | undefined {
  const match = (t: string) => (typeof label === "string" ? t.trim() === label : label.test(t));
  return Array.from(document.body.querySelectorAll("button")).find((b) =>
    match(b.textContent ?? "")
  ) as HTMLButtonElement | undefined;
}

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** Seeds the store as if GET /workspaces already returned this workspace. */
function seedStore(role: "OWNER" | "ADMIN" | "MEMBER", overrides: Record<string, unknown> = {}) {
  useWorkspaceStore.setState({
    workspaces: [{ ...ORG_WS, role, membership_id: `m-${role.toLowerCase()}`, ...overrides }],
    activeWorkspaceId: "ws-1",
    isLoading: false,
    error: null,
    pendingInvites: [],
    invitesLoading: false,
    members: [],
    membersLoading: false,
    membersError: null,
  });
}

describe("WorkspacePage — MEMBER", () => {
  beforeEach(() => {
    authUserId.current = "u-self";
    getMock.mockResolvedValue({ data: { data: [] } });
  });

  it("does NOT request the manager-only roster", async () => {
    seedStore("MEMBER", { membership_id: "m-self" });
    await renderPage();

    const rosterCalls = getMock.mock.calls.filter(([url]: [string]) =>
      String(url).endsWith("/members")
    );
    expect(rosterCalls).toHaveLength(0);
  });

  it("shows no members.manage permission error just for opening the workspace", async () => {
    seedStore("MEMBER", { membership_id: "m-self" });
    await renderPage();

    expect(visibleText()).not.toMatch(/do not have permission/i);
    expect(visibleText()).not.toMatch(/Try again/i);
  });

  it("shows a Leave workspace action", async () => {
    seedStore("MEMBER", { membership_id: "m-self" });
    await renderPage();

    expect(findButton("Leave workspace")).toBeTruthy();
    expect(visibleText()).toMatch(/Your membership/i);
  });

  it("does NOT show management actions for anyone", async () => {
    seedStore("MEMBER", { membership_id: "m-self" });
    await renderPage();

    expect(findButton(/Promote to ADMIN/)).toBeUndefined();
    expect(findButton(/Change to MEMBER/)).toBeUndefined();
    expect(findButton("Suspend")).toBeUndefined();
    expect(findButton("Reactivate")).toBeUndefined();
    expect(visibleText()).not.toMatch(/Send invitation/i);
  });

  it("leaving opens a confirmation dialog and calls DELETE with the caller's own membership_id", async () => {
    seedStore("MEMBER", { membership_id: "m-self" });
    deleteMock.mockResolvedValue({ data: { data: { id: "m-self" } } });
    await renderPage();

    await click(findButton("Leave workspace")!);

    // Confirmation is required before anything is sent.
    expect(visibleText()).toMatch(/Leave workspace\?/i);
    expect(deleteMock).not.toHaveBeenCalled();

    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Leave workspace" && b.closest("[role='alertdialog']")
    );
    await click(confirm!);

    expect(deleteMock).toHaveBeenCalledWith("/workspaces/ws-1/members/m-self");
  });

  it("an OWNER of a personal workspace is never offered Leave", async () => {
    seedStore("OWNER", { type: "personal", membership_id: "m-personal" });
    await renderPage();
    expect(findButton("Leave workspace")).toBeUndefined();
  });
});

describe("WorkspacePage — ADMIN", () => {
  beforeEach(() => {
    authUserId.current = "u-self";
  });

  it("fetches the roster and renders management actions", async () => {
    seedStore("ADMIN", { membership_id: "m-admin" });
    getMock.mockResolvedValue({ data: { data: ROSTER } });
    await renderPage();
    await act(async () => {
      useWorkspaceStore.setState({ members: ROSTER, membersLoading: false });
    });

    expect(getMock.mock.calls.some(([u]: [string]) => u === "/workspaces/ws-1/members")).toBe(true);
    expect(visibleText()).toMatch(/Mary Member/);
    expect(findButton(/Promote to ADMIN/)).toBeTruthy();
    expect(findButton("Suspend")).toBeTruthy();
  });

  it("offers Leave on their own row but no self-role-change or self-suspend", async () => {
    seedStore("ADMIN", { membership_id: "m-admin" });
    getMock.mockResolvedValue({ data: { data: ROSTER } });
    await renderPage();
    await act(async () => {
      useWorkspaceStore.setState({ members: ROSTER, membersLoading: false });
    });

    expect(findButton("Leave workspace")).toBeTruthy();

    // The admin's own row (u-self) must expose no role/status controls. Only
    // Mary (MEMBER) may be promoted — Adam must not be demotable by himself.
    const promoteButtons = Array.from(document.body.querySelectorAll("button")).filter((b) =>
      /Promote to ADMIN|Change to MEMBER/.test(b.textContent ?? "")
    );
    for (const btn of promoteButtons) {
      expect(btn.closest("li")?.textContent).not.toMatch(/Adam Admin/);
    }
  });
});

describe("WorkspacePage — OWNER", () => {
  beforeEach(() => {
    authUserId.current = "u-owner";
  });

  it("fetches the roster and shows the OWNER row as Protected with no mutation controls", async () => {
    seedStore("OWNER", { membership_id: "m-owner" });
    getMock.mockResolvedValue({ data: { data: ROSTER } });
    await renderPage();
    await act(async () => {
      useWorkspaceStore.setState({ members: ROSTER, membersLoading: false });
    });

    expect(getMock.mock.calls.some(([u]: [string]) => u === "/workspaces/ws-1/members")).toBe(true);
    expect(visibleText()).toMatch(/Protected/);

    const ownerRow = Array.from(document.body.querySelectorAll("li")).find((li) =>
      li.textContent?.includes("Olive Owner")
    );
    expect(ownerRow).toBeTruthy();
    // No control of any kind on the OWNER row.
    expect(ownerRow!.querySelectorAll("button")).toHaveLength(0);
  });

  it("never offers the OWNER a Leave action", async () => {
    seedStore("OWNER", { membership_id: "m-owner" });
    getMock.mockResolvedValue({ data: { data: ROSTER } });
    await renderPage();
    await act(async () => {
      useWorkspaceStore.setState({ members: ROSTER, membersLoading: false });
    });

    expect(findButton("Leave workspace")).toBeUndefined();
  });
});

describe("WorkspacePage — roster states (managers)", () => {
  beforeEach(() => {
    authUserId.current = "u-owner";
    getMock.mockResolvedValue({ data: { data: [] } });
  });

  it("renders the loading state while the roster is in flight", async () => {
    seedStore("OWNER", { membership_id: "m-owner" });
    await renderPage();
    await act(async () => {
      useWorkspaceStore.setState({ membersLoading: true });
    });

    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders the error state with a retry for managers", async () => {
    seedStore("OWNER", { membership_id: "m-owner" });
    await renderPage();
    await act(async () => {
      useWorkspaceStore.setState({ membersError: "You do not have permission", membersLoading: false });
    });

    expect(visibleText()).toMatch(/You do not have permission/);
    expect(findButton("Try again")).toBeTruthy();
  });

  it("renders the empty state when the roster comes back empty", async () => {
    seedStore("OWNER", { membership_id: "m-owner" });
    await renderPage();
    await act(async () => {
      useWorkspaceStore.setState({ members: [], membersLoading: false, membersError: null });
    });

    expect(visibleText()).toMatch(/No members yet/i);
  });
});
