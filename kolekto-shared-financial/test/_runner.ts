/**
 * _runner.ts — shared, runtime-agnostic golden-vector runner.
 *
 * Given the engine module and the parsed golden vectors, evaluate every vector
 * group and return a structured result. Both the Node harness and the Deno
 * harness import this so the two runtimes execute IDENTICAL assertions — the
 * whole point of the conformance suite.
 *
 * Pure TS, no test framework, no I/O (the caller loads the JSON and prints).
 */

import type * as Engine from "../src/index.ts";

type FPE = typeof Engine;

export interface VectorResult {
  group: string;
  name: string;
  ok: boolean;
  expected: unknown;
  actual: unknown;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  results: VectorResult[];
}

/** Round-aware deep equality for the money shapes we assert on. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    // Compare at kobo precision to ignore any float representation noise.
    return Math.round(a * 100) === Math.round(b * 100);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    // Subset match: every key present in `expected` (b) must match `actual`.
    return Object.keys(bo).every((k) => deepEqual(ao[k], bo[k]));
  }
  return false;
}

/** Pick only the asserted keys from a projection for a focused diff. */
function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

export function runVectors(
  FPE: FPE,
  vectors: Record<string, unknown>
): RunSummary {
  const results: VectorResult[] = [];
  const push = (
    group: string,
    name: string,
    expected: unknown,
    actual: unknown
  ) => results.push({ group, name, expected, actual, ok: deepEqual(actual, expected) });

  // ── fees ────────────────────────────────────────────────────────────────
  for (const v of (vectors.fees as any[]) ?? []) {
    const actual = FPE.calculateFees(v.amount, v.collectionType, v.feeBearer);
    push("fees", v.name, v.expected, actual);
  }

  // ── deriveNet ─────────────────────────────────────────────────────────────
  for (const v of (vectors.deriveNet as any[]) ?? []) {
    const actual = FPE.deriveNetContribution(v.gross, v.collectionType, v.feeBearer);
    push("deriveNet", v.name, v.expected, actual);
  }

  // ── cutoff ────────────────────────────────────────────────────────────────
  for (const v of (vectors.cutoff as any[]) ?? []) {
    const actual = FPE.getSettlementCutoff(new Date(v.now)).toISOString();
    push("cutoff", v.name, v.expectedCutoff, actual);
  }

  // ── isSettled ─────────────────────────────────────────────────────────────
  for (const v of (vectors.isSettled as any[]) ?? []) {
    const actual = FPE.isPaymentSettled(v.paymentDate, new Date(v.now));
    push("isSettled", v.name, v.expected, actual);
  }

  // ── allocate ──────────────────────────────────────────────────────────────
  for (const v of (vectors.allocate as any[]) ?? []) {
    const actual = FPE.allocateAmounts(v.total, v.weights);
    push("allocate", v.name, v.expected, actual);
  }

  // ── wallet + divergence (same shape, both exercise computeWallet) ─────────
  for (const group of ["wallet", "divergence"] as const) {
    for (const v of (vectors[group] as any[]) ?? []) {
      const w = FPE.computeWallet(v.contributions, v.withdrawals, new Date(v.now));
      const keys = Object.keys(v.expected);
      push(group, v.name, v.expected, pick(w as any, keys));
      // Invariant checks on every wallet vector.
      const ledgerOk = Math.round((w.available + w.pending) * 100) === Math.round(w.ledger * 100);
      results.push({
        group: `${group}:invariant`,
        name: `${v.name} — ledger === available + pending, available >= 0`,
        expected: true,
        actual: ledgerOk && w.available >= 0,
        ok: ledgerOk && w.available >= 0,
      });
    }
  }

  // ── withdrawal eligibility ────────────────────────────────────────────────
  for (const v of (vectors.withdrawalEligibility as any[]) ?? []) {
    const pending = v.pendingWithdrawalRows ?? v.pendingWithdrawals;
    const actual = FPE.computeWithdrawalEligibility({ available: v.available }, pending);
    push("withdrawalEligibility", v.name, v.expected, actual);
  }

  // ── tiers ─────────────────────────────────────────────────────────────────
  for (const v of (vectors.tiers as any[]) ?? []) {
    const built = FPE.buildTierAvailability(v.tiers, v.paidRows);
    const keys = ["tierId", "tierName", "sold", "totalCapacity", "remainingCapacity"];
    const actual = built.map((t: any) => pick(t, keys));
    const expected = (v.expected as any[]).map((t) => pick(t, keys));
    push("tiers", v.name, expected, actual);
  }

  const passed = results.filter((r) => r.ok).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}

/** Human-readable one-line-per-failure report. */
export function formatFailures(summary: RunSummary): string {
  return summary.results
    .filter((r) => !r.ok)
    .map(
      (r) =>
        `  ✗ [${r.group}] ${r.name}\n      expected: ${JSON.stringify(r.expected)}\n      actual:   ${JSON.stringify(r.actual)}`
    )
    .join("\n");
}
