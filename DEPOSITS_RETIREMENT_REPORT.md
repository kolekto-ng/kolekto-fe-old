# DEPOSITS_RETIREMENT_REPORT (Tier 1)

Status of the `deposits` table after removing its runtime coupling. **The table is NOT dropped** — that is Tier 2, after a soak.

## Runtime dependency: ELIMINATED
Repo-wide grep for `deposits`-table references in runtime code (backend controllers/services/jobs/utils/routes, edge functions, frontend `src`) → **ZERO**. Remaining matches are only:
- documentation (`*.md`),
- SQL files (`database/*.sql`: `settlement_recompute.sql` comments, `g1` migration, diagnostics),
- generated types (`src/integrations/supabase/types.ts` in the admin apps),
- a few explanatory code comments (e.g. `_shared1.ts` history note) — non-executable.

## Live table state
- `deposits`: **0 rows** (never populated on the live path; the only writer, `deposit.initializePayment`, is dead and no longer writes it).
- No view, trigger, FK, function, cron, edge function, route, RPC, or import queries `deposits` at runtime.

## Why the table can't be dropped yet (Tier 2 gate)
- **Generated types** in the admin apps still declare the `deposits` table; dropping it makes those types stale (harmless, but regenerate).
- The `g1_financial_idempotency_guards.sql` migration (unapplied) references `deposits.payment_reference` — update/skip before it's ever applied.
- **Soak requirement (per the task):** confirm over a soak window (staging/production) that real payments, webhooks, retries, and admin reconciliation work with **no** `deposits` references before dropping the table. Only then Tier 2 runs `DROP TABLE deposits`.

## Tier 2 preconditions (do NOT execute now)
1. Soak passed: real payment + webhook + retry + admin reconcile all green with zero `deposits` access.
2. Re-grep confirms zero runtime references (holds now).
3. Save the `deposits` table DDL for rollback.
4. Regenerate Supabase types after the drop.

## Rollback (Tier 1)
`git revert` the two commits restores the `deposits` reads/writes in `deposit.js` and `_shared1.ts`. No data or schema was changed, so there is nothing to reverse in the database.
