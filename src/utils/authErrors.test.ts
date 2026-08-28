import { describe, it, expect, afterEach, vi } from "vitest";
import { classifyAuthError, isNetworkError, AUTH_CODES } from "./authErrors";

/**
 * authErrors.test.ts — the auth error taxonomy.
 *
 * WHY THESE EXIST
 * The production incident was not that auth failed; it was that every DIFFERENT
 * failure produced the SAME sentence, so the user never learned what to do. The
 * property worth pinning is therefore not "an error is returned" but "distinct
 * failures stay distinct, and each one is actionable".
 *
 * Every test below names a real failure mode observed in the production Supabase
 * Auth logs or reachable from the code paths in controllers/auth.js.
 */

/** An axios error that got an HTTP response. */
function httpError(status: number, data: any) {
  return { isAxiosError: true, response: { status, data }, message: `Request failed with status code ${status}` };
}

/** An axios error where the request never got an answer. */
function transportError(code: string, message = "Network Error") {
  return { isAxiosError: true, code, message, response: undefined };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("category A — network / connectivity", () => {
  it("classifies ERR_NETWORK as network, never as a credential problem", () => {
    const result = classifyAuthError(transportError("ERR_NETWORK"), "signin");
    expect(result.category).toBe("network");
    expect(result.title).toBe("Connection problem");
    // The critical property: it must not tell the user their details are wrong.
    expect(result.message).not.toMatch(/password|details/i);
  });

  it("classifies a timeout distinctly from a dead connection", () => {
    const result = classifyAuthError(transportError("ECONNABORTED", "timeout of 15000ms exceeded"), "signup");
    expect(result.category).toBe("network");
    expect(result.title).toBe("That took too long");
  });

  it("treats navigator.onLine === false as offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isNetworkError({ message: "boom" })).toBe(true);
  });

  it("does NOT treat an HTTP error response as a network failure", () => {
    // A 400 means we reached the server — the user's input was evaluated.
    expect(isNetworkError(httpError(400, { code: AUTH_CODES.INVALID_CREDENTIALS }))).toBe(false);
  });
});

describe("category B — user/action problems stay distinct", () => {
  it("email already exists points the user at sign-in", () => {
    const result = classifyAuthError(httpError(409, { code: AUTH_CODES.EMAIL_EXISTS }), "signup");
    expect(result.category).toBe("user");
    expect(result.message).toMatch(/already exists/i);
    expect(result.action?.to).toBe("/login");
    // Their account is real — never imply the registration vanished.
    expect(result.accountMayExist).toBe(true);
  });

  it("email NOT CONFIRMED is different from INVALID CREDENTIALS", () => {
    const notConfirmed = classifyAuthError(httpError(403, { code: AUTH_CODES.EMAIL_NOT_CONFIRMED }), "signin");
    const badPassword = classifyAuthError(httpError(401, { code: AUTH_CODES.INVALID_CREDENTIALS }), "signin");

    // THE regression guard for this incident. These two collapsed into the
    // identical string ("Please check your login details and try again."),
    // which sent 196 unverified production users to reset a working password.
    expect(notConfirmed.message).not.toBe(badPassword.message);
    expect(notConfirmed.title).not.toBe(badPassword.title);

    expect(notConfirmed.message).toMatch(/verif/i);
    expect(notConfirmed.message).toMatch(/inbox|spam/i);
    expect(notConfirmed.action?.intent).toBe("resend-verification");

    expect(badPassword.message).toMatch(/email or password is incorrect/i);
    expect(badPassword.action?.to).toBe("/forgot-password");
  });

  it("weak password tells the user to strengthen it", () => {
    const result = classifyAuthError(httpError(400, { code: AUTH_CODES.WEAK_PASSWORD }), "signup");
    expect(result.category).toBe("user");
    expect(result.title).toMatch(/stronger password/i);
  });

  it("an invalid email address is reported as such", () => {
    const result = classifyAuthError(httpError(400, { code: AUTH_CODES.EMAIL_ADDRESS_INVALID }), "signup");
    expect(result.message).toMatch(/valid/i);
  });

  it("an expired verification link offers a resend", () => {
    const result = classifyAuthError(httpError(400, { code: AUTH_CODES.OTP_EXPIRED }), "signin");
    expect(result.title).toMatch(/expired/i);
    expect(result.action?.intent).toBe("resend-verification");
  });
});

describe("category C — provider/service problems", () => {
  it("provider unavailable is a service problem, not the user's fault", () => {
    const result = classifyAuthError(httpError(503, { code: AUTH_CODES.PROVIDER_UNAVAILABLE }), "signin");
    expect(result.category).toBe("service");
    expect(result.message).not.toMatch(/your (details|password)/i);
  });

  it("a failed verification email does NOT claim registration failed", () => {
    const result = classifyAuthError(httpError(502, { code: AUTH_CODES.EMAIL_SEND_FAILED }), "signup");
    expect(result.accountMayExist).toBe(true);
    expect(result.message).toMatch(/may have been created/i);
    // It must steer to resend, not to registering again (which would then fail
    // with "email already exists" — the dead end users actually hit).
    expect(result.action?.intent).toBe("resend-verification");
  });

  it("signups disabled is reported as a service state", () => {
    const result = classifyAuthError(httpError(403, { code: AUTH_CODES.SIGNUPS_DISABLED }), "signup");
    expect(result.category).toBe("service");
  });
});

describe("category D — Kolekto backend problems", () => {
  it("an unknown 500 on signup admits the account may exist", () => {
    const result = classifyAuthError(httpError(500, {}), "signup");
    expect(result.category).toBe("backend");
    // We cannot prove the account was not created, so we must not claim it.
    expect(result.accountMayExist).toBe(true);
  });

  it("a 500 on sign-in does not claim the account may exist", () => {
    const result = classifyAuthError(httpError(500, {}), "signin");
    // Falsy is the contract — sign-in never creates an account.
    expect(result.accountMayExist).toBeFalsy();
  });
});

describe("category E — rate limiting", () => {
  it("maps a 429 with no code to the rate-limit message", () => {
    const result = classifyAuthError(httpError(429, {}), "signup");
    expect(result.category).toBe("ratelimit");
    expect(result.message).toMatch(/wait a few minutes/i);
  });

  it("maps the backend RATE_LIMITED code", () => {
    const result = classifyAuthError(httpError(429, { code: AUTH_CODES.RATE_LIMITED }), "signin");
    expect(result.category).toBe("ratelimit");
  });
});

describe("nothing technical ever reaches the user", () => {
  const leaky = [
    "AxiosError: Request failed with status code 500",
    "Cannot read properties of null (reading 'requireV2')",
    'duplicate key value violates unique constraint "profiles_pkey"',
    "Database error saving new user",
    "JWT expired at 1730000000",
    "supabase.auth.signUp failed",
    "PostgREST error PGRST116",
  ];

  it.each(leaky)("replaces %s with safe copy", (raw) => {
    const result = classifyAuthError({ message: raw }, "signup");
    expect(result.message).not.toContain(raw);
    expect(result.message).not.toMatch(/supabase|postgres|jwt|constraint|axios|null/i);
    expect(result.title).toBeTruthy();
  });

  it("passes through a short, human backend message under a neutral title", () => {
    const result = classifyAuthError(
      httpError(400, { message: "Please enter a phone number we can reach you on." }),
      "signup"
    );
    expect(result.message).toBe("Please enter a phone number we can reach you on.");
  });
});

describe("a missing backend route is never blamed on the user", () => {
  it("maps 404 to a service problem, not an account problem", () => {
    // The real incident: the deployed backend lacked /auth/resend-verification,
    // so the UI showed "We couldn't complete that / Not found" — which reads as
    // "your email was not found".
    const result = classifyAuthError(
      { response: { status: 404, data: { error: "Not found", requestId: "abc" } } },
      "signin"
    );
    expect(result.category).toBe("service");
    expect(result.message.toLowerCase()).not.toContain("not found");
    expect(result.message).not.toMatch(/email|account|password/i);
  });

  it("never surfaces a bare 'Not found' body as user copy", () => {
    const result = classifyAuthError({ message: "Not found" }, "signup");
    expect(result.message).not.toBe("Not found");
  });
});

describe("unknown failures still say something actionable", () => {
  it("falls back to operation-specific unknown copy", () => {
    const result = classifyAuthError({}, "signup");
    expect(result.category).toBe("unknown");
    expect(result.message).toMatch(/contact Kolekto support/i);
  });

  it("never returns an empty message for any input", () => {
    for (const input of [null, undefined, {}, "", 0, new Error(""), { response: { status: 418, data: {} } }]) {
      const result = classifyAuthError(input, "signin");
      expect(result.message.length).toBeGreaterThan(10);
      expect(result.title.length).toBeGreaterThan(3);
    }
  });
});
