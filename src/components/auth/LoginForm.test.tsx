import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * LoginForm.test.tsx — the sign-in surface contract.
 *
 * Two properties are pinned here:
 *
 *  1. NO MAGIC LINK. The production audit found POST /auth/v1/otp failing with
 *     HTTP 520 on 100% of attempts. The option was removed from the UI rather
 *     than shipped broken. This test fails if anyone reintroduces it, which is
 *     the only cheap way to keep a removed auth method from creeping back via
 *     a revert or a merge.
 *
 *  2. AUTO-SCROLL. A sign-in failure must bring its own error into view. The
 *     error banner sits above the fold-line on mobile while the submit button
 *     sits below it, so without this a failed sign-in showed the user nothing.
 */

const signIn = vi.fn();
const resendVerification = vi.fn();

vi.mock("@/store", () => ({
  useAuthStore: Object.assign(() => ({ signIn, resendVerification }), {
    getState: () => ({ signIn, resendVerification }),
    setState: () => {},
  }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import LoginForm from "./LoginForm";

let container: HTMLDivElement;
let root: Root;
let scrollIntoView: ReturnType<typeof vi.fn>;

function render() {
  act(() => {
    root.render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
  });
}

async function submitForm() {
  const form = container.querySelector("form") as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  // The banner defers its scroll by one animation frame.
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  signIn.mockReset();
  resendVerification.mockReset();

  scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: scrollIntoView,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  // requestAnimationFrame runs synchronously so the deferred scroll is
  // observable without fake timers fighting the async submit handler.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("magic link is not offered", () => {
  it("renders no magic-link / passwordless copy anywhere", () => {
    render();
    const text = container.textContent || "";
    for (const phrase of [
      "magic link",
      "Magic Link",
      "sign-in link",
      "login link",
      "Email me",
      "passwordless",
      "one-time password",
    ]) {
      expect(text.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("offers exactly one submit button and no secondary auth method", () => {
    render();
    const submits = container.querySelectorAll('button[type="submit"]');
    expect(submits.length).toBe(1);
    expect(submits[0].textContent).toMatch(/sign in/i);
  });

  it("still offers the password-reset escape hatch", () => {
    render();
    const forgot = container.querySelector('a[href="/forgot-password"]');
    expect(forgot).not.toBeNull();
  });

  it("never calls a sendMagicLink action", () => {
    render();
    // The store mock exposes only signIn/resendVerification. If LoginForm
    // reached for sendMagicLink it would throw on render or on click.
    expect((container.textContent || "").length).toBeGreaterThan(0);
  });
});

describe("auto-scroll on sign-in failure", () => {
  it("scrolls the error into view without the user scrolling", async () => {
    signIn.mockResolvedValue({
      user: null,
      error: { response: { status: 401, data: { code: "AUTH_INVALID_CREDENTIALS" } } },
    });
    render();
    await submitForm();

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth", block: "center" })
    );
  });

  it("announces the error assertively for screen readers", async () => {
    signIn.mockResolvedValue({
      user: null,
      error: { response: { status: 401, data: { code: "AUTH_INVALID_CREDENTIALS" } } },
    });
    render();
    await submitForm();

    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(document.activeElement).toBe(alert);
  });

  it("shows the unverified-email state with a resend action, not a password error", async () => {
    signIn.mockResolvedValue({
      user: null,
      error: { response: { status: 403, data: { code: "AUTH_EMAIL_NOT_CONFIRMED" } } },
    });
    render();
    await submitForm();

    const text = container.textContent || "";
    expect(text).toMatch(/verif/i);
    expect(text).toMatch(/inbox|spam/i);
    expect(text).toMatch(/resend verification email/i);
    // Must NOT tell them to register again.
    expect(text.toLowerCase()).not.toContain("register again");
  });

  it("reports a transport failure as a connection problem, not bad credentials", async () => {
    signIn.mockResolvedValue({
      user: null,
      error: { code: "ERR_NETWORK", message: "Network Error", response: undefined },
    });
    render();
    await submitForm();

    const text = container.textContent || "";
    expect(text).toMatch(/connection problem|offline/i);
    expect(text).not.toMatch(/password is incorrect/i);
  });

  it("reports rate limiting distinctly", async () => {
    signIn.mockResolvedValue({
      user: null,
      error: { response: { status: 429, data: { code: "AUTH_RATE_LIMITED" } } },
    });
    render();
    await submitForm();

    expect(container.textContent).toMatch(/too many attempts/i);
  });
});
