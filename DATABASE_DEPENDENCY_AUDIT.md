# DATABASE_DEPENDENCY_AUDIT (Tier 2, pre-drop)

Exhaustive check that **nothing** in the database depended on `deposits` before dropping it. Project `lpeeckqsltxohppheucz`. All queries via catalog introspection.

## Dependency checks — ALL CLEAR

| Dependency type | Result | Query basis |
|-----------------|--------|-------------|
| Inbound foreign keys (tables referencing `deposits`) | **NONE** | `pg_constraint contype='f' AND confrelid=deposits` |
| Views referencing `deposits` | **NONE** | `information_schema.views` |
| Materialized views | **NONE** | `pg_matviews` |
| Triggers on `deposits` | **NONE** | `pg_trigger` |
| Functions referencing `deposits` | **NONE** | `pg_get_functiondef ILIKE '%deposits%'` (Tier 0 dropped the 2 settlement fns) |
| RLS policies on `deposits` | **NONE** | `pg_policies` |
| Rule/view dependents (`pg_depend`) | **NONE** | `pg_depend` join `pg_rewrite` |
| Rows | **0** | `count(*)` |

## `deposits`' OWN objects (dropped with the table)
- PK: `payments_pkey (id)`
- Own FKs (outbound → other tables): `payments_collection_id_fkey → collections(id) ON DELETE SET NULL`, `payments_contributor_id_fkey → contributions(id) ON DELETE SET NULL`
- Check: `deposits_settlement_status_check`
- Index: `payments_pkey`
- (Note: object names are `payments_*` — the table was originally `payments`, later renamed to `deposits`.)

**Outbound FKs are safe:** `deposits → collections/contributions` means dropping `deposits` removes those FK constraints; it does **not** affect `collections`/`contributions` (the referenced side). No `ON DELETE` cascade points *into* those tables from this drop.

## Security note (bonus)
`deposits` had **RLS disabled** (`relrowsecurity=false`) with `GRANT ALL` to `anon` and `authenticated`. It was an anon-readable/writable table with no row security. Empty and now dropped — this removes a latent exposure.

## Verdict
`deposits` is a **pure leaf with zero external dependents**. Dropping it cannot break any database object. **GATE PASSED.**
