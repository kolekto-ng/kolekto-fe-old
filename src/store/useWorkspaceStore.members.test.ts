import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mocking convention as useWorkspaceStore.invitations.test.ts: stub the
// two heavy dependencies (supabase client + axios) so this file only
// exercises useWorkspaceStore's own member-management logic.
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

import { useWorkspaceStore as useWorkspaceStoreUntyped } from "./useWorkspaceStore";

const useWorkspaceStore = useWorkspaceStoreUntyped as any;

const OWNER_ROW = {
  id: "m-owner",
  workspace_id: "ws-1",
  user_id: "u-owner",
  role: "OWNER",
  status: "active",
  joined_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  full_name: "Owner One",
  email: "owner@example.com",
};
const MEMBER_ROW = {
  id: "m-member",
  workspace_id: "ws-1",
  user_id: "u-member",
  role: "MEMBER",
  status: "active",
  joined_at: "2026-01-02T00:00:00Z",
  created_at: "2026-01-02T00:00:00Z",
  full_name: "Member Two",
  email: "member@example.com",
};

describe("useWorkspaceStore — member management (Wave 5)", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [],
      activeWorkspaceId: null,
      members: [],
      membersLoading: false,
      membersError: null,
      error: null,
    });
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    localStorage.clear();
  });

  describe("fetchMembers", () => {
    it("populates members from the workspace-scoped endpoint", async () => {
      getMock.mockResolvedValue({ data: { data: [OWNER_ROW, MEMBER_ROW] } });

      const result = await useWorkspaceStore.getState().fetchMembers("ws-1");

      expect(getMock).toHaveBeenCalledWith("/workspaces/ws-1/members");
      expect(result).toHaveLength(2);
      expect(useWorkspaceStore.getState().members).toHaveLength(2);
      expect(useWorkspaceStore.getState().membersLoading).toBe(false);
      expect(useWorkspaceStore.getState().membersError).toBeNull();
    });

    it("exposes the flat full_name/email the backend actually returns", async () => {
      getMock.mockResolvedValue({ data: { data: [MEMBER_ROW] } });
      const [member] = await useWorkspaceStore.getState().fetchMembers("ws-1");
      expect(member.full_name).toBe("Member Two");
      expect(member.email).toBe("member@example.com");
    });

    it("yields an empty list when the workspace has no members", async () => {
      getMock.mockResolvedValue({ data: { data: [] } });
      const result = await useWorkspaceStore.getState().fetchMembers("ws-1");
      expect(result).toEqual([]);
      expect(useWorkspaceStore.getState().members).toEqual([]);
    });

    it("records membersError and clears loading when the request fails, and rethrows", async () => {
      getMock.mockRejectedValue(new Error("network down"));

      await expect(useWorkspaceStore.getState().fetchMembers("ws-1")).rejects.toThrow("network down");

      expect(useWorkspaceStore.getState().membersLoading).toBe(false);
      expect(useWorkspaceStore.getState().membersError).toBeTruthy();
    });

    it("clears a previous error on a successful refetch", async () => {
      useWorkspaceStore.setState({ membersError: "stale failure" });
      getMock.mockResolvedValue({ data: { data: [OWNER_ROW] } });

      await useWorkspaceStore.getState().fetchMembers("ws-1");

      expect(useWorkspaceStore.getState().membersError).toBeNull();
    });
  });

  describe("changeMemberRole", () => {
    it("PATCHes the role endpoint and updates that member in place", async () => {
      useWorkspaceStore.setState({ members: [OWNER_ROW, MEMBER_ROW] });
      patchMock.mockResolvedValue({ data: { data: { ...MEMBER_ROW, role: "ADMIN" } } });

      const updated = await useWorkspaceStore
        .getState()
        .changeMemberRole("ws-1", "m-member", "ADMIN");

      expect(patchMock).toHaveBeenCalledWith("/workspaces/ws-1/members/m-member/role", {
        role: "ADMIN",
      });
      expect(updated.role).toBe("ADMIN");
      const state = useWorkspaceStore.getState().members;
      expect(state.find((m: any) => m.id === "m-member").role).toBe("ADMIN");
      expect(state.find((m: any) => m.id === "m-owner").role).toBe("OWNER");
      expect(state).toHaveLength(2);
    });

    it("throws and leaves local state untouched when the server rejects", async () => {
      useWorkspaceStore.setState({ members: [OWNER_ROW, MEMBER_ROW] });
      patchMock.mockRejectedValue(new Error("Request failed with status code 409"));

      await expect(
        useWorkspaceStore.getState().changeMemberRole("ws-1", "m-owner", "MEMBER")
      ).rejects.toThrow();

      expect(
        useWorkspaceStore.getState().members.find((m: any) => m.id === "m-owner").role
      ).toBe("OWNER");
    });
  });

  describe("suspendMember / reactivateMember", () => {
    it("suspendMember PATCHes status=suspended and updates local state", async () => {
      useWorkspaceStore.setState({ members: [MEMBER_ROW] });
      patchMock.mockResolvedValue({ data: { data: { ...MEMBER_ROW, status: "suspended" } } });

      await useWorkspaceStore.getState().suspendMember("ws-1", "m-member");

      expect(patchMock).toHaveBeenCalledWith("/workspaces/ws-1/members/m-member/status", {
        status: "suspended",
      });
      expect(
        useWorkspaceStore.getState().members.find((m: any) => m.id === "m-member").status
      ).toBe("suspended");
    });

    it("reactivateMember PATCHes status=active and updates local state", async () => {
      useWorkspaceStore.setState({ members: [{ ...MEMBER_ROW, status: "suspended" }] });
      patchMock.mockResolvedValue({ data: { data: { ...MEMBER_ROW, status: "active" } } });

      await useWorkspaceStore.getState().reactivateMember("ws-1", "m-member");

      expect(patchMock).toHaveBeenCalledWith("/workspaces/ws-1/members/m-member/status", {
        status: "active",
      });
      expect(
        useWorkspaceStore.getState().members.find((m: any) => m.id === "m-member").status
      ).toBe("active");
    });
  });

  describe("removeMember", () => {
    it("DELETEs the member endpoint and drops the row from local state", async () => {
      useWorkspaceStore.setState({ members: [OWNER_ROW, MEMBER_ROW] });
      deleteMock.mockResolvedValue({ data: { data: MEMBER_ROW } });

      await useWorkspaceStore.getState().removeMember("ws-1", "m-member");

      expect(deleteMock).toHaveBeenCalledWith("/workspaces/ws-1/members/m-member");
      const state = useWorkspaceStore.getState().members;
      expect(state).toHaveLength(1);
      expect(state[0].id).toBe("m-owner");
    });

    it("uses the same endpoint for self-removal (leave workspace)", async () => {
      // Leaving is the same DELETE — the backend distinguishes self from other
      // and applies the capability rule; the client sends one request shape.
      useWorkspaceStore.setState({ members: [OWNER_ROW, MEMBER_ROW] });
      deleteMock.mockResolvedValue({ data: { data: MEMBER_ROW } });

      await useWorkspaceStore.getState().removeMember("ws-1", "m-member");

      expect(deleteMock).toHaveBeenCalledWith("/workspaces/ws-1/members/m-member");
    });

    it("throws and keeps the member when the server rejects (e.g. OWNER_PROTECTED)", async () => {
      useWorkspaceStore.setState({ members: [OWNER_ROW, MEMBER_ROW] });
      deleteMock.mockRejectedValue(new Error("Request failed with status code 409"));

      await expect(
        useWorkspaceStore.getState().removeMember("ws-1", "m-owner")
      ).rejects.toThrow();

      expect(useWorkspaceStore.getState().members).toHaveLength(2);
    });
  });

  describe("reset", () => {
    it("clears member state along with the rest of the workspace context", () => {
      useWorkspaceStore.setState({ members: [OWNER_ROW], membersError: "boom" });

      useWorkspaceStore.getState().reset();

      expect(useWorkspaceStore.getState().members).toEqual([]);
      expect(useWorkspaceStore.getState().membersError).toBeNull();
    });
  });
});
