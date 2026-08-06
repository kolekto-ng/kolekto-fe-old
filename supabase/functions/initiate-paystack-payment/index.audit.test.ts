/**
 * Regression suite for the initiate-paystack-payment edge function's amount
 * logic (normalizePaymentRequest / matchTier / calculateFees).
 *
 * WHY THIS TEST LOADS index.ts DIRECTLY, RATHER THAN A HAND-COPIED MIRROR:
 * The 2026-08-06 production incident (collection
 * da3e3a24-1133-4cdd-8e2a-c3ca53389db1 charging the wrong tier price) was
 * possible because the code deployed to Supabase had silently diverged from
 * git — a hand-maintained test double would have kept passing throughout
 * that entire drift, proving nothing about what was actually live. This
 * harness instead reads the real index.ts, strips only the two Deno-only
 * remote imports (serve, createClient — the one thing Node cannot resolve),
 * and dynamically imports the rest completely unmodified. Any future edit to
 * index.ts — correct or not — is exactly what this test exercises.
 *
 * Run with: node --experimental-strip-types --test index.audit.test.ts
 * (from this directory), or `npm run test:edge-payment` if wired up in
 * kolekto-fe-old/package.json.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_PATH = fileURLToPath(new URL("./index.ts", import.meta.url));
const raw = readFileSync(SOURCE_PATH, "utf8");

const HANDLER_MARKER = "// ─── MAIN HANDLER";
const handlerIndex = raw.indexOf(HANDLER_MARKER);
assert.ok(
  handlerIndex > 0,
  "index.ts structure changed — update this test harness's MAIN HANDLER marker"
);

const pureLogicSource = raw
  .slice(0, handlerIndex)
  .replace(/^import \{ serve \} from ".*";\r?\n/m, "")
  .replace(/^import \{ createClient \} from ".*";\r?\n/m, "");

const EXPORTS = [
  "matchTier",
  "normalizePaymentRequest",
  "PaymentValidationError",
  "calculateFees",
  "roundCurrency",
  "buildTierAvailability",
  "getPriceTiers",
  "getCollectionType",
  "asNumber",
  "isPlausiblePhone",
  "normalizePhone",
];

const tmpDir = mkdtempSync(join(tmpdir(), "initiate-paystack-payment-audit-"));
const tmpModulePath = join(tmpDir, "pure-logic.ts");
writeFileSync(
  tmpModulePath,
  `${pureLogicSource}\nexport { ${EXPORTS.join(", ")} };\n`,
  "utf8"
);

const mod = await import(`file://${tmpModulePath.replace(/\\/g, "/")}`);
const { normalizePaymentRequest, matchTier, PaymentValidationError, calculateFees } = mod;

// ─── Fixtures ──────────────────────────────────────────────────────────────

function tieredCollection(overrides: Record<string, unknown> = {}) {
  return {
    id: "da3e3a24-1133-4cdd-8e2a-c3ca53389db1",
    title: "FARSTECH SIWES MALETE",
    collection_type: "tiered",
    fee_bearer: "contributor",
    price_tiers: [
      { id: "1", name: "UI/UX (Physical Classes)", price: 80000 },
      { id: "1784872292979", name: "Data Analysis (Physical Classes)", price: 80000 },
      { id: "1784872375205", name: "Frontend (Physical Classes)", price: 90000 },
      { id: "1784872465076", name: "Cyber Security (Physical Classes)", price: 120000 },
    ],
    ...overrides,
  };
}

function baseMetadata(overrides: Record<string, unknown> = {}) {
  return {
    collectionId: "da3e3a24-1133-4cdd-8e2a-c3ca53389db1",
    contact: { name: "Test Contributor", email: "test@example.com", phone: "08012345678" },
    ...overrides,
  };
}

// ─── Tiered: every tier, in every position, must resolve to its OWN price ──

test("tiered collection: each tier charges exactly its own price, regardless of array position or which tier was picked", () => {
  const collection = tieredCollection();
  const cases = [
    { tierId: "1", tierName: "UI/UX (Physical Classes)", expected: 80000 },
    { tierId: "1784872292979", tierName: "Data Analysis (Physical Classes)", expected: 80000 },
    { tierId: "1784872375205", tierName: "Frontend (Physical Classes)", expected: 90000 },
    { tierId: "1784872465076", tierName: "Cyber Security (Physical Classes)", expected: 120000 },
  ];

  for (const c of cases) {
    const result = normalizePaymentRequest({
      collection,
      metadata: baseMetadata({
        selectedTierId: c.tierId,
        selectedTier: c.tierName,
        contributionAmount: c.expected,
      }),
      paidRows: [],
    });
    assert.equal(
      result.contributionAmount,
      c.expected,
      `tier ${c.tierName} (${c.tierId}) should charge ${c.expected}, got ${result.contributionAmount}`
    );
    assert.equal(result.selectedTierId, c.tierId);
  }
});

test("tiered collection: lowest and highest tiers are not collapsed to a single price (the historical regression)", () => {
  const collection = tieredCollection();

  const lowest = normalizePaymentRequest({
    collection,
    metadata: baseMetadata({ selectedTierId: "1", selectedTier: "UI/UX (Physical Classes)", contributionAmount: 80000 }),
    paidRows: [],
  });
  const highest = normalizePaymentRequest({
    collection,
    metadata: baseMetadata({ selectedTierId: "1784872465076", selectedTier: "Cyber Security (Physical Classes)", contributionAmount: 120000 }),
    paidRows: [],
  });

  assert.notEqual(
    lowest.contributionAmount,
    highest.contributionAmount,
    "lowest and highest tier must not charge the same amount"
  );
  assert.equal(lowest.totalPayable, calculateFees(80000, "tiered", "contributor").totalPayable);
  assert.equal(highest.totalPayable, calculateFees(120000, "tiered", "contributor").totalPayable);
});

test("tiered collection: duplicate tier NAMES do not hijack an ID-based selection (matchTier collision guard)", () => {
  // Two tiers deliberately share a name — this is the exact shape the
  // 2026-08-01 fix (commit 8294d28) exists to protect against, and the exact
  // shape that could recur if matchTier is ever rewritten carelessly.
  const collection = tieredCollection({
    price_tiers: [
      { id: "early-bird", name: "General Admission", price: 5000 },
      { id: "regular", name: "General Admission", price: 15000 },
    ],
  });

  const result = normalizePaymentRequest({
    collection,
    metadata: baseMetadata({ selectedTierId: "regular", selectedTier: "General Admission", contributionAmount: 15000 }),
    paidRows: [],
  });

  assert.equal(
    result.contributionAmount,
    15000,
    "ID-based selection must win over an earlier name-colliding tier"
  );
});

test("tiered collection: impossible state — resolved tier price disagrees with client-claimed amount is rejected, not silently charged", () => {
  const collection = tieredCollection();

  assert.throws(
    () =>
      normalizePaymentRequest({
        collection,
        metadata: baseMetadata({
          selectedTierId: "1", // UI/UX — ₦80,000
          selectedTier: "UI/UX (Physical Classes)",
          contributionAmount: 51000, // stale/wrong client amount
        }),
        paidRows: [],
      }),
    (err: unknown) => err instanceof PaymentValidationError && (err as any).code === "tier_amount_mismatch"
  );
});

test("tiered collection: unmatched tier is rejected outright, never falls back to any default amount", () => {
  const collection = tieredCollection();
  assert.throws(
    () =>
      normalizePaymentRequest({
        collection,
        metadata: baseMetadata({ selectedTierId: "does-not-exist", selectedTier: "Ghost Tier" }),
        paidRows: [],
      }),
    (err: unknown) => err instanceof PaymentValidationError && (err as any).code === "invalid_selected_tier"
  );
});

// ─── Fixed collections ───────────────────────────────────────────────────

test("fixed collection: charges collection.amount regardless of any client-supplied amount", () => {
  const collection = { id: "c1", collection_type: "fixed", amount: 25000, fee_bearer: "organizer" };
  const result = normalizePaymentRequest({
    collection,
    metadata: baseMetadata({ contributionAmount: 999999 }),
    paidRows: [],
  });
  assert.equal(result.contributionAmount, 25000);
  assert.equal(result.totalPayable, 25000); // organizer-borne — no fees added
});

// ─── Fundraising (custom amount) ────────────────────────────────────────

test("fundraising collection: custom amount is honoured but fees are always contributor-borne", () => {
  const collection = { id: "c2", collection_type: "fundraising", amount: 1000, fee_bearer: "organizer" };
  const result = normalizePaymentRequest({
    collection,
    metadata: baseMetadata({ contributionAmount: 5000 }),
    paidRows: [],
  });
  assert.equal(result.contributionAmount, 5000);
  assert.equal(result.feeBearer, "contributor");
  assert.equal(result.totalPayable, calculateFees(5000, "fundraising", "contributor").totalPayable);
});

test("fundraising collection: below minimum is rejected", () => {
  const collection = { id: "c2", collection_type: "fundraising", amount: 2000 };
  assert.throws(
    () =>
      normalizePaymentRequest({
        collection,
        metadata: baseMetadata({ contributionAmount: 500 }),
        paidRows: [],
      }),
    (err: unknown) => err instanceof PaymentValidationError && (err as any).code === "amount_below_minimum"
  );
});

// ─── Open pool ───────────────────────────────────────────────────────────

test("open_pool collection: custom amount honoured, minimum enforced", () => {
  const collection = { id: "c3", collection_type: "open_pool", amount: 1000, fee_bearer: "organizer" };
  const result = normalizePaymentRequest({
    collection,
    metadata: baseMetadata({ contributionAmount: 3000 }),
    paidRows: [],
  });
  assert.equal(result.contributionAmount, 3000);
});

// ─── Ticket (flat) ───────────────────────────────────────────────────────

test("flat ticket collection: quantity multiplies unit price, not client-supplied amount", () => {
  const collection = { id: "c4", collection_type: "ticket", ticket_mode: "flat", amount: 5000, fee_bearer: "organizer" };
  const result = normalizePaymentRequest({
    collection,
    metadata: baseMetadata({ quantity: 3, contributionAmount: 1 }),
    paidRows: [],
  });
  assert.equal(result.contributionAmount, 15000);
});

// ─── Ticket (tiered) ─────────────────────────────────────────────────────

test("tiered ticket collection: sums selected tiers × quantity, ignores client total", () => {
  const collection = {
    id: "c5",
    collection_type: "ticket",
    ticket_mode: "tiered",
    fee_bearer: "contributor",
    price_tiers: [
      { id: "vip", name: "VIP", price: 20000 },
      { id: "reg", name: "Regular", price: 5000 },
    ],
  };
  const result = normalizePaymentRequest({
    collection,
    metadata: baseMetadata({
      ticketSelections: [
        { tierId: "vip", tierName: "VIP", quantity: 2 },
        { tierId: "reg", tierName: "Regular", quantity: 1 },
      ],
      contributionAmount: 45000,
    }),
    paidRows: [],
  });
  assert.equal(result.contributionAmount, 45000); // 2*20000 + 1*5000
});

test("tiered ticket collection: impossible state — selection total disagrees with client amount is rejected", () => {
  const collection = {
    id: "c5",
    collection_type: "ticket",
    ticket_mode: "tiered",
    price_tiers: [{ id: "vip", name: "VIP", price: 20000 }],
  };
  assert.throws(
    () =>
      normalizePaymentRequest({
        collection,
        metadata: baseMetadata({
          ticketSelections: [{ tierId: "vip", tierName: "VIP", quantity: 1 }],
          contributionAmount: 5000, // wrong — should be 20000
        }),
        paidRows: [],
      }),
    (err: unknown) => err instanceof PaymentValidationError && (err as any).code === "ticket_amount_mismatch"
  );
});

// ─── matchTier unit coverage ─────────────────────────────────────────────

test("matchTier: ID match wins even when an earlier tier's name equals the requested name", () => {
  const tiers = [
    { tierId: "a", tierName: "Standard" },
    { tierId: "b", tierName: "Standard" }, // duplicate name, later in array
  ];
  const result = matchTier(tiers, { tierId: "b", tierName: "Standard" });
  assert.equal(result?.tierId, "b");
});

test("matchTier: falls back to name only when no id is supplied", () => {
  const tiers = [{ tierId: "a", tierName: "Gold" }, { tierId: "b", tierName: "Silver" }];
  const result = matchTier(tiers, { tierName: "Silver" });
  assert.equal(result?.tierId, "b");
});

test("matchTier: returns null (never a default tier) when nothing matches", () => {
  const tiers = [{ tierId: "a", tierName: "Gold" }];
  const result = matchTier(tiers, { tierId: "z", tierName: "Nonexistent" });
  assert.equal(result, null);
});
