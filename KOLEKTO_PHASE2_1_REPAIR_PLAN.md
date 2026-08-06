# KOLEKTO — Phase 2.1B Repair Plan (recommendation only — NOTHING repaired here)

Based on the live forensics (`KOLEKTO_FINAL_FINANCIAL_FORENSICS.md`). **This phase (2.1A) performed no writes.** Below is the ranked, validate-between-steps plan for the *approved* repair phase. Read-only until you say go.

**One-line strategy:** stop the nightly corruptor first, then recompute wallets from the intact source, then fix the settlement subsystem so it can't recur — all reversible, no source data touched.

---

## Step 0 — STOP THE BLEEDING (highest priority, do first)

The job `settle-pending-balances` (`cron.job` id **4**, `0 4 * * *`) corrupts every wallet nightly. **Until it is disabled, any wallet you repair will be re-broken at the next 04:00 UTC.**

- **Action:** unschedule/disable jobid 4 (e.g. `SELECT cron.unschedule('settle-pending-balances');`) — *and* review jobid 5 (`settle-pending-deposits` → `process_deposit_settlements()`): it is a no-op today but a **read-modify-write landmine** that would double-credit if `deposits` ever populates. Disable it too until the settlement model is fixed.
- **Risk:** **Very low.** Disabling a broken settlement job removes corruption; settlement is currently *harmful*, so stopping it is strictly positive. Rollback = re-schedule (seconds).
- **Note:** this is the one step that is arguably "modification" — it is deliberately deferred to 2.1B for your explicit approval, but it is **urgent** (the bug re-fires daily).

## Step 1 — Snapshot (reversibility gate)

- Copy all 56 `wallets` rows (id, all balances, updated_at) to a `wallets_backup_20260717` table / export **before any write**. Every later step is then fully reversible.

## Step 2 — Recompute all wallets from source (the actual fix for 50/50 drift)

- Run the canonical recompute (`refreshWallet` / `computeWalletBalances` over `contributions`+`withdrawals`) for **every** collection. This rewrites `available/pending/ledger` correctly and clears all 42 zeroed + 8 negative wallets in one idempotent pass.
- **Risk:** Low–Med (writes wallet cache only; source untouched; reversible via Step 1). **Automatable.** No migration. Est. minutes for 56 wallets.
- **Validate:** re-run reconciliation → **0 drift, 0 negatives, 0 broken identities**.

## Step 3 — Backfill the 1 missing wallet

- Collection `380e1d0e…` has no wallet. Create the row (zeros) then recompute. It currently has 0 paid contributions, so expected balances are 0 — low urgency, but close it for completeness.
- **Risk:** Low. Automatable. Verify `§A5` returns zero after.

## Step 4 — Fix the settlement subsystem (prevent recurrence)

- Replace `settle_pending_balances()` so it recomputes from **`contributions`** (the live model), or **retire the SQL settlement entirely** and rely on the app-side canonical recompute + a corrected scheduled job. Decide the **single canonical wallet writer** (this ties into Phase 2.1 WalletService/PaymentService consolidation).
- Retire/repair `process_deposit_settlements()` (read-modify-write) at the same time.
- **Risk:** Med (SQL/code change). Requires review + staging test. No data backfill. **Do before re-enabling any settlement cron.**

## Step 5 — Guardrails so it can't silently recur

- Apply **G1** `uq_wallets_collection_id` (0 dups today — safe after Step 2).
- Wire the **reconciliation** (`scripts/reconcileFinancials.js`) + the **ledger-identity check** as a scheduled monitor with an alert on any drift or `available+pending≠ledger`. This bug survived because nothing watched the projection.

---

## Repair order (validate after each)

```
Step 0 disable corrupting cron  ──►  confirm no 04:00 writes
Step 1 snapshot wallets         ──►  backup verified
Step 2 recompute all wallets    ──►  reconcile = 0 drift
Step 3 backfill missing wallet  ──►  §A5 = 0 missing
Step 4 fix settlement functions ──►  parity test (staging)
Step 5 guardrails + monitor     ──►  alert fires on injected drift
       ▼
Resume Phase 2.1 (WalletService / single canonical writer)
```

## Risk / difficulty / rollback ranking

| Step | Risk | Difficulty | Rollback | Prod impact | Est. time |
|------|------|-----------|----------|-------------|-----------|
| 0 disable cron | Very low | Trivial | re-schedule (sec) | Stops nightly corruption | minutes |
| 1 snapshot | None | Trivial | drop backup | None | minutes |
| 2 recompute | Low–Med | Low (automatable) | restore snapshot | Wallet display corrects | minutes |
| 3 backfill wallet | Low | Low | delete row | 1 collection | minutes |
| 4 fix functions | Med | Med | revert function | Settlement behavior | hours (+ staging) |
| 5 guardrails/monitor | Low | Low | drop index/job | None (additive) | hours |

## Must-do before PaymentService
Steps 0–3 are **prerequisites** to any PaymentService/WalletService work: you need a clean, reconciled wallet baseline (and the corruptor stopped) to validate the consolidation against. Step 4 *is* part of the WalletService consolidation (single canonical writer).

---

## STOP
This phase (2.1A) is investigation only — **no cron disabled, no wallet recomputed, no function changed, no migration applied.** Await approval to begin Phase 2.1B (repair), starting with Step 0.
