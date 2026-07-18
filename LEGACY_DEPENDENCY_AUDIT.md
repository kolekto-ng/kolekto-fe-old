# LEGACY_DEPENDENCY_AUDIT (Phase 2.1C-2)

Complete dependency graph for the financial legacy artifacts. **Read-only; nothing deleted/modified.** Evidence: full-repo search (`kolekto-be-old`, `kolekto-fe-old` incl. edge functions, `kolekto-admin-control-panel-1`, `kelekto-admin`) + live DB introspection (`lpeeckqsltxohppheucz`).

## ⚠️ Premise correction (proof-driven)
The task lists "legacy deposit controllers" among disabled fallbacks. **This is wrong: `controllers/deposit.js` is RUNTIME-CRITICAL, not a fallback.** Evidence:
- `app.js:36` imports `handleWebhook` and mounts `/api/payments/webhook` (the **live Paystack webhook**, raw-body).
- `app.js:126` mounts `paymentRouter` → `routes/payment.js:8` → `deposit.js` (`initializePayment`, `verifyPayment`, `listTransactions`, `fetchTransaction`, `sendReceiptNotification`).
- `deposit.js` exports **`invokeVerifyEdgeFunction`** (line 55), the **single** re-verify path used by admin tooling: `admin/payments.js:16/75`, `admin/paymentMonitoring.js:14/302/327/357`.
Only the **`deposits`-table coupling inside** `deposit.js` is legacy — not the file.

## Dependency matrix

| Artifact | Purpose | Referenced by (proof) | Runtime active? | Safe to remove? | Replacement | Migration needed | Risk |
|----------|---------|-----------------------|-----------------|-----------------|-------------|------------------|------|
| **`deposits` table** | legacy payment model | **write:** `deposit.js.initializePayment` (`.from("deposits").insert`); **read:** `deposit.js` verify/webhook (~11 sites), `verify-paystack-payment/_shared1.ts:555,582`; SQL `settle_pending_balances`/`process_deposit_settlements` (disabled); `diagnostics_*.sql`; `g1_financial_idempotency_guards.sql` (unapplied); `kelekto-admin` types | **0 rows**; write path reachable but unused (live init = edge) | **After migration** | contributions (source of truth) | Yes — remove deposits reads/writes from `deposit.js` + `_shared1.ts` first | Med |
| **`settle_pending_balances()`** | corrupting nightly settle (read empty deposits) | ONLY cron 4 (disabled). **No app code calls it** (grep: 0 rpc calls) | **No** (cron disabled) | **Yes** (after soak) | `settlement_recompute_wallets()` | No | Low |
| **`process_deposit_settlements()`** | RMW settle from deposits | ONLY cron 5 → `settle-pending-deposits` edge (disabled). No app code | **No** | **Yes** | `settlement_recompute_wallets()` | No | Low |
| **`settle-pending-deposits` edge fn** | http entry → `process_deposit_settlements()` | ONLY cron 5 (disabled) | **No** | **Yes** | — | No | Low |
| **cron 4 `settle-pending-balances`** | scheduler | pg_cron | **No** (active=false) | Yes | cron 7 | No | Low |
| **cron 5 `settle-pending-deposits`** | scheduler | pg_cron | **No** (active=false) | Yes | cron 7 | No | Low |
| **`deposit.js` controller** | webhook + verify + admin reconcile + transactions | `app.js:36,126`, `routes/payment.js`, `admin/payments.js`, `admin/paymentMonitoring.js` | **YES — critical** | **No** | keep; strip only `deposits` coupling | Refactor, not delete | **High if deleted** |
| **`deposit.initializePayment`** (Express init → writes deposits) | legacy payment init | `routes/payment.js` (`POST /payments/initialize-payment`); FE `usePaystackStore.ts` (dormant) | Reachable, **unused** (live init = edge `initiate-paystack-payment`) | After confirming 0 callers | edge initiate | Verify no client calls it | Med |
| **Node settlement cron** (`paymentSettlement.js`) | scheduler (gated) | `app.js:30`; gated by `RUN_SETTLEMENT_CRON=true` | Refactored to **delegate** to `settlement_recompute_wallets`; proven not executing in deployed env | Keep as manual/fallback; set flag false | pg_cron cron 7 | Set `RUN_SETTLEMENT_CRON=false` | Low |
| **Duplicate wallet recompute** | balance math | Node `financial.js computeWalletBalances` (used by deposit/withdrawal/collectionAccess/dashboard/admin-wallet/reconcile); Deno `_shared2.refreshCollectionAndWallets`; SQL `settlement_recompute_wallets` | All active (event paths + settlement) | **No** — consolidation only | one shared WalletService | Phase 2.1 | Med |
| **Duplicate settlement cutoff** | 4am-UTC def | Node `getSettlementCutoff`; Deno copy (`_shared1.ts`); SQL `settlement_cutoff()` | active | No | one shared def | Phase 2.1 | Low |
| **Duplicate normalization** | net/fee | Node `normalizeContributions`/`calculateFees`; Deno copies; SQL inline | active | No | one shared | Phase 2.1 | Low |
| **`g1`/`g2` migration files** | idempotency + atomic withdrawal | unapplied `.sql` in repo | Not applied | Keep (future) | — | Apply when ready | Low |
| **`kelekto-admin`** (typo folder) | old admin app | separate root folder; types reference deposits | Unknown/likely dead | Investigate separately | `kolekto-admin-control-panel-1` | — | Low |

## Who invokes the legacy SQL functions? — **Nobody in code**
Grep for `settle_pending_balances` / `process_deposit_settlements` across all code found **only comments** (`settlement_recompute.sql`, `reconcileFinancials.js`). Their only historical invoker was cron 4/5 (now disabled) and the `settle-pending-deposits` edge (cron 5, disabled). No `rpc()`, no HTTP, no scheduler in application code calls them.

## Hidden coupling scan (all clear for legacy)
- `supabase.rpc(...)` calls: `claim_push_notification_event`, `claim_email_campaign_recipients`, ambassador RPCs, `next_contribution_code_number`, **`settlement_recompute_wallets`** (new). **None target the legacy settlement functions.**
- `cron.schedule(...)` in code: push, email, `paymentSettlement.js:70` (gated). No code schedules the legacy SQL functions (those live in pg_cron, disabled).
- `import(...)` dynamic: only `node:crypto`, `@supabase/supabase-js` — no legacy financial code.
- No webhook/retry worker calls the legacy functions (the recovery cron 6 → `scheduled-payment-recovery` edge → `verify-paystack-payment`, the canonical verify, not the legacy settlement).
