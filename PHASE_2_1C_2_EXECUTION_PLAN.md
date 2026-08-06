# PHASE_2_1C_2_EXECUTION_PLAN (plan only — NOTHING executed)

The ordered execution sequence for the legacy removal, once approved. Validate after every step; everything reversible. Test project first, then prod.

```
─ PRE ────────────────────────────────────────────────────────────────────────
0. Re-grep to confirm 0 code callers of the two legacy SQL fns (already true).
   Save definitions of everything to be dropped (functions, table DDL) for rollback.
   Confirm cron 7 (settlement) green; reconciliation = 0 drift; deposits = 0 rows.

─ TIER 0 — inert artifacts (safe) ─────────────────────────────────────────────
1. cron.unschedule('settle-pending-balances'); cron.unschedule('settle-pending-deposits')
2. DROP FUNCTION settle_pending_balances(); DROP FUNCTION process_deposit_settlements()
3. Delete the 'settle-pending-deposits' edge function
   ✓ validate: settlement still runs (cron 7); reconcile = 0 drift; no errors

─ TIER 1 — remove deposits references from ACTIVE code (refactor, keep controller) ─
4. Confirm 0 clients call POST /api/payments/initialize-payment (access logs)
5. Code: strip deposits INSERT from deposit.initializePayment; strip deposits
   read/fallback in verifyPayment/handleWebhook (keep webhook + edge fallback +
   invokeVerifyEdgeFunction + transactions endpoints intact)
6. Code: strip deposits reads from verify-paystack-payment/_shared1.ts
7. FE: retire usePaystackStore Express-init reference if present
   ✓ validate: webhook e2e, admin reconcile e2e, a live payment → 0 drift

─ TIER 2 — drop the table (last) ──────────────────────────────────────────────
8. Re-grep: zero 'deposits' references in runtime code. Confirm 0 rows.
9. DROP TABLE deposits
   ✓ validate: full reconcile 0 drift; webhook/verify/admin all green

─ TIER 3 — config hygiene ─────────────────────────────────────────────────────
10. Set RUN_SETTLEMENT_CRON=false (sole scheduler = pg_cron)
11. Investigate + retire kelekto-admin/ (typo folder) separately
    ✓ validate: exactly one active settlement scheduler

─ TIER 4 — duplicate-math consolidation (Phase 2.1, separate) ──────────────────
12. Unify Node/Deno/SQL recompute+cutoff+normalization behind one WalletService
    (canaried; do not delete a copy before its callers are repointed)
```

## Gates (go/no-go between tiers)
| After | Pass condition |
|-------|----------------|
| Tier 0 | cron 7 ran / settlement callable; reconcile 0 drift; app errors none |
| Tier 1 | 0 runtime `deposits` refs; webhook + admin reconcile + live payment all clean |
| Tier 2 | `deposits` dropped; reconcile 0 drift; no 500s |
| Tier 3 | one active settlement scheduler; `RUN_SETTLEMENT_CRON=false` |

## Risk / rollback per tier
| Tier | Risk | Rollback |
|------|------|----------|
| 0 | Low | recreate fns from saved DDL; re-add crons (disabled) |
| 1 | Med (active controller) | revert code commits |
| 2 | Low→Med | recreate `deposits` table from saved DDL (empty) |
| 3 | Low | flip env / restore folder |
| 4 | Med (live edge path) | canary revert |

## Hard stops
- Never drop `deposits` before Tier 1 leaves zero references.
- Never delete `deposit.js`, `handleWebhook`, or `invokeVerifyEdgeFunction` (runtime-critical).
- Never re-enable cron 4/5.
- Keep `wallets_backup_20260717` + `settlement_runs` monitoring until the whole sequence is soaked.

## Current status
**Audit complete. Nothing removed, modified, or committed.** Awaiting approval to begin Tier 0.
