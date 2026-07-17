# CANONICAL_FINANCIAL_ARCHITECTURE (TASK 5)

The target: **exactly one implementation** of each financial computation, all derived from the canonical source. Design only — no code.

## Principles
1. **Single source of truth:** `contributions` (status=`paid`) + `withdrawals`. `wallets.*` is a **derived projection** (a cache), never authoritative.
2. **One writer per concern.** Every wallet write goes through **one** service method.
3. **One runtime owns balance math** (Node/Express — the write authority from Phase 1). Edge/SQL do not re-implement it.
4. **Ledger-ready:** the projection is rebuildable from source at any time (already true — that's why the incident is recoverable).

## The one-and-only implementations

| Concern | Canonical owner | Replaces (today) |
|---------|-----------------|------------------|
| **Wallet computation** (net/gross/pending/available/ledger/withdrawn) | `WalletService.recompute(collectionId)` → `computeWalletBalances` (single copy) | Deno `refreshCollectionAndWallets`, SQL `settle_pending_balances`, SQL `process_deposit_settlements`, Node `updateWalletStats` |
| **Balance computation** (the formula) | `utils/financial.js computeWalletBalances` (the sole definition, imported everywhere) | 4 divergent copies |
| **Fee computation** | `PricingService.feeFor()` / `netOf()` (single `calculateFees`) | Node + Deno hardcoded copies |
| **Settlement** (T+1 pending→available) | `SettlementService` — one cutoff (`getSettlementCutoff`), one scheduled job that calls `WalletService.recompute` for due collections | Node cron + 2 SQL functions + implicit recompute-on-verify |
| **Withdrawal eligibility** | `WithdrawalService.eligible()` / `withdrawableCap()` (available − pending requests, from `WalletService`) | `getWithdrawableSnapshot` + `getEligibleCollections` (already 1 formula, 2 entry points) |
| **Ledger projection** | `WalletService` reads/writes the `wallets` projection; (future) `LedgerService` posts append-only entries and `wallets = SUM(ledger)` | denormalized columns recomputed ad hoc |

## Target write flow

```
payment verified  ─┐
withdrawal change  ─┼─►  WalletService.recompute(collectionId)  ──►  wallets (projection)
settlement (daily) ─┘        │ uses computeWalletBalances (ONE copy)
                             │ reads contributions + withdrawals (SOURCE)
                             └─ emits WalletRecomputed event  ──► activity/audit/monitor
```

- **Edge functions** either call `WalletService` (via the API) or are demoted to read-only; they stop writing wallets with their own math.
- **SQL functions** that compute balances are **retired** (a DB function may exist only as a thin `refresh` that mirrors the Node formula, if a DB-side recompute is ever required — but not a second definition).
- **Settlement** becomes: one daily job → `WalletService.recompute` for collections with due pending balances. No `deposits`. No second cutoff.

## Migration alignment
- This is the Phase 2.1 (WalletService/PaymentService) consolidation. The drift repair (Phase 2.1B-B) is the *first* concrete step: recompute all wallets via the canonical path, then make it the *only* path.
- `deposits` and its settlement functions are removed (see `DEPOSITS_REMOVAL_PLAN.md`) — they are the "second model" that must not survive consolidation.

## Invariant to enforce forever (monitor)
`available_balance + pending_balance = ledger_balance`, and `wallets.* == computeWalletBalances(source)` within ₦0.01, for every collection — checked by the scheduled reconciliation (`scripts/reconcileFinancials.js`). Any deviation = alert. This is what would have caught the incident on night one.
