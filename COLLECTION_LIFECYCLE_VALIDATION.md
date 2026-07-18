# COLLECTION_LIFECYCLE_VALIDATION

Verifies new-collection → wallet → first contribution → wallet update → withdrawal, and whether the missing-wallet issue can recur.

## Lifecycle (verified)

| Stage | Mechanism | Notes |
|-------|-----------|-------|
| New collection | Edge `create-collection` / Express `CollectionService` | creates a `wallets` row (zeros) — **best-effort / non-fatal** |
| Wallet creation | upsert/insert zeros | if it fails, only a warning is logged (no retry) → wallet may be absent until first payment |
| First contribution | Edge `verify-paystack-payment` → `refreshCollectionAndWallets` | **INSERTs the wallet if none exists** (`_shared2.ts:169-181`) |
| Wallet update | same edge function recomputes from contributions | correct balances from the first payment onward |
| Withdrawal | `refreshWallet` recompute | independent, correct |

## Can the missing-wallet issue recur? — Analysis

**The specific instance is fixed** (collection `380e1d0e…` now has a wallet). **The class can technically recur** (collection-creation wallet insert is non-fatal and nothing lazily backfills a wallet for a *paymentless* collection). **However it is functionally harmless**, because:

1. **A collection with no wallet has no money** (0 paid contributions) — nothing to display or withdraw; dashboards handle the null wallet.
2. **The first payment self-heals it:** the edge verify path **INSERTs the wallet if missing** before writing balances (verified in code). So any collection that ever receives money gets a correct wallet automatically.
3. Therefore a missing wallet can only ever exist for a **zero-payment** collection, where it causes no financial error.

**Evidence:** `380e1d0e…` was exactly this case — a fundraising collection with 0 paid contributions and 0 withdrawals; its wallet was simply never created because it never received a payment. Creating it (zeros) was cosmetic completeness, not a money fix.

## Hygiene recommendation (for 2.1C, not required for stability)
Make wallet creation reliable (fail-closed or a lazy `ensureWallet` on read) so that even paymentless collections always have a row — purely for consistency/monitoring cleanliness. Not a stability blocker.

## Verdict: ✅ PASS (with hygiene note)
The collection lifecycle is sound. Missing wallets cannot cause a financial defect — they self-heal on first payment and are harmless before it.
