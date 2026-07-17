# WALLET_SNAPSHOT_LOCATION

The pre-repair backup of the entire `wallets` table, taken **before any write** in Phase 2.1B-B.

## Location
- **Project:** `lpeeckqsltxohppheucz` (Supabase, test)
- **Table:** `public.wallets_backup_20260717`
- **Contents:** a full copy of every `wallets` column, plus `backed_up_at timestamptz` (= snapshot time).
- **Rows:** 56 (the wallet count before the missing-wallet backfill).
- **Created by:** `CREATE TABLE wallets_backup_20260717 AS SELECT *, now() AS backed_up_at FROM public.wallets;`
- **Verified:** row count = live (56); `sum(available_balance)` = live at snapshot time (−159,300.00).

## What it captures
The **corrupted** pre-repair state (e.g. `available_balance = −withdrawn`, `pending = 0`). This is intentional — it is the exact state to restore to if the repair must be reverted.

## Full rollback procedure (if ever required)
```sql
-- 1) Restore the 56 original wallet rows to their pre-repair values
UPDATE public.wallets w
SET net_payment      = b.net_payment,
    gross_payment    = b.gross_payment,
    pending_balance  = b.pending_balance,
    available_balance= b.available_balance,
    ledger_balance   = b.ledger_balance,
    withdrawn        = b.withdrawn,
    updated_at       = b.updated_at
FROM public.wallets_backup_20260717 b
WHERE w.id = b.id;

-- 2) Remove the wallet created in Phase 4 (was absent in the snapshot)
DELETE FROM public.wallets
WHERE collection_id = '380e1d0e-866b-4902-a413-10fd46119863'
  AND id NOT IN (SELECT id FROM public.wallets_backup_20260717);

-- 3) (Only if intentionally reverting the whole change) re-enable the crons — NOT recommended:
-- SELECT cron.alter_job(job_id := 4, active := true);
-- SELECT cron.alter_job(job_id := 5, active := true);
```

## Retention
Keep `wallets_backup_20260717` until Phase 2.1C is complete and the repaired state has survived at least one full day without the (now-disabled) corruptor. Drop only deliberately:
```sql
DROP TABLE public.wallets_backup_20260717;  -- only after 2.1C sign-off
```

## Integrity note
The backup is a plain table copy in the same database; for stronger durability you may also export it (`pg_dump -t wallets_backup_20260717`) to off-database storage before Phase 2.1C.
