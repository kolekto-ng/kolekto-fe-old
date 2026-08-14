import { describe, it, expect, beforeEach, vi } from "vitest";

// axios.tsx transitively imports @/store -> useAuthStore.ts ->
// @/integrations/supabase/client, which calls supabase-js's createClient()
// at module load time and throws without real env vars. Stub it the same way
// useCollectionStore.test.ts does — this test only exercises the request
// interceptor, not anything supabase-backed.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { setSession: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

import { axiosInstance } from "./axios";
import { setActiveWorkspaceId } from "./activeWorkspace";

// Wave 2 (workspace authorization hardening): the request interceptor attaches
// X-Workspace-Id as a FALLBACK from localStorage. A caller that already knows
// its own workspace context (e.g. the collection-creation wizard) must be able
// to set the header explicitly on its own request without the interceptor
// silently clobbering it with the global "active workspace" value a moment
// later — that clobbering is exactly the implicit-side-channel dependency this
// wave exists to remove. See useCollectionStore.createCollection.
describe("axiosInstance request interceptor — X-Workspace-Id", () => {
  const AUTH_KEY = "kolekto-auth-token";

  function runInterceptor(config: any) {
    const handler = (axiosInstance.interceptors.request as any).handlers[0].fulfilled;
    return handler(config);
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        access_token: "token-abc",
        user: { id: "user-1" },
        kolekto_started_at: Math.floor(Date.now() / 1000),
        kolekto_expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
  });

  it("falls back to the globally active workspace when the caller sets no header", async () => {
    setActiveWorkspaceId("ws-global", "user-1");

    const config = await runInterceptor({ url: "/create-collection", method: "post", headers: {} });

    expect(config.headers["X-Workspace-Id"]).toBe("ws-global");
  });

  it("never overwrites an explicitly-set header with the global fallback", async () => {
    setActiveWorkspaceId("ws-global", "user-1");

    const config = await runInterceptor({
      url: "/create-collection",
      method: "post",
      headers: { "X-Workspace-Id": "ws-explicit" },
    });

    expect(config.headers["X-Workspace-Id"]).toBe("ws-explicit");
  });

  it("sends no header at all when neither the caller nor localStorage has a workspace", async () => {
    const config = await runInterceptor({ url: "/create-collection", method: "post", headers: {} });

    expect(config.headers["X-Workspace-Id"]).toBeUndefined();
  });
});
