import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the circular-import TDZ bug fixed in
// useAuthStore.ts: this module and utils/axios.tsx import each other, and a
// previous version called `useAuthStore.getState().checkAuth()` directly at
// module top-level. On a fresh page load that could run before axios.tsx's
// own top-level `export const axiosInstance` had finished initializing,
// throwing a TDZ ReferenceError that checkAuth's catch block swallowed as
// "not authenticated" — silently bouncing a valid session to /login. The fix
// wraps the startup call in `queueMicrotask` so it always runs after module
// evaluation completes. These tests assert the deferral mechanism itself is
// in place, not just that checkAuth eventually resolves (the broken version
// also appeared to "work" from a caller's perspective, since the error was
// swallowed).

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(() => Promise.resolve({ data: { user: null } })),
}));

vi.mock("@/utils/axios", () => ({
  axiosInstance: { get: getMock, post: vi.fn() },
  authAPI: {},
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { setSession: vi.fn(), signOut: vi.fn() } },
}));

vi.mock("@/store/useProfileStore", () => ({
  useProfileStore: { getState: () => ({ resetKycState: vi.fn() }) },
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const AUTH_STORAGE_KEY = "kolekto-auth-token";

function seedValidStoredSession() {
  const now = Math.floor(Date.now() / 1000);
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      access_token: "tok",
      refresh_token: "refresh",
      expires_at: now + 3600,
      kolekto_expires_at: now + 3600,
    }),
  );
}

describe("useAuthStore startup rehydration timing", () => {
  beforeEach(() => {
    localStorage.clear();
    getMock.mockClear();
    vi.resetModules();
  });

  it("defers the startup checkAuth call to a microtask instead of calling it synchronously at module top-level", async () => {
    seedValidStoredSession();
    const queueMicrotaskSpy = vi.spyOn(globalThis, "queueMicrotask");

    // `await import(...)` itself goes through the job queue, so by the time
    // control returns here any microtask queued during module evaluation
    // (including our deferred callback) has already run — the ordering
    // guarantee under test is "went through queueMicrotask at all", not
    // "hasn't fired yet by this specific point".
    await import("./useAuthStore");

    expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
    expect(queueMicrotaskSpy).toHaveBeenCalledWith(expect.any(Function));
    expect(getMock).toHaveBeenCalledWith("/auth/me");
  });

  it("does not schedule rehydration when there is no stored session", async () => {
    const queueMicrotaskSpy = vi.spyOn(globalThis, "queueMicrotask");

    await import("./useAuthStore");

    expect(queueMicrotaskSpy).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });
});
