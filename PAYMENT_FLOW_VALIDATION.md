# PAYMENT_FLOW_VALIDATION

Verifies the complete payment lifecycle still functions with cron 4/5 disabled. Live + code evidence.

## Lifecycle (verified)

| Stage | Mechanism | Depends on disabled crons? | Evidence |
|-------|-----------|----------------------------|----------|
| Contribution created | Edge `initiate-paystack-payment` → INSERT `contributions(pending)` | No | live: 185 paid rows |
| Verification | Edge `verify-paystack-payment` → UPDATE contribution→paid | No | live payment `kolekto-1784297165337-664475` marked paid |
| **Wallet recomputation** | Edge `_shared2.refreshCollectionAndWallets` recomputes from `contributions`+`withdrawals` | **No** | wallet `92819d85` written 14:10:50, 1s after the 14:10:49 contribution |
| Collection totals / tier sold | same edge function updates `collections.total_contributions`, tier availability | No | (edge path unchanged) |
| Dashboard | reads `wallets.*` (now correct) | No | reconciles to 0 drift |
| Receipt | `renderReceiptEmail` from the contribution/transaction | No | independent of wallets/crons |
| Notifications | fired from the payment event | No | independent |
| Withdrawal eligibility | `getEligibleCollections` recomputes from contributions | No | see `WITHDRAWAL_FLOW_VALIDATION.md` |

## Live natural experiment (definitive)
A real ₦7,500 payment to collection `92819d85` occurred **after** the repair and **with the crons disabled**:
- contribution `created_at` = 2026-07-17 14:10:49.724 UTC
- wallet `updated_at` = 2026-07-17 14:10:50.407 UTC (the edge verify wrote it 0.7s later)
- resulting balances: net 12,500 · available 5,000 · **pending 7,500** · ledger 12,500 (identity holds)
- reconciliation across all 185 contributions after this event: **0 drift**

**Interpretation:** the edge verify path recomputes the *entire* collection's balances (all paid contributions) with the *current* 4am-UTC settlement cutoff on every payment. So:
- new payments are correctly classified `pending` (today) vs `available` (settled),
- previously-pending-now-settled contributions are re-classified on the next payment,
- the wallet identity and canonical equality are preserved — **no SQL settlement job required for an active collection.**

## Verdict: ✅ PASS
The payment flow is fully functional without cron 4/5. The wallet projection is maintained correctly by the live edge writer (contributions-based). The only scenario the edge does *not* cover is a **dormant** collection's daily pending→available roll with no subsequent event — addressed under settlement (Phase 2.1C), non-blocking because the withdrawal path recomputes on demand.
