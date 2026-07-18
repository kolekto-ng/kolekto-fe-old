# DEPOSITS_TABLE_RETIREMENT_REPORT (Tier 2)

`public.deposits` has been **dropped** from the test project `lpeeckqsltxohppheucz` after proving zero runtime and zero database dependency. Full rollback DDL captured below.

## Pre-drop gates — all passed
- **Runtime:** 0 references in code (Tier 1); only docs/SQL/generated-types remain.
- **Database:** 0 dependents (no inbound FK / view / matview / trigger / function / policy / rule) — see `DATABASE_DEPENDENCY_AUDIT.md`.
- **Rows:** 0.
- **Types:** generated `types.ts` in the admin apps declare `deposits` (stale after drop; regenerate — non-blocking).
- **Migrations:** `g1` references `deposits.payment_reference` (unapplied — update before applying); `diagnostics_*` obsolete; `settlement_recompute.sql` comment only.

## Action taken
```sql
DROP TABLE public.deposits;
```
Confirmed: `to_regclass('public.deposits') IS NULL` → **true**. Nothing else touched.

## Full rollback DDL (captured before drop)
```sql
CREATE TABLE public.deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name character varying NOT NULL,
  email character varying NOT NULL,
  phone_number character varying,
  amount numeric NOT NULL,
  status character varying NOT NULL DEFAULT 'pending',
  payment_reference character varying NOT NULL,
  access_code character varying,
  authorization_url text,
  contributor_id uuid,
  collection_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  channel character varying,
  currency character varying,
  wallet_id uuid,
  settled_at timestamptz,
  settlement_status text DEFAULT 'unsettled',
  net_amount numeric NOT NULL DEFAULT 0,
  init_email_sent boolean NOT NULL DEFAULT false,
  contributor_confirmed_sent boolean NOT NULL DEFAULT false,
  organizer_notified_sent boolean NOT NULL DEFAULT false,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT deposits_settlement_status_check
    CHECK (settlement_status = ANY (ARRAY['unsettled'::text,'settled'::text,'failed'::text])),
  CONSTRAINT payments_collection_id_fkey
    FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE SET NULL,
  CONSTRAINT payments_contributor_id_fkey
    FOREIGN KEY (contributor_id) REFERENCES public.contributions(id) ON DELETE SET NULL
);
-- Original grants (RLS was DISABLED — reproduce only if intentionally rolling back;
-- consider enabling RLS instead, as anon had full access):
GRANT ALL ON public.deposits TO anon, authenticated, postgres, service_role;
```
- Table was empty (0 rows), so there is **no data to restore** — recreating the schema fully reverts the drop.
- Indexes: only `payments_pkey` (recreated by the PK constraint above).

## Rollback procedure
Run the `CREATE TABLE` above to restore the (empty) table. Then, to restore the code coupling, `git revert` the Tier 1 commits (`d0e3954`, `c8ff9b1`). **Not recommended** — `deposits` was dead and RLS-less.

## Follow-ups (post-Tier-2, non-blocking)
1. **Regenerate Supabase types** in `kolekto-admin-control-panel-1` and `kelekto-admin` so `types.ts` no longer declares `deposits`.
2. **Update/retire `database/g1_financial_idempotency_guards.sql`** — it targets `deposits.payment_reference`; remove that block before the migration is ever applied.
3. Remove `deposits` from `diagnostics_host_visibility_and_aggregates.sql` (obsolete).
4. Apply the same drop to **production** after its own soak (per the staged plan).
