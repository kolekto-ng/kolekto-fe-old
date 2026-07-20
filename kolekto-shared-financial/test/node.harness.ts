/**
 * node.harness.ts — Node golden-vector harness (RUNS in Wave 0).
 *
 * Loads the shared engine + golden vectors and asserts the engine reproduces
 * every expected output. Prints a per-group scorecard and exits non-zero on
 * any failure. This is one of the three conformance feeds; the Deno and SQL
 * harnesses run the SAME vectors in their runtimes (Waves 2/3).
 *
 * Run:  node --experimental-strip-types test/node.harness.ts
 */

import * as FPE from "../src/index.ts";
import vectors from "./golden-vectors.json" with { type: "json" };
import { formatFailures, runVectors } from "./_runner.ts";

const summary = runVectors(FPE, vectors as Record<string, unknown>);

// Per-group scorecard.
const byGroup = new Map<string, { pass: number; total: number }>();
for (const r of summary.results) {
  const g = byGroup.get(r.group) ?? { pass: 0, total: 0 };
  g.total += 1;
  if (r.ok) g.pass += 1;
  byGroup.set(r.group, g);
}

console.log("── kolekto-shared-financial · Node golden-vector harness ──");
for (const [group, { pass, total }] of byGroup) {
  console.log(`  ${pass === total ? "✓" : "✗"} ${group.padEnd(26)} ${pass}/${total}`);
}
console.log(`  ${"".padEnd(28)} ─────`);
console.log(`  ${summary.failed === 0 ? "✓ PASS" : "✗ FAIL"}  total ${summary.passed}/${summary.total}`);

if (summary.failed > 0) {
  console.error("\nFailures:\n" + formatFailures(summary));
  process.exit(1);
}
