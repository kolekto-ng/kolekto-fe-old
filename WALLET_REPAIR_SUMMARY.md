# WALLET_REPAIR_SUMMARY

Project `lpeeckqsltxohppheucz`. Repair of the `wallets` projection from the canonical source (`contributions`+`withdrawals`). Source records untouched.

## Before → After

| Metric | Before | After |
|--------|--------|-------|
| Collections (active) | 57 | 57 |
| Wallets | 56 (**1 missing**) | **57** (0 missing) |
| Duplicate wallets | 0 | 0 |
| Negative wallets | **8** | **0** |
| Broken ledger identity (`avail+pending≠ledger`) | **51** | **0** |
| Projection drift (vs canonical) | 50 collections | **0** |
| Σ available_balance | **−₦159,300.00** | **₦49,769,848.09** |
| Σ pending_balance | ₦0 (forced) | ₦0 (all settled by time) |
| Σ ledger_balance | broken | **₦49,769,848.09** |
| Σ net_payment | ₦50,064,148 (stale-correct) | ₦50,064,148.09 |
| Σ withdrawn | ₦294,300 | ₦294,300 |

## Money-movement guard (unchanged — proof no funds touched)
| Source table | Before | After |
|---|---|---|
| Paid contributions (count) | 184 | **184** |
| Withdrawals (count) | 24 | **24** |
| Completed withdrawn (sum) | ₦294,300 | **₦294,300** |

`net − withdrawn = available`: 50,064,148.09 − 294,300 = **49,769,848.09** ✓

## What changed
- **Only** the `wallets` cache columns (net/gross/pending/available/ledger/withdrawn) were rewritten to the canonical values, plus **one new wallet row** for the previously-missing collection.
- The nightly corruptor (`settle_pending_balances`, cron 4) and the no-op (`process_deposit_settlements`, cron 5) are **disabled** (not deleted), so the projection will **stay** correct.

## What did NOT change
- `contributions`, `withdrawals`, `transactions`: untouched.
- `deposits`: untouched (0 rows; Phase 2.1C).
- SQL functions: not dropped (disabled crons only).
- Application code, architecture: not modified.

## User-visible effect
Organizer and admin dashboards, the wallet endpoint, and the marketing earnings view now read **correct** balances (they read the same columns, now fixed — no reader code changed). The withdrawal cap was always correct (it recomputes), so payouts were never at risk.
