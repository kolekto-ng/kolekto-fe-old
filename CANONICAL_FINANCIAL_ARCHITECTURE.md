# CANONICAL_FINANCIAL_ARCHITECTURE (Phase 2.1C-2 — "exactly one?" verification)

Post-settlement state. For each concern the task requires **exactly one** implementation. Below is the honest count; duplicates are **listed, not removed** (per stop condition). Read-only.

| Concern | Exactly one? | Implementations (live) |
|---------|:---:|------------------------|
| **Financial source of truth** | ✅ **1** | `contributions` (paid) + `withdrawals` |
| **Withdrawal computation** | ✅ **1** | `withdrawal.js` (`refreshWallet`/`getEligibleCollections`, Node `computeWalletBalances`) |
| **Settlement implementation (active)** | ✅ **1 active** | `settlement_recompute_wallets()` (SQL). Legacy `settle_pending_balances`/`process_deposit_settlements` exist but **disabled** |
| **Settlement scheduler (active)** | ✅ **1 active** | pg_cron `settlement-recompute-wallets` (cron 7). Node cron delegates to same fn; set `RUN_SETTLEMENT_CRON=false` |
| **Wallet projection implementation** | ❌ **3** | Node `computeWalletBalances` (`financial.js`) · Deno `refreshCollectionAndWallets` (`_shared2.ts`) · SQL `settlement_recompute_wallets` |
| **Settlement cutoff** | ❌ **3** | Node `getSettlementCutoff` · Deno copy (`_shared1.ts`) · SQL `settlement_cutoff()` |
| **Contribution normalization / fees** | ❌ **3** | Node `normalizeContributions`/`calculateFees` · Deno copies · SQL inline (in `settlement_recompute_wallets`) |

## Summary
- **Achieved single-source:** source of truth, withdrawal computation, the *active* settlement implementation, and the *active* settlement scheduler.
- **Still triplicated (Node / Deno / SQL):** the wallet-balance recompute, the settlement cutoff, and normalization/fees. These are the same formula expressed once per runtime because the event paths run in Deno (edge) and Node (Express) while settlement runs in SQL (pg_cron). They currently **agree** (verified: reconciliation 0 drift), so they are a *consolidation* item, not a defect.

## Path to literally one (Phase 2.1 — NOT this phase)
Unify the three recompute copies behind a single **WalletService.recompute(collectionId)**:
- the edge verify path calls the service (edge → Express API), instead of its own Deno copy;
- settlement calls the same service (or the service and the SQL function are proven bit-identical and the SQL becomes a thin generated mirror);
- one `getSettlementCutoff`, one `normalizeContributions`/`calculateFees`, imported everywhere.
This removes the Deno and SQL duplicates. It is a behavior-sensitive migration (touches the live edge verify path) and belongs to Phase 2.1, canaried like the Collection cutover.

## Target diagram (post Phase 2.1)
```
contributions + withdrawals  (SOURCE OF TRUTH)
        │
        ▼
WalletService.recompute()  ← ONE implementation (one cutoff, one normalization, one fee calc)
        ▲            ▲               ▲
  edge verify   withdrawal     SettlementService (scheduled)
        │
        ▼
wallets (projection)  →  dashboards / admin / withdrawal cap
```

## This phase's contribution
Phase 2.1C established **one active settlement + one scheduler + one cutoff for settlement** and disabled all competitors. The remaining triplication is documented here for Phase 2.1.
