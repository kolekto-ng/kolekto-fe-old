# POST_REPAIR_RISK_ASSESSMENT

Risks after the repair, with the crons disabled. None are active drift sources; all are either latent (require an action to trigger) or a known functional gap.

## 6. Settlement logic — is anything missing now?

With cron 4 & 5 disabled, there is **no guaranteed scheduled settlement**. Effect:

| Scenario | Behavior now | Risk |
|----------|--------------|------|
| Active collection (gets further payments/withdrawals) | Edge verify / `refreshWallet` recompute with the **current** cutoff on each event → pending→available rolls correctly | **None** |
| Withdrawal attempt on any collection | Cap recomputes on demand → correct | **None** (money never blocked/over-paid) |
| **Dormant** collection (a payment made "today", then no further activity) | Its `pending` won't auto-roll to `available` on the dashboard until the next event or a settlement job | **Display lag only** — no money loss; withdrawable via the recomputing path |
| Node settlement cron `RUN_SETTLEMENT_CRON` | **Unverified** — if enabled it correctly rolls dormant collections; if not, dormant pending lingers on the dashboard | Confirm in 2.1C |

**Conclusion:** a **correct scheduled settlement replacement is required in Phase 2.1C** (enable/verify the Node cron, or add a `contributions`-based job). It is **not a stability or safety blocker** now: Σ pending is small, the cutoff is honored on every event, and withdrawals recompute independently.

## 8. Regression sources (what could reintroduce drift)

| Source | Active now? | Trigger that would reintroduce drift | Mitigation |
|--------|-------------|--------------------------------------|------------|
| Re-enable cron 4 (`settle_pending_balances`) | No (disabled) | `cron.alter_job(4, active:=true)` | **Do not re-enable while `deposits` empty**; documented in `CRON_DISABLE_REPORT.md` |
| Re-enable cron 5 / manually invoke `settle-pending-deposits` edge | No (disabled; edge still deployed) | manual HTTP call or re-schedule | remove edge + function in 2.1C |
| `process_deposit_settlements()` (RMW) + Express `deposit.js` init path populating `deposits` | Both dormant | if the Express init path is used AND cron 5 re-enabled → double-credit | retire Express init path (2.1C) |
| Duplicate balance logic (Deno vs Node) | Active but **agreeing** (drift 0) | a code change to one copy not mirrored to the other | consolidate to one `WalletService` (Phase 2.1) |
| `_shared1.ts` reads `deposits` (verify edge) | Active (read-only) | none (reads empty table; harmless) | remove in cleanup |
| Non-fatal wallet creation | Active | a create failure leaves a paymentless collection wallet-less | self-heals on first payment; add `ensureWallet` (hygiene) |
| Stored-balance assumptions in readers | — | none — withdrawal path recomputes; displays read corrected columns | — |

**No source currently produces drift.** Every corruptor is disabled; every active writer is canonical and they agree (verified live). The residual risks require a deliberate action (re-enabling a cron, invoking a disabled function, or an unmirrored code edit) to materialize.

## Recommended near-term guards (optional, before/within 2.1C)
1. Keep cron 4/5 disabled until replaced; never re-enable against empty `deposits`.
2. Confirm `RUN_SETTLEMENT_CRON` (Node settlement) status, or add a correct daily job.
3. Schedule the reconciliation (`scripts/reconcileFinancials.js`) + ledger-identity check as a monitor — would catch any recurrence on night one.
4. Keep `wallets_backup_20260717` until 2.1C sign-off.
