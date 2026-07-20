# WAVE3_READINESS_REPORT (Phase 2.2 — SQL Mirror Lockstep next)

Gate between Wave 2 (Edge delegation, **complete locally**) and Wave 3 (bind the
SQL settlement function to the engine via the conformance suite). **Do not start
Wave 3 without explicit approval.**

---

## 1. State after Wave 2

- **Node** delegates to the engine (compiled `dist` vendored to
  `kolekto-be-old/utils/fpe/`). 63/63 green.
- **Edge (Deno)** delegates to the engine (inlined IIFE via `npm run bundle:edge`)
  in `initiate` + `verify` (`_shared1`/`_shared2`). Inlined blocks proven == the
  canonical source; the edge's `{completed, successful}` → canonical superset
  convergence applied.
- **SQL** (`database/settlement_recompute.sql`) is **unchanged**. It already uses
  the Node/engine superset for completed withdrawals and the same fee/cutoff math,
  but it has never been formally bound to the engine by the conformance suite.
- **Engine `src` untouched** since Wave 0 → Node parity (104/104) intact.

There is now **one logical financial implementation** consumed by both TS runtimes
(Node + Edge). SQL is the remaining independent copy.

## 2. Is Wave 3 ready?

**Yes, once approved.** Prereqs in place:

- The SQL harness (`kolekto-shared-financial/test/sql.harness.sql`) is authored
  and mirrors the engine's wallet projection over the golden vectors.
- The vector fixture is the single shared source of truth across Node/Deno/SQL.
- Wave 3 is annotation + CI-binding, not a behaviour change (unless a vector
  reveals a real SQL gap — surface it, don't silently change).

## 3. Wave 3 scope (from FPE_EXECUTION_PLAN)

Bind `settlement_recompute_wallets()` to the engine via the golden-vector
conformance suite; annotate `-- MIRRORS kolekto-shared-financial@<hash>`. Add the
SQL harness to CI. If a vector fails, fix the SQL to match the engine and ship it
as its own reversible migration.

## 4. Risks / open decisions carried forward

| # | Item | Severity | Handling |
|---|------|----------|----------|
| **R-REV** | **`reverseCalculateContribution` algorithm divergence** — edge binary search vs engine `deriveNetContribution` differ ≤₦19.55 in the partially-fee-capped region; the binary search is the more exact inverse. Node's `deriveNetContribution` (and thus the engine) carries the same slight inaccuracy in `normalizeContributions` for legacy contributor-borne rows. | Medium (rare paths) | **Decision needed:** make the engine's `deriveNetContribution` exact (adopt the binary search or a closed-form capped inverse) — but that changes Node's established 0-drift behaviour, so it needs its own approval + reconcile. Until then, edge keeps its binary search; engine unchanged. NOT a Wave 3 blocker. |
| R1 | Edge status convergence is a **write-path behaviour change** — must be validated on the test project before prod. | High (needs verification) | Operator runs the Wave 2 §8 e2e checks; only then consider prod. |
| R2 | Deno-runtime harness + e2e not run locally (no Deno/deploy). | Medium | Operator gate (Wave 2 §8). Inlined blocks are proven == engine under Node. |
| R3 | SQL harness runs only where Postgres is available. | Low | Wave 3 runs it in CI / against the test project. |
| R4 | Edge inline block can drift if someone hand-edits between the markers. | Low | Generated banner warns; `bundle:edge` regenerates; Wave 4 grep-gate will forbid local financial math outside the engine + SQL mirror. |

## 5. Checklist to begin Wave 3

- [ ] Approval to touch SQL (annotation + reversible migration only).
- [ ] Run `psql -f kolekto-shared-financial/test/sql.harness.sql` on the test
      project → all wallet + divergence vectors green.
- [ ] If any vector fails: fix `settlement_recompute.sql` to match the engine;
      ship as a standalone reversible migration; re-run.
- [ ] Annotate `settlement_recompute_wallets()` / `settlement_cutoff()` as
      `-- MIRRORS kolekto-shared-financial@<hash>`.
- [ ] Add the SQL harness to CI alongside the Node harness.
- [ ] Run settlement on the test project → `settlement_runs` clean, drift 0.
- [ ] Do **not** flip production.

## 6. Entry gate

Wave 2's operator checks (Deno harness green, e2e wallet == `FPE.computeWallet`,
reconcile drift 0 on the test project) pass, **and** the R-REV decision is at
least logged (it does not block Wave 3). **Wave 3 begins only on explicit
approval.**

## 7. Note toward Wave 4 (cleanup + guardrail)

After SQL is bound, Wave 4 removes remaining dead duplicates (e.g. the deprecated
`supabase/functions/_shared/payment.ts`) and adds a CI grep-gate forbidding
`calculateFees`/`roundCurrency`/cutoff redefinition outside the engine + SQL
mirror — which would also mechanically catch any hand-edit of an inlined edge
block or the Node vendor.
