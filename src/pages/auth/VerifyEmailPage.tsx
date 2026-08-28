import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailWarning, ShieldCheck, Sparkles, Users } from "lucide-react";
import AuthPageShell from "@/components/auth/AuthPageShell";
import AuthErrorBanner from "@/components/auth/AuthErrorBanner";
import { useAuthError } from "@/hooks/useAuthError";
import { useAuthStore } from "@/store";
import { supabase } from "@/integrations/supabase/client";
import { withOneHourExpiry } from "@/utils/authSession";
import { toast } from "@/lib/toast";

/**
 * VerifyEmailPage — the landing page for the email-verification link.
 *
 * HOW THE CALLBACK ACTUALLY WORKS HERE
 * ------------------------------------
 * Signup runs on the BACKEND (controllers/auth.js) against a throwaway Supabase
 * client, so no PKCE code verifier is ever created in the user's browser.
 * supabase-js also defaults to `flowType: 'implicit'`. GoTrue therefore answers
 * the emailed /auth/v1/verify link with a 303 to:
 *
 *     <emailRedirectTo>#access_token=...&refresh_token=...&type=signup
 *
 * — tokens in the URL FRAGMENT, not a `?code=`. Two consumers race for that
 * fragment: this page, and the shared Supabase client's `detectSessionInUrl`
 * (left enabled because the password-reset flow depends on it). The session can
 * therefore arrive by any of three routes, and all three are handled below:
 *   1. we read the tokens ourselves       -> setSession()
 *   2. supabase-js got there first        -> getSession()
 *   3. supabase-js is still mid-flight    -> onAuthStateChange()
 *
 * WHY THIS PAGE EXISTS
 * --------------------
 * `emailRedirectTo` used to point straight at /dashboard. supabase-js consumed
 * the fragment into its OWN storage key (`kolekto-supabase-session`), but the
 * Zustand auth store and axios read `kolekto-auth-token` — a different key. The
 * store saw no session, ProtectedRoute saw `user === null`, and a user who had
 * just verified their email was bounced to /login. This page is the bridge.
 */

type Phase = "working" | "success" | "failed" | "needs-resend";

/**
 * Hard ceiling on the whole callback. None of setSession/getSession/checkAuth
 * carries its own timeout, so without this a stalled network would leave the
 * user on the spinner indefinitely. Matches the axios client's 15s budget.
 */
const CALLBACK_TIMEOUT_MS = 15_000;

/**
 * How long to wait for detectSessionInUrl to announce a session before
 * concluding the link simply did not carry one.
 *
 * Deliberately much shorter than the watchdog: this path is "supabase-js may
 * still be parsing the fragment", which takes milliseconds when it is going to
 * happen at all. Making the user stare at a spinner for the full 15s to be told
 * their link is invalid is a bad trade, and the outer watchdog still covers the
 * genuinely-hung-network case.
 */
const LATE_SESSION_WAIT_MS = 4_000;

const valueProps = [
  { icon: Users, text: "Collect group payments in minutes" },
  { icon: ShieldCheck, text: "Secure, verified transactions every time" },
  { icon: Sparkles, text: "Instant receipts and live dashboards" },
];

/**
 * Read the auth payload the callback delivered.
 *
 * Supabase uses two shapes depending on the flow: tokens in the URL FRAGMENT
 * (implicit — what the confirmation email uses), or a `code` in the QUERY
 * string (PKCE). Errors arrive in either location too. Reading both means this
 * page keeps working if the project's flow type is ever changed.
 */
function readCallback(): {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  errorCode?: string;
  errorDescription?: string;
} {
  if (typeof window === "undefined") return {};

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const pick = (key: string) => hash.get(key) || query.get(key) || undefined;

  return {
    accessToken: pick("access_token"),
    refreshToken: pick("refresh_token"),
    code: pick("code"),
    errorCode: pick("error_code") || pick("error"),
    errorDescription: pick("error_description"),
  };
}

/** Strip the tokens out of the address bar so they are not left in history. */
function scrubUrl() {
  try {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch {
    /* non-fatal */
  }
}

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const emailFromUrl = searchParams.get("email") || "";

  const [phase, setPhase] = useState<Phase>("working");
  const [email, setEmail] = useState(emailFromUrl);
  const [resendPending, setResendPending] = useState(false);
  const { error, scrollKey, raise, raiseClassified, raiseValidation, clear } = useAuthError("verify");
  const { resendVerification } = useAuthStore() as any;

  // Guards for the callback effect.
  //
  // `ran` stops the ONE-TIME token exchange running twice: React 18 StrictMode
  // double-invokes effects, and a verification token that has already been
  // redeemed fails with "token not found" on the second attempt.
  //
  // `alive` says whether this component is still on screen, and is re-armed at
  // the top of EVERY effect run — including StrictMode's second run. That is
  // the whole point. The previous version used a `cancelled` flag captured in
  // the effect closure and set by the cleanup, which under StrictMode ran:
  //
  //     effect#1  -> ran = true, starts the async callback
  //     cleanup#1 -> cancelled = true      (StrictMode's simulated unmount)
  //     effect#2  -> `ran` is true, returns early; nothing resets `cancelled`
  //     async resolves -> every setPhase() sat behind `if (!cancelled)`
  //
  // so no terminal state was ever set and the page span its spinner forever —
  // even though the token HAD been redeemed and the account WAS verified, which
  // is exactly why affected users could sign in normally straight afterwards.
  // A ref survives the remount and can be re-armed; a closure variable cannot.
  const ran = useRef(false);
  const alive = useRef(true);
  const sessionEstablished = useRef(false);

  useEffect(() => {
    // Re-arm on every run, BEFORE the `ran` short-circuit below.
    alive.current = true;
    if (ran.current) {
      return () => {
        alive.current = false;
      };
    }
    ran.current = true;

    let settled = false;
    let unsubscribe: () => void = () => {};
    const timers: ReturnType<typeof setTimeout>[] = [];

    /**
     * The single exit point. Whichever path reaches it first wins; every later
     * caller is a no-op. This makes "the spinner always ends" a structural
     * property instead of something each branch has to remember to do.
     */
    const settle = (apply: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      timers.forEach(clearTimeout);
      if (!alive.current) return;
      apply();
    };

    const failWith = (title: string, message: string) =>
      settle(() => {
        setPhase("needs-resend");
        raiseClassified({ category: "user", title, message });
      });

    /**
     * Hand the user off to the app. If the auth store never resolved a user, an
     * SPA navigation would hit ProtectedRoute with `user === null` and bounce
     * straight back to /login — the very bug this page exists to fix. A full
     * page load re-runs the store's rehydration against the token just written,
     * so it always lands authenticated.
     */
    const handOff = () => {
      if (!alive.current) return;
      const hasUser = Boolean((useAuthStore.getState() as any)?.user);
      if (hasUser) {
        navigate(redirectTo, { replace: true });
      } else {
        window.location.assign(redirectTo);
      }
    };

    const succeed = () =>
      settle(() => {
        setPhase("success");
        toast.success("Email verified. Welcome to Kolekto!");
        // Brief pause so the confirmation is actually readable before we move.
        timers.push(setTimeout(handOff, 1200));
      });

    // ── Watchdog ────────────────────────────────────────────────────────────
    // No execution path may leave the user on the spinner. The awaited calls
    // below have no timeout of their own, so a stalled network would otherwise
    // hang here forever.
    timers.push(
      setTimeout(() => {
        if (!alive.current) return;
        if (sessionEstablished.current) {
          // The link was good and the session is stored — only the profile
          // lookup was slow. Let them in rather than blaming their link.
          succeed();
          return;
        }
        settle(() => {
          setPhase("failed");
          raiseClassified({
            category: "network",
            title: "This is taking longer than expected",
            message:
              "We couldn't finish confirming your email just now. Check your connection, then request a new verification link below.",
          });
        });
      }, CALLBACK_TIMEOUT_MS)
    );

    (async () => {
      const cb = readCallback();

      // ── The link itself was rejected by Supabase ────────────────────────
      if (cb.errorCode) {
        scrubUrl();
        failWith(
          "That verification link has expired",
          "This link has already been used or has expired. Enter your email below and we'll send you a fresh one."
        );
        return;
      }

      try {
        let session: any = null;

        if (cb.accessToken && cb.refreshToken) {
          // Route 1 — we read the fragment first.
          const { data, error: setErr } = await supabase.auth.setSession({
            access_token: cb.accessToken,
            refresh_token: cb.refreshToken,
          });
          if (setErr) throw setErr;
          session = data?.session ?? null;
        } else if (cb.code) {
          // PKCE, kept in case the project ever switches flow type.
          const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(cb.code);
          if (exErr) throw exErr;
          session = data?.session ?? null;
        } else {
          // Route 2 — detectSessionInUrl already parsed and stripped the
          // fragment. Ask the client for what it stored.
          const { data } = await supabase.auth.getSession();
          session = data?.session ?? null;

          if (!session?.access_token) {
            // Route 3 — it may still be mid-flight. Wait for it to announce the
            // session rather than declaring a good link dead. The watchdog
            // bounds this wait, so it cannot hang.
            session = await new Promise<any>((resolve) => {
              const { data: sub } = supabase.auth.onAuthStateChange((event: string, s: any) => {
                if (
                  s?.access_token &&
                  (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
                ) {
                  resolve(s);
                }
              });
              unsubscribe = () => sub?.subscription?.unsubscribe?.();
              // Bounded: give up and report an invalid link rather than
              // holding the spinner until the outer watchdog.
              timers.push(setTimeout(() => resolve(null), LATE_SESSION_WAIT_MS));
            });
          }
        }

        scrubUrl();

        if (!session?.access_token) {
          failWith(
            "We couldn't confirm this link",
            "This verification link is no longer valid. Enter your email below and we'll send you a new one."
          );
          return;
        }

        // ── Promote into the session storage the rest of the app reads ────
        // The Supabase client keeps its session under its own key; axios and
        // the auth store read `kolekto-auth-token`.
        sessionEstablished.current = true;
        localStorage.setItem("kolekto-auth-token", JSON.stringify(withOneHourExpiry(session)));

        // Resolve the real user through the backend so the store is populated
        // exactly as after a normal sign-in. A failure here is NOT a
        // verification failure — the account is verified either way — so it
        // must never strand the user; handOff() falls back to a full page load.
        try {
          await (useAuthStore.getState() as any).checkAuth();
        } catch {
          /* handled by handOff's fallback */
        }

        succeed();
      } catch (err: any) {
        scrubUrl();
        settle(() => {
          setPhase("failed");
          raise(err);
        });
      }
    })();

    return () => {
      // Deliberately does NOT clearTimeout the pending timers.
      //
      // Under StrictMode this cleanup runs between the two effect invocations,
      // and the second invocation short-circuits on `ran` without registering
      // anything new — so clearing here would destroy the watchdog and
      // reintroduce the infinite spinner by a different route. Instead every
      // timer callback (and settle itself) checks `alive`, so a timer that
      // fires after a genuine unmount is a harmless no-op. The longest
      // outstanding timer is CALLBACK_TIMEOUT_MS, so nothing leaks for long.
      alive.current = false;
      unsubscribe();
    };
    // Intentionally empty: this must run once, on mount, against the URL as it
    // was when the user arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    if (!email.trim()) {
      raiseValidation("Please enter your email address so we know where to send it.");
      return;
    }
    setResendPending(true);
    try {
      const { data, error: resendError } = await resendVerification(
        email,
        `${window.location.origin}/auth/verify?redirect=${encodeURIComponent(redirectTo)}`
      );
      if (resendError) {
        raise(resendError);
        return;
      }
      clear();
      toast.success(data?.message || "Verification email sent. Please check your inbox.");
    } finally {
      setResendPending(false);
    }
  };

  return (
    <AuthPageShell
      variant="login"
      title={
        phase === "success" ? (
          <>
            Email <span className="text-kolekto">verified</span>
          </>
        ) : (
          <>
            Verifying your <span className="text-kolekto">email</span>
          </>
        )
      }
      subtitle={
        phase === "working"
          ? "This will only take a moment."
          : phase === "success"
            ? "You're all set — taking you to Kolekto now."
            : "We couldn't finish verifying this link."
      }
      desktopTitle={
        <>
          One click and
          <br />
          you're in.
        </>
      }
      desktopSubtitle="Verifying your email keeps your Kolekto account and your collections secure."
      valueProps={valueProps}
      footerNote="Secure. Fast & Reliable"
    >
      <div className="space-y-6">
        <AuthErrorBanner error={error} scrollKey={scrollKey} actionPending={resendPending} />

        {phase === "working" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center" aria-live="polite">
            <Loader2 className="h-10 w-10 animate-spin text-kolekto" aria-hidden="true" />
            <p className="text-base text-slate-600">Confirming your email address…</p>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center" aria-live="polite">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-kolekto">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">You're verified</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Taking you to your dashboard…
              </p>
            </div>
          </div>
        )}

        {(phase === "needs-resend" || phase === "failed") && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <MailWarning className="h-7 w-7" />
              </span>
              <p className="text-sm leading-6 text-slate-600">
                Verification links can only be used once, and they expire after a
                while. Send yourself a fresh one below.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="verify-email" className="text-sm font-medium text-slate-900">
                Email address
              </label>
              <input
                id="verify-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              />
            </div>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendPending}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-kolekto to-emerald-500 text-base font-semibold text-white shadow-lg shadow-emerald-900/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {resendPending ? "Sending…" : "Send a new verification link"}
            </button>

            <p className="text-center text-sm text-slate-600">
              Already verified?{" "}
              <Link to="/login" className="font-medium text-kolekto hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </AuthPageShell>
  );
};

export default VerifyEmailPage;
