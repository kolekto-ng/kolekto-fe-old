# SETTLEMENT_SERVICE_DESIGN (Phase 2.1C — STEP 3)

## Principles (all satisfied)
1. **contributions are the only source of truth** — settlement reads `contributions`(paid) + `withdrawals`, **never `deposits`**.
2. **wallets are only a projection** — settlement recomputes and overwrites the cache; it moves no money.
3. **exactly ONE settlement implementation** — the Postgres function `settlement_recompute_wallets()`. All entry points (pg_cron, the Node `SettlementService`, manual/admin) delegate to it.
4. **exactly ONE settlement cutoff** — `settlement_cutoff()` (4am UTC), mirroring `getSettlementCutoff`.
5. **dormant collections auto-settle** — the scheduled recompute reclassifies aged pending → available with no triggering event.
6. **no logic depends on deposits** — proven; `deposits` is not referenced by the settlement path.

## Why the canonical implementation is a DB function (not Node)
The investigation (STEP 1) showed the Node cron does **not** reliably execute in the deployed environment, while pg_cron does. Settlement must be *reliable* above all. Placing the single recompute in the database — called by pg_cron — gives reliability, atomicity, and locality to the source data, and lets every code entry point delegate to one implementation (no duplicate balance math for settlement).

## Components

```
pg_cron 'settlement-recompute-wallets' (0 4 * * *)      ← the reliable scheduler
        │  SELECT settlement_recompute_wallets('cron')
        ▼
settlement_recompute_wallets(triggered_by)              ← THE single implementation
        │  cutoff := settlement_cutoff()                ← the single cutoff
        │  recompute EVERY wallet from contributions+withdrawals (idempotent, atomic)
        │  INSERT settlement_runs row (observable)      ← wallets_processed, drift_after, ok
        ▼
wallets projection (correct)

services/settlementService.js (Node)                    ← code entry point / wrapper
        └─ runDailySettlement(triggeredBy) → supabase.rpc('settlement_recompute_wallets')
           (used by the Node cron fallback, an admin trigger, or tests; delegates to the ONE impl)
```

## Requirement mapping

| Requirement | How met |
|-------------|---------|
| derives only from contributions | function joins `contributions`(paid) + `withdrawals`; no `deposits` |
| uses WalletService | the function *is* the single wallet recompute for settlement; `SettlementService` (Node) delegates to it. A per-collection `WalletService.recompute` unifying the event paths is Phase 2.1 |
| no duplicate balance math (settlement) | one function; Node wrapper calls it; the old Node loop was **removed** (delegates now) |
| single cutoff | `settlement_cutoff()` |
| idempotent | full recompute; two runs verified identical (drift 0) |
| retry-safe | single transaction — a failure rolls back; the next scheduled/retried run redoes cleanly |
| observable | `settlement_runs` (per-run `wallets_processed`, `drift_after`, `ok`); structured `financial.settlement_completed/failed` audit log from the Node wrapper |

## Balance math (faithful to the canonical)
`settlement_recompute_wallets()` implements `normalizeContributions → computeWalletBalances` exactly (per-fee rounding as in `calculateFees`; organizer = gross−fees, contributor = deriveNetContribution; pending by cutoff; available = max(0, settled − completed withdrawals); ledger = available + pending). Validated **byte-identical** to the canonical (0 drift across 57 wallets).

## Observability & monitoring
- `settlement_runs.ok=false` or `drift_after>0` → alert (settlement produced/left drift).
- No run in >25h → alert (scheduler stalled).
- Node wrapper emits `financial.settlement_completed` / `financial.settlement_failed` (via `financialAudit`).

## Scheduler policy (single active scheduler)
pg_cron `settlement-recompute-wallets` is authoritative. Set **`RUN_SETTLEMENT_CRON=false`** so the Node cron does not also fire (it now delegates to the same function; running both would be a duplicate scheduler, harmless-but-wasteful).

## Out of scope (Phase 2.1 / 2.1C-2)
- Consolidating the event-path recompute copies (edge Deno `refreshCollectionAndWallets`, Node `updateWalletStats`/`refreshWallet`) and this settlement function into a single shared implementation.
- Deleting `deposits`, the legacy SQL functions, and the legacy edge/controllers.
