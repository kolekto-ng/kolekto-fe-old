# FPE_EXECUTION_PLAN (Phase 2.2 — Deliverable 5)

The build sequence, in waves. Each wave: objective · affected files · migration strategy · rollback · validation · financial invariants. **Nothing here is executed yet — this is the plan awaiting approval.**

Ordering principle: **build the engine + prove parity before moving any caller.** Callers move behind a passing conformance suite, cheapest/lowest-risk first, money-out gate (withdrawals) last.

---

## Wave 0 — Scaffold + Golden Vectors (no caller changes)
- **Objective:** create `kolekto-shared-financial` (L0–L2) by *lifting* the existing Node `financial.js` logic verbatim; build `golden-vectors.json` + 3 harnesses (Node/Deno/SQL) proving today's three implementations already agree on the vectors.
- **Affected:** new package only; new test files. No existing runtime file edited.
- **Migration strategy:** copy Node math into the engine unchanged (Node is the reference — it's what live reconciliation validates at 0 drift). Author vectors covering: fundraising/fixed/other × organizer/contributor × pre/post-cutoff timestamps × with/without withdrawals × the divergent withdrawn-status case.
- **Rollback:** delete the package; nothing depended on it.
- **Validation:** all 3 harnesses green against vectors. Capture that Deno's `{completed,successful}` set **fails** the divergent vector — documents the latent bug the engine fixes.
- **Invariants:** `ledger = available + pending`; `available ≥ 0`; Σ available unchanged (no caller moved).

## Wave 1 — Node delegation
- **Objective:** point `financial.js` at the engine (delegate/re-export); zero call-site churn.
- **Affected:** `utils/financial.js` (+ constants), `controllers/withdrawal.js` (replace the inline `getEligibleCollections` math with `FPE.computeWithdrawalEligibility`).
- **Migration:** `financial.js` re-exports engine functions under current names; delete duplicated bodies. Run `node --test "tests/*.test.js"` (63/63 must hold — they're characterization tests over these exact functions).
- **Rollback:** git revert one commit (`financial.js`); engine untouched.
- **Validation:** 63/63 unit + integration; live reconcile drift 0 on test project; `getEligibleCollections` output diffed against pre-change for a sample of collections.
- **Invariants:** withdrawal cap = `available − Σ pending requests`, byte-identical to today.

## Wave 2 — Edge delegation (verify + initiate)
- **Objective:** replace all edge-local math with engine imports; eliminate the edge's internal duplication.
- **Affected:** `_shared/payment.ts`, `verify-paystack-payment/_shared1.ts`, `_shared2.ts`, `initiate-paystack-payment/index.ts`.
- **Migration:** vendor/import the engine into Deno (import map). Replace `roundCurrency/calculateFees/allocateAmounts/buildTierAvailability/normalizePaymentRequest/getSettlementCutoff/reverseCalculateContribution` with engine calls. `refreshCollectionAndWallets` keeps its tier-sold side-effect (adapter) but sources balances from `FPE.computeWallet`. **This adopts Node's withdrawn-status set** → resolves the latent divergence.
- **Rollback:** redeploy previous edge function versions (Supabase keeps versions); engine unaffected.
- **Validation:** deploy to **test project only**; run a real end-to-end payment → verify wallet write matches `FPE.computeWallet`; reconcile drift 0; compare a verify run's wallet output before/after on identical input.
- **Invariants:** a verified payment produces the same `wallets` row the Node recompute would; fee on a contributor payment unchanged to the kobo.

## Wave 3 — SQL mirror lockstep
- **Objective:** formally bind `settlement_recompute_wallets()` to the engine via the conformance suite; annotate as mirror.
- **Affected:** `database/settlement_recompute.sql` (comments/annotation only unless a vector reveals a real gap).
- **Migration:** add the SQL harness to CI; annotate `-- MIRRORS FPE@<hash>`. If a vector fails, fix the SQL to match the engine (that would be a real latent bug — surface, don't silently change).
- **Rollback:** annotation-only; revert comment. Any SQL fix ships as its own reversible migration.
- **Validation:** SQL harness green; run settlement on test project → drift 0; `settlement_runs` records a clean run.
- **Invariants:** post-settlement Σ available = pre-settlement Σ(available+pending that crossed cutoff); no wallet goes negative; dormant collections roll pending→available exactly once.

## Wave 4 — Cleanup + guardrail
- **Objective:** delete now-dead duplicate bodies; add a CI gate so no runtime can reintroduce local financial math.
- **Affected:** remove dead exports left in edge shared files; add a lint/CI check (grep-gate) forbidding `calculateFees`/`roundCurrency`/cutoff redefinition outside the engine + SQL mirror.
- **Rollback:** revert cleanup commit.
- **Validation:** full suite (Node 63/63 + Deno + SQL conformance) green; grep-gate passes; final reconcile drift 0.
- **Invariants:** exactly one logical implementation per rule (1 TS + 1 SQL mirror); matrix scorecard reaches target.

---

## Cross-wave financial invariants (asserted every wave)
1. `ledger = available + pending` for every wallet.
2. `available ≥ 0`; `withdrawn ≤ net`.
3. Σ available across all wallets **unchanged** by any wave (parity, not repricing).
4. Withdrawal cap = `available − Σ pending withdrawal requests` (strict cap preserved).
5. Fees to the kobo unchanged for both fee bearers and all collection types.
6. Settlement cutoff = T+1 04:00 UTC everywhere.

## Global rollback posture
- Engine is additive until Wave 1; every caller wave is a single-commit revert.
- Edge waves roll back via Supabase function versioning.
- SQL waves ship as reversible migrations.
- **All validation on test project `lpeeckqsltxohppheucz` only** until sign-off; PROD flip is a separate, later, approved step.

## Entry / exit gates
- **Do not start Wave N+1** until Wave N's reconcile shows drift 0 and the full conformance suite is green.
- **Exit criteria for Phase 2.2 build:** matrix scorecard at target (1 TS + 1 SQL mirror per rule), 63/63 + Deno + SQL conformance green, live drift 0, grep-gate active.

## STOP
This document is the **plan**. No engine, no delegation, no edge redeploy, no SQL change has been made. Awaiting approval to begin Wave 0.
