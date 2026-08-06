/**
 * deno.harness.ts — Deno (Supabase Edge runtime) golden-vector harness.
 *
 * READY, not run in Wave 0 (Deno is not part of the Wave 0 local toolchain).
 * It imports the SAME engine source and the SAME shared _runner as the Node
 * harness, so when executed in Wave 2 it proves the Edge runtime computes every
 * vector identically to Node. This is the mechanism that lets the edge drop its
 * local duplicate math and adopt the engine.
 *
 * Run (Wave 2, with Deno installed):
 *   deno test --allow-read test/deno.harness.ts
 *
 * NOTE ON THE LATENT BUG (matrix row 15): today's edge shared code uses
 * COMPLETED_WITHDRAWAL_STATUSES = {completed, successful}. Against the
 * `divergence` vectors (approved / success withdrawals) that set computes the
 * `edgeLegacyWouldCompute` values — which DIFFER from `expected`. The engine's
 * canonical superset {completed, successful, success, approved} makes those
 * vectors pass. Running this harness against the pre-migration edge code is how
 * Wave 2 demonstrates the fix.
 */

// deno-lint-ignore-file no-explicit-any
import * as FPE from "../src/index.ts";
import vectors from "./golden-vectors.json" with { type: "json" };
import { formatFailures, runVectors } from "./_runner.ts";

// `Deno` is provided by the Deno runtime; typed loosely so this file also
// parses under Node's type checker without the Deno type libs installed.
declare const Deno: {
  test: (name: string, fn: () => void) => void;
  exit: (code: number) => never;
};

const summary = runVectors(FPE, vectors as Record<string, unknown>);

// One Deno.test per vector for a granular report.
for (const r of summary.results) {
  Deno.test(`[${r.group}] ${r.name}`, () => {
    if (!r.ok) {
      throw new Error(
        `expected ${JSON.stringify(r.expected)} but got ${JSON.stringify(r.actual)}`
      );
    }
  });
}

// Also expose a summary test so a bare `deno run` prints the scorecard.
Deno.test("golden-vector summary", () => {
  if (summary.failed > 0) {
    throw new Error(`\n${formatFailures(summary)}\n${summary.failed} vector(s) failed`);
  }
});
