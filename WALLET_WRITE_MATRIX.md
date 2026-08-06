# WALLET_WRITE_MATRIX (TASK 1)

Every code path that **writes** `wallets`. Read-only analysis; nothing modified. Evidence: code search across `kolekto-be-old`, edge functions, and live `pg_proc`/`cron.job` introspection on project `lpeeckqsltxohppheucz`.

**Column note:** the wallet balance columns are `net_payment`, `gross_payment`, `pending_balance`, `available_balance`, `ledger_balance`, `withdrawn` (there is **no** `withdrawn_balance` column — the brief's name; the real one is `withdrawn`).

## Writers

| # | Writer | File · function | Runtime | Trigger (when) | Fields written | Balances computed | Active? |
|---|--------|-----------------|---------|----------------|----------------|-------------------|---------|
| 1 | Edge verify | `supabase/functions/verify-paystack-payment/_shared2.ts` · `refreshCollectionAndWallets` | Edge Function | per payment verify (live path) | net_payment, gross_payment, pending_balance, available_balance, ledger_balance, withdrawn (+ SELECT-then-UPDATE or INSERT) | **locally**, from `contributions`+`withdrawals` (own Deno copy of the math) | **YES — live primary writer** |
| 2 | Express verify/webhook | `controllers/deposit.js:242` · `updateWalletStats` | Express | per Express verify/webhook | same 6 | **delegated** → `utils/financial.js computeWalletBalances` (from `contributions`) | Code active, but **path inactive** (Express `deposits` init unused; `deposits`=0 rows) |
| 3 | Withdrawal refresh | `controllers/withdrawal.js:36` · `refreshWallet` | Express | per withdrawal request + approve/reject | net_payment, pending_balance, available_balance, ledger_balance, withdrawn | **delegated** → `computeWalletBalances` (from `contributions`) | **YES** |
| 4 | Node settlement cron | `jobs/paymentSettlement.js:27` · `runDailySettlement` | Node cron (`0 4 * * *`) | daily **iff `RUN_SETTLEMENT_CRON=true`** | net_payment, pending_balance, available_balance, ledger_balance, withdrawn | **delegated** → `computeWalletBalances` (from `contributions`) | Conditional (env-gated) |
| 5a | Wallet creation (Edge) | `supabase/functions/create-collection/index.ts` (wallet upsert) | Edge | per collection create | row insert: all balances = 0 | n/a (zeros) | YES |
| 5b | Wallet creation (Express) | `services/collectionService.js` · `createWalletIfAbsent` → `repositories/collectionRepository.js` | Express | per collection create (Phase-1 path) | row insert: all balances = 0 | n/a (zeros) | YES (dormant until FE flip) |
| 6 | **SQL settle_pending_balances()** | Postgres function · `cron.job` id 4 (`SELECT settle_pending_balances()`) | SQL cron (`0 4 * * *`) | daily 04:00 UTC | **available_balance, pending_balance** (+ updated_at) | **locally, from `deposits`** (EMPTY) → sets available = −withdrawn, pending = 0 | **YES — CORRUPTING (root cause)** |
| 7 | SQL process_deposit_settlements() | Postgres function · `cron.job` id 5 (via `settle-pending-deposits` edge) | SQL cron (`0 4 * * *`) | daily 04:00 UTC | available_balance, pending_balance (read-modify-write) | **locally, from `deposits`** (EMPTY) → **no-op** (loops 0 rows) | Active but **no-op** (RMW landmine) |

## Non-writers (verified read-only)
- `controllers/wallet.js` · `getCollectionWallet` — **SELECT only** (user wallet display).
- `controllers/admin/wallet.js` — **live recompute, no persisted write** (reads `contributions`).
- `controllers/withdrawal.js` · `getEligibleCollections` — recomputes in-memory, does not persist.
- `scripts/reconcileFinancials.js`, `utils/financialReconcile.js`, tests — read-only.

## Key observations
- **7 distinct writers; 3 different balance implementations** — Deno (`refreshCollectionAndWallets`), Node (`computeWalletBalances`), SQL (`settle_pending_balances` / `process_deposit_settlements`).
- **Only writers #6 and #7 read `deposits`.** Both are broken on the live `contributions` model. #6 is the nightly corruptor.
- **Writers #1–#4 all derive from `contributions`** and are correct (modulo the Deno-vs-Node code duplication, see `FINANCIAL_DUPLICATION_AUDIT.md`).
- **No database trigger writes `wallets`** (verified via `pg_trigger`).
