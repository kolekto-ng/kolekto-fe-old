# POST_RETIREMENT_ARCHITECTURE (after Tier 2 — no `deposits` model)

The canonical financial architecture. **There is no `deposits` model anywhere** — table dropped, zero code references.

```
                 FINANCIAL SOURCE OF TRUTH
                 contributions (paid)  +  withdrawals
                          │
          ┌───────────────┼─────────────────────────────┐
          ▼               ▼                               ▼
   Edge verify       withdrawal.js                 SettlementService
   (per payment)     (per withdrawal)              settlement_recompute_wallets()
   contributions→    recompute cap from            (pg_cron daily; dormant
   wallets           contributions                  collections roll pending→available)
          │               │                               │
          └───────────────┴───────────────┬───────────────┘
                                           ▼
                                   wallets (PROJECTION)
                                           │
                       dashboards · admin · withdrawal cap · receipts
```

## The pipelines (all `contributions`-based)

| Pipeline | Implementation | Source |
|----------|----------------|--------|
| Payment initiation | Edge `initiate-paystack-payment` | inserts `contributions` |
| Verification | Edge `verify-paystack-payment` (+ `deposit.verifyPayment`) | `contributions` |
| Webhook | `deposit.handleWebhook` (HMAC) → F1 `contributions` + edge recovery | `contributions` |
| Retry recovery | webhook 500→Paystack; `scheduled-payment-recovery` cron → edge verify | `contributions` |
| Wallet projection | Edge `refreshCollectionAndWallets` / Node `refreshWallet` | `contributions`+`withdrawals` |
| Settlement | `settlement_recompute_wallets()` (pg_cron, one cutoff, observable) | `contributions`+`withdrawals` |
| Withdrawals | `withdrawal.js` | `contributions`+`withdrawals` |
| Admin reconcile/monitor | `invokeVerifyEdgeFunction` | edge verify → `contributions` |

## "Exactly one / none" scorecard

| Concern | State |
|---------|-------|
| Financial source of truth | ✅ `contributions` + `withdrawals` |
| **`deposits` model** | ✅ **NONE** (table dropped; 0 code refs) |
| Legacy settlement (`settle_pending_balances`, `process_deposit_settlements`) | ✅ removed (Tier 0) |
| Settlement implementation / scheduler / cutoff | ✅ one each (`settlement_recompute_wallets` / pg_cron / `settlement_cutoff`) |
| Withdrawal computation | ✅ one (`withdrawal.js`) |
| Wallet recompute / cutoff / normalization across runtimes | ❌ still 3 (Node/Deno/SQL) — **Phase 2.1 Financial Projection Engine** (NOT started) |

## What remains for later phases (NOT this phase)
- **Financial Projection Engine (Phase 2.1):** consolidate the Node/Deno/SQL recompute, cutoff, and normalization into one authoritative (or verified-equivalent) implementation — `computeWallet/computePending/computeAvailable/computeLedger/calculateFees/normalizeContribution/getSettlementCutoff/computeOrganizerBalance`.
- Regenerate Supabase types (drop stale `deposits` declarations); update the unapplied `g1` migration; production drop after soak.

## Live state (test project)
57 wallets · 0 drift · 0 negatives · identity holds · Σ available ₦49,777,348.09 · Σ pending ₦0 · 185 paid contributions · 24 withdrawals · **`deposits` table: gone** · settlement scheduler active.
