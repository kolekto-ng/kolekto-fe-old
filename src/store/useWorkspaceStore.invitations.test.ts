import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mocking convention as useCollectionStore.test.ts / axios.test.ts:
// stub the two heavy dependencies (supabase client + axios) so this file
// only exercises useWorkspaceStore's own logic.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { setSession: vi.fn(), signOut: vi.fn() }, from: vi.fn(), functions: { invoke: vi.fn() } },
}));

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/utils/axios", () => ({
  axiosInstance: { get: getMock, post: postMock, delete: deleteMock },
}));

import {
  useWorkspaceStore as useWorkspaceStoreUntyped,
  previewInviteByToken,
  acceptInviteByToken,
  declineInviteByToken,
} from "./useWorkspaceStore";

const useWorkspaceStore = useWorkspaceStoreUntyped as any;

describe("useWorkspaceStore — invitations (Wave 4)", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [],
      activeWorkspaceId: null,
      pendingInvites: [],
      invitesLoading: false,
      error: null,
    });
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    localStorage.clear();
  });

  describe("fetchPendingInvites", () => {
    it("populates pendingInvites from the workspace-scoped endpoint", async () => {
      getMock.mockResolvedValue({ data: { data: [{ id: "inv-1", email: "a@example.com", role: "MEMBER", status: "PENDING" }] } });

      const result = await useWorkspaceStore.getState().fetchPendingInvites("ws-1");

      expect(getMock).toHaveBeenCalledWith("/workspaces/ws-1/invites");
      expect(result).toHaveLength(1);
      expect(useWorkspaceStore.getState().pendingInvites).toHaveLength(1);
      expect(useWorkspaceStore.getState().invitesLoading).toBe(false);
    });

    it("clears invitesLoading even when the request fails, and rethrows", async () => {
      getMock.mockRejectedValue(new Error("network down"));
      await expect(useWorkspaceStore.getState().fetchPendingInvites("ws-1")).rejects.toThrow("network down");
      expect(useWorkspaceStore.getState().invitesLoading).toBe(false);
    });
  });

  describe("createInvite", () => {
    it("posts to the workspace-scoped endpoint and prepends the new invite locally", async () => {
      postMock.mockResolvedValue({ data: { data: { id: "inv-2", email: "b@example.com", role: "ADMIN", status: "PENDING" } } });

      const invite = await useWorkspaceStore.getState().createInvite("ws-1", { email: "b@example.com", role: "ADMIN" });

      expect(postMock).toHaveBeenCalledWith("/workspaces/ws-1/invites", { email: "b@example.com", role: "ADMIN" });
      expect(invite.id).toBe("inv-2");
      expect(useWorkspaceStore.getState().pendingInvites[0].id).toBe("inv-2");
    });

    it("a reissue for the same email REPLACES the prior local row, matching the backend's revoke-and-replace behavior", async () => {
      useWorkspaceStore.setState({
        pendingInvites: [{ id: "inv-old", email: "dup@example.com", role: "MEMBER", status: "PENDING" }],
      });
      postMock.mockResolvedValue({ data: { data: { id: "inv-new", email: "dup@example.com", role: "ADMIN", status: "PENDING" } } });

      await useWorkspaceStore.getState().createInvite("ws-1", { email: "dup@example.com", role: "ADMIN" });

      const invites = useWorkspaceStore.getState().pendingInvites;
      expect(invites).toHaveLength(1);
      expect(invites[0].id).toBe("inv-new");
    });

    it("throws a friendly error if the server response has no invite id", async () => {
      postMock.mockResolvedValue({ data: { data: null } });
      await expect(useWorkspaceStore.getState().createInvite("ws-1", { email: "x@example.com", role: "MEMBER" })).rejects.toThrow();
    });
  });

  describe("revokeInvite", () => {
    it("deletes via the workspace-scoped endpoint and removes it from local state", async () => {
      useWorkspaceStore.setState({
        pendingInvites: [{ id: "inv-1", email: "a@example.com", role: "MEMBER", status: "PENDING" }],
      });
      deleteMock.mockResolvedValue({});

      await useWorkspaceStore.getState().revokeInvite("ws-1", "inv-1");

      expect(deleteMock).toHaveBeenCalledWith("/workspaces/ws-1/invites/inv-1");
      expect(useWorkspaceStore.getState().pendingInvites).toHaveLength(0);
    });
  });

  describe("public token-scoped functions", () => {
    it("previewInviteByToken calls the public preview endpoint and returns its data", async () => {
      getMock.mockResolvedValue({ data: { data: { valid: true, workspaceName: "FASSA Alumni", role: "MEMBER" } } });
      const preview = await previewInviteByToken("abc123");
      expect(getMock).toHaveBeenCalledWith("/invites/abc123/preview");
      expect(preview.valid).toBe(true);
      expect(preview.workspaceName).toBe("FASSA Alumni");
    });

    it("previewInviteByToken falls back to { valid: false } if the response has no data", async () => {
      getMock.mockResolvedValue({ data: {} });
      const preview = await previewInviteByToken("abc123");
      expect(preview).toEqual({ valid: false });
    });

    it("acceptInviteByToken posts to the accept endpoint", async () => {
      postMock.mockResolvedValue({ data: { data: { workspace_id: "ws-9" } } });
      const result = await acceptInviteByToken("abc123");
      expect(postMock).toHaveBeenCalledWith("/invites/abc123/accept");
      expect(result.workspace_id).toBe("ws-9");
    });

    it("declineInviteByToken posts to the decline endpoint", async () => {
      postMock.mockResolvedValue({ data: {} });
      await declineInviteByToken("abc123");
      expect(postMock).toHaveBeenCalledWith("/invites/abc123/decline");
    });
  });

  describe("acceptInviteAndActivate — the critical ordering guarantee", () => {
    it("calls accept, THEN fetchWorkspaces, THEN switchWorkspace — never any other order", async () => {
      const callOrder: string[] = [];

      postMock.mockImplementation(async (url: string) => {
        if (url === "/invites/tok-1/accept") {
          callOrder.push("accept");
          return { data: { data: { workspace_id: "ws-new" } } };
        }
        throw new Error(`unexpected POST ${url}`);
      });
      getMock.mockImplementation(async (url: string) => {
        if (url === "/workspaces") {
          callOrder.push("fetchWorkspaces");
          // The newly-joined workspace MUST be present here — this is what
          // makes switchWorkspace's own guard accept it afterward.
          return { data: { data: [{ id: "ws-new", name: "New Workspace", type: "organization" }] } };
        }
        throw new Error(`unexpected GET ${url}`);
      });

      const originalSwitch = useWorkspaceStore.getState().switchWorkspace;
      const switchSpy = vi.fn((...args: any[]) => {
        callOrder.push("switchWorkspace");
        return originalSwitch(...args);
      });
      useWorkspaceStore.setState({ switchWorkspace: switchSpy });

      const member = await useWorkspaceStore.getState().acceptInviteAndActivate("tok-1", "user-1");

      expect(callOrder).toEqual(["accept", "fetchWorkspaces", "switchWorkspace"]);
      expect(member.workspace_id).toBe("ws-new");
      // Proves the guard in switchWorkspace actually accepted the switch —
      // if fetchWorkspaces had NOT run first, activeWorkspaceId would still
      // be null (switchWorkspace silently no-ops on an unknown id).
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe("ws-new");
    });

    it("does not call switchWorkspace at all if accept itself fails", async () => {
      postMock.mockRejectedValue(new Error("expired"));
      const switchSpy = vi.fn();
      useWorkspaceStore.setState({ switchWorkspace: switchSpy });

      await expect(useWorkspaceStore.getState().acceptInviteAndActivate("tok-1", "user-1")).rejects.toThrow("expired");
      expect(getMock).not.toHaveBeenCalled();
      expect(switchSpy).not.toHaveBeenCalled();
    });
  });
});
