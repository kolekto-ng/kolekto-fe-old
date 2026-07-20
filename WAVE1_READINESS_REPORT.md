# WAVE1_READINESS_REPORT (Phase 2.2 — Financial Projection Engine)

Gate check between Wave 0 (engine + proof) and Wave 1 (Node delegation).

---

## 1. Is the engine production-ready?

**Yes — as a library.** It is:

- **Complete** — every function the design and handover named is implemented
  (L0 constants + types, L1 primitives, L2 projections). See
  `FINANCIAL_ENGINE_API.md`.
- **Pure & dependency-free** — no DB, Supabase, `fetch`, network, logging, env,
  or hidden time. `package.json` has **zero** runtime dependencies. Time is an
  injected `now`.
- **Type-sound** — `tsc --strict --erasableSyntaxOnly` passes (exit 0); valid for
  both Node type-stripping and native Deno.
- **Proven equivalent to the 0-drift reference** — ~650 differential assertions
  against the live `kolekto-be-old/utils/financial.js` all pass; 72/72 golden
  vectors pass; 104/104 tests pass, **0 skipped**. See `WAVE0_VALIDATION_REPORT.md`.

"Production-ready" here means *ready to be adopted*. It is **not yet in any
production path** — that is Wave 1+ by design.

## 2. Does any runtime currently use it?

**No.** Verified:

- **Node** — `kolekto-be-old` still uses its own `utils/financial.js`. No import
  of `kolekto-shared-financial` exists in the backend.
- **Edge** — the Deno functions (`_shared/payment.ts`, `verify-paystack-payment/
  _shared1.ts`, `_shared2.ts`, `initiate-paystack-payment`) still use their local
  copies.
- **SQL** — `settlement_recompute.sql` is unchanged and undeployed-by-this-work.

The engine is **additive**. Deleting the `kolekto-shared-financial/` directory
would return the repos to their exact pre-Wave-0 state (only new docs remain).

## 3. Risks identified

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **Latent Node/Edge divergence** on `approved`/`success` withdrawals. Edge's `{completed, successful}` set undercounts `withdrawn`, over-reporting `available`. | High (correctness) — **latent**; unexercised by live data. | Engine adopts the Node superset. Wave 2 edge delegation eliminates it; divergence vectors lock it. |
| R2 | **Node runtime cannot `import` a `.ts` package** without strip-types or a build. | Medium (Wave 1 mechanics) | Wave 1 chooses one: run backend under Node ≥22.6 strip-types, add a `tsc` build step, or vendor compiled JS. Engine is already erasable-syntax clean. |
| R3 | **Cross-repo path** — engine lives in `kolekto-fe-old`; Node lives in `kolekto-be-old`. | Low | Promote to a sibling/workspace package (no code change — it's self-contained) or vendor into the backend at Wave 1. |
| R4 | **`deriveNetContribution` algorithm differs across sources** (Node one-step-refine vs Edge binary search). Engine lifted **Node**. | Low | Vectors confirm identical outputs; Wave 2 replaces the edge's binary search with the engine, removing the second algorithm. |
| R5 | **`now` injection** — callers currently rely on the hidden `new Date()`. | Low | Default parameter preserves current behaviour; adapters may pass an explicit `now` for determinism. |
| R6 | **Deno/SQL harnesses not yet executed** (no Deno/psql in the Wave 0 toolchain). | Low | Authored against the shared fixture; scheduled to run in Waves 2/3 exactly as the execution plan sequences them. |

None of these block Wave 0 sign-off; R1–R3 are the first things Wave 1/2 address.

## 4. Checklist for beginning Wave 1 (Node delegation)

Per `FPE_EXECUTION_PLAN.md` Wave 1. **Do not start until Wave 0 is signed off.**

- [ ] Decide the Node consumption mechanism for R2 (strip-types vs `tsc` build vs
      vendor) and wire `kolekto-be-old` to resolve `kolekto-shared-financial`.
- [ ] Make `utils/financial.js` a thin **re-export/adapter** of the engine under
      the current export names (`roundCurrency`, `calculateFees`,
      `deriveNetContribution`, `getSettlementCutoff`, `isPaymentSettled`,
      `computeWalletBalances`, `normalizeContributions`) — zero call-site churn.
- [ ] Replace the inline `getEligibleCollections` cap math in
      `controllers/withdrawal.js` with `FPE.computeWithdrawalEligibility`.
- [ ] Run the backend's `node --test tests/*.test.js` — **63/63 must hold**
      (they characterize these exact functions).
- [ ] Keep the differential parity suite green during the swap (engine vs the
      pre-change `financial.js`), then retire it once delegation lands.
- [ ] Run live reconciliation on test project `lpeeckqsltxohppheucz` → **drift 0**.
- [ ] Diff `getEligibleCollections` output before/after for a sample of
      collections.
- [ ] Single-commit boundary so Wave 1 reverts cleanly (`git revert` of the
      `financial.js` delegation commit; engine untouched).

**Entry gate to Wave 1:** Wave 0 signed off — engine exists, is pure, parity
proven, production untouched. **All items above are green before Wave 2.**

## 5. Sign-off statement

Wave 0 is **complete**. The Financial Projection Engine package exists, is fully
dependency-free, faithfully reproduces the current Node implementation (proven by
differential parity at 0 drift), ships the complete golden-vector infrastructure
(Node running; Deno + SQL ready), and **no production code was changed or
deployed**. The project is prepared for Wave 1.
