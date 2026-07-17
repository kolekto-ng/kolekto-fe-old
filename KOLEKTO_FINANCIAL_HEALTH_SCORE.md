# KOLEKTO — Financial Health Score (live, 2026-07-17)

Project `lpeeckqsltxohppheucz`. Read-only snapshot. Scores are evidence-based (see `KOLEKTO_FINAL_FINANCIAL_FORENSICS.md`).

## Overall verdict: **FUNDS SAFE · PROJECTION CRITICAL**

> Every naira is accounted for in the source of truth, but the wallet *display* is corrupted for 56/57 collections and **re-corrupts itself every night at 04:00 UTC**. This is a **P1 correctness/trust incident**, not a loss event.

## Dimension scores

| Dimension | Score | Basis |
|---|---|---|
| **Money safety (funds at risk)** | **100 / 100** | 0 over-withdrawals; ₦294,300 withdrawn vs ₦50.06M raised; no payment/withdrawal lost |
| **Source-of-truth integrity** (`contributions`+`withdrawals`) | **98 / 100** | 184 paid contributions all referenced; 0 dup (ref,line); 0 dup withdrawals; 0 orphans. −2: 1 collection missing its wallet row |
| **Projection accuracy** (`wallets.*`) | **11 / 100** | only 6/57 wallets read correctly; 50 corrupted by the settlement bug; ₦49.93M mis-displayed |
| **Settlement subsystem** | **5 / 100** | active job reads an empty table and corrupts all wallets nightly; a second job is a no-op read-modify-write landmine |
| **Idempotency guards** | **70 / 100** | contributions composite unique index holding (0 dup); wallets have 0 dup but **no** unique constraint yet (G1 unapplied) |
| **Recoverability** | **100 / 100** | 100% of drift is recomputable from intact source; fully reversible with a pre-snapshot |

## Key numbers

- Collections: **57** · wallets: **56** (1 missing) · paid contributions: **184** · withdrawals: **24** · **`deposits`: 0**
- Net raised: **₦50,064,148** · expected available: **₦49,769,848** · **stored available: −₦159,300**
- Corrupted wallets: **50** (42 zeroed + 8 negative) · clean: **6** · missing: **1**
- Max drift **₦30,773,000** · median **₦22,005** · p95 **₦1,600,016**

## What's healthy
- The money model's **inputs are clean and consistent.** No loss, no double-spend, no orphaned payments.
- The contributions idempotency constraint (F3) is doing its job (0 duplicates under real load).

## What's critical
- `settle_pending_balances()` (cron, 04:00 UTC daily) **overwrites all wallets from the empty `deposits` table** → `available = −withdrawn`, `pending = 0`. **It ran today and will run again tomorrow.**
- Two parallel payment data models (`deposits` vs `contributions`); the live system uses `contributions`, the settlement SQL uses `deposits` → structural mismatch.
- No monitoring caught this: 56 wallets breaking the `available+pending=ledger` identity went undetected until reconciliation.

## Trend
Without intervention the score **does not degrade further** (the bug is idempotent — it sets the same wrong values each night) but it **does not self-heal**, and any wallet corrected by an app-side refresh (e.g. a withdrawal request) is **re-corrupted at the next 04:00 run**. The projection oscillates daily between correct (post-refresh) and corrupted (post-cron).
