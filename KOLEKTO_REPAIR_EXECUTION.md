# KOLEKTO — Wallet Projection Repair Execution Log (Phase 2.1B-B)

**Target:** Supabase project `lpeeckqsltxohppheucz` (test — the project holding the documented drift). Prod untouched.
**Scope:** the `wallets` projection **only**. `contributions`, `withdrawals`, `transactions` were **never** written. Crons/functions **disabled, not deleted**. `deposits` untouched (Phase 2.1C).
**Mechanism note:** recompute executed as one SQL statement faithfully implementing the canonical `normalizeContributions → computeWalletBalances` (per-fee rounding as in `calculateFees`; 4am-UTC settlement cutoff; completed-withdrawal statuses). It reads only `contributions`+`withdrawals`, never `deposits`. (JS could not run against the remote DB from the tooling; the SQL is a one-time repair statement equal to the characterization-tested Node math, not new persistent logic.)

---

## Phase 1 — Snapshot (reversibility gate) · **PASS**
- **Action:** `CREATE TABLE wallets_backup_20260717 AS SELECT *, now() AS backed_up_at FROM wallets`.
- **Evidence:** backup_rows = **56** = live; `sum(available)` backup = live = **−159,300.00**.
- **Rollback:** this table *is* the rollback source (see `WALLET_SNAPSHOT_LOCATION.md`).
- **Risk:** none (read-only copy). **Time:** ~1s.

## Phase 2 — Disable both broken cron jobs · **PASS**
- **Action:** `cron.alter_job(4, active := false)`, `cron.alter_job(5, active := false)`. **No job deleted.**
- **Evidence:** `cron.job` → job 4 `settle-pending-balances` active=**false**; job 5 `settle-pending-deposits` active=**false**; job 6 `scheduled-payment-recovery` untouched (active=true).
- **Rollback:** `cron.alter_job(4, active := true)` / `(5, active := true)` (seconds).
- **Risk:** very low (stops corruption; nothing depends on these — see pre-repair verification). **Time:** ~1s.

## Phase 3 — Recompute all 56 wallets from source · **PASS**
- **Action:** single `UPDATE wallets` setting net/gross/pending/available/ledger/withdrawn from the canonical recompute over `contributions`+`withdrawals`. Only `wallets` written.
- **Evidence:** 56 rows updated (all `updated_at` fresh); **negatives 8→0**; **broken identity 51→0**; `sum(available)` −159,300 → **49,769,848.09**; `net − withdrawn` = 50,064,148.09 − 294,300 = 49,769,848.09 (consistent).
- **Rollback:** restore from `wallets_backup_20260717` (see snapshot report).
- **Risk:** low–med (idempotent; reversible via snapshot; math characterization-tested). **Time:** ~1s.

## Phase 4 — Create the missing wallet · **PASS**
- **Action:** `INSERT INTO wallets (collection_id) SELECT '380e1d0e-866b-4902-a413-10fd46119863' WHERE NOT EXISTS (...)`. All balances default to 0 = canonical value (collection has 0 paid contributions, 0 withdrawals).
- **Evidence:** wallet_rows for that collection = **1**; all balances 0; currency NGN/₦.
- **Rollback:** `DELETE FROM wallets WHERE collection_id='380e1d0e-…'` (safe — it was created empty).
- **Risk:** low (guarded insert, no duplicate). **Time:** ~1s (one transient TLS retry; verified idempotent).

## Phase 5 — Full reconciliation · **PASS (all 7 criteria)**
- collections **57** / wallets **57** / missing **0** / duplicate **0**
- negatives **0** · broken identity **0** · **drift 0** (stored == independent canonical recompute for all 57)
- over-withdrawn **0**
- **No money movement:** paid contributions **184** & withdrawals **24** unchanged; `withdrawn_sum` 294,300 unchanged.
- **Rollback (whole repair):** restore wallets from snapshot + delete the created wallet + re-enable crons.
- **Risk:** none (read-only validation). **Time:** ~2s.

---

## Overall result: **SUCCESS**
All validation gates passed in order; no phase was continued past a failure. Source financial records were never touched; only the derived `wallets` projection was corrected. The nightly corruptor is disabled (not deleted). Full reversibility retained via `wallets_backup_20260717` + cron re-enable.

**STOP** — per instruction, no cleanup, no `deposits` removal, no architecture consolidation. Awaiting approval for Phase 2.1C.
