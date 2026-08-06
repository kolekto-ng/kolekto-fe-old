# PHASE_2_1C_IMPLEMENTATION_REPORT

**Mission:** replace the settlement architecture with a canonical, reliable mechanism. **Done and validated** on the test project `lpeeckqsltxohppheucz`.

## What changed
The nightly settlement was **corrupting** (SQL `settle_pending_balances()` read the empty `deposits` table) and the *correct* mechanism (Node `runDailySettlement`) was **not executing** in the deployed environment. This phase replaced both with a single, reliable, contributions-based settlement.

## The canonical settlement (now live on test)
- **One implementation:** Postgres `settlement_recompute_wallets()` — recomputes every wallet from `contributions`+`withdrawals` (never `deposits`), idempotent, atomic, observable.
- **One cutoff:** `settlement_cutoff()` (4am UTC).
- **One scheduler:** pg_cron `settlement-recompute-wallets` (`0 4 * * *`) — the reliable scheduler in this Supabase-centric stack.
- **Code entry point:** `services/settlementService.js` (Node) delegates to the same function; `jobs/paymentSettlement.js` refactored to delegate (its duplicate Node balance loop removed).
- **Observability:** `settlement_runs` table (`wallets_processed`, `drift_after`, `ok`) + `financial.settlement_*` audit logs.

## Principles — all satisfied
✓ contributions = source of truth · ✓ wallets = projection only · ✓ exactly one settlement implementation · ✓ one cutoff · ✓ dormant collections auto-settle · ✓ no dependency on `deposits`.

## Evidence (live)
- Dormant collection `92819d85` settled: pending 7,500 → available 12,500.
- Reconciliation: 57 wallets, 0 negatives, 0 broken identity, 0 drift, pending 0.
- Idempotent: two runs, both `drift_after=0, ok=true`.
- Single active settlement scheduler; two corruptors remain disabled.
- No money movement: 185 paid contributions, 24 withdrawals unchanged; `deposits` still 0.
- Unit tests: 63/63 pass.

## Deliverables
`SETTLEMENT_ARCHITECTURE_AUDIT.md` · `SETTLEMENT_SERVICE_DESIGN.md` · `SETTLEMENT_EXECUTION_PLAN.md` · `SETTLEMENT_VALIDATION.md` · this report.
Code: `kolekto-be-old/database/settlement_recompute.sql`, `services/settlementService.js`, `tests/settlementService.test.js`, refactored `jobs/paymentSettlement.js`.

## Operator actions before prod rollout
1. Apply `database/settlement_recompute.sql` to prod; run once (`'manual'`); confirm `drift_after=0`.
2. Schedule the pg_cron job; keep `settle-pending-balances`/`settle-pending-deposits` disabled.
3. **Set `RUN_SETTLEMENT_CRON=false`** (pg_cron is the sole scheduler).
4. Add monitoring alerts on `settlement_runs`.

## STOP — Phase 2.1C-2 (NOT done here)
As instructed, **no deletions**: `deposits`, `settle_pending_balances()`, `process_deposit_settlements()`, the `settle-pending-deposits` edge, and the legacy controllers all remain in place (disabled where relevant) as a fallback. Their removal — and consolidating the remaining event-path recompute copies into one shared WalletService — is Phase 2.1C-2 / Phase 2.1. Awaiting approval.
