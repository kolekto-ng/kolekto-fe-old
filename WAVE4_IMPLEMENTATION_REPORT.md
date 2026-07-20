# WAVE4_IMPLEMENTATION_REPORT (Phase 2.2 — Cleanup & Enforcement)

## Executive Summary
Final wave. Removed dead duplicate financial code, and added an automated
guardrail (script + CI workflow) that fails the build if any runtime reintroduces
local financial math. Phase 2.2's target is reached: **exactly one logical
financial implementation** — one TypeScript engine consumed by Node (vendored)
and Edge (inlined), plus one SQL mirror proven equivalent by golden vectors.

## Files Modified
**Removed / cleaned (kolekto-fe-old):**
- `supabase/functions/_shared/payment.ts` — **deleted** (proven orphan; a dead
  duplicate of engine math, 0 importers repo-wide).
- `supabase/functions/verify-paystack-payment/_shared1.ts` — removed the now-dead
  edge helpers `getTierLabel` / `getTierMatchKey` / `getInfoRows` (only the
  deleted edge `buildTierAvailability` used them; the engine carries its own).

**Added (kolekto-fe-old):**
- `kolekto-shared-financial/scripts/guard-financial-duplication.mjs` — the
  no-local-financial-math grep-gate.
- `kolekto-shared-financial/package.json` — `guard` + `conformance` scripts.
- `.github/workflows/financial-guardrails.yml` — CI: golden-vector conformance +
  engine typecheck + guardrail + "inline block in sync" check.

**Modified (kolekto-be-old, Wave 3 carryover):**
- `database/settlement_recompute.sql` — MIRRORS annotations (comment-only).

## Decisions Made
1. **Delete the orphan, keep the adapter.** `_shared/payment.ts` was dead → removed.
   `utils/financial.js` (Node adapter) and `utils/fpe/` (vendor) are load-bearing
   (13 callers) → kept. The adapter contains no math, only re-exports.
2. **Guardrail = names + inline-fee-math + status-set, minus sanctioned exceptions.**
   Flags redefinitions of `roundCurrency`/`calculateFees`/`deriveNetContribution`/
   `getSettlementCutoff`/`computeWalletBalances`, inline `Math.min(x*rate, 2000)`
   fee math, and hardcoded completed-withdrawal `Set`s. Ignores: the engine, the
   vendored copy, the adapter, the SQL mirror, characterization tests, generated
   `FPE-ENGINE-INLINE` blocks (stripped before scan), and `= FPE.*` bindings.
   `reverseCalculateContribution` is deliberately allowed (sanctioned edge-local,
   R-REV).
3. **CI also checks inline-block freshness** — re-runs `bundle:edge` and fails if
   the committed edge block drifts from the engine, mechanically preventing a
   hand-edit of an inlined copy.
4. **Frontend display math out of scope.** The guard scans the three server
   runtimes (Node + Edge); any client-side fee *preview* is a separate concern
   (the client is read-only for financial writes per CLAUDE.md).

## Validation Results
See `WAVE4_VALIDATION_REPORT.md`. All green: engine 104/104, backend 63/63,
guardrail PASS (and proven to catch an injected violation, exit 1), edge files
type-strip clean, `bundle:edge` idempotent, SQL conformance 16/16 + 57/57 live
wallets 0 drift (Wave 3).

## Risks
- **R-REV** (open): edge `reverseCalculateContribution` vs engine `deriveNetContribution`
  divergence in the fee-capped region — allowed by the guard, decision pending.
- **R-COALESCE** (latent, unreachable): SQL gross-fallback vs JS `||` — no data
  triggers it.
- **CI cross-repo scope**: in a single-repo (fe-old) CI checkout the guard scans
  only edge functions; full cross-repo scanning needs `kolekto-be-old` checked
  out as a sibling (documented in the workflow). Running `npm run guard` locally
  (both repos present) covers everything.
- No production flip performed; PROD conformance remains an approved step.

## Rollback Strategy
- `_shared/payment.ts` deletion + dead-helper removal: `git revert`.
- Guardrail/workflow are additive: delete the files to remove.
- SQL annotation: comment-only revert.
Nothing deployed; no DB or production change to undo.

## Next Recommended Action
Phase 2.2 build is complete across all four waves. The remaining items are
**explicitly-approved production steps**, not build work:
1. Decide **R-REV** (canonical reverse-calc algorithm).
2. Run the Deno conformance harness + an end-to-end payment on the test project
   (Wave 2 §8) to confirm the edge status-convergence on real traffic.
3. Run SQL conformance on **PROD** and, once all green, flip production (separate
   approval).
