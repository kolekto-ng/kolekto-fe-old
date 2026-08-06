# FINANCIAL_COMPUTATION_AUDIT (Phase 2.2 — Deliverable 1)

Complete inventory of every financial computation in Kolekto and where it is implemented. **Discovery only — no code changed.** Grounded in a direct read of the exact exports in each runtime.

## Runtimes
- **Node** = Express backend (`kolekto-be-old`), canonical module `utils/financial.js`.
- **Edge** = Supabase Deno functions (`kolekto-fe-old/supabase/functions`). Two internal copies: `_shared/payment.ts` (used by `initiate-paystack-payment`) and `verify-paystack-payment/_shared1.ts` (verify's own copy) + `_shared2.ts` (wallet recompute).
- **SQL** = Postgres functions (`settlement_recompute_wallets()`, `settlement_cutoff()`).

## Per-rule inventory

### 1. `roundCurrency`
| Impl | File | Runtime | Canonical? |
|------|------|---------|-----------|
| `roundCurrency` | `utils/financial.js:50` | Node | reference |
| `roundCurrency` | `_shared/payment.ts:58` | Edge | duplicate |
| `roundCurrency` | `_shared1.ts:56` | Edge | **duplicate (2nd Deno copy)** |
| inline `round(x,2)` | `settlement_recompute_wallets()` | SQL | duplicate |
- Rule: 2-dp round, coerce non-numeric→0. **4 implementations.** Difficulty: **S**. Risk: **Low** (trivial, agree).

### 2. `calculateFees` (platform + gateway fee, caps)
| Impl | File | Runtime | Notes |
|------|------|---------|-------|
| `calculateFees` | `financial.js:72` | Node | constants `PLATFORM_FEE_RATES`, `GATEWAY_FEE_RATE=0.015`, `MAX_FEE_AMOUNT=2000` |
| `calculateFees` | `_shared/payment.ts:107` | Edge | hardcoded caps/rates |
| `calculateFees` | `_shared1.ts:128` | Edge | **2nd Deno copy** (hardcoded) |
| inline fee math | `settlement_recompute_wallets()` | SQL | hardcoded `least(x*rate,2000)` |
- Rule: platform 1% fundraising / 0.5% else, gateway 1.5%, each capped ₦2,000; contributor ⇒ payable=amount+fees, organizer ⇒ payable=amount. **4 implementations.** Callers: init (edge), collection create (Node), verify (edge), settlement (SQL), reconcile (Node). Difficulty: **M**. Risk: **Med** (hardcoded constants drift silently).

### 3. `normalizeContribution` / net derivation
| Impl | File | Runtime | Notes |
|------|------|---------|-------|
| `normalizeContributions` | `financial.js:254` | Node | recompute net from gross (organizer=gross−fees) |
| `deriveNetContribution` | `financial.js:100` | Node | contributor back-out |
| `normalizePaymentRequest` | `_shared/payment.ts:266` | Edge | payment-init normalization |
| `normalizePaymentRequest` | `_shared1.ts:250` | Edge | **2nd Deno copy** |
| `reverseCalculateContribution` | `_shared1.ts:147` | Edge | net back-out |
| inline normalize | `settlement_recompute_wallets()` | SQL | organizer=gross−fees, contributor=derive |
- **~5 implementations across 2 concerns** (init-time normalization vs recompute-time normalization). Difficulty: **M–L**. Risk: **Med**.

### 4. `getSettlementCutoff` (T+1, 4am UTC)
| Impl | File | Runtime |
|------|------|---------|
| `getSettlementCutoff` | `financial.js:141` | Node |
| `getSettlementCutoff` | `_shared1.ts:517` | Edge |
| `settlement_cutoff()` | SQL function | SQL |
- **3 implementations.** `isPaymentSettled` (`financial.js:165`) is Node-only. Difficulty: **S**. Risk: **Low** (agree; but 3 places to change).

### 5. Wallet balances — net / gross / pending / available / ledger / withdrawn
| Impl | File | Runtime | Notes |
|------|------|---------|-------|
| `computeWalletBalances` | `financial.js:188` | Node | the core projection math |
| `refreshCollectionAndWallets` | `_shared2.ts:40` | Edge | Deno recompute + **also** writes tier `sold_quantity` |
| `settlement_recompute_wallets()` | SQL | SQL | the canonical settlement |
- **3 implementations.** Callers of Node: `deposit.updateWalletStats`, `withdrawal.refreshWallet` + `getEligibleCollections` (inline), `dashboard.js`, `collectionAccess.js`, `admin/wallet.js`, `scripts/reconcileFinancials.js`, `utils/financialReconcile.js`. Difficulty: **L**. Risk: **High** (the money projection).
- ⚠️ **Known divergence:** the withdrawn set differs — Node counts `{completed, successful, success, approved}` (`financial.js:225`), Deno `COMPLETED_WITHDRAWAL_STATUSES` = `{completed, successful}` (`_shared1.ts:514`). They agree *today* only because no collection has hit the divergent sequence (an `approved`/`success` withdrawal followed by an edge-triggering payment). This is a latent drift source.
- ⚠️ **Side-effect divergence:** the Edge recompute also updates `collections.price_tiers` sold/remaining; the Node recompute does not.

### 6. `available` / `pending` / `ledger` (sub-parts of #5)
All three are computed **inside** each of the three balance implementations (Node/Deno/SQL) — not separately. `available = max(0, settledNet − completedWithdrawals)`, `pending = Σ net where created_at ≥ cutoff`, `ledger = available + pending`. **3 implementations each** (co-located with #5).

### 7. Withdrawal eligibility / withdrawable cap
| Impl | File | Runtime | Notes |
|------|------|---------|-------|
| `getWithdrawableSnapshot` | `withdrawal.js:111` | Node | `available − Σ pending withdrawal requests` |
| `getEligibleCollections` | `withdrawal.js:143` | Node | bulk, **inline** `computeWalletBalances` |
| `sumPendingWithdrawals` | `withdrawal.js:86` | Node | pending-request sum |
| `PENDING_WITHDRAWAL_STATUSES` | `withdrawal.js:84` | Node | `{pending, processing}` |
- **1 runtime, but 2 code paths** (snapshot vs bulk) both re-deriving the cap. Difficulty: **M**. Risk: **High** (strict-cap = money-out gate). Note the known withdrawal TOCTOU (Phase 2.0 `g2`, unapplied).

### 8. Collection totals / tier availability
| Impl | File | Runtime | Notes |
|------|------|---------|-------|
| `total_contributions`, tier sold/remaining | `_shared2.refreshCollectionAndWallets` | Edge | writes `collections` |
| `total_contributions` | (formerly `updateWalletStats`) | Node | count |
| `buildTierAvailability` | `_shared/payment.ts:154` + `_shared1.ts:180` | Edge | **2 Deno copies** |
- **Divergent:** only the Edge path updates tier sold-counts. Difficulty: **M**. Risk: **Med** (display; ticket capacity).

### 9. Fee allocation across line items
| Impl | File | Runtime |
|------|------|---------|
| `allocateAmounts` | `_shared/payment.ts:130` | Edge |
| `allocateAmounts` | `_shared1.ts:166` | Edge (**2nd copy**) |
- Edge-only, but **duplicated within the edge**. Difficulty: **S**. Risk: **Low**.

## Summary of duplication
- **Node ↔ Edge ↔ SQL triplication:** fees, normalization, cutoff, wallet balances.
- **Edge ↔ Edge duplication:** `_shared/payment.ts` and `_shared1.ts` each independently implement `roundCurrency`, `calculateFees`, `allocateAmounts`, `buildTierAvailability`, `normalizePaymentRequest`, `getCollectionType`, `getPriceTiers`. The edge duplicates *itself*.
- **Node-internal:** `computeWalletBalances` is one module but re-invoked from ~8 callers, and `withdrawal.js` re-derives the cap in 2 places.
- **Known divergences (agree today, could drift):** withdrawn-status set (Node vs Deno), tier-sold side effect (Edge only).

## Overall risk & difficulty
| Rule | # impls | Difficulty | Financial risk |
|------|--------:|-----------|----------------|
| roundCurrency | 4 | S | Low |
| calculateFees | 4 | M | Med |
| normalization/net | ~5 | M–L | Med |
| settlement cutoff | 3 | S | Low |
| wallet balances (net/gross/pending/available/ledger/withdrawn) | 3 | L | **High** |
| withdrawal eligibility | 2 paths | M | **High** |
| collection totals / tiers | 2–4 | M | Med |
| fee allocation | 2 | S | Low |
