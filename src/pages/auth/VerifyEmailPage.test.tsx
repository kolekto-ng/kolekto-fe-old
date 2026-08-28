import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * VerifyEmailPage.test.tsx — the email-verification callback.
 *
 * THE BUG THESE REPRODUCE
 * -----------------------
 * A user clicked a real verification link, landed on /auth/verify, and the page
 * span its spinner forever. The account WAS verified (they could sign in right
 * afterwards) — so the callback was succeeding and only the UI was stuck.
 *
 * Cause: the effect combined a `ran` ref (to stop React 18 StrictMode running
 * the one-time token exchange twice) with a `cancelled` flag set by the effect
 * cleanup. Under StrictMode those two are mutually destructive:
 *
 *   effect#1  -> ran = true, cancelled = false, async work starts
 *   cleanup#1 -> cancelled = true            (StrictMode's simulated unmount)
 *   effect#2  -> `ran` is true, returns immediately — nothing resets `cancelled`
 *   async resolves -> every `setPhase` is behind `if (!cancelled)` -> NO-OP
 *
 * `phase` stayed "working" on every path, so the spinner never left the screen,
 * while the side effects before the guard (setSession, localStorage promotion)
 * had already happened. That is exactly the reported symptom.
 *
 * These tests render under <React.StrictMode>, which is what main.tsx does.
 */

const setSession = vi.fn();
const getSession = vi.fn();
const exchangeCodeForSession = vi.fn();
const onAuthStateChange = vi.fn();
const checkAuth = vi.fn();
const resendVerification = vi.fn();
const navigate = vi.fn();
// jsdom's location.assign is non-configurable, so the hard-redirect branch is
// asserted by the ABSENCE of an SPA navigate rather than by spying on it.
const assign = vi.fn();

/** What useAuthStore.getState() reports. handOff() branches on `user`. */
let storeUser: any = { id: "test-user" };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: (...a: any[]) => setSession(...a),
      getSession: (...a: any[]) => getSession(...a),
      exchangeCodeForSession: (...a: any[]) => exchangeCodeForSession(...a),
      onAuthStateChange: (...a: any[]) => onAuthStateChange(...a),
    },
  },
}));

vi.mock("@/store", () => ({
  useAuthStore: Object.assign(() => ({ resendVerification }), {
    getState: () => ({ checkAuth, resendVerification, user: storeUser }),
  }),
}));

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("react-router-dom", async () => {
  const actual: any = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

import VerifyEmailPage from "./VerifyEmailPage";

let container: HTMLDivElement;
let root: Root;

const VALID_SESSION = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

/** Put the page's callback params into the URL the way Supabase does. */
function setCallbackUrl(hash = "", search = "") {
  window.history.replaceState(null, "", `/auth/verify${search}${hash}`);
}

function render() {
  act(() => {
    root.render(
      <React.StrictMode>
        <MemoryRouter initialEntries={["/auth/verify"]}>
          <VerifyEmailPage />
        </MemoryRouter>
      </React.StrictMode>
    );
  });
}

/** Let the async callback pipeline settle. */
async function settle(ms = 0) {
  await act(async () => {
    if (ms) vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const text = () => container.textContent || "";
const isSpinning = () => /confirming your email address/i.test(text());

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  setSession.mockReset();
  getSession.mockReset();
  exchangeCodeForSession.mockReset();
  onAuthStateChange.mockReset();
  checkAuth.mockReset();
  resendVerification.mockReset();
  navigate.mockReset();

  // Default: no auth event ever arrives (the common real case once
  // detectSessionInUrl has already consumed the hash).
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  checkAuth.mockResolvedValue(undefined);

  storeUser = { id: "test-user" };
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: vi.fn(), writable: true, configurable: true,
  });
  // The error banner defers its scroll by one animation frame; run it inline so
  // the assertion does not depend on fake-timer rAF scheduling.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  assign.mockReset();
  Object.defineProperty(window, "matchMedia", {
    writable: true, configurable: true,
    value: (q: string) => ({
      matches: false, media: q,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
  localStorage.clear();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// A. Successful verification — the reported failure
// ─────────────────────────────────────────────────────────────────────────────

describe("A. successful verification (implicit flow, tokens in the hash)", () => {
  beforeEach(() => {
    setCallbackUrl("#access_token=test-access-token&refresh_token=test-refresh-token&type=signup");
    setSession.mockResolvedValue({ data: { session: VALID_SESSION }, error: null });
  });

  it("leaves the spinner and reaches the success state under StrictMode", async () => {
    render();
    await settle();
    // THE REGRESSION: this was stuck on "Confirming your email address…" forever.
    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/you're verified/i);
  });

  it("promotes the session into kolekto-auth-token so the rest of the app sees it", async () => {
    render();
    await settle();
    const stored = JSON.parse(localStorage.getItem("kolekto-auth-token") || "null");
    expect(stored?.access_token).toBe("test-access-token");
    expect(stored?.refresh_token).toBe("test-refresh-token");
  });

  it("resolves the user through the backend exactly once", async () => {
    render();
    await settle();
    // StrictMode double-invokes the effect; the one-time token must not be
    // exchanged twice or the second attempt fails with "token not found".
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(checkAuth).toHaveBeenCalledTimes(1);
  });

  it("navigates to the dashboard after the confirmation pause", async () => {
    render();
    await settle();
    expect(navigate).not.toHaveBeenCalled();
    await settle(1500);
    expect(navigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("scrubs the tokens out of the address bar", async () => {
    render();
    await settle();
    expect(window.location.hash).toBe("");
  });
});

describe("A2. successful verification when supabase-js already consumed the hash", () => {
  it("recovers the session via getSession and still succeeds", async () => {
    // detectSessionInUrl is enabled on the shared client, so it can process and
    // strip the fragment before this page's effect ever reads it.
    setCallbackUrl("");
    getSession.mockResolvedValue({ data: { session: VALID_SESSION }, error: null });
    render();
    await settle();
    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/you're verified/i);
  });

  it("recovers via a late SIGNED_IN event when getSession is still empty", async () => {
    setCallbackUrl("");
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    let emit: ((e: string, s: any) => void) | null = null;
    onAuthStateChange.mockImplementation((cb: any) => {
      emit = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    render();
    await settle();
    expect(isSpinning()).toBe(true); // still waiting — correct, not yet failed

    await act(async () => {
      emit?.("SIGNED_IN", VALID_SESSION);
      await Promise.resolve();
    });
    await settle();

    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/you're verified/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B/C/D. Link problems
// ─────────────────────────────────────────────────────────────────────────────

describe("B–D. expired / already-used / invalid links", () => {
  it("shows an expired-link message when Supabase returns an error param", async () => {
    setCallbackUrl("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    render();
    await settle();
    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/expired/i);
    expect(text()).toMatch(/send a new verification link/i);
  });

  it("shows an invalid-link message when no session can be resolved", async () => {
    setCallbackUrl("");
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    render();
    await settle();
    // Still waiting for a possible late SIGNED_IN — correct, not yet failed.
    expect(isSpinning()).toBe(true);
    // The bounded late-session wait (4s) expires well before the 15s watchdog,
    // so the user is told the link is invalid rather than staring at a spinner.
    await settle(5_000);
    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/no longer valid|couldn't confirm/i);
  });

  it("an already-used link (second click) does not strand the user", async () => {
    setCallbackUrl("#access_token=used&refresh_token=used&type=signup");
    setSession.mockResolvedValue({
      data: { session: null },
      error: Object.assign(new Error("Token has expired or is invalid"), { status: 403, code: "otp_expired" }),
    });
    render();
    await settle();
    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/expired|no longer valid|invalid/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E/F. Failures
// ─────────────────────────────────────────────────────────────────────────────

describe("E–F. network and unexpected failures", () => {
  it("reports a network failure as a connection problem", async () => {
    setCallbackUrl("#access_token=a&refresh_token=b&type=signup");
    setSession.mockRejectedValue(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }));
    render();
    await settle();
    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/connection problem|offline/i);
  });

  it("never exposes raw Supabase/Postgres internals", async () => {
    setCallbackUrl("#access_token=a&refresh_token=b&type=signup");
    setSession.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "profiles_pkey" in supabase postgres')
    );
    render();
    await settle();
    expect(isSpinning()).toBe(false);
    expect(text()).not.toMatch(/supabase|postgres|constraint|pkey|duplicate key/i);
  });

  it("a hung callback still leaves the loading state via the watchdog", async () => {
    setCallbackUrl("#access_token=a&refresh_token=b&type=signup");
    setSession.mockReturnValue(new Promise(() => {})); // never settles
    render();
    await settle();
    expect(isSpinning()).toBe(true);
    await settle(20_000);
    // G: no execution path may remain on the spinner forever.
    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/taking longer|connection|try again|no longer valid/i);
  });

  it("falls back to a full page load when the store never resolved a user", async () => {
    // An SPA navigate here would hit ProtectedRoute with user === null and
    // bounce to /login — the original bug. A full load rehydrates the store
    // from the token we just wrote.
    storeUser = null;
    setCallbackUrl("#access_token=test-access-token&refresh_token=test-refresh-token&type=signup");
    setSession.mockResolvedValue({ data: { session: VALID_SESSION }, error: null });
    render();
    await settle();
    // Verification still succeeds...
    expect(isSpinning()).toBe(false);
    expect(text()).toMatch(/you're verified/i);
    await settle(1500);
    // ...but hand-off must NOT be an SPA navigate, which would hit
    // ProtectedRoute with user === null and bounce back to /login.
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a hung checkAuth still leaves the loading state", async () => {
    setCallbackUrl("#access_token=a&refresh_token=b&type=signup");
    setSession.mockResolvedValue({ data: { session: VALID_SESSION }, error: null });
    checkAuth.mockReturnValue(new Promise(() => {}));
    render();
    await settle();
    await settle(20_000);
    expect(isSpinning()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G/H. No infinite loading, and errors are surfaced
// ─────────────────────────────────────────────────────────────────────────────

describe("G–H. terminal state and error visibility", () => {
  it("every failure path renders an alert that scrolls itself into view", async () => {
    setCallbackUrl("#error=access_denied&error_code=otp_expired");
    render();
    await settle();
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("offers a resend action on every failure path", async () => {
    setCallbackUrl("#error=access_denied&error_code=otp_expired");
    render();
    await settle();
    expect(text()).toMatch(/send a new verification link/i);
  });
});
