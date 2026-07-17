# Kolekto — Financial Drift Risk Assessment

Companion to `FINANCIAL_DRIFT_ROOT_CAUSE_REPORT.md` and `FINANCIAL_REPAIR_PLAN.md`. Investigation only — nothing modified.

## Money-at-risk verdict

**On current evidence, no money is lost.** The drift is between a **cache** (`wallets.*`) and its **intact source** (`contributions` + `withdrawals`), and/or between **two formulas** for the same figure. The reconciliation "expected" is derived from the source, so a non-zero expected proves the underlying payment/withdrawal rows exist. **This verdict is conditional on `§A6` returning zero rows** (no withdrawn-exceeds-raised, no concerning orphans) — that query is the only thing that could reveal real loss, and it must be run before the verdict is treated as final.

## Risk by root cause

| Cause | Real-money risk | User-visible impact | Production risk of the REPAIR | Confidence in diagnosis |
|-------|-----------------|---------------------|-------------------------------|--------------------------|
| **R1** Edge/Node fee divergence (organizer-borne) | **None** — withdrawal gate re-normalizes, so no over-payout | Displayed balance over-states by fees on organizer collections | Low (recompute is idempotent/reversible) — but **must ratify the formula first** | High |
| **R2** Settlement staleness | **None** — reclassification only | Funds show as pending/0 when they should be available → organizer thinks money is stuck | Low | High |
| **R3** Legacy negative balances | **None** — source nets to 0 | Negative/odd balance shown | Low (recompute floors at 0) | High (impossible under current code) |
| **R4** Missing / duplicate wallet | **None** — source intact | Missing balances; multi-wallet reads pick newest | **Medium for duplicates** (merging is a decision, not a mechanical dedup) | High |
| **R5** Historical fee-policy | **None** — semantic | Small diffs that are neither cache nor source "wrong" | Low | Medium |
| **§A6 exception (if any rows)** | **POTENTIALLY REAL** | — | — | Must investigate individually |

## Key risks of acting carelessly (why "don't repair yet" is right)

1. **Recomputing before ratifying the R1 formula** rewrites 48 wallets to a number you may then change — double the churn, double the risk. *Mitigation:* R0 decision gate.
2. **Recomputing while two divergent writers remain** (Edge raw vs Node normalized) means R1 drift **reappears on the next payment**. *Mitigation:* fix the writer (Phase 2.1) as part of the recompute program, not after.
3. **Duplicate wallet rows** can hide balance; a naive `keep newest` dedup could discard the row that actually had the right number. *Mitigation:* verify balances (reconcile) per duplicate before removing.
4. **Silent refresh failures** (no retry/alert) mean drift will keep accruing until observability (the Phase-2.0 audit helper, once wired) and a reliable settlement executor are in place. *Mitigation:* wire `auditFinancial`, confirm exactly one daily settlement executor runs.
5. **The SQL `process_deposit_settlements()` is unseen** — it may implement a *third* net formula. *Mitigation:* dump and review its body before trusting/retiring it; it could itself be a drift source.

## Should this be repaired before PaymentService?

**Yes — the data recompute and the settlement-executor/observability fixes should precede PaymentService**, because (a) PaymentService consolidation will move wallet writes and you want a clean, reconciled baseline to validate the migration against, and (b) the R1 writer alignment *is* part of the WalletService consolidation. Sequence: **guardrails (2.0, done) → confirm buckets → ratify formula → backfill wallets → bulk recompute → single writer (2.1) → PaymentService.**

## Confidence & residual unknowns
- **High confidence** in the *mechanisms* (R1–R4 are proven in code). **Medium confidence** in the *distribution* across the 48 (needs the SQL run — I have no DB access and did not fabricate it).
- **Residual unknowns to close with data:** the `process_deposit_settlements()` body; whether fee constants changed historically (R5); the `updated_at`/author of each negative wallet (R3); and the §A6 integrity result (the money-loss gate).
