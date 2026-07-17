# EXECUTION_ORDER (Phase 2.1B — recommendation only, NOT executed)

The single ordered sequence, distilled from all seven analysis documents. Validate after every step; nothing here has been run.

```
─ EMERGENCY (stop the nightly corruption) ───────────────────────────────
1. Snapshot wallets → wallets_backup_20260717        [reversibility gate]
2. Disable cron 4 (settle-pending-balances)          [stops the corruptor]
3. Disable cron 5 (settle-pending-deposits)          [stops the no-op landmine]
   ✓ validate: confirm no wallet writes at next 04:00 UTC

─ DATA REPAIR (make the projection correct) ─────────────────────────────
4. Recompute ALL 56 wallets from contributions (canonical WalletService/refreshWallet)
5. Backfill the 1 missing wallet (380e1d0e…) + recompute
   ✓ validate: reconcileFinancials = 0 drift, 0 negatives, available+pending=ledger for all

─ CODE REPAIR (prevent recurrence) ──────────────────────────────────────
6. Drop SQL settle_pending_balances() and process_deposit_settlements()
7. Delete the settle-pending-deposits edge function
   ✓ validate: no scheduled job references deposits

─ ARCHITECTURE CLEANUP (one source, one writer) ─────────────────────────
8. Confirm + retire Express deposit.js initializePayment (deposits INSERT)   [verify 0 callers first]
9. Simplify deposit.js verify/webhook deposits branch (keep Edge fallback)   [webhook e2e test]
10. Drop the deposits table                                                  [last; 0 rows, 0 refs]
11. Consolidate wallet writers → one WalletService.recompute (Edge calls it) [canaried, own migration]
    ✓ validate: payment e2e + reconcile after a test payment = 0 drift

─ GUARDRAILS (can't silently recur) ─────────────────────────────────────
12. Schedule reconcileFinancials + ledger-identity alert
13. Apply G1 uq_wallets_collection_id (0 dups today)
    ✓ validate: inject drift on staging → alert fires
```

## Dependency ordering rules
- **1 before everything** (reversibility).
- **2–3 before 4–5** — stop corruption before repairing, or the 04:00 run re-breaks the repair.
- **6–7 after 2–3** — disable the crons before dropping the functions they call.
- **8–9 before 10** — never drop `deposits` while code references it (webhook would 500 on the fallback path).
- **11 is a separate canaried migration** (behavior-sensitive live payment path) — do **not** bundle it with the emergency repair.
- **12–13 anytime after 5** (additive, no risk).

## Phase gates (go/no-go between blocks)
| Gate | Pass condition |
|------|----------------|
| After EMERGENCY | next 04:00 UTC produced no wallet writes; snapshot exists |
| After DATA REPAIR | reconcile = 0 drift, 0 negatives, 0 broken identity; withdrawal cap correct on a test |
| After CODE REPAIR | 0 deposits references in scheduled jobs/functions |
| After ARCH CLEANUP | one wallet writer; `deposits` gone; payment e2e clean |
| After GUARDRAILS | monitor alerts on injected drift |

## Reminder
This phase (2.1B-A) is **analysis only**. No cron disabled, no wallet recomputed, no function/table dropped, no code changed, **no commit**. Await approval to begin execution at Step 1.

---

### Deliverables in this audit
`FINANCIAL_DEPENDENCY_GRAPH.md` · `WALLET_WRITE_MATRIX.md` · `WALLET_READ_MATRIX.md` · `DEPOSITS_REMOVAL_PLAN.md` · `FINANCIAL_DUPLICATION_AUDIT.md` · `CANONICAL_FINANCIAL_ARCHITECTURE.md` · `RISK_AND_ROLLBACK_PLAN.md` · `EXECUTION_ORDER.md`
