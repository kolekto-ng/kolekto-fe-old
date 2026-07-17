# FINANCIAL_DUPLICATION_AUDIT (TASK 4)

Every financial calculation implemented in more than one place. Read-only analysis. This is *why* drift is structurally possible: the same math exists in Node, Deno, and SQL, hand-synced.

## Duplication map

| Calculation | Implementations (runtime · location) | Agree today? | Canonical target |
|-------------|--------------------------------------|--------------|------------------|
| **Fee calculation** | (1) Node `utils/financial.js:72 calculateFees` · (2) Deno `initiate-paystack-payment/index.ts:107 calculateFees` (hardcodes cap 2000, 0.015) · (3) Deno `verify-paystack-payment` fee allocation · (comment refs a 4th: `functions/_shared/payment.ts`) | Mostly (constants match) | **one PricingService** |
| **Net contribution derivation** | (1) Node `financial.js:100 deriveNetContribution` · (2) Deno verify allocation | Mostly | PricingService.netOf |
| **Wallet balance computation** (net/gross/pending/available/ledger/withdrawn) | (1) Node `financial.js:188 computeWalletBalances` · (2) Deno `verify-paystack-payment/_shared2.ts:40 refreshCollectionAndWallets` · (3) SQL `settle_pending_balances()` · (4) SQL `process_deposit_settlements()` | **NO** — Deno omits `normalizeContributions`; SQL reads `deposits` | **one WalletService.recompute** |
| **available_balance** | inside all four above | **NO** (SQL = −withdrawn) | WalletService |
| **pending_balance** | inside all four above | **NO** (SQL = 0) | WalletService |
| **ledger_balance** | Node + Deno (SQL doesn't set it → identity breaks) | **NO** | WalletService |
| **net_payment** | Node `computeWalletBalances` (normalized) vs Deno `_shared2` (raw Σ amount) | organizer-borne differ by fees | WalletService |
| **Settlement cutoff (T+1)** | Node `financial.js:141 getSettlementCutoff` · Deno `_shared1.ts:516` copy · SQL `CURRENT_DATE` in the two functions | Node/Deno agree (4am UTC); SQL uses `CURRENT_DATE` (midnight) — **different boundary** | SettlementService |
| **Withdrawable / eligibility** | (1) `withdrawal.js:111 getWithdrawableSnapshot` (per-collection, via refreshWallet) · (2) `withdrawal.js:143 getEligibleCollections` (bulk recompute) | Yes (same formula) | WithdrawalService |
| **Collection totals** (`total_contributions`, tier `sold_quantity`) | Node `deposit.js updateWalletStats` (count only) · Deno `_shared2` (count + tier sold) | **NO** — Deno also updates tier sold; Node does not | one recompute |
| **Fee breakdown persisted** (`wallets.fee_breakdown`) | old Express `collection.js` (removed) vs edge/CollectionService (not written) | n/a (Phase-1) | — |

## Severity ranking
1. **Wallet balance computation (4 impls, disagreeing)** — the direct cause of the drift incident. The SQL pair reads the wrong table; Deno omits normalization; only Node is fully canonical.
2. **Settlement cutoff (3 definitions, one differs)** — Node/Deno use 04:00 UTC; the SQL functions use `CURRENT_DATE` (00:00). Even if the SQL read `contributions`, it would classify pending/available on a **different boundary**.
3. **Fee calculation (2–4 impls)** — currently agree, but hardcoded Deno constants will drift if Node's change.
4. **Collection totals / tier sold** — Node path doesn't update tier availability; Edge does → collections settled via different writers show different sold-counts.

## Conclusion
There is **no single source for any balance number.** Every wallet field is computed by 2–4 independent implementations across 3 runtimes with **no shared definition**. Consolidation to one `WalletService.recompute` (over `contributions`) + one `PricingService` + one `SettlementService` (see `CANONICAL_FINANCIAL_ARCHITECTURE.md`) is the structural fix; the drift incident is the symptom.
