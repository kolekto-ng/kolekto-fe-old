# SETTLEMENT_EXECUTION_PLAN (Phase 2.1C — STEP 4, executed)

What was implemented (on the test project `lpeeckqsltxohppheucz`) and the rollout for other environments. **Legacy is not deleted** (that is Phase 2.1C-2).

## Implemented (this phase)

| # | Change | Where | Reversible? |
|---|--------|-------|-------------|
| 1 | `settlement_cutoff()` — single 4am-UTC cutoff | DB (`database/settlement_recompute.sql`) | `DROP FUNCTION` |
| 2 | `settlement_runs` observability table | DB | `DROP TABLE` |
| 3 | `settlement_recompute_wallets(triggered_by)` — the one settlement impl (contributions-based, idempotent, atomic, observable) | DB | `DROP FUNCTION` |
| 4 | pg_cron job `settlement-recompute-wallets` `0 4 * * *` (single active scheduler) | DB | `cron.unschedule(...)` |
| 5 | `services/settlementService.js` — Node wrapper delegating to the rpc | code | revert file |
| 6 | `jobs/paymentSettlement.js` refactored to delegate (removed duplicate Node balance loop) | code | revert file |
| 7 | `tests/settlementService.test.js` (5 tests) | code | — |

SQL is version-controlled in `kolekto-be-old/database/settlement_recompute.sql`.

## Rollout to other environments (prod, when approved)
1. Apply `database/settlement_recompute.sql` (creates cutoff fn, runs table, settlement fn).
2. `SELECT settlement_recompute_wallets('manual');` once to settle current state; confirm `drift_after=0, ok=true`.
3. `SELECT cron.schedule('settlement-recompute-wallets','0 4 * * *','SELECT public.settlement_recompute_wallets(''cron'');');`
4. Ensure the two corrupting crons are disabled (`settle-pending-balances`, `settle-pending-deposits` → `active=false`).
5. **Set `RUN_SETTLEMENT_CRON=false`** in the backend env so pg_cron is the sole scheduler.
6. Deploy the backend with the refactored `paymentSettlement.js` + `settlementService.js` (so any manual/admin trigger also delegates to the one function).
7. Add monitoring on `settlement_runs` (alert on `ok=false`, `drift_after>0`, or no run in 25h).

## Ordering rules
- Steps 1–3 (DB) before 4 (schedule).
- Corruptors disabled (step 4/existing) before/with scheduling the new one — never two writers with conflicting formulas.
- `RUN_SETTLEMENT_CRON=false` before/with enabling pg_cron to avoid a duplicate scheduler.

## Rollback
- Disable new job: `cron.alter_job` / `cron.unschedule('settlement-recompute-wallets')`.
- Restore wallets from `wallets_backup_20260717` if ever needed (settlement is idempotent, so rarely necessary).
- Revert the two code files.
- The legacy SQL functions and crons remain in place (disabled) as a fallback until 2.1C-2.

## NOT done (Phase 2.1C-2 / 2.1)
Deleting `deposits`, `settle_pending_balances()`, `process_deposit_settlements()`, the `settle-pending-deposits` edge, and consolidating the event-path recompute copies into one shared WalletService.
