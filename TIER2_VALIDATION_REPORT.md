# TIER2_VALIDATION_REPORT (Phase 2.1C-2 — Tier 2)

Post-drop financial validation. Project `lpeeckqsltxohppheucz`.

## Financial correctness — ALL PASS

| Invariant | Result |
|-----------|--------|
| Projection drift (stored vs canonical, all 57) | **0** |
| Negative wallets | **0** |
| Ledger identity (`available + pending = ledger`) | **holds** (0 violations) |
| Σ available_balance | **₦49,777,348.09** (unchanged) |
| Σ pending_balance | **₦0.00** |
| Σ ledger_balance | ₦49,777,348.09 (= available + pending) |
| Paid contributions | **185** (unchanged) |
| Withdrawals | **24** (unchanged) |
| `deposits` table | **gone** (`to_regclass` NULL) |

## Pipeline validation (STEP 7)

| Pipeline | Status | Evidence |
|----------|--------|----------|
| Settlement | ✅ operational | `settlement_recompute_wallets('tier2_post_drop_validation')` → 57 processed, drift_after 0, ok=true |
| Wallet projection | ✅ intact | reconciliation drift 0 |
| Payment initialization | ✅ intact | code unchanged; live path = Edge `initiate-paystack-payment` (never used `deposits`) |
| Payment verification | ✅ intact | `deposit.verifyPayment` + Edge verify — `contributions`-based (Tier 1); `deposit.js` parses |
| Webhook | ✅ intact | `deposit.handleWebhook` — HMAC + F1(`contributions`) + edge recovery; unchanged this tier |
| Retry recovery | ✅ intact | webhook returns 500 → Paystack retries; `scheduled-payment-recovery` cron active |
| Admin reconciliation | ✅ intact | `invokeVerifyEdgeFunction` unchanged |
| Withdrawals | ✅ intact | `withdrawal.js` recomputes from `contributions`+`withdrawals` |
| Admin payment monitoring | ✅ intact | `admin/paymentMonitoring.js` uses `invokeVerifyEdgeFunction` |

## Code/tests
- BE unit tests: **63/63 pass**.
- `deposit.js`: **parses** (`node --check`).
- No code changed in Tier 2 (only the DB drop), so all Tier 1 guarantees carry over.

## Why dropping the table changed nothing
No code path queried `deposits` (Tier 1 removed all references), and no database object depended on it (`DATABASE_DEPENDENCY_AUDIT.md`). Removing an unreferenced, empty, dependency-free table is a no-op for every runtime and every other DB object — confirmed by identical reconciliation before and after.

## Deferred to production soak
The live webhook/verify/retry/admin-reconcile still require the same production soak noted in Tier 1 before the prod drop. This report validates the **test** project drop.

## Verdict: **TIER 2 PASS.** `deposits` retired; 0 drift; all financial pipelines operational; no deposits model remains.
