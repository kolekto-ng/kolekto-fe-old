/**
 * characterization.test.ts — the backend's locked money math, asserted against
 * the ENGINE.
 *
 * This mirrors kolekto-be-old/tests/financial.characterization.test.js
 * assertion-for-assertion, but imports the shared engine instead of the
 * backend's utils/financial.js. If the engine reproduces the reference exactly,
 * every one of these passes unchanged — that is the Node-parity guarantee at
 * the unit level. (The differential parity test proves the same thing over a
 * far larger, generated input space.)
 *
 * `now` is pinned so the settlement-cutoff assertions are deterministic.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roundCurrency,
  calculateFees,
  deriveNetContribution,
  getSettlementCutoff,
  isPaymentSettled,
  computeWalletBalances,
  computeWallet,
  normalizeContributions,
} from "../src/index.ts";

const NOW = new Date("2026-01-15T12:00:00.000Z");
const cutoff = getSettlementCutoff(NOW);
const beforeCutoff = () => new Date(cutoff.getTime() - 3600 * 1000).toISOString();
const afterCutoff = () => new Date(cutoff.getTime() + 1000).toISOString();

// ── roundCurrency ────────────────────────────────────────────────────────────
test("roundCurrency: 2dp, coerces non-numeric to 0", () => {
  assert.equal(roundCurrency(1.234), 1.23);
  assert.equal(roundCurrency(1.235), 1.24);
  assert.equal(roundCurrency(100), 100);
  assert.equal(roundCurrency("abc"), 0);
  assert.equal(roundCurrency(null), 0);
  assert.equal(roundCurrency(undefined), 0);
});

// ── calculateFees ────────────────────────────────────────────────────────────
test("calculateFees: fixed 5000 organizer — fees separate, payable = amount", () => {
  assert.deepEqual(calculateFees(5000, "fixed", "organizer"), {
    platformFee: 25, gatewayFee: 75, totalFees: 100, totalPayable: 5000,
  });
});

test("calculateFees: fixed 5000 contributor — payable = amount + fees", () => {
  assert.deepEqual(calculateFees(5000, "fixed", "contributor"), {
    platformFee: 25, gatewayFee: 75, totalFees: 100, totalPayable: 5100,
  });
});

test("calculateFees: fundraising uses 1% platform rate", () => {
  assert.deepEqual(calculateFees(10000, "fundraising", "contributor"), {
    platformFee: 100, gatewayFee: 150, totalFees: 250, totalPayable: 10250,
  });
});

test("calculateFees: fees are capped at 2000 each", () => {
  const f = calculateFees(500000, "fixed", "organizer");
  assert.equal(f.platformFee, 2000);
  assert.equal(f.gatewayFee, 2000);
  assert.equal(f.totalFees, 4000);
  assert.equal(f.totalPayable, 500000);
  assert.equal(calculateFees(500000, "fixed", "contributor").totalPayable, 504000);
});

test("calculateFees: unknown type falls back to 0.5% platform", () => {
  const f = calculateFees(1000, "mystery", "organizer");
  assert.equal(f.platformFee, 5);
  assert.equal(f.gatewayFee, 15);
});

test("calculateFees: zero amount → zero fees", () => {
  assert.deepEqual(calculateFees(0, "fixed", "organizer"), {
    platformFee: 0, gatewayFee: 0, totalFees: 0, totalPayable: 0,
  });
});

// ── deriveNetContribution ─────────────────────────────────────────────────────
test("deriveNetContribution: organizer-borne gross == net", () => {
  assert.equal(deriveNetContribution(5000, "fixed", "organizer"), 5000);
});

test("deriveNetContribution: contributor-borne backs out the fees", () => {
  assert.equal(deriveNetContribution(5100, "fixed", "contributor"), 5000);
  assert.equal(deriveNetContribution(10250, "fundraising", "contributor"), 10000);
});

test("deriveNetContribution: never negative, zero for non-positive gross", () => {
  assert.equal(deriveNetContribution(0, "fixed", "contributor"), 0);
  assert.equal(deriveNetContribution(-100, "fixed", "contributor"), 0);
});

test("round-trip: net → totalPayable → deriveNetContribution == net", () => {
  for (const [amt, type] of [[5000, "fixed"], [10000, "fundraising"], [2500, "tiered"]] as const) {
    const { totalPayable } = calculateFees(amt, type, "contributor");
    assert.equal(deriveNetContribution(totalPayable, type, "contributor"), amt);
  }
});

// ── settlement cutoff ─────────────────────────────────────────────────────────
test("getSettlementCutoff: is 04:00 UTC, today or yesterday", () => {
  const c = getSettlementCutoff(NOW);
  assert.equal(c.getUTCHours(), 4);
  assert.equal(c.getUTCMinutes(), 0);
  assert.ok(c.getTime() <= NOW.getTime());
  assert.ok(NOW.getTime() - c.getTime() < 48 * 3600 * 1000);
});

test("isPaymentSettled: strictly before cutoff settled; at/after pending", () => {
  assert.equal(isPaymentSettled(new Date(cutoff.getTime() - 1000), NOW), true);
  assert.equal(isPaymentSettled(new Date(cutoff.getTime()), NOW), false);
  assert.equal(isPaymentSettled(new Date(cutoff.getTime() + 1000), NOW), false);
});

// ── computeWalletBalances (legacy shape parity) ───────────────────────────────
test("computeWalletBalances: empty → all zero", () => {
  assert.deepEqual(computeWalletBalances([], [], NOW), {
    netPayment: 0, grossPayment: 0, pendingBalance: 0,
    availableBalance: 0, ledgerBalance: 0, completedWithdrawals: 0,
  });
});

test("computeWalletBalances: settled contribution available, not pending", () => {
  const b = computeWalletBalances(
    [{ amount: 5000, gross_amount: 5100, created_at: beforeCutoff() }], [], NOW);
  assert.equal(b.netPayment, 5000);
  assert.equal(b.grossPayment, 5100);
  assert.equal(b.pendingBalance, 0);
  assert.equal(b.availableBalance, 5000);
  assert.equal(b.ledgerBalance, 5000);
});

test("computeWalletBalances: today's contribution pending, not available", () => {
  const b = computeWalletBalances(
    [{ amount: 3000, gross_amount: 3000, created_at: afterCutoff() }], [], NOW);
  assert.equal(b.pendingBalance, 3000);
  assert.equal(b.availableBalance, 0);
  assert.equal(b.ledgerBalance, 3000);
});

test("computeWalletBalances: completed withdrawals reduce available only", () => {
  const b = computeWalletBalances(
    [
      { amount: 5000, gross_amount: 5000, created_at: beforeCutoff() },
      { amount: 2000, gross_amount: 2000, created_at: afterCutoff() },
    ],
    [{ amount: 1000, status: "approved" }], NOW);
  assert.equal(b.netPayment, 7000);
  assert.equal(b.pendingBalance, 2000);
  assert.equal(b.completedWithdrawals, 1000);
  assert.equal(b.availableBalance, 4000);
  assert.equal(b.ledgerBalance, 6000);
});

test("computeWalletBalances: available floors at 0", () => {
  const b = computeWalletBalances(
    [{ amount: 1000, gross_amount: 1000, created_at: beforeCutoff() }],
    [{ amount: 5000, status: "completed" }], NOW);
  assert.equal(b.availableBalance, 0);
});

test("computeWalletBalances: all legacy completed-status synonyms count", () => {
  for (const status of ["completed", "successful", "success", "approved"]) {
    const b = computeWalletBalances(
      [{ amount: 5000, gross_amount: 5000, created_at: beforeCutoff() }],
      [{ amount: 1000, status }], NOW);
    assert.equal(b.completedWithdrawals, 1000, `status=${status}`);
  }
  const b = computeWalletBalances(
    [{ amount: 5000, gross_amount: 5000, created_at: beforeCutoff() }],
    [{ amount: 1000, status: "pending" }], NOW);
  assert.equal(b.completedWithdrawals, 0);
  assert.equal(b.availableBalance, 5000);
});

test("computeWalletBalances: gross falls back to amount when gross_amount missing", () => {
  const b = computeWalletBalances(
    [{ amount: 5000, created_at: beforeCutoff() }], [], NOW);
  assert.equal(b.grossPayment, 5000);
});

// ── normalizeContributions ────────────────────────────────────────────────────
test("normalizeContributions: organizer-borne subtracts fees to get net", () => {
  const [row] = normalizeContributions(
    [{ amount: 0, gross_amount: 5000, created_at: beforeCutoff() }], "organizer", "fixed");
  assert.equal(row!.amount, 4900);
  assert.equal(row!.gross_amount, 5000);
});

test("normalizeContributions: contributor-borne derives net from gross", () => {
  const [row] = normalizeContributions(
    [{ amount: 0, gross_amount: 5100, created_at: beforeCutoff() }], "contributor", "fixed");
  assert.equal(row!.amount, 5000);
});

test("normalizeContributions: gross===0 rows pass through untouched", () => {
  const input = [{ amount: 0, gross_amount: 0, created_at: beforeCutoff() }];
  assert.deepEqual(normalizeContributions(input, "organizer", "fixed"), input);
});

// ── invariant + canonical shape ───────────────────────────────────────────────
test("INVARIANT: available + pending == ledger, always", () => {
  const rows = [
    { amount: 5000, gross_amount: 5000, created_at: beforeCutoff() },
    { amount: 1234.56, gross_amount: 1234.56, created_at: afterCutoff() },
    { amount: 999.99, gross_amount: 999.99, created_at: beforeCutoff() },
  ];
  const b = computeWalletBalances(rows, [{ amount: 500, status: "approved" }], NOW);
  assert.equal(roundCurrency(b.availableBalance + b.pendingBalance), b.ledgerBalance);
});

test("computeWallet: canonical shape relabels the same numbers", () => {
  const rows = [
    { amount: 5000, gross_amount: 5100, created_at: beforeCutoff() },
    { amount: 2000, gross_amount: 2000, created_at: afterCutoff() },
  ];
  const wd = [{ amount: 1000, status: "approved" }];
  const b = computeWalletBalances(rows, wd, NOW);
  const w = computeWallet(rows, wd, NOW);
  assert.deepEqual(w, {
    gross: b.grossPayment, net: b.netPayment, withdrawn: b.completedWithdrawals,
    pending: b.pendingBalance, available: b.availableBalance, ledger: b.ledgerBalance,
  });
  assert.equal(w.ledger, roundCurrency(w.available + w.pending));
});
