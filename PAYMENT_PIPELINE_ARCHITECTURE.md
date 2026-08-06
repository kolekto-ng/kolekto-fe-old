# PAYMENT_PIPELINE_ARCHITECTURE (after Tier 1)

Complete payment lifecycle, with every file, after removing the `deposits` coupling.

## Lifecycle (live)

```
User clicks Pay
  │  FE: ContributePage (/contribute/:id) → ContributeFlow
  ▼
Edge initiate-paystack-payment
  │  calculateFees · INSERT contributions(status=pending) · pending_payment_context · Paystack init
  ▼
Paystack hosted checkout
  ▼
return → FE paymentCallback ─────────────► Edge verify-paystack-payment
  │                                          │ Paystack /verify · UPDATE contributions→paid
  │                                          │ refreshCollectionAndWallets → wallets (from contributions)
  │                                          │ receipt (→ /payments/send-receipt) · push
  │  (browser closed / tab killed)           │ collection recovery: _shared1.attemptDeterministicCollectionRecovery (contributions)
  ▼                                          ▼
Paystack webhook (charge.success)     contributions (SOURCE OF TRUTH) + withdrawals
  │  Express deposit.handleWebhook (HMAC over raw body)
  │  F1: contributions already paid? → no-op 200
  │  Recovery: invokeVerifyEdgeFunction → Edge verify (idempotent)   [no deposits lookup]
  ▼
wallets (PROJECTION)  ← settlement_recompute_wallets() (pg_cron, daily)
  ▼
withdrawal (withdrawal.js recomputes cap from contributions)
```

## Files in the pipeline

| Stage | File · function | Reads/writes |
|-------|-----------------|--------------|
| Init (live) | Edge `initiate-paystack-payment` | insert `contributions` |
| Init (Express, dead) | `deposit.initializePayment` | creates contribution + Paystack; **no longer writes `deposits`** |
| Verify (canonical) | Edge `verify-paystack-payment` (+ `_shared1`, `_shared2`) | `contributions`, `wallets` |
| Verify (Express) | `deposit.verifyPayment` | Paystack + `contributions` (no `deposits`) |
| Webhook | `deposit.handleWebhook` (`app.js:102`) | `contributions` (F1) + edge verify (recovery); **no `deposits`** |
| Admin reconcile | `deposit.invokeVerifyEdgeFunction` ← `admin/payments.js`, `admin/paymentMonitoring.js` | edge verify |
| Transactions | `deposit.listTransactions`/`fetchTransaction` | Paystack API |
| Receipts | `deposit.sendReceiptNotification` | email |
| Settlement | `settlement_recompute_wallets()` (pg_cron) | `contributions`+`withdrawals` → `wallets` |
| Withdrawal | `withdrawal.js` | `contributions`+`withdrawals` |

## Before → After (the change)

| Aspect | Before Tier 1 | After Tier 1 |
|--------|---------------|--------------|
| Payment source of truth | `contributions` (live) + a dead `deposits` sibling model | **`contributions` only** |
| `deposit.verifyPayment` | SELECT `deposits`; fallback to `contributions` if none (always) | verify + `contributions` directly |
| `deposit.handleWebhook` | F1 `contributions` → F2 `deposits` (always empty) → recovery | F1 `contributions` → recovery |
| `deposit.initializePayment` | creates contribution + **`deposits` row** | creates contribution (no `deposits`) |
| `_shared1` recovery | `deposits` + `contributions` sibling lookup | `contributions` only |
| Runtime `deposits` refs | present (all dead/empty) | **zero** |

**No behavioral difference**: every removed `deposits` branch was unreachable (`deposits` empty, its writer dead), so the live behavior — verify-with-Paystack-and-read-`contributions`, webhook F1+edge-recovery — is exactly as before.

## Invariant
The `deposits` table is now **never queried** during payment initiation, verification, webhook, settlement, or withdrawal. `deposits` remains only as an empty leaf table (dropped in Tier 2 after soak).
