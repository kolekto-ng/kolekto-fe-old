# TIER0_VALIDATION_REPORT (Phase 2.1C-2 — Tier 0)

All checks from the live test project `lpeeckqsltxohppheucz` after the removals. **Source tables never written.**

## Settlement — exactly one of each
| Check | Result |
|-------|--------|
| Settlement implementations | **1** — `settlement_recompute_wallets()` (legacy `settle_pending_balances`/`process_deposit_settlements` = **NONE**) |
| Settlement scheduler (active) | **1** — pg_cron `settlement-recompute-wallets` |
| Settlement cutoff | **1** — `settlement_cutoff()` |
| Remaining settlement DB objects | `settlement_recompute_wallets()`, `settlement_cutoff()`, `settlement_runs` — **only these** |
| Crons remaining | `scheduled-payment-recovery=true`, `settlement-recompute-wallets=true` (4 & 5 gone) |

## Financial correctness — reconciliation
| Invariant | Before Tier 0 | After Tier 0 | Pass |
|-----------|---------------|--------------|------|
| Projection drift (stored vs canonical, all 57) | 0 | **0** | ✅ |
| Negative wallets | 0 | **0** | ✅ |
| Ledger identity (`available+pending=ledger`) | holds | **holds** (0 violations) | ✅ |
| Σ pending_balance | 0.00 | **0.00** (unchanged) | ✅ |
| Σ available_balance | 49,777,348.09 | **49,777,348.09** (unchanged) | ✅ |
| Wallets | 57 | 57 | ✅ |

**Removing the dead settlement infrastructure changed no balance.** (Expected — the removed objects were disabled and had no callers.)

## Payment flow — unaffected
No payment code was touched (git-verified: `deposit.js`, `routes/payment.js`, `app.js` clean). Therefore, unchanged and functional:
- **Payment initiation** — Edge `initiate-paystack-payment` (untouched).
- **Payment verification** — Edge `verify-paystack-payment` (untouched).
- **Webhook** — `deposit.handleWebhook` mounted at `app.js:102` (untouched).
- **Admin reconciliation** — `deposit.invokeVerifyEdgeFunction` used by `admin/payments.js` & `admin/paymentMonitoring.js` (untouched).
None of these depend on the removed settlement functions/crons (proven in `LEGACY_DEPENDENCY_AUDIT.md` / `PRODUCTION_ROLLOUT_AUDIT.md`).

## Source of truth — untouched
`contributions` (185 paid) and `withdrawals` (24) unchanged; `deposits` still 0 rows (not modified).

## Database — remaining settlement objects (expected set only)
```
settlement_recompute_wallets()   ✅
settlement_cutoff()              ✅
settlement_runs (table)          ✅
```
Legacy `settle_pending_balances()` / `process_deposit_settlements()` → **removed**.

## Regression / accidental-execution
- No code path, RPC, route, import, webhook, retry worker, or cron can invoke the removed functions (they no longer exist; their crons are gone).
- Deployed `settle-pending-deposits` edge is unreachable (cron 5 removed); operator to delete it via CLI.

## Verdict: **TIER 0 PASS** — dead settlement infrastructure removed; financial correctness preserved at 0 drift; canonical settlement intact and singular; payment flows unaffected; fully reversible.
