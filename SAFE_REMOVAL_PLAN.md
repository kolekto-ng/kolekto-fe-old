# SAFE_REMOVAL_PLAN (Phase 2.1C-2 — plan only, NOTHING removed)

Ordered, reversible plan to retire the legacy financial artifacts. **Do not execute yet.** Grounded in `LEGACY_DEPENDENCY_AUDIT.md` / `DEAD_CODE_INVENTORY.md`.

## Removal tiers (by dependency safety)

### Tier 0 — zero code callers, remove first (lowest risk)
These have **no application dependency** (only the disabled crons referenced them):
1. Drop pg_cron jobs 4 (`settle-pending-balances`) & 5 (`settle-pending-deposits`) — already disabled.
2. Drop SQL `settle_pending_balances()` and `process_deposit_settlements()`.
3. Delete the `settle-pending-deposits` edge function.
- **Risk:** Low. **Rollback:** re-create from git/DB definition (keep the definitions saved). **Detect:** settlement still runs via cron 7; reconciliation stays 0 drift.

### Tier 1 — `deposits` table references (refactor before dropping the table)
`deposits` is a leaf (0 rows) but still *referenced* by active code, so the table cannot be dropped until these are removed:
4. In `deposit.js`: remove the `deposits` INSERT in `initializePayment` (confirm 0 callers of `POST /api/payments/initialize-payment` first) and the `deposits` read/fallback branches in `verifyPayment`/`handleWebhook` (they never execute — `deposits` empty — so the edge fallback becomes the sole path). **Keep the webhook, `invokeVerifyEdgeFunction`, verify, and transactions endpoints.**
5. In edge `verify-paystack-payment/_shared1.ts`: remove the `deposits` reads (lines ~555/582).
6. Retire the FE `usePaystackStore` reference to the Express init endpoint (if still present).
- **Risk:** Med (touches the live `deposit.js` — must preserve the webhook + admin-reconcile paths). **Rollback:** revert commits. **Detect:** payment webhook + admin reconcile e2e; reconciliation 0 drift.

### Tier 2 — drop the table (last)
7. `DROP TABLE deposits` only after Tier 1 leaves **zero** references (re-grep to confirm) and `deposits` is still 0 rows.
- **Risk:** Med→Low after Tier 1. **Rollback:** recreate table from schema (keep DDL).

### Tier 3 — config hygiene
8. Set `RUN_SETTLEMENT_CRON=false` (pg_cron is the sole scheduler). Optionally retire `paymentSettlement.js` once confident.
9. Review `kelekto-admin/` (typo folder) — confirm dead, then remove separately.

### Tier 4 — duplicate-math consolidation (Phase 2.1, not 2.1C-2)
10. Unify the Node/Deno/SQL recompute, cutoff, and normalization behind one WalletService (canaried). Do **not** delete any copy before its callers are repointed.

## Golden rules
- **Never drop `deposits` while any code references it** (webhook would error on the dead fallback if mis-refactored).
- **Never re-enable cron 4/5.**
- Remove Tier 0 first (safe), then Tier 1 refactor, then Tier 2 table drop, each with a reconciliation check.
- Keep `wallets_backup_20260717` and the `settlement_runs` monitor throughout.
- Save every dropped function/table's definition before dropping (for rollback).

## Do NOT remove (active — from the audit)
`deposit.js` (the file), `handleWebhook`, `invokeVerifyEdgeFunction`, verify/transactions endpoints, `financial.js` math, `_shared2` edge recompute, `settlement_recompute_wallets`/`settlement_cutoff`/`settlement_runs`, cron 6 (recovery), cron 7 (settlement).
