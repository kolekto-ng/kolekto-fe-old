# TIER0_REMOVAL_LOG

Every artifact removed in Phase 2.1C-2 Tier 0, with the exact definition captured **before** removal for reversibility. Project `lpeeckqsltxohppheucz` (test).

## Removed

| # | Artifact | Type | How removed | Reversible via |
|---|----------|------|-------------|----------------|
| 1 | cron job `settle-pending-balances` (jobid 4) | pg_cron | `SELECT cron.unschedule('settle-pending-balances')` | re-create (below) |
| 2 | cron job `settle-pending-deposits` (jobid 5) | pg_cron | `SELECT cron.unschedule('settle-pending-deposits')` | re-create (below) |
| 3 | `settle_pending_balances()` | SQL function | `DROP FUNCTION IF EXISTS public.settle_pending_balances()` | re-create (below) |
| 4 | `process_deposit_settlements()` | SQL function | `DROP FUNCTION IF EXISTS public.process_deposit_settlements()` | re-create (below) |
| 5 | `supabase/functions/settle-pending-deposits/index.ts` | edge source (repo) | `git rm` | git revert |

**Deployed edge function note:** the MCP has no delete-edge-function capability, so the *deployed* `settle-pending-deposits` function was not removed from Supabase by this step. Its runtime path is already severed (cron 5 removed → nothing invokes it). **Operator action:** `supabase functions delete settle-pending-deposits` (CLI) or delete via the dashboard to fully remove the deployed function.

## Rollback definitions (captured pre-removal)

### cron 4
```sql
SELECT cron.schedule('settle-pending-balances', '0 4 * * *', 'SELECT settle_pending_balances()');
-- (was active=false)
```
### cron 5
```sql
SELECT cron.schedule('settle-pending-deposits', '0 4 * * *', $$
  select net.http_post(
    url:='https://lpeeckqsltxohppheucz.supabase.co/functions/v1/settle-pending-deposits',
    headers:=jsonb_build_object(),
    timeout_milliseconds:=5000
  );
$$);
-- (was active=false)
```
### settle_pending_balances()  ⚠️ CORRUPTING — do NOT re-create except to roll back
```sql
CREATE OR REPLACE FUNCTION public.settle_pending_balances() RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE wallets w SET
    available_balance = COALESCE((SELECT SUM(d.net_amount) FROM deposits d
      WHERE d.wallet_id = w.id AND d.status = 'success' AND d.paid_at < CURRENT_DATE::timestamptz), 0) - COALESCE(w.withdrawn, 0),
    pending_balance = COALESCE((SELECT SUM(d.net_amount) FROM deposits d
      WHERE d.wallet_id = w.id AND d.status = 'success' AND d.paid_at >= CURRENT_DATE::timestamptz), 0),
    updated_at = NOW();
END;
$function$;
```
### process_deposit_settlements()  ⚠️ RMW landmine — do NOT re-create except to roll back
```sql
CREATE OR REPLACE FUNCTION public.process_deposit_settlements() RETURNS void LANGUAGE plpgsql AS $function$
DECLARE d RECORD;
BEGIN
  FOR d IN SELECT id, wallet_id, net_amount FROM public.deposits
    WHERE status='success' AND settlement_status='unsettled' AND paid_at < date_trunc('day', now())
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.wallets SET available_balance = available_balance + d.net_amount,
      pending_balance = GREATEST(pending_balance - d.net_amount, 0), updated_at = now() WHERE id = d.wallet_id;
    UPDATE public.deposits SET settlement_status='settled', settled_at=now(), updated_at=now() WHERE id=d.id;
  END LOOP;
END;
$function$;
```
### edge source
Restore from git history (`git revert` / checkout the deleted `supabase/functions/settle-pending-deposits/index.ts`), then redeploy via `supabase functions deploy settle-pending-deposits`.

> **Do not roll these back except in a genuine emergency.** They are the corruptor and its landmine; re-creating them while `deposits` is empty (or ever) re-introduces the wallet corruption. Rollback of Tier 0 should only ever be a temporary step while diagnosing an unrelated issue.

## Zero-caller proof (captured before removal)
- `grep settle_pending_balances|process_deposit_settlements|settle-pending-deposits` across all repos → only docs, comments, generated `types.ts` declarations, and the edge's own `index.ts:32`. **No `rpc()` / route / import / scheduler in application code called them.**
- Their only invokers were cron 4 (→ `settle_pending_balances`) and cron 5 (→ edge → `process_deposit_settlements`), both already disabled and now removed.
