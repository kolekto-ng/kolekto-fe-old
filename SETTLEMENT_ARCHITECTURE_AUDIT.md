# SETTLEMENT_ARCHITECTURE_AUDIT (Phase 2.1C — STEP 1 & 2)

Evidence-based investigation of Kolekto's settlement, then the canonical replacement's context. Project `lpeeckqsltxohppheucz`.

## STEP 1 — Is `RUN_SETTLEMENT_CRON` enabled? Where does settlement run?

| Question | Finding | Evidence |
|----------|---------|----------|
| `RUN_SETTLEMENT_CRON` set? | **Yes = true** in `kolekto-be-old/.env` | `grep RUN_SETTLEMENT_CRON .env` → `RUN_SETTLEMENT_CRON=true` |
| Where the Node cron runs | `jobs/paymentSettlement.js`, loaded at boot by `app.js:30`; schedules `0 4 * * *` only if the flag is true | `app.js:30`, `paymentSettlement.js:142` |
| PM2? | **No** PM2/ecosystem file in repo | no `ecosystem.config.*` |
| Render? | **No** `render.yaml`/`Procfile`/`Dockerfile` in repo (deploy config external) | dir listing |
| Start command | `node app.js` | `package.json` scripts |
| Another scheduler? | **pg_cron** in the database: jobs 4 `settle-pending-balances`, 5 `settle-pending-deposits` (both **disabled** in 2.1B), 6 `scheduled-payment-recovery` | `cron.job` |
| Duplicate schedulers? | **YES, historically** — the Node cron (`0 4 * * *`) AND the pg_cron `settle_pending_balances` (`0 4 * * *`) both targeted wallets nightly | code + `cron.job` |

### Critical evidence: the Node cron is NOT actually executing
Despite `RUN_SETTLEMENT_CRON=true`, a **dormant collection was not settled at today's cutoff**:
- collection `92819d85`: a ₦7,500 payment on **2026-07-17 14:10**; wallet `updated_at` still **2026-07-17 14:10:50**; the 2026-07-18 04:00 UTC cutoff passed with **no settlement write**.
- If the Node cron had run at 04:00, the wallet would show `available=12,500, pending=0` with a ~04:00 timestamp. It did not.

**Conclusion:** the Node settlement cron is unreliable in the deployed environment (not running, or the backend/flag isn't live there). The **reliable scheduler in this Supabase-centric stack is pg_cron.** The historically-effective settlement was the pg_cron `settle_pending_balances()` — which was the *corrupting* one (read empty `deposits`). So prior to this phase: the correct mechanism (Node) wasn't running, and the running mechanism (SQL) was broken.

## STEP 2 — Complete settlement lifecycle

```
payment (Edge initiate) → contribution(pending)
        │
verify (Edge verify-paystack-payment · _shared2.refreshCollectionAndWallets)
        │  recompute from contributions → wallet.pending/available by cutoff
        ▼
wallet projection (pending = today's net ; available = settled net − withdrawn)
        │
scheduled settlement (T+1)  ── rolls dormant pending → available at the cutoff
        │   OLD: cron 4 settle_pending_balances() [from deposits → CORRUPT, disabled]
        │   OLD: Node cron runDailySettlement() [from contributions → correct, NOT running]
        │   NEW: pg_cron 'settlement-recompute-wallets' → settlement_recompute_wallets() [contributions]
        ▼
available → withdrawal (withdrawal.js recomputes cap from contributions; independent)
```

| Stage | Runtime | Function | Source | Cutoff |
|-------|---------|----------|--------|--------|
| Payment init | Edge | `initiate-paystack-payment` | inserts contribution | — |
| Verify + wallet | Edge | `verify-paystack-payment` / `_shared2.refreshCollectionAndWallets` | contributions | `getSettlementCutoff` (Deno copy) |
| Event-path recompute | Express | `deposit.updateWalletStats`, `withdrawal.refreshWallet` | contributions | `getSettlementCutoff` (Node) |
| **Scheduled settlement (NEW)** | **SQL / pg_cron** | **`settlement_recompute_wallets()`** | **contributions** | **`settlement_cutoff()`** |
| Withdrawal | Express | `requestWithdrawal`/`getEligibleCollections` | contributions (recompute) | Node |

**Cutoff definitions today:** `getSettlementCutoff` (Node) + its Deno copy + the new `settlement_cutoff()` (SQL) — all **4am UTC**. Unifying these to a single shared definition is Phase 2.1; `settlement_cutoff()` is documented as the canonical settlement cutoff and must stay aligned with `getSettlementCutoff`.

## Duplicate-scheduler resolution (this phase)
- Disabled: cron 4 & 5 (2.1B). 
- Added: cron 7 `settlement-recompute-wallets` (the single active settlement scheduler).
- The Node cron was refactored to delegate to the same SQL function; **`RUN_SETTLEMENT_CRON` should be set to `false`** so pg_cron is the sole scheduler (no duplicate). See execution plan.
