/**
 * parity.test.ts — differential Node-parity proof.
 *
 * Imports BOTH the shared engine AND the live backend reference
 * (kolekto-be-old/utils/financial.js) and asserts they produce byte-identical
 * results across a broad, generated input grid. This is the Wave 0 "prove Node
 * parity" deliverable at scale: not a re-statement of expected constants, but a
 * direct diff against the exact implementation reconciliation validates at 0
 * drift today.
 *
 * If the backend file is not resolvable (e.g. the sibling repo is absent on
 * some CI checkout), the suite records a single explicit skip rather than a
 * false pass — parity must be proven where the reference exists.
 *
 * Run:  node --experimental-strip-types --test test/parity.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as FPE from "../src/index.ts";

const BACKEND = "../../../kolekto-be-old/utils/financial.js";

type Ref = {
  roundCurrency: (v: unknown) => number;
  calculateFees: (a: number, t?: string, b?: string) => Record<string, number>;
  deriveNetContribution: (g: number, t?: string, b?: string) => number;
  getSettlementCutoff: () => Date;
  computeWalletBalances: (c: unknown[], w: unknown[]) => Record<string, number>;
  normalizeContributions: (c: unknown[], b?: string, t?: string) => unknown[];
};

let ref: Ref | null = null;
try {
  ref = (await import(BACKEND)) as unknown as Ref;
} catch (err) {
  ref = null;
  console.warn(
    `[parity] backend reference not resolvable at ${BACKEND} — parity tests skipped. (${(err as Error).message})`
  );
}

const AMOUNTS = [0, 1, 100, 250.5, 999.99, 1000, 2500, 5000, 10000, 12345.67,
  133333.33, 200000, 400000, 500000, 1000000, 1234.56];
const TYPES = ["fixed", "fundraising", "tiered", "ticket", "open_pool", "mystery"];
const BEARERS = ["organizer", "contributor"] as const;

test("parity: reference reachable", { skip: !ref ? "backend not present" : false }, () => {
  assert.ok(ref);
});

test("parity: roundCurrency matches reference", { skip: !ref }, () => {
  for (const v of [1.234, 1.235, 100, -5.005, 0.1 + 0.2, 999.995, 1234.564]) {
    assert.equal(FPE.roundCurrency(v), ref!.roundCurrency(v), `roundCurrency(${v})`);
  }
  for (const v of ["abc", null, undefined, "12.5", ""]) {
    assert.equal(FPE.roundCurrency(v), ref!.roundCurrency(v), `roundCurrency(${String(v)})`);
  }
});

test("parity: calculateFees matches reference across grid", { skip: !ref }, () => {
  for (const amount of AMOUNTS) {
    for (const type of TYPES) {
      for (const bearer of BEARERS) {
        assert.deepEqual(
          FPE.calculateFees(amount, type, bearer),
          ref!.calculateFees(amount, type, bearer),
          `calculateFees(${amount}, ${type}, ${bearer})`
        );
      }
    }
  }
});

test("parity: deriveNetContribution matches reference across grid", { skip: !ref }, () => {
  for (const gross of AMOUNTS) {
    for (const type of TYPES) {
      for (const bearer of BEARERS) {
        assert.equal(
          FPE.deriveNetContribution(gross, type, bearer),
          ref!.deriveNetContribution(gross, type, bearer),
          `deriveNetContribution(${gross}, ${type}, ${bearer})`
        );
      }
    }
  }
});

test("parity: getSettlementCutoff matches reference", { skip: !ref }, () => {
  // Both read the wall clock; compare the resulting cutoff instant.
  assert.equal(
    FPE.getSettlementCutoff(new Date()).toISOString(),
    ref!.getSettlementCutoff().toISOString()
  );
});

test("parity: computeWalletBalances matches reference across scenarios", { skip: !ref }, () => {
  // Anchor timestamps to the reference's own cutoff, with hour-scale margins so
  // settled/pending classification is identical regardless of sub-second clock
  // differences between the two calls.
  const cutoff = ref!.getSettlementCutoff();
  const settled = new Date(cutoff.getTime() - 6 * 3600 * 1000).toISOString();
  const settled2 = new Date(cutoff.getTime() - 30 * 3600 * 1000).toISOString();
  const pending = new Date(cutoff.getTime() + 2 * 3600 * 1000).toISOString();
  const now = new Date();

  const scenarios: Array<{ c: unknown[]; w: unknown[] }> = [
    { c: [], w: [] },
    { c: [{ amount: 5000, gross_amount: 5100, created_at: settled }], w: [] },
    { c: [{ amount: 3000, gross_amount: 3000, created_at: pending }], w: [] },
    {
      c: [
        { amount: 5000, gross_amount: 5000, created_at: settled },
        { amount: 2000, gross_amount: 2000, created_at: pending },
        { amount: 1234.56, gross_amount: 1234.56, created_at: settled2 },
      ],
      w: [{ amount: 1000, status: "approved" }, { amount: 250, status: "success" }],
    },
    {
      c: [{ amount: 1000, gross_amount: 1000, created_at: settled }],
      w: [{ amount: 5000, status: "completed" }],
    },
    {
      c: [{ amount: 5000, gross_amount: 5000, created_at: settled }],
      w: [
        { amount: 1000, status: "pending" },
        { amount: 500, status: "processing" },
        { amount: 750, status: "rejected" },
        { amount: 250, status: "successful" },
      ],
    },
    { c: [{ amount: 5000, created_at: settled }], w: [] }, // gross fallback
  ];

  for (const [i, s] of scenarios.entries()) {
    assert.deepEqual(
      FPE.computeWalletBalances(s.c, s.w, now),
      ref!.computeWalletBalances(s.c, s.w),
      `computeWalletBalances scenario #${i}`
    );
  }
});

test("parity: normalizeContributions matches reference", { skip: !ref }, () => {
  const rows = [
    { amount: 0, gross_amount: 5000 },
    { amount: 0, gross_amount: 5100 },
    { amount: 0, gross_amount: 0 },
    { amount: 4900, gross_amount: 5000 },
    { amount: 0, gross_amount: 10250 },
  ];
  for (const type of TYPES) {
    for (const bearer of BEARERS) {
      assert.deepEqual(
        FPE.normalizeContributions(structuredClone(rows), bearer, type),
        ref!.normalizeContributions(structuredClone(rows), bearer, type),
        `normalizeContributions(${type}, ${bearer})`
      );
    }
  }
});
