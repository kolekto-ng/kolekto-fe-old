# KOLEKTO — Pre-Repair Architecture Verification (READ-ONLY)

**Goal:** prove that disabling the nightly `settle_pending_balances()` cron cannot break any production workflow, *before* any repair.
**Method:** live DB introspection (`pg_proc`, `pg_trigger`, `information_schema.views`, `pg_constraint`, `cron.job`) on project `lpeeckqsltxohppheucz` + full code search across backend, frontend, edge, SQL. **Nothing was modified.**
**Bottom line up front:** **YES — safe to proceed.** `settle_pending_balances()` has **zero downstream dependents**; every production workflow derives from `contributions` or recomputes wallets on demand. Confidence: **High** (§10).

---

## TASK 1 — Complete payment data flow (live path)

```
User clicks Pay
  → FE ContributeFlow → Edge initiate-paystack-payment
       · calculateFees (Deno) · INSERT contributions(status=pending) · pending_payment_context
  → Paystack hosted checkout
  → return → FE paymentCallback → Edge verify-paystack-payment
       · Paystack /verify · UPDATE contributions→paid (amount, gross_amount, code)
       · refreshCollectionAndWallets(_shared2)  → WRITE wallets (from contributions)
       · tier sold_quantity · receipt email · push
  → (fallback) Paystack webhook → Express deposit.handleWebhook (HMAC)
       · if no deposits/contrib row → invokeVerifyEdgeFunction → Edge verify (same as above)
  → Settlement (T+1): recompute reclassifies pending→available by 04:00-UTC cutoff
  → Withdrawal: withdrawal.requestWithdrawal → refreshWallet (recompute from contributions) → strict cap
  → Ledger: none (single-entry; wallets is a derived projection)
  → Receipts: renderReceiptEmail (edge) / paymentConfirmation (backend)
  → Analytics/Notifications: derived from contributions / transactions
```

**Every money fact originates in `contributions` (+ `withdrawals`). `wallets.*` is a derived projection. `deposits` is not on the live path.**

## TASK 2 — Every `deposits` usage (and whether it's live)

| Location | Purpose | Active? | Prod uses it? | Safe to remove? |
|---|---|---|---|---|
| `controllers/deposit.js` `initializePayment` | INSERT `deposits` (Express init path) | Code present | **No** — `deposits` = **0 rows**; live init is the Edge function | After migrating the Express path off (Phase 2.1) |
| `controllers/deposit.js` `verifyPayment`/`handleWebhook` | READ `deposits` by reference; fallback to Edge | Code present | Webhook active, but `deposits` branch never hits (0 rows) → always uses the Edge fallback | Keep webhook; the deposits branch is dead |
| SQL `settle_pending_balances()` (cron 4) | READ `deposits` to recompute wallets | **Active + CORRUPTING** | **No** (reads empty table) | **Yes — disable** (Phase 2.1B Step 0) |
| SQL `process_deposit_settlements()` (cron 5 via edge) | READ `deposits`, RMW wallets | Active but **no-op** (0 rows) | No | Yes — disable (RMW landmine) |
| `database/diagnostics_host_visibility_and_aggregates.sql` | diagnostic SELECT | Manual | No | Yes (diagnostic only) |
| Frontend (`kolekto-fe-old/src`) | — | **No references at all** | — | n/a |
| Views / triggers / other functions | **None reference `deposits`** | — | — | — |

`deposits` is a **leaf table** (0 rows, 23 cols; only its own `payments_*_fkey` constraints; nothing FK-references it). It is effectively **dead data** on this project.

## TASK 3 — Every `contributions` usage (the live source)

- **Writers:** Edge `initiate-paystack-payment` (insert pending), Edge `verify-paystack-payment` (→paid), Express `deposit.js` verify/webhook (deposits path — inactive here), Express `contribution.js` (legacy), client `useContributionStore` (to be removed).
- **Readers (money):** Edge `refreshCollectionAndWallets`, Node `updateWalletStats`, `withdrawal.refreshWallet`/`getEligibleCollections`, Node `paymentSettlement` cron, `scripts/reconcileFinancials.js`, admin `wallet.js` (live recompute), analytics/receipts.
- **Triggers on `contributions`:** `enforce_max_contributions`, `trg_contributions_ambassador_attribution` (business rules — unrelated to wallet balances).
- **Verdict:** `contributions` is the **de-facto single source of truth**; every correct wallet number in the system is derived from it.

## TASK 4 — Every wallet writer (complete inventory)

| # | Writer | Runtime | Writes columns | Frequency | Source | Active? |
|---|--------|---------|----------------|-----------|--------|---------|
| 1 | Edge `verify-paystack-payment` → `refreshCollectionAndWallets` | Edge | net/gross/pending/available/ledger/withdrawn | per payment | **contributions** | **Yes (live)** |
| 2 | `deposit.js updateWalletStats` | Express | same 6 | per Express verify/webhook | contributions | Code yes; **path inactive** (0 deposits) |
| 3 | `withdrawal.js refreshWallet` | Express | same 6 | per withdrawal request/approve | contributions | **Yes** |
| 4 | `jobs/paymentSettlement.js runDailySettlement` | Node cron | net/pending/available/ledger/withdrawn | daily 04:00 **if `RUN_SETTLEMENT_CRON=true`** | contributions | Conditional (env) |
| 5 | Wallet creation (Edge `create-collection` / `CollectionService`) | Edge/Express | zeros (row create) | per collection create | — | Yes |
| 6 | **SQL `settle_pending_balances()`** | SQL cron 4 | available, pending | daily 04:00 | **deposits (empty)** | **Yes — CORRUPTING** |
| 7 | SQL `process_deposit_settlements()` | SQL cron 5 | available, pending (RMW) | daily 04:00 | deposits (empty) | Active but **no-op** |
| 8 | `admin/wallet.js` | Express | **none** (read/live-recompute only — verified) | on admin view | contributions | Read-only |

**Only #6 and #7 read `deposits`. #6 is the corruptor; #7 is a dormant RMW landmine. #1–#5 all derive from `contributions` and are correct.**

## TASK 5 — The single canonical financial source

**`contributions` (with `withdrawals`).** Technical justification:
- It is the **only table the live payment path writes** (`deposits` has 0 rows; the Express `deposits` init path is unused).
- Every correct wallet value in the system is already computed from it (`computeWalletBalances`).
- It carries the structural idempotency guard (`uq_contributions_collection_ref_line`) proven to hold under real load.
- `deposits` is a parallel model from the Express-first era, now empty and unreferenced by any view/trigger/FK.

→ **Use `contributions` as canonical. Retire `deposits` and all settlement logic built on it.** Do **not** use both.

## TASK 6 — Dead / legacy code

| Item | Status |
|---|---|
| `settle_pending_balances()` (SQL) | **Safe to remove** (disable) — corrupting, no dependents |
| `process_deposit_settlements()` (SQL) | **Safe to remove** (disable) — no-op RMW landmine |
| `deposits` table | **Needs migration** — dead data, but Express init path still references it; migrate that path first |
| `deposit.js initializePayment` (Express init) | **Needs migration** — superseded by Edge `initiate-paystack-payment`; not used in this project |
| `deposit.js` deposits-branch in verify/webhook | **Still used** (webhook), but the deposits lookup is dead; the Edge fallback is what runs |
| `process_deposit_settlements` RMW pattern | **Safe to remove** |
| Duplicate wallet refresh (Node vs Deno vs SQL) | **Still used** (Node + Edge active) — consolidate in Phase 2.1, don't delete blindly |
| Client `useContributionStore` financial writes | **Safe to remove** (Phase 1 finding) |

## TASK 7 — Does disabling `settle_pending_balances()` break anything? (verified, per workflow)

| Workflow | Depends on the cron? | Why it's safe |
|---|---|---|
| **Withdrawals** | **No** | `requestWithdrawal`/`approve` call `refreshWallet` and `getEligibleCollections` **recompute from `contributions`** at request time — never trust the stored column for the cap |
| **Payment verification** | **No** | Edge verify writes wallets from `contributions` on every payment |
| **Wallet refresh** | **No** | On-demand recompute (edge verify, withdrawal, admin view, Node cron) all use `contributions` |
| **Receipts** | **No** | Rendered from the contribution/transaction, not wallets |
| **Analytics / reports** | **No** | Derived from `contributions`/`transactions` |
| **Notifications** | **No** | Fired from payment events, not settlement |
| **Scheduled jobs** | **No** | Nothing calls `settle_pending_balances` except its own cron (verified: 0 other callers); the Node settlement cron and payment-recovery are independent |
| **Views** (`email_recipient_directory`) | **No** | Reads current `wallets` values; disabling the corruptor + recompute *improves* what it reads |
| **Triggers / FKs** | **No** | No trigger writes wallets; nothing FK-references `deposits` |

**One honest caveat (not a breakage):** the cron's *intended* job — the daily pending→available roll for a **dormant** collection (no new payment/withdrawal) — will no longer happen via this function. But (a) it currently does that job **incorrectly** (zeroes available), so removing it is strictly better; (b) the withdrawal path always recomputes correctly; (c) Phase 2.1B Step 4 replaces it with a `contributions`-based settlement (or enables the correct Node cron). **No workflow regresses relative to today.**

## TASK 8 — Dependency graph

```
Paystack
  │
  ▼
Edge verify-paystack-payment ───────────────► contributions (SOURCE OF TRUTH)
  │  refreshCollectionAndWallets                     │
  ▼                                                  ├─► withdrawal.refreshWallet ─► wallets ─► withdrawal cap
wallets (PROJECTION) ◄──────────────────────────────┤
  ▲   ▲   ▲                                          ├─► reconcileFinancials (read)
  │   │   └── Node paymentSettlement cron (if enabled)├─► admin/wallet.js (live recompute, read)
  │   └────── withdrawal.refreshWallet               └─► analytics / receipts / notifications
  │
  └──✗ settle_pending_balances() (cron 4) ──reads──► deposits (EMPTY) ──► CORRUPTS wallets
      ✗ process_deposit_settlements() (cron 5) ─────► deposits (EMPTY) ──► no-op

Legend: ✗ = the two edges to sever. Every OTHER edge flows from contributions.
Cutting the ✗ edges removes corruption; no other edge touches them.
```

## TASK 9 — Production repair strategy (recommendation only — NOT executed)

| Phase | Action | Risk | Rollback | Downtime | Validation | Expected outcome |
|-------|--------|------|----------|----------|------------|------------------|
| **A — Emergency stop** | `cron.unschedule('settle-pending-balances')` (+ `settle-pending-deposits`) | Very low | re-schedule (sec) | None | confirm no 04:00 wallet writes tomorrow | Corruption stops |
| **B — Data repair** | snapshot `wallets` → recompute all 56 from `contributions` (`refreshWallet`) → backfill 1 missing wallet | Low–Med | restore snapshot | None | reconcile = 0 drift, 0 negatives, 0 broken identity | Wallets correct |
| **C — Code repair** | fix/retire `settle_pending_balances` + `process_deposit_settlements` to read `contributions` (or delete); migrate Express `deposit.js` init off `deposits` | Med | revert function/deploy | None | staging parity test | Settlement no longer reads empty table |
| **D — Architecture cleanup** | single canonical wallet writer (WalletService); retire `deposits` table + Express init path | Med | keep table until cutover | None | reconcile stays 0 | One writer, one source |
| **E — Validation** | full reconcile + integrity + a withdrawal end-to-end on staging | Low | — | None | 0 drift; withdrawal cap correct | Verified clean |
| **F — Monitoring** | schedule `reconcileFinancials` + ledger-identity alert; apply G1 `uq_wallets_collection_id` | Low | drop job/index | None | injected drift fires alert | Can't silently recur |

**No phase requires downtime.** Phase A is the urgent one (the bug re-fires nightly).

## TASK 10 — Confidence & recommendation

**Can we safely proceed with repair? → YES. Confidence: HIGH.**

Evidence supporting the decision:
- **No dependents:** DB introspection shows nothing calls `settle_pending_balances` except its cron; no view/trigger/FK depends on it or on `deposits`.
- **Canonical source is unambiguous:** every correct wallet value derives from `contributions`; `deposits` is empty and unreferenced on the live path.
- **Every workflow verified independent** of the cron (withdrawals/verify/refresh/receipts/analytics/notifications all recompute from or derive from `contributions`).
- **Disabling is strictly positive:** the function only ever writes wrong values; removing it cannot make any number worse.

**Residual items to handle in the repair (not blockers to Phase A):** (1) ensure a *correct* settlement path exists for dormant collections (Node cron enabled or fixed SQL) — Phase C/D; (2) confirm `RUN_SETTLEMENT_CRON` intent; (3) migrate the Express `deposit.js` init path before dropping `deposits` — Phase C/D.

**Recommendation:** proceed to Phase 2.1B, starting with **Phase A (emergency stop)** immediately upon approval, then B–F. Nothing in this verification phase was modified.

---

*Read-only architecture verification. No data, schema, functions, cron, or code were changed.*
