# PHASE_2_1C_READINESS_REPORT

## Recommendation: **READY FOR PHASE 2.1C**

The wallet projection is repaired, stable under live traffic, and has **no active drift source**. The one open functional item — a replacement scheduled settlement for dormant collections — **is the mandate of Phase 2.1C**, not a blocker to entering it. No condition makes the current state unsafe or unstable.

## Prerequisites now satisfied (evidence-backed)

| Prerequisite | Status | Evidence |
|--------------|--------|----------|
| Wallet projection correct | ✅ | live reconciliation: 0 drift, 0 negatives, 0 broken identity, 0 missing, 0 duplicate across 57 collections |
| Repair holds under load | ✅ | a real ₦7,500 payment after the repair reconciled to 0 drift; wallet written by the live edge path |
| Corruptor stopped | ✅ | cron 4 & 5 `active=false` (verified); no 04:00 wallet writes will occur |
| Source of truth intact | ✅ | contributions 185, withdrawals 24, `deposits` 0 — never written by the repair |
| No money at risk | ✅ | 0 over-withdrawn; withdrawal cap recomputes; no funds moved |
| Payment flow works without SQL crons | ✅ | live natural experiment (`PAYMENT_FLOW_VALIDATION.md`) |
| Withdrawal flow independent of disabled fns | ✅ | recomputes from contributions (`WITHDRAWAL_FLOW_VALIDATION.md`) |
| Collection lifecycle sound | ✅ | edge verify self-heals missing wallets on first payment |
| Active writers canonical & consistent | ✅ | all derive from contributions; agree (drift 0); SQL writers disabled |
| Rollback available | ✅ | `wallets_backup_20260717` + cron re-enable |

## Open items — to be DONE IN Phase 2.1C (not blockers to starting it)

1. **Establish a correct scheduled settlement** (contributions-based) for dormant collections' pending→available roll — either verify/enable the Node `paymentSettlement` cron (`RUN_SETTLEMENT_CRON`) or add a fixed job. *(Priority 1 of 2.1C.)*
2. **Retire the disabled corruptors** — drop `settle_pending_balances()`, `process_deposit_settlements()`, the `settle-pending-deposits` edge, and (eventually) the `deposits` table + Express init path, per `DEPOSITS_REMOVAL_PLAN.md` / `EXECUTION_ORDER.md`.
3. **Wire monitoring** — schedule reconciliation + ledger-identity alert so any drift is caught immediately.
4. **Consolidate wallet writers** to a single canonical `WalletService` (removes the latent Deno-vs-Node duplication) — Phase 2.1.
5. **Hygiene:** reliable wallet creation (`ensureWallet`) and apply G1 `uq_wallets_collection_id`.

## Not blockers — why
- The dormant-settlement gap causes at most a **dashboard display lag** for a collection that receives one payment and then goes silent; the money is fully withdrawable (the withdrawal path recomputes with the live cutoff) and no balance is wrong for any active collection.
- The disabled functions cannot fire unless deliberately re-enabled.
- The duplicate balance logic currently agrees (verified) and is a consolidation task, not a defect.

## Guardrails to keep in force until 2.1C completes
- Do **not** re-enable cron 4/5 while `deposits` is empty (they re-corrupt).
- Keep `wallets_backup_20260717`.
- Prefer landing the settlement replacement (item 1) early in 2.1C so dormant collections settle on schedule.

---

**Verdict: READY FOR PHASE 2.1C.** Proceed on approval; begin with the settlement replacement + monitoring, then the cleanup/removal sequence.

*Validation phase complete. No architecture changed, no cleanup, no deletion, no `deposits`/function/cron removal, no commit.*
