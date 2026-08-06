# CRON_DISABLE_REPORT

Project `lpeeckqsltxohppheucz`. Both broken settlement jobs were **disabled** (`active := false`) — **not deleted**. The SQL functions they call were **not dropped** (per phase rules).

## Actions taken

| jobid | jobname | schedule | before | after | command (unchanged) |
|------:|---------|----------|--------|-------|---------------------|
| 4 | `settle-pending-balances` | `0 4 * * *` | active=true | **active=false** | `SELECT settle_pending_balances()` |
| 5 | `settle-pending-deposits` | `0 4 * * *` | active=true | **active=false** | `net.http_post(.../settle-pending-deposits)` |
| 6 | `scheduled-payment-recovery` | `*/5 * * * *` | active=true | **untouched (active=true)** | `net.http_post(.../scheduled-payment-recovery)` |

- **Method:** `SELECT cron.alter_job(job_id := 4, active := false);` and `(job_id := 5, active := false);`
- **Job rows preserved** (nothing removed from `cron.job`).
- **SQL functions preserved:** `settle_pending_balances()` and `process_deposit_settlements()` still exist (disabled only). Removal is Phase 2.1C.

## Why this is safe (verified in pre-repair architecture verification)
- Nothing calls `settle_pending_balances()` except job 4; no view/trigger/FK depends on it or on `deposits`.
- Every production workflow (withdrawals, verification, wallet refresh, receipts, analytics, notifications) derives from `contributions` or recomputes on demand.
- Job 4 only ever wrote *wrong* values (from empty `deposits`); disabling it removes corruption.

## Validation
`SELECT jobid, jobname, active FROM cron.job` → job 4 = false, job 5 = false, job 6 = true. Confirmed.

## Rollback (if ever needed)
```sql
SELECT cron.alter_job(job_id := 4, active := true);
SELECT cron.alter_job(job_id := 5, active := true);
```
⚠️ **Do NOT re-enable job 4/5 while `deposits` is empty** — they would immediately re-corrupt the wallets (available = −withdrawn). They must be **replaced** with a `contributions`-based settlement (Phase 2.1C) before any settlement cron is re-enabled.

## Next (Phase 2.1C, not done here)
Establish a correct daily settlement (contributions-based) and only then decide whether to drop these functions/jobs.
