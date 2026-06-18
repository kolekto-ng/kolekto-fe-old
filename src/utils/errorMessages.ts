export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

const TECHNICAL_ERROR_PATTERNS = [
  /request failed/i,
  /status code/i,
  /^http\s+\d+/i,
  /non-2xx/i,
  /edge function/i,
  /internal server/i,
  /invalid payload/i,
  /supabase/i,
  /paystack api key/i,
  /jwt/i,
  /stack/i,
  /undefined is not/i,
  /cannot read properties/i,
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
  if (message.length > 160) return fallback;
  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}

