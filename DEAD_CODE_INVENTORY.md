# DEAD_CODE_INVENTORY (Phase 2.1C-2)

Classification of every financial legacy artifact. **Read-only.** Legend: **DEAD** (no runtime path) · **DISABLED** (present but not scheduled/invoked) · **ACTIVE** (runtime-critical — do NOT remove) · **UNAPPLIED** (repo only).

## Truly dead / disabled (removable after soak)
| Artifact | State | Why |
|----------|-------|-----|
| `settle_pending_balances()` (SQL fn) | **DISABLED** | cron 4 off; 0 code callers; corrupting |
| `process_deposit_settlements()` (SQL fn) | **DISABLED** | cron 5 off; 0 code callers; no-op RMW |
| `settle-pending-deposits` edge function | **DISABLED** | only cron 5 called it (off) |
| cron 4 `settle-pending-balances` | **DISABLED** | active=false |
| cron 5 `settle-pending-deposits` | **DISABLED** | active=false |
| `deposits` table | **DEAD DATA** (0 rows) | live path writes `contributions`; still *referenced* by code (see below) so remove references first |
| `deposit.initializePayment` deposits INSERT | **DEAD PATH** | superseded by edge `initiate-paystack-payment`; endpoint reachable but unused |
| `deposit.js` deposits-read branches (verify/webhook) | **DEAD BRANCH** | `deposits` empty ⇒ always falls through to the edge verify |
| `diagnostics_*.sql` (deposits) | **DEAD** (manual only) | not runtime |
| `kelekto-admin/` (typo folder) | **LIKELY DEAD** | superseded by `kolekto-admin-control-panel-1`; verify before touching |

## ACTIVE — must NOT be removed (only refactored later)
| Artifact | State | Runtime role |
|----------|-------|--------------|
| `controllers/deposit.js` (the file) | **ACTIVE** | live webhook (`handleWebhook`), payment routes, `invokeVerifyEdgeFunction` used by admin reconcile/monitoring |
| `deposit.handleWebhook` | **ACTIVE** | Paystack `charge.success` safety net (`app.js:102`) |
| `deposit.invokeVerifyEdgeFunction` | **ACTIVE** | single re-verify path for admin reconcile + webhook recovery |
| `deposit.verifyPayment` / `listTransactions` / `fetchTransaction` | **ACTIVE** | `/api/payments/*` endpoints |
| Node `computeWalletBalances`/`normalizeContributions`/`calculateFees`/`getSettlementCutoff` (`financial.js`) | **ACTIVE** | canonical Node math used by withdrawal/dashboard/admin-wallet/reconcile/settlement wrapper |
| Deno `refreshCollectionAndWallets` (`_shared2`) | **ACTIVE** | live edge verify wallet write |
| `settlement_recompute_wallets()` / `settlement_cutoff()` / `settlement_runs` | **ACTIVE** | the canonical settlement (cron 7) |
| cron 6 `scheduled-payment-recovery` | **ACTIVE** | orphan recovery → canonical verify |
| Node `paymentSettlement.js` cron | **ACTIVE (gated)** | now delegates to canonical fn; keep as manual/fallback; `RUN_SETTLEMENT_CRON` should be false |

## Duplicates (NOT dead — consolidation, Phase 2.1)
Same computation in 3 runtimes; all live; keep until unified:
- **wallet recompute:** Node `computeWalletBalances` · Deno `refreshCollectionAndWallets` · SQL `settlement_recompute_wallets`
- **cutoff:** Node `getSettlementCutoff` · Deno copy · SQL `settlement_cutoff`
- **normalization/fees:** Node `normalizeContributions`/`calculateFees` · Deno copies · SQL inline

## Repo-only / unapplied (not runtime)
- `database/g1_financial_idempotency_guards.sql`, `database/g2_atomic_withdrawal_request.sql` — never applied; keep for future.
- FE feature flag `VITE_CREATE_COLLECTION_PATH` + `src/lib/featureFlags.ts` — dormant (Collection canary; default edge).

## Unused env vars / flags to review
- `RUN_SETTLEMENT_CRON` — still gates `paymentSettlement.js`; recommend **false** (pg_cron is authoritative). Not "unused" but should be flipped.
- `USE_ATOMIC_WITHDRAWAL` — referenced only in the unapplied `g2` SQL comment; not wired.
- `USE_EXPRESS_CREATE_COLLECTION` / `VITE_CREATE_COLLECTION_PATH` — Collection canary, dormant.

## Bottom line
Removable-now set is small and clean: **the 2 legacy SQL settlement functions, the `settle-pending-deposits` edge, and the 2 disabled crons** — none have any code caller. The `deposits` **table** and its `deposit.js`/`_shared1.ts` references must be **refactored out first** (the controller is active). Duplicate math is a Phase-2.1 consolidation, not dead code.
