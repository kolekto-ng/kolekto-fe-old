# PRODUCTION_ROLLOUT_AUDIT (Phase 2.1C-2)

Question: **can production still accidentally execute the legacy/corrupting code?** Evidence-based, read-only.

## Every possible trigger of the corrupting settlement — checked

| Trigger class | Could it call `settle_pending_balances()` / `process_deposit_settlements()`? | Evidence |
|---------------|------------------------------------------------------------------------------|----------|
| pg_cron | **No** — cron 4 & 5 `active=false` (verified live) | `cron.job` |
| Application `supabase.rpc(...)` | **No** — no code calls these functions (grep: only comments) | full-repo grep |
| HTTP endpoint | **No** — no route invokes them | routes audit |
| Edge function (scheduled) | **No** — `settle-pending-deposits` edge is only invoked by cron 5 (off) | `cron.job` |
| Webhook / retry worker | **No** — recovery cron 6 calls the canonical `verify-paystack-payment`, not settlement | edge audit |
| Node scheduler | **No** — `paymentSettlement.js` now delegates to `settlement_recompute_wallets` (the canonical fn), never the legacy ones | `paymentSettlement.js` |
| Manual/admin script | **No** — no admin/CLI script references them | scripts audit |

**Conclusion:** the corrupting functions **cannot fire on any schedule or code path**. They exist in the DB but are inert. (They could only run if an operator manually `SELECT`s them or re-enables cron 4/5 — a deliberate act, not an accident.)

## Residual accidental-execution risks (must be closed before/at cleanup)

| Risk | Path | Likelihood | Mitigation (Phase 2.1C-2) |
|------|------|-----------|---------------------------|
| **Re-enabling cron 4/5** | `cron.alter_job(active:=true)` | Manual only | Delete the jobs + functions (they're the only remaining way to re-corrupt) |
| **`deposits` repopulated** then a legacy fn re-enabled | `deposit.initializePayment` still reachable at `POST /api/payments/initialize-payment`; if a client calls it, `deposits` gets rows | Low (FE uses edge) | Confirm 0 callers of the Express init endpoint; then retire that path; then drop `deposits` |
| **Duplicate scheduler** | Node cron (`RUN_SETTLEMENT_CRON=true`) + pg_cron cron 7 both at 04:00 | Present-but-harmless (both idempotent; Node delegates to same fn) | **Set `RUN_SETTLEMENT_CRON=false`** so pg_cron is sole scheduler |
| **`_shared1.ts` reads `deposits`** in verify edge | read-only; `deposits` empty | None (harmless read) | Remove the read during deposits retirement |

## Deployment-config check
- **No `render.yaml`/`Procfile`/`Dockerfile`/PM2 file** in the repo → scheduler/env config is external (Render dashboard). **Action:** verify in the deployed env that (a) cron 4/5 stay disabled, (b) `RUN_SETTLEMENT_CRON=false`, (c) cron 7 exists. These cannot be confirmed from the repo alone.
- `.env` shows `RUN_SETTLEMENT_CRON=true` locally — **must be flipped to false** to guarantee a single scheduler.

## Current live state (verified)
- cron: 4=false, 5=false, 6=true (recovery), 7=true (canonical settlement).
- `deposits`: 0 rows. Legacy SQL functions: present, 0 code callers.
- Canonical settlement: operational, single active scheduler.

## Verdict
Production **cannot accidentally execute** the corrupting settlement via any schedule, endpoint, webhook, worker, or code path. The only remaining ways to re-corrupt are deliberate operator actions (re-enable cron 4/5, or repopulate `deposits` + re-enable a legacy fn). Closing those = the Phase 2.1C-2 removals, plus setting `RUN_SETTLEMENT_CRON=false`.
