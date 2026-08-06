# RISK_AND_ROLLBACK_PLAN (TASK 7)

Per-deletion risk analysis. Read-only; nothing executed. For each proposed change: what could break, how to detect it, rollback, confidence.

| # | Proposed change | What could break | How to detect | Rollback | Confidence it's safe |
|---|-----------------|------------------|---------------|----------|----------------------|
| 1 | **Disable cron 4 `settle-pending-balances`** | The daily pending→available roll for **dormant** collections stops via this function | Reconcile shows pending not rolling; but it currently rolls *incorrectly* (zeroes), so state improves | `cron.schedule(...)` re-add (seconds) | **Very high** — no dependents; strictly removes corruption |
| 2 | **Disable cron 5 `settle-pending-deposits`** | Nothing (no-op on empty `deposits`) | n/a | re-schedule | **Very high** |
| 3 | **Drop SQL `settle_pending_balances()`** | Any external/manual caller | `pg_proc`/logs show 0 callers besides cron 4 | `CREATE OR REPLACE` from saved def | **High** (do after #1; keep the def text) |
| 4 | **Drop SQL `process_deposit_settlements()`** | Manual callers; future if `deposits` repopulates | logs; 0 callers besides cron 5 | recreate from saved def | **High** |
| 5 | **Recompute all wallets from `contributions`** (Phase B) | Wrong recompute would mis-set balances | reconcile = 0 drift + `available+pending=ledger`; snapshot diff | restore `wallets_backup` snapshot | **High** (idempotent; the canonical math is characterization-tested — 24 tests) |
| 6 | **Backfill 1 missing wallet** | Duplicate wallet if one already exists | `§A5` unique check first; 0 dups today | delete the inserted row | **High** |
| 7 | **Remove Express `deposit.js initializePayment` (deposits path)** | A client still calling `POST /payments/initialize-payment` | access logs; FE ref is dormant (`usePaystackStore` commented) | revert deploy | **Med** — verify no caller first |
| 8 | **Simplify `deposit.js` verify/webhook deposits branch** | Webhook regression (webhook is LIVE) | webhook e2e test; monitor `charge.success` handling | revert deploy | **Med** — keep the Edge fallback intact; change last |
| 9 | **Drop `deposits` table** | Any lingering read/write 500s | run only after #7/#8; confirm 0 references + 0 rows | restore from backup/migration | **Med→High** after #7/#8 |
| 10 | **Consolidate to one WalletService writer** (Edge stops writing its own math) | Edge verify no longer refreshes wallet inline → must call the service | payment e2e; reconcile after a test payment | revert; re-enable Edge inline write | **Med** — behavior-sensitive; shadow/canary like the Collection cutover |

## Cross-cutting safeguards
- **Snapshot `wallets` before any write** (Phase B step 1) — makes 5/6 fully reversible.
- **Reconciliation as the objective gate** after every step: `scripts/reconcileFinancials.js` = 0 drift, 0 negatives, 0 broken identities.
- **No step needs downtime.** The withdrawal cap recomputes independently, so even mid-repair the money path is correct.
- **Order matters:** stopping the corruptor (1–4) is safe and urgent; table drop (9) is last and gated on the Express path removal (7–8).

## Highest residual risks
1. **#10 (single writer)** — genuine behavior change to the live payment path; treat as its own canaried migration, not part of the emergency repair.
2. **#8 (webhook branch)** — the webhook is production-critical; touch last, with an e2e test.
3. **Re-population of `deposits`** — if the Express init path is ever re-enabled while the SQL functions still exist, corruption returns. Removing both together closes this.

## Confidence summary
- **Emergency stop + data recompute (1–6): HIGH** — reversible, no dependents, characterization-tested math.
- **Code/table cleanup (7–9): MED→HIGH** with per-step verification.
- **Architecture consolidation (10): MED** — separate canaried effort.
