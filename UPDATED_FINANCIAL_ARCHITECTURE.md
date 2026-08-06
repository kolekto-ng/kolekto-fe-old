# UPDATED_FINANCIAL_ARCHITECTURE (after Phase 2.1C-2 Tier 0)

The financial architecture after removing the dead settlement infrastructure.

```
                 contributions (paid)  +  withdrawals          ← SOURCE OF TRUTH
                          │
        ┌─────────────────┼───────────────────────────┐
        ▼                 ▼                             ▼
 Edge verify        withdrawal.js                SettlementService
 refreshCollection  refreshWallet /              settlement_recompute_wallets()
 AndWallets         getEligibleCollections       (pg_cron 'settlement-recompute-wallets', 0 4 * * *)
 (per payment)      (per withdrawal)             (daily; dormant collections roll pending→available)
        │                 │                             │
        └─────────────────┴───────────────┬─────────────┘
                                          ▼
                                  wallets (PROJECTION)
                                          │
                          dashboards · admin · withdrawal cap · email view
```

## Settlement subsystem (now singular)
| Concern | Implementation |
|---------|----------------|
| Settlement | `settlement_recompute_wallets()` (SQL) — from contributions, idempotent, observable |
| Cutoff | `settlement_cutoff()` (SQL) = 4am UTC |
| Scheduler | pg_cron `settlement-recompute-wallets` (`0 4 * * *`) |
| Observability | `settlement_runs` (`wallets_processed`, `drift_after`, `ok`) |

**Removed (Tier 0):** `settle_pending_balances()`, `process_deposit_settlements()`, cron 4, cron 5, edge source `settle-pending-deposits` (deployed edge pending CLI deletion).

## Still present (by design — NOT removed in Tier 0)
- **`deposits` table** (0 rows) — leaf; retirement is Tier 1/2 after removing its `deposit.js`/`_shared1.ts` references.
- **`deposit.js`** — RUNTIME-CRITICAL (webhook, verify, transactions, `invokeVerifyEdgeFunction` for admin reconcile). Keep.
- **Duplicate balance math across runtimes** — Node `computeWalletBalances` · Deno `refreshCollectionAndWallets` · SQL settlement. They agree (0 drift); unification is Phase 2.1 (the "Financial Projection Engine": `computeWallet/computePending/computeAvailable/computeLedger/calculateFees/normalizeContribution/getSettlementCutoff/computeOrganizerBalance` with every runtime delegating to one authoritative or verified-equivalent implementation).

## "Exactly one?" scorecard (updated)
| Concern | One? |
|---------|:---:|
| Financial source of truth | ✅ contributions + withdrawals |
| Withdrawal computation | ✅ withdrawal.js |
| Settlement implementation | ✅ `settlement_recompute_wallets()` (legacy removed) |
| Settlement scheduler | ✅ pg_cron cron 7 |
| Settlement cutoff | ✅ `settlement_cutoff()` (for the settlement path) |
| Wallet recompute / cutoff / normalization across runtimes | ❌ still 3 (Node/Deno/SQL) — Phase 2.1 |

## Config
Set `RUN_SETTLEMENT_CRON=false` so pg_cron remains the sole scheduler (the Node cron delegates to the same function). Monitor `settlement_runs` (alert on `ok=false`, `drift_after>0`, or no run in 25h).

## Live state
57 wallets · 0 drift · 0 negatives · identity holds · Σ available ₦49,777,348.09 · Σ pending ₦0 · 1 active settlement scheduler · `deposits` 0 rows · 185 paid contributions.
