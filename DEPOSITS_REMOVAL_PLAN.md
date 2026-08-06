# DEPOSITS_REMOVAL_PLAN (TASK 3 + TASK 6)

Every remaining reference to the `deposits` table, classified, plus an ordered removal plan. Read-only analysis; nothing deleted. Live fact: **`deposits` = 0 rows, 23 columns, leaf table** (only its own `payments_*_fkey` constraints; nothing FK-references it; no view/trigger reads it).

## TASK 3 — Every `deposits` reference & classification

| Reference | Layer | Purpose | Classification |
|-----------|-------|---------|----------------|
| `controllers/deposit.js` · `initializePayment` (INSERT deposits) | Express | legacy payment-init path | **LEGACY** — superseded by Edge `initiate-paystack-payment`; unused (0 rows). *Must replace/retire before dropping table* |
| `controllers/deposit.js` · `verifyPayment` (READ deposits by ref, fallback) | Express | verify via deposit row, else Edge | **LEGACY branch / ACTIVE function** — the deposits lookup is dead (0 rows → always Edge fallback); the function itself is used |
| `controllers/deposit.js` · `handleWebhook` (READ/UPDATE deposits) | Express | Paystack webhook safety-net | **ACTIVE function, LEGACY branch** — webhook is live and required; its `deposits` branch never hits (recovers via Edge) |
| SQL `settle_pending_balances()` (cron 4) | SQL/cron | recompute wallets from deposits | **SAFE TO DELETE** (corrupting; no dependents) |
| SQL `process_deposit_settlements()` (cron 5 via edge) | SQL/cron | RMW wallets from deposits | **SAFE TO DELETE** (no-op landmine) |
| `settle-pending-deposits` edge function | Edge | invokes the SQL RPC | **SAFE TO DELETE** (only calls the dead RPC) |
| `cron.job` id 4 & 5 | pg_cron | schedule the above | **SAFE TO DELETE** (disable) |
| `database/diagnostics_*_.sql` (host-visibility, orphaned-payments) | SQL | manual diagnostics | **SAFE TO DELETE / keep as docs** (not runtime) |
| `models/collections.js` (Sequelize) | Express | ORM schema echo | **LEGACY** — Sequelize dual-model (Phase-1 debt), unrelated to live writes |
| `deposits` table itself | DB | legacy data model | **LEGACY** — delete after the Express init path is migrated |
| Frontend (`kolekto-fe-old/src`, admin) | React | — | **NONE** — no reference (verified) |
| Types | `types.ts` | — | none material |
| Tests | — | integration harness references `wallets`, not `deposits` | none |

**Nothing ACTIVE depends on `deposits` data.** The only live *functions* touching it (`deposit.js` verify/webhook) fall through to the Edge path because the table is empty.

## TASK 6 — Ordered deletion plan (per item)

| Item | Class | Order |
|------|-------|-------|
| `cron.job` id 4 (`settle-pending-balances`) | **Delete immediately** (disable) | 1 — emergency stop |
| `cron.job` id 5 (`settle-pending-deposits`) | **Delete immediately** (disable) | 1 — emergency stop |
| SQL `settle_pending_balances()` | **Delete after** its cron is disabled | 2 |
| SQL `process_deposit_settlements()` | **Delete after** its cron is disabled | 2 |
| `settle-pending-deposits` edge function | Delete after cron 5 disabled | 2 |
| `deposit.js` `initializePayment` (deposits INSERT) | **Must replace first** (confirm no client calls Express init; it's superseded by Edge) then delete | 3 |
| `deposit.js` deposits-read branches in verify/webhook | **Keep temporarily** — simplify only after the init path is gone; the webhook must keep working | 3 |
| `deposits` table | **Delete after migration** — only once no code writes/reads it | 4 (last) |
| `models/collections.js` Sequelize | Delete after migration (Phase-1 dual-ORM cleanup) | 4 |
| diagnostics `.sql` | Keep temporarily (move to `/docs`) | anytime |

**Golden rule:** disable the crons and drop the two SQL functions **first** (they are pure liability); drop the `deposits` **table last**, only after the Express init path is confirmed dead and removed. Never drop the table while `deposit.js` still references it — that would 500 the webhook fallback path.

## Pre-deletion verification (run read-only before each drop)
- Confirm `deposits` still 0 rows (`SELECT count(*) FROM deposits`).
- Confirm no new caller of Express `POST /payments/initialize-payment` (access logs / `usePaystackStore` is the only FE reference and it is commented/dormant).
- Confirm `cron.job` has no other entry invoking the two functions.
