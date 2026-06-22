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
