/**
 * vectors.test.ts — node:test wrapper over the golden vectors.
 *
 * Emits one assertion per vector so `node --test` reports each by name. The
 * heavy lifting is in the shared _runner (also used by the Deno harness), so
 * both runtimes assert identically.
 *
 * Run:  node --experimental-strip-types --test test/vectors.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as FPE from "../src/index.ts";
import vectors from "./golden-vectors.json" with { type: "json" };
import { runVectors } from "./_runner.ts";

const summary = runVectors(FPE, vectors as Record<string, unknown>);

for (const r of summary.results) {
  test(`[${r.group}] ${r.name}`, () => {
    assert.ok(
      r.ok,
      `expected ${JSON.stringify(r.expected)} but got ${JSON.stringify(r.actual)}`
    );
  });
}
