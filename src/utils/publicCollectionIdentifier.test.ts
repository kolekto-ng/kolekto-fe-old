import { describe, it, expect } from "vitest";
import { normalizePublicCollectionIdentifier as norm } from "./publicCollectionIdentifier";

// The exact identifiers from the 2026-08-18 incident.
const REAL_SLUG = "farstech-siwes-malete-86b80455";
const REAL_UUID = "86b80455-6684-477f-9830-6ce9a8d94da0";

describe("normalizePublicCollectionIdentifier", () => {
  it("recovers the incident input: a trailing ')' captured by a chat autolinker", () => {
    expect(norm(`${REAL_SLUG})`)).toBe(REAL_SLUG);
    // Same link after one extra encoding hop — exactly as PostgREST logged it
    // (slug=eq.farstech-siwes-malete-86b80455%29).
    expect(norm(`${REAL_SLUG}%29`)).toBe(REAL_SLUG);
  });

  it("leaves a clean slug untouched", () => {
    expect(norm(REAL_SLUG)).toBe(REAL_SLUG);
    expect(norm("siwes-ilorin-sango-area--853bca8d")).toBe("siwes-ilorin-sango-area--853bca8d");
    expect(norm("engineering-marathon-nights-1")).toBe("engineering-marathon-nights-1");
  });

  it("leaves a clean UUID untouched and recovers a bracketed one", () => {
    expect(norm(REAL_UUID)).toBe(REAL_UUID);
    expect(norm(`${REAL_UUID})`)).toBe(REAL_UUID);
  });

  it("strips the other punctuation autolinkers append to a URL in prose", () => {
    for (const tail of [".", ",", ";", ":", "]", "}", ">", '"', "'", "!", "?"]) {
      expect(norm(REAL_SLUG + tail)).toBe(REAL_SLUG);
    }
    expect(norm(`${REAL_SLUG}).`)).toBe(REAL_SLUG);
    expect(norm(`(${REAL_SLUG})`)).toBe(REAL_SLUG);
  });

  it("strips whitespace, zero-width and bidi marks pasted from chat apps", () => {
    expect(norm(`  ${REAL_SLUG}  `)).toBe(REAL_SLUG);
    expect(norm(`${REAL_SLUG}​`)).toBe(REAL_SLUG);
    expect(norm(`‪${REAL_SLUG}‬`)).toBe(REAL_SLUG);
    expect(norm(`${REAL_SLUG}\n`)).toBe(REAL_SLUG);
  });

  it("drops a trailing slash, query or fragment", () => {
    expect(norm(`${REAL_SLUG}/`)).toBe(REAL_SLUG);
    expect(norm(`${REAL_SLUG}/?utm_source=whatsapp`)).toBe(REAL_SLUG);
    expect(norm(`${REAL_SLUG}#pay`)).toBe(REAL_SLUG);
  });

  it("folds case, rescuing links auto-capitalized by mobile keyboards", () => {
    expect(norm("FARSTECH-SIWES-MALETE-86B80455")).toBe(REAL_SLUG);
    expect(norm("Farstech-Siwes-Malete-86b80455")).toBe(REAL_SLUG);
  });

  it("preserves boundary hyphens — the slug trigger can emit them", () => {
    // lower(regexp_replace(title,'[^a-zA-Z0-9]+','-','g')) does not trim ends,
    // so a title starting/ending in punctuation yields a boundary hyphen.
    expect(norm("-leading-hyphen-abc12")).toBe("-leading-hyphen-abc12");
    expect(norm("trailing-hyphen-")).toBe("trailing-hyphen-");
    expect(norm("(-leading-hyphen-abc12)")).toBe("-leading-hyphen-abc12");
  });

  it("never rewrites the interior — no fuzzy matching between collections", () => {
    expect(norm("farstech siwes malete 86b80455")).toBe("farstech siwes malete 86b80455");
    expect(norm("farstech_siwes_malete_86b80455")).toBe("farstech_siwes_malete_86b80455");
    expect(norm("siwes-malete-da3e3a24")).not.toBe(REAL_SLUG);
  });

  it("leaves a genuinely unknown identifier unknown, so it still 404s", () => {
    expect(norm("does-not-exist-123")).toBe("does-not-exist-123");
    expect(norm("does-not-exist-123)")).toBe("does-not-exist-123");
  });

  it("returns '' for empty / missing / punctuation-only input", () => {
    expect(norm(null)).toBe("");
    expect(norm(undefined)).toBe("");
    expect(norm("")).toBe("");
    expect(norm("   ")).toBe("");
    expect(norm(")")).toBe("");
    expect(norm("()")).toBe("");
    expect(norm("/")).toBe("");
  });

  it("does not throw on a malformed percent escape", () => {
    expect(() => norm("%E0%A4%A")).not.toThrow();
    expect(norm(`${REAL_SLUG}%`)).toBe(REAL_SLUG);
  });

  it("is idempotent", () => {
    for (const input of [`${REAL_SLUG})`, `${REAL_SLUG}%29`, `  ${REAL_SLUG}/ `, REAL_UUID]) {
      expect(norm(norm(input))).toBe(norm(input));
    }
  });

  it("agrees with the backend copy on every incident-shaped input", () => {
    // Mirrors kolekto-be-old/utils/publicCollectionIdentifier.js — the two must
    // not drift, or the client and server would disagree about which collection
    // a link refers to.
    const cases: Array<[string, string]> = [
      [`${REAL_SLUG})`, REAL_SLUG],
      [`${REAL_SLUG}%29`, REAL_SLUG],
      [`${REAL_SLUG}/`, REAL_SLUG],
      [REAL_SLUG.toUpperCase(), REAL_SLUG],
      [`${REAL_UUID})`, REAL_UUID],
      ["does-not-exist-123)", "does-not-exist-123"],
      [")", ""],
    ];
    for (const [input, expected] of cases) {
      expect(norm(input)).toBe(expected);
    }
  });
});
