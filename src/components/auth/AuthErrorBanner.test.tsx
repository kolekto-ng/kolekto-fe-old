import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import AuthErrorBanner from "./AuthErrorBanner";
import type { ClassifiedAuthError } from "@/utils/authErrors";

/**
 * AuthErrorBanner.test.tsx — the "the user must not have to scroll" contract.
 *
 * WHY THESE EXIST
 * The register form is taller than a phone viewport. Its error region is at the
 * TOP; its submit button is at the BOTTOM. A failed submission therefore
 * rendered a message the user never saw — they were left staring at an idle
 * button, which is why failures were reported as "nothing happens".
 *
 * jsdom does not implement scrollIntoView, so it is stubbed and asserted on.
 * That is exactly the right level: what we care about is that the component
 * ASKS to be revealed, once per new error, with non-jarring options.
 */

let container: HTMLDivElement;
let root: Root;
let scrollIntoView: ReturnType<typeof vi.fn>;

const ERROR: ClassifiedAuthError = {
  category: "user",
  title: "Sign-in details not recognised",
  message: "The email or password is incorrect. Please check your details and try again.",
};

function render(node: React.ReactNode) {
  act(() => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
  // The component defers its scroll by one animation frame so layout can settle.
  act(() => {
    vi.advanceTimersByTime(32);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  // requestAnimationFrame in terms of the fake clock so the deferred scroll is
  // deterministic rather than racing the test.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id as unknown as NodeJS.Timeout));

  scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: scrollIntoView,
    writable: true,
    configurable: true,
  });

  // Default: motion is allowed.
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

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("visibility — the error is brought to the user", () => {
  it("scrolls itself into view when an error appears", () => {
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("scrolls smoothly and centres itself, rather than jumping to the top edge", () => {
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth", block: "center" })
    );
  });

  it("centring keeps it clear of a mobile keyboard and sticky chrome", () => {
    // block:"center" (not "start") is deliberate — on a short viewport with the
    // keyboard open, "start" can put the banner under fixed chrome.
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    const opts = scrollIntoView.mock.calls[0][0];
    expect(opts.block).toBe("center");
  });

  it("does NOT scroll when there is no error", () => {
    render(<AuthErrorBanner error={null} scrollKey={0} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does NOT re-scroll on an unrelated re-render", () => {
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // Same error, same key — e.g. the user is typing in another field.
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("DOES re-scroll when the same error is raised again", () => {
    // A user who resubmits the same wrong password must be shown the message
    // again — value comparison would wrongly treat this as "no change".
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    render(<AuthErrorBanner error={ERROR} scrollKey={2} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("respects prefers-reduced-motion by jumping instead of animating", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("reduced-motion"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
  });

  it("survives a browser that rejects the options object", () => {
    scrollIntoView.mockImplementationOnce(() => {
      throw new TypeError("no options overload");
    });
    expect(() => render(<AuthErrorBanner error={ERROR} scrollKey={1} />)).not.toThrow();
    // Falls back to the boolean form rather than leaving the user stranded.
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith(true);
  });
});

describe("accessibility", () => {
  it("announces itself to screen readers without needing focus", () => {
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    expect(alert?.getAttribute("aria-atomic")).toBe("true");
  });

  it("receives focus so a keyboard user's next Tab starts at the error", () => {
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(alert);
  });

  it("renders both the title and the message as text", () => {
    render(<AuthErrorBanner error={ERROR} scrollKey={1} />);
    expect(container.textContent).toContain(ERROR.title);
    expect(container.textContent).toContain(ERROR.message);
  });
});

describe("actions", () => {
  it("renders a link action for a routed next step", () => {
    render(
      <AuthErrorBanner
        error={{ ...ERROR, action: { label: "Reset your password", to: "/forgot-password" } }}
        scrollKey={1}
      />
    );
    const link = container.querySelector('a[href="/forgot-password"]');
    expect(link?.textContent).toBe("Reset your password");
  });

  it("invokes onAction for an intent the form owns", () => {
    const onAction = vi.fn();
    render(
      <AuthErrorBanner
        error={{ ...ERROR, action: { label: "Resend verification email", intent: "resend-verification" } }}
        scrollKey={1}
        onAction={onAction}
      />
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onAction).toHaveBeenCalledWith("resend-verification");
  });

  it("disables the action while it is in flight", () => {
    render(
      <AuthErrorBanner
        error={{ ...ERROR, action: { label: "Resend verification email", intent: "resend-verification" } }}
        scrollKey={1}
        actionPending
      />
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("tones an account-exists state as a next step, not a red failure", () => {
    render(
      <AuthErrorBanner
        error={{
          category: "user",
          title: "Verify your email to continue",
          message: "Check your inbox.",
          accountMayExist: true,
        }}
        scrollKey={1}
      />
    );
    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    // Amber, not red — telling a user whose account WAS created that something
    // failed in alarming red is what drove the duplicate-registration loop.
    expect(alert.className).toMatch(/amber/);
    expect(alert.className).not.toMatch(/border-red/);
  });
});
