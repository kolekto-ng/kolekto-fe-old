/**
 * utils/authErrors.ts — the auth error taxonomy.
 *
 * WHY THIS EXISTS
 * ---------------
 * Auth failures were being funnelled through `toFriendlyErrorMessage`, which is
 * a *last-resort sanitiser*: it exists to stop a raw technical string reaching
 * the UI, so its answer to anything it does not recognise is a single generic
 * sentence. For auth that is precisely the wrong shape — the five things a user
 * can be told ("you're offline", "that email is taken", "verify your inbox",
 * "wrong password", "we broke") demand five DIFFERENT actions, and collapsing
 * them into "Registration failed. Please try again." makes the product
 * unusable: the user retries the one thing that cannot work.
 *
 * This module classifies FIRST and falls back to sanitising only for genuinely
 * unrecognised failures. It is the single source of auth copy for both forms.
 *
 * Classification order is deliberate:
 *   1. Transport   — no HTTP response at all. Nothing about the user's input
 *                    was ever evaluated, so it must never be blamed on them.
 *   2. Server code — the backend's stable `code` (utils/authErrors.js). The
 *                    only signal that survives rewording anywhere upstream.
 *   3. HTTP status — 429/5xx, which are unambiguous.
 *   4. Message text — last, because it is the least stable signal.
 */

export type AuthErrorCategory =
  | "network"    // A — connectivity/transport
  | "user"       // B — the user must change something
  | "service"    // C — identity provider / configuration
  | "backend"    // D — Kolekto API
  | "ratelimit"  // E — throttled
  | "unknown";

export interface AuthErrorAction {
  label: string;
  /** Router path, when the next step is somewhere else in the app. */
  to?: string;
  /** Named intent the form handles itself (e.g. resending a verification email). */
  intent?: "resend-verification" | "retry";
}

export interface ClassifiedAuthError {
  category: AuthErrorCategory;
  /** Short heading, e.g. "Connection problem". */
  title: string;
  /** The actionable sentence(s) under the title. */
  message: string;
  /** Optional next step rendered as a link/button in the banner. */
  action?: AuthErrorAction;
  /** Stable backend code when one was present — for logging, never displayed. */
  code?: string;
  /** HTTP status when one was received — for logging, never displayed. */
  status?: number;
  /**
   * True when the Auth account was (or may have been) created despite this
   * failure. The UI must NOT tell these users that registration failed
   * outright — that sends them into a retry loop ending in "email exists".
   */
  accountMayExist?: boolean;
}

/** Backend codes — must stay in sync with kolekto-be-old/utils/authErrors.js. */
export const AUTH_CODES = {
  EMAIL_EXISTS: "AUTH_EMAIL_EXISTS",
  EMAIL_NOT_CONFIRMED: "AUTH_EMAIL_NOT_CONFIRMED",
  INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  EMAIL_ADDRESS_INVALID: "AUTH_EMAIL_ADDRESS_INVALID",
  WEAK_PASSWORD: "AUTH_WEAK_PASSWORD",
  VALIDATION_FAILED: "AUTH_VALIDATION_FAILED",
  CAPTCHA_REQUIRED: "AUTH_CAPTCHA_REQUIRED",
  CAPTCHA_FAILED: "AUTH_CAPTCHA_FAILED",
  INVALID_REFERRAL_CODE: "AUTH_INVALID_REFERRAL_CODE",
  OTP_EXPIRED: "AUTH_OTP_EXPIRED",
  RATE_LIMITED: "AUTH_RATE_LIMITED",
  PROVIDER_DISABLED: "AUTH_PROVIDER_DISABLED",
  SIGNUPS_DISABLED: "AUTH_SIGNUPS_DISABLED",
  EMAIL_SEND_FAILED: "AUTH_EMAIL_SEND_FAILED",
  PROVIDER_UNAVAILABLE: "AUTH_PROVIDER_UNAVAILABLE",
  SERVER_ERROR: "AUTH_SERVER_ERROR",
  PROFILE_UNAVAILABLE: "AUTH_PROFILE_UNAVAILABLE",
  SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
  UNKNOWN: "AUTH_UNKNOWN",
} as const;

type Copy = Omit<ClassifiedAuthError, "code" | "status">;

const SIGNIN_COPY: Record<string, Copy> = {
  [AUTH_CODES.EMAIL_NOT_CONFIRMED]: {
    category: "user",
    title: "Verify your email to continue",
    message:
      "Your account exists, but the email address hasn't been verified yet. Check your inbox (and your spam folder) for the verification link, then sign in again.",
    action: { label: "Resend verification email", intent: "resend-verification" },
    accountMayExist: true,
  },
  [AUTH_CODES.INVALID_CREDENTIALS]: {
    category: "user",
    title: "Sign-in details not recognised",
    message: "The email or password is incorrect. Please check your details and try again.",
    action: { label: "Reset your password", to: "/forgot-password" },
  },
  [AUTH_CODES.PROFILE_UNAVAILABLE]: {
    category: "backend",
    title: "Signed in, but your profile didn't load",
    message: "You're signed in, but we couldn't load your profile just now. Please refresh in a moment.",
  },
};

const SIGNUP_COPY: Record<string, Copy> = {
  [AUTH_CODES.EMAIL_EXISTS]: {
    category: "user",
    title: "That email is already registered",
    message: "An account with this email already exists. Try signing in instead.",
    action: { label: "Go to sign in", to: "/login" },
    accountMayExist: true,
  },
  [AUTH_CODES.WEAK_PASSWORD]: {
    category: "user",
    title: "Choose a stronger password",
    message: "Please pick a longer password with a mix of letters, numbers and symbols.",
  },
  [AUTH_CODES.EMAIL_ADDRESS_INVALID]: {
    category: "user",
    title: "Check your email address",
    message: "That email address doesn't look valid. Please check it and try again.",
  },
  [AUTH_CODES.INVALID_REFERRAL_CODE]: {
    category: "user",
    title: "Referral code not recognised",
    message: "That ambassador referral code wasn't recognised. Check the code, or clear the field to continue without one.",
  },
  [AUTH_CODES.CAPTCHA_REQUIRED]: {
    category: "user",
    title: "One more security check",
    message: "Please complete the checkbox below to confirm you're not a robot, then we'll finish creating your account.",
  },
  [AUTH_CODES.CAPTCHA_FAILED]: {
    category: "user",
    title: "Security check failed",
    message: "The security check couldn't be completed. Please try it again.",
  },
  [AUTH_CODES.SIGNUPS_DISABLED]: {
    category: "service",
    title: "Registrations are paused",
    message: "New registrations are temporarily closed. Please try again later.",
  },
  [AUTH_CODES.EMAIL_SEND_FAILED]: {
    category: "service",
    title: "We couldn't send your verification email",
    message:
      "Your account may have been created, but we couldn't send the verification email right now. Please wait a moment and use 'Resend verification email' rather than registering again.",
    action: { label: "Resend verification email", intent: "resend-verification" },
    accountMayExist: true,
  },
};

const SHARED_COPY: Record<string, Copy> = {
  [AUTH_CODES.VALIDATION_FAILED]: {
    category: "user",
    title: "Check your details",
    message: "Please check the details you entered and try again.",
  },
  [AUTH_CODES.OTP_EXPIRED]: {
    category: "user",
    title: "That link has expired",
    message: "This link has expired or has already been used. Please request a new one.",
    action: { label: "Resend verification email", intent: "resend-verification" },
  },
  [AUTH_CODES.RATE_LIMITED]: {
    category: "ratelimit",
    title: "Too many attempts",
    message: "Too many attempts were made. Please wait a few minutes and try again.",
  },
  [AUTH_CODES.PROVIDER_DISABLED]: {
    category: "service",
    title: "Sign-in is temporarily unavailable",
    message: "This sign-in method is temporarily unavailable. Please try again shortly.",
  },
  [AUTH_CODES.PROVIDER_UNAVAILABLE]: {
    category: "service",
    title: "We can't reach our sign-in service",
    message: "We're having trouble reaching our sign-in service. Please try again in a moment.",
  },
  [AUTH_CODES.SERVER_ERROR]: {
    category: "backend",
    title: "Something went wrong on our side",
    message: "We couldn't complete your request right now. Please try again in a moment.",
  },
  [AUTH_CODES.SESSION_EXPIRED]: {
    category: "user",
    title: "Your session has expired",
    message: "Please sign in again to continue.",
  },
};

const NETWORK_ERROR: Copy = {
  category: "network",
  title: "Connection problem",
  message:
    "You appear to be offline, or your internet connection dropped. Check your connection and try again — nothing was submitted.",
  action: { label: "Try again", intent: "retry" },
};

const TIMEOUT_ERROR: Copy = {
  category: "network",
  title: "That took too long",
  message:
    "The request timed out before we heard back. Check your connection and try again in a moment.",
  action: { label: "Try again", intent: "retry" },
};

const UNKNOWN_SIGNUP: Copy = {
  category: "unknown",
  title: "Something unexpected happened",
  message:
    "Something unexpected happened while creating your account. Please try again. If the problem continues, contact Kolekto support.",
};

const UNKNOWN_SIGNIN: Copy = {
  category: "unknown",
  title: "Something unexpected happened",
  message:
    "Something unexpected happened while signing you in. Please try again. If the problem continues, contact Kolekto support.",
};

export type AuthOperation = "signup" | "signin" | "verify" | "resend" | "reset";

/**
 * Is this a transport failure — i.e. we never received an HTTP response?
 *
 * axios reports these with NO `error.response`. Distinguishing them matters
 * more than any other branch here: a request that never left the device is not
 * a wrong password, and telling the user to "check their details" when their
 * wifi dropped is the single most misleading thing the UI can do.
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  if (error.response) return false; // we got an answer — not a transport failure

  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;

  const code = String(error.code || "");
  if (["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED", "ERR_INTERNET_DISCONNECTED"].includes(code)) {
    return true;
  }

  return /network error|failed to fetch|load failed|timeout|net::|fetch failed/i.test(
    String(error.message || "")
  );
}

function isTimeout(error: any): boolean {
  return (
    String(error?.code || "") === "ECONNABORTED" ||
    /timeout/i.test(String(error?.message || ""))
  );
}

/**
 * Classify any auth failure into something a human can act on.
 *
 * `error` may be an axios error, a plain `{ code, message }` from the auth
 * store, or anything thrown. All three shapes occur in practice.
 */
export function classifyAuthError(error: any, operation: AuthOperation): ClassifiedAuthError {
  // ── 1. Transport ────────────────────────────────────────────────────────
  if (isNetworkError(error)) {
    const copy = isTimeout(error) ? TIMEOUT_ERROR : NETWORK_ERROR;
    return { ...copy };
  }

  const status: number | undefined = error?.response?.status ?? error?.status;
  const code: string | undefined =
    error?.response?.data?.code ?? error?.code ?? undefined;

  // ── 2. Stable backend code ──────────────────────────────────────────────
  const table = operation === "signup" ? SIGNUP_COPY : SIGNIN_COPY;
  const byCode = (code && (table[code] || SHARED_COPY[code])) || undefined;
  if (byCode) return { ...byCode, code, status };

  // ── 3. HTTP status ──────────────────────────────────────────────────────
  if (status === 429) return { ...SHARED_COPY[AUTH_CODES.RATE_LIMITED], code, status };
  // 404 on an auth endpoint is never a statement about the user's account — it
  // means the ROUTE is missing, i.e. the frontend is talking to a backend that
  // does not have this endpoint (a stale or older deployment). Surfacing the
  // raw body rendered as "We couldn't complete that / Not found", which reads
  // as "your email was not found" and sent people chasing the wrong problem.
  if (status === 404) {
    return {
      category: "service",
      title: "This feature isn't available right now",
      message:
        "We couldn't reach that part of Kolekto. Please try again in a few minutes, and contact support if it keeps happening.",
      code,
      status,
    };
  }
  if (status && status >= 500) {
    return {
      ...SHARED_COPY[AUTH_CODES.SERVER_ERROR],
      code,
      status,
      // A 5xx AFTER the account-creation call may have left an account behind.
      // Never assert a clean failure we cannot prove.
      accountMayExist: operation === "signup",
    };
  }

  // ── 4. Message text (least stable) ──────────────────────────────────────
  const raw = String(
    error?.response?.data?.message || error?.response?.data?.error || error?.message || ""
  );

  if (operation === "signup" && /already (registered|exists)/i.test(raw)) {
    return { ...SIGNUP_COPY[AUTH_CODES.EMAIL_EXISTS], code, status };
  }
  if (/not confirmed|verify your email/i.test(raw)) {
    return { ...SIGNIN_COPY[AUTH_CODES.EMAIL_NOT_CONFIRMED], code, status };
  }
  if (/invalid login credentials|email or password/i.test(raw)) {
    return { ...SIGNIN_COPY[AUTH_CODES.INVALID_CREDENTIALS], code, status };
  }
  if (/too many/i.test(raw)) {
    return { ...SHARED_COPY[AUTH_CODES.RATE_LIMITED], code, status };
  }
  if (/recaptcha|captcha|security check/i.test(raw)) {
    return { ...SIGNUP_COPY[AUTH_CODES.CAPTCHA_FAILED], code, status };
  }

  // A message the backend wrote for a human (short, no technical markers) is
  // better than our generic fallback — surface it under a neutral title.
  if (raw && raw.length <= 160 && !LOOKS_TECHNICAL.test(raw)) {
    return {
      category: operation === "signup" ? "unknown" : "unknown",
      title: "We couldn't complete that",
      message: raw,
      code,
      status,
    };
  }

  return {
    ...(operation === "signup" ? UNKNOWN_SIGNUP : UNKNOWN_SIGNIN),
    code,
    status,
  };
}

/**
 * Markers that a string is a technical artefact rather than copy meant for a
 * user. Anything matching is replaced with our own wording — raw stack traces,
 * SQL errors, JWT internals and Supabase internals must never reach the UI.
 */
const LOOKS_TECHNICAL =
  /^not found$|axioserror|request failed|status code|\b[45]\d\d\b|supabase|postgres|jwt|sql|stack|cannot read propert|undefined is not|duplicate key|constraint|gotrue|edge function|database|error saving|internal server|relation "|column "|violates/i;

/** Local (pre-submit) validation failures share the banner's shape. */
export function validationError(message: string, title = "Check your details"): ClassifiedAuthError {
  return { category: "user", title, message };
}

/**
 * Structured, PII-safe log line for a production auth failure.
 *
 * Records ONLY the classification — operation, category, backend code, HTTP
 * status. Never the password, the email, tokens, or the raw provider error.
 */
export function logAuthFailure(
  operation: AuthOperation,
  classified: ClassifiedAuthError,
  extra?: Record<string, unknown>
): void {
  try {
    // eslint-disable-next-line no-console
    console.warn("[auth]", {
      op: operation,
      category: classified.category,
      code: classified.code ?? null,
      status: classified.status ?? null,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      at: new Date().toISOString(),
      ...extra,
    });
  } catch {
    // Logging must never break an auth flow.
  }
}
