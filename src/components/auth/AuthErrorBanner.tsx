import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, MailCheck, ShieldAlert, WifiOff } from "lucide-react";
import type { ClassifiedAuthError } from "@/utils/authErrors";

/**
 * AuthErrorBanner — one component that renders EVERY auth failure, on every
 * auth form, and guarantees the user actually sees it.
 *
 * WHY IT SCROLLS
 * --------------
 * The register form is tall: three sections, ten fields, a terms checkbox and
 * then the submit button. The error region lives at the TOP of the form. On a
 * phone the submit button and the error are more than a full viewport apart, so
 * a failed submission rendered a message the user was never shown — they sat
 * looking at an idle button. Every report of "nothing happened when I pressed
 * Create Account" is this.
 *
 * The scroll is implemented HERE rather than at the call sites on purpose. Any
 * form that renders this component inherits the behaviour, and there is exactly
 * one place to reason about when a scroll is or is not appropriate. Adding
 * scrollIntoView() calls to individual submit handlers is how you end up with
 * forms that scroll twice, scroll on success, or forget entirely.
 *
 * WHEN IT SCROLLS
 * ---------------
 * On a NEW error only. `scrollKey` changes identity per emitted error, so
 * re-renders from typing, focus changes or React StrictMode's double-invoke do
 * not re-scroll and yank the page out from under someone mid-correction.
 *
 * ACCESSIBILITY
 * -------------
 * - `role="alert"` + `aria-live="assertive"` so screen readers announce the
 *   message the moment it appears, without needing focus.
 * - The container is focusable (`tabIndex={-1}`) and receives focus, which puts
 *   a keyboard user's next Tab at the error rather than back at the page top.
 * - `preventScroll` on focus() so focusing does not fight the smooth scroll.
 * - Honours `prefers-reduced-motion`: jumps instead of animating.
 */

const CATEGORY_ICON = {
  network: WifiOff,
  ratelimit: Loader2,
  user: AlertTriangle,
  service: ShieldAlert,
  backend: ShieldAlert,
  unknown: AlertTriangle,
} as const;

export interface AuthErrorBannerProps {
  error: ClassifiedAuthError | null;
  /**
   * Changes identity whenever a new error is emitted — including the same error
   * twice in a row. Drives the scroll-once behaviour.
   */
  scrollKey?: number;
  /** Handles an action whose `intent` the parent form owns (e.g. resend). */
  onAction?: (intent: NonNullable<ClassifiedAuthError["action"]>["intent"]) => void;
  /** Set while an action triggered from the banner is in flight. */
  actionPending?: boolean;
  className?: string;
}

/**
 * Scrolls an element into view and focuses it, accounting for mobile keyboards
 * and small viewports.
 *
 * `block: "center"` rather than "start": on a short viewport with the on-screen
 * keyboard open, "start" can place the banner directly under a sticky header or
 * flush against the top edge where it reads as clipped. Centring keeps it
 * visible on every viewport height we support.
 */
function revealElement(el: HTMLElement) {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  try {
    el.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
  } catch {
    // Older Safari rejects the options object — fall back to the boolean form.
    try {
      el.scrollIntoView(true);
    } catch {
      /* nothing more we can do; the banner is still rendered */
    }
  }

  try {
    el.focus({ preventScroll: true });
  } catch {
    try {
      el.focus();
    } catch {
      /* focus is a progressive enhancement here */
    }
  }
}

const AuthErrorBanner: React.FC<AuthErrorBannerProps> = ({
  error,
  scrollKey = 0,
  onAction,
  actionPending = false,
  className = "",
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastScrolledKey = useRef<number | null>(null);

  useEffect(() => {
    if (!error || !ref.current) return;
    // Guard against re-scrolling for an error that is already on screen.
    if (lastScrolledKey.current === scrollKey) return;
    lastScrolledKey.current = scrollKey;

    const el = ref.current;
    // Defer one frame so layout has settled (the banner has just mounted, and
    // on mobile the keyboard may still be collapsing) — scrolling to a node
    // whose final position is not yet known lands in the wrong place.
    const raf = requestAnimationFrame(() => revealElement(el));
    return () => cancelAnimationFrame(raf);
  }, [error, scrollKey]);

  if (!error) return null;

  const Icon = CATEGORY_ICON[error.category] ?? AlertTriangle;
  const isPositive = error.category === "user" && Boolean(error.accountMayExist);

  // An "account exists / verify your email" state is not a red failure — it is
  // a next step. Colouring it as an error is what made users believe their
  // registration had been lost when it had in fact succeeded.
  const tone = isPositive
    ? {
        wrap: "border-amber-200 bg-amber-50 text-amber-900",
        icon: "text-amber-600",
        action: "text-amber-900 hover:bg-amber-100",
      }
    : {
        wrap: "border-red-200 bg-red-50 text-red-800",
        icon: "text-red-600",
        action: "text-red-800 hover:bg-red-100",
      };

  const ActionIcon = isPositive ? MailCheck : Icon;

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
      // scroll-mt keeps the banner clear of any sticky chrome when the browser
      // (rather than our handler) brings it into view, e.g. on anchor focus.
      className={`scroll-mt-24 rounded-2xl border px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 sm:px-5 ${tone.wrap} ${className}`}
    >
      <div className="flex items-start gap-3">
        <ActionIcon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.icon}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-6">{error.title}</p>
          <p className="mt-1 text-sm leading-6">{error.message}</p>

          {error.action && (
            <div className="mt-3">
              {error.action.to ? (
                <Link
                  to={error.action.to}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium underline underline-offset-4 transition ${tone.action}`}
                >
                  {error.action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={actionPending}
                  onClick={() => onAction?.(error.action?.intent)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium underline underline-offset-4 transition disabled:cursor-not-allowed disabled:opacity-60 ${tone.action}`}
                >
                  {actionPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {actionPending ? "Sending…" : error.action.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthErrorBanner;
