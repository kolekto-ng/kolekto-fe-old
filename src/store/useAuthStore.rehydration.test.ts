import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * useAuthStore.rehydration.test.ts — surviving a full browser reload.
 *
 * THE SCENARIO
 * ------------
 * A user verifies their email, lands on /dashboard (an SPA navigation, so the
 * store is still populated in memory), then presses F5. That reload throws away
 * all in-memory state; the ONLY thing that carries the session across it is
 * `kolekto-auth-token` in localStorage plus the module-level `checkAuth()` that
 * useAuthStore fires on import.
 *
 * ProtectedRoute renders `<Navigate to="/login">` whenever `isLoading` is false
 * and `user` is null. So every path through boot that ends with "no user and not
 * loading" is a silent logout, whether or not the stored token was actually
 * invalid. These tests pin which boot outcomes are allowed to do that.
 */

const get = vi.fn();
const post = vi.fn();

vi.mock("../utils/axios", () => ({
  axiosInstance: {
    get: (...a: any[]) => get(...a),
    post: (...a: any[]) => post(...a),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  authAPI: {},
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock("@/store/useProfileStore", () => ({
  useProfileStore: { getState: () => ({ resetKycState: vi.fn() }) },
}));

const AUTH_KEY = "kolekto-auth-token";

/** A stored session shaped exactly as VerifyEmailPage / signIn write it. */
function storedSession(overrides: Record<string, any> = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: "stored-access-token",
    refresh_token: "stored-refresh-token",
    expires_at: nowSec + 3600,
    kolekto_started_at: nowSec,
    kolekto_expires_at: nowSec + 3600,
    ...overrides,
  };
}

/** Boot the store the way a page load does, and wait for checkAuth to settle. */
async function boot() {
  vi.resetModules();
  const mod = await import("./useAuthStore");
  // Let the module-level checkAuth() promise chain flush.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  return mod.useAuthStore;
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reload with a valid stored session", () => {
  beforeEach(() => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(storedSession()));
  });

  it("verifies the stored token and restores the user", async () => {
    get.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" }, profile: { id: "u1" } } });
    const store = await boot();
    const s: any = store.getState();

    expect(get).toHaveBeenCalledWith("/auth/me");
    expect(s.user?.id).toBe("u1");
    expect(s.isLoading).toBe(false);
    // ProtectedRoute's redirect condition must be false.
    expect(!s.isLoading && !s.user).toBe(false);
  });

  it("keeps the token in storage after a successful rehydration", async () => {
    get.mockResolvedValue({ data: { user: { id: "u1" }, profile: null } });
    await boot();
    expect(localStorage.getItem(AUTH_KEY)).not.toBeNull();
  });

  it("starts in a loading state so ProtectedRoute shows a skeleton, not /login", async () => {
    // If isLoading were false while checkAuth is still in flight, ProtectedRoute
    // would redirect to /login before the answer arrived.
    get.mockReturnValue(new Promise(() => {}));
    vi.resetModules();
    const mod = await import("./useAuthStore");
    const s: any = mod.useAuthStore.getState();
    expect(s.isLoading).toBe(true);
    expect(s.user).toBeNull();
  });
});

describe("reload with an expired stored session", () => {
  it("does not call the backend and lands logged out", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify(storedSession({ kolekto_expires_at: nowSec - 10, expires_at: nowSec - 10 }))
    );
    const store = await boot();
    const s: any = store.getState();

    expect(get).not.toHaveBeenCalled();
    expect(s.user).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
  });
});

describe("reload when the backend rejects the token", () => {
  it("a 401 clears the session — an invalid token must not stay usable", async () => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(storedSession()));
    get.mockRejectedValue({ response: { status: 401 } });
    const store = await boot();
    const s: any = store.getState();

    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
  });
});

describe("reload when the backend is unreachable", () => {
  beforeEach(() => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(storedSession()));
  });

  it("retries a transient failure instead of giving up on the first error", async () => {
    // A single flaky request on boot must not look like a logout: the token is
    // still perfectly valid, we just could not confirm it that instant.
    get
      .mockRejectedValueOnce({ code: "ERR_NETWORK", message: "Network Error" })
      .mockResolvedValueOnce({ data: { user: { id: "u1" }, profile: null } });

    const store = await boot();
    // allow the backoff to elapse
    await new Promise((r) => setTimeout(r, 1200));
    const s: any = store.getState();

    expect(get.mock.calls.length).toBeGreaterThan(1);
    expect(s.user?.id).toBe("u1");
  });

  it("never discards a valid stored token on a network failure", async () => {
    get.mockRejectedValue({ code: "ERR_NETWORK", message: "Network Error" });
    await boot();
    await new Promise((r) => setTimeout(r, 3000));
    // The token may still be good — only the backend was unreachable.
    expect(localStorage.getItem(AUTH_KEY)).not.toBeNull();
  });
});

describe("logout still fully invalidates", () => {
  it("clears user, session and storage", async () => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(storedSession()));
    get.mockResolvedValue({ data: { user: { id: "u1" }, profile: null } });
    post.mockResolvedValue({ status: 200, data: {} });

    const store = await boot();
    await (store.getState() as any).signOut();
    const s: any = store.getState();

    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
  });
});

describe("no stored session at all", () => {
  it("does not call the backend and is immediately unauthenticated", async () => {
    const store = await boot();
    const s: any = store.getState();
    expect(get).not.toHaveBeenCalled();
    expect(s.user).toBeNull();
    expect(s.isLoading).toBe(false);
  });
});
