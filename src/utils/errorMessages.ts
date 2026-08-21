export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
export const NETWORK_ERROR_MESSAGE = "Unable to connect. Check your internet and try again.";
export const ACTION_ERROR_MESSAGE = "We could not complete this action. Please try again.";

const TECHNICAL_ERROR_PATTERNS = [
  /^axioserror/i,
  /^error:/i,
  /request failed/i,
  /status code/i,
  /^http\s+\d+/i,
  /\b4\d\d\b/,
  /\b5\d\d\b/,
  /non-2xx/i,
  /edge function/i,
  /internal server/i,
  /unexpected server/i,
  /server error/i,
  /network error/i,
  /failed to fetch/i,
  /load failed/i,
  /timeout/i,
  /econn/i,
  /enotfound/i,
  /etimedout/i,
  /invalid payload/i,
  /supabase/i,
  /paystack api key/i,
  /cast ?error/i,
  /validation ?error/i,
  /syntaxerror/i,
  /jwt/i,
  /stack/i,
  /undefined is not/i,
  /cannot read properties/i,
  /database/i,
  /duplicate key/i,
];

const FRIENDLY_ERROR_MAPPINGS: Array<[RegExp, string]> = [
  [/network error|failed to fetch|load failed|timeout|econn|enotfound|etimedout/i, NETWORK_ERROR_MESSAGE],
  // A saved bank account whose encrypted number can no longer be read. Keep the
  // actionable "remove and re-add" guidance — it must come before the generic
  // "bank account" / "withdrawal" mappings below so it is not swallowed.
  [/older format|can no longer be decrypted|unrecoverable/i, "This saved bank account can't be used anymore. Please remove it in your bank settings and add it again, then try the withdrawal."],
  // Server-side encryption key missing/misconfigured: never leak the raw
  // technical message to the user.
  [/encryption (is )?unavailable|account encryption|misconfiguration|encryption_unavailable/i, "Bank features are temporarily unavailable. Please try again shortly, and contact support if it continues."],
  [/invalid login credentials|invalid email or password|email not confirmed/i, "Please check your login details and try again."],
  [/unauthorized|not authenticated|invalid or expired token|no token/i, "Your session expired. Please sign in again."],
  [/too many/i, "Too many attempts. Please try again later."],
  [/recaptcha|captcha/i, "Please complete the security check and try again."],
  [/payment|paystack|gateway/i, "We could not start your payment. Please try again."],
  [/withdrawal/i, "We could not send the withdrawal request. Please try again."],
  [/bank account|account number|resolve account|verify account/i, "We could not verify that bank account."],
  [/kyc|bvn|nin/i, "We could not verify your details. Please try again."],
];

function extractMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;

  const err = error as any;
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    ""
  );
}

export function toFriendlyErrorMessage(error: unknown, fallback = GENERIC_ERROR_MESSAGE): string {
  const message = String(extractMessage(error) || "").trim();
  if (!message) return fallback;
  for (const [pattern, friendlyMessage] of FRIENDLY_ERROR_MAPPINGS) {
    if (pattern.test(message)) return friendlyMessage;
  }
  if (message.length > 140) return fallback;
  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}

export function toFriendlyActionError(error: unknown): string {
  return toFriendlyErrorMessage(error, ACTION_ERROR_MESSAGE);
}

// KYC upload hardening: uploads are large multipart requests on a dedicated,
// longer timeout (see axios.tsx), so "it took too long" and "there's no
// connection" are genuinely different situations for this one flow and
// deserve different copy — the generic NETWORK_ERROR_MESSAGE collapses both
// into the same misleading "check your internet" message. Falls back to
// toFriendlyErrorMessage for anything not specific to uploads.
export function toKycUploadErrorMessage(error: unknown): string {
  const err = error as any;

  if (err?.code === "ECONNABORTED" || /timeout/i.test(String(err?.message || ""))) {
    return "Upload is taking longer than expected. Please keep this page open while we finish uploading your documents.";
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Your internet connection appears to be unavailable.";
  }

  // Branch on the backend's stable error CODE before anything else. The
  // backend now distinguishes a business conflict (this NIN belongs to
  // someone else) from each infrastructure failure stage, so the UI must
  // stop collapsing all of them into one "Upload failed" message — that
  // ambiguity is precisely what made the identity-KYC incident unreadable
  // for users and support alike. See KYC_ERROR_CODES in the backend's
  // controllers/settings/kyc.js.
  const code = err?.response?.data?.code;
  const KYC_CODE_MESSAGES: Record<string, string> = {
    KYC_NIN_ALREADY_REGISTERED:
      "This NIN is already registered to a different Kolekto account. Please check the number you entered, or contact support if you believe this is a mistake.",
    ENCRYPTION_NOT_CONFIGURED:
      "Identity verification is temporarily unavailable. Please try again in a few minutes — your documents were not submitted.",
    KYC_DOCUMENT_UPLOAD_FAILED:
      "We couldn't save your documents. Nothing was submitted, so please try again.",
    KYC_VERIFICATION_CREATE_FAILED:
      "We couldn't start your verification. Nothing was submitted, so please try again.",
    KYC_IDENTITY_PERSISTENCE_FAILED:
      "We couldn't save your identity details. Nothing was submitted, so please try again.",
  };
  if (code && KYC_CODE_MESSAGES[code]) return KYC_CODE_MESSAGES[code];

  const status = err?.response?.status;
  if (status === 413) return "One of your files is too large.";
  if (status === 415) return "One of your files is not supported.";
  if (status === 503) return "Verification is temporarily unavailable. Please try again in a few minutes.";
  if (status === 500) return "We couldn't upload your documents. Please try again.";

  return toFriendlyErrorMessage(error, "Could not upload document. Please try again.");
}

// Whether a KYC upload failure is a business decision the user must act on
// (a conflicting NIN) rather than a transient failure they should just retry.
// Drives the toast TITLE — "Upload Failed" on a NIN conflict is actively
// misleading, since the upload itself was never the problem.
export function isKycConflictError(error: unknown): boolean {
  const err = error as any;
  return (
    err?.response?.status === 409 ||
    err?.response?.data?.code === "KYC_NIN_ALREADY_REGISTERED"
  );
}
