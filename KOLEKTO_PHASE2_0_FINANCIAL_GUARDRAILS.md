# KOLEKTO 4.0 — Phase 2.0 Financial Guardrails Report

**Objective:** make the *current* financial system safe enough that future refactors (PaymentService, WalletService, Settlement, Ledger, Gateway/OPay, Workspaces) cannot silently introduce money bugs — with **zero business-behavior change**.
**Prime directive honored:** no payment flow redesigned, no Ledger, no PaymentService, no Wallet logic changed, no API/UI/DB behavior changed. Only observability, correctness, safety, and verification were added.

**What shipped as code (fully built + tested here):** the financial characterization suite, the reconciliation/consistency engine, and the audit-log helper. **What shipped as operator-gated deliverables (written, pre-checked, NOT applied):** the structural-idempotency migration and the atomic-withdrawal migration — because I must never mutate the production database, and a wrong constraint could break payments.

---

## 1. Financial Guardrails Report (summary)

| Guardrail | Deliverable | State | Test/validation |
|-----------|-------------|-------|-----------------|
| Characterization tests | `tests/financial.characterization.test.js` (24) | ✅ shipped | **24/24 pass** |
| Reconciliation engine | `utils/financialReconcile.js` + `scripts/reconcileFinancials.js` | ✅ shipped | **8/8 unit pass**; CLI ready |
| Consistency checks | `checkInvariants()` in the same module | ✅ shipped | covered by the 8 |
| Audit logging | `utils/financialAudit.js` | ✅ shipped | **6/6 pass**, never-throws proven |
| Structural idempotency | `database/g1_financial_idempotency_guards.sql` | 🔶 operator-gated | pre-check guarded |
| Withdrawal race fix | `database/g2_atomic_withdrawal_request.sql` | 🔶 operator-gated | row-lock design |
| Monitoring | metrics derivable from structured logs (§8) | ✅ design | — |

Full BE unit suite after this phase: **58/58 pass** (`npm test`, offline, no DB).

---

## 2. Idempotency Report (STEP 1 & 6)

**Key correction from investigation:** `contributions` are **1:N per `payment_reference`** (one row per ticket line item), keyed by `(collection_id, payment_reference, line_index)`. A naïve `UNIQUE(payment_reference)` on contributions would **break multi-ticket payments** — so it must never be added.

| Table | Idempotency today | Structural guard | Action |
|-------|-------------------|------------------|--------|
| `contributions` | **Already structural** — `uq_contributions_collection_ref_line` on `(collection_id, payment_reference, line_index)` partial index (see `f3_step2_line_index_constraint.sql`); edge F2 handler catches `23505` | ✅ present | **Verify it is live in prod** (query in G1) |
| `contributions.contributor_unique_code` | `uq_contributions_unique_code (collection_id, contributor_unique_code)` (see `c1_…sql`) | ✅ present | verify live |
| `deposits.payment_reference` | procedural only (`.single()` read would throw on dup) | ❌ missing | **G1 adds `uq_deposits_payment_reference`** (pre-check guarded) |
| `wallets.collection_id` | none — multiple wallet rows tolerated (read newest) | ❌ missing | **G1 adds `uq_wallets_collection_id`** (requires dedup first; pre-check refuses while dups exist) |
| `withdrawals` | none (no natural key) | n/a | concurrency handled structurally by **G2** (row lock), not a unique index |

**Delivered:** `database/g1_financial_idempotency_guards.sql`. Every `CREATE UNIQUE INDEX` is preceded by a `DO $$` block that **RAISES if the duplicates it would reject exist**, so it can never silently break inserts. Zero behavior change when the data is clean.

---

## 3. Financial Characterization Test Report (STEP 2)

`tests/financial.characterization.test.js` — **24 regression tests** locking in today's exact math on the canonical `utils/financial.js`:
- **Fees:** fixed/fundraising/unknown-type rates; organizer vs contributor payable; the ₦2,000 cap boundaries; zero-amount.
- **Net derivation:** organizer (gross==net) vs contributor (back-out); non-negative; **round-trip** (`net → totalPayable → net`).
- **Settlement:** cutoff is 4am UTC; `isPaymentSettled` boundary (strictly-before is settled).
- **Wallet balances:** empty; settled→available; today→pending; completed withdrawals reduce available only; **available floors at 0**; all legacy completed-status synonyms count; gross fallback.
- **normalizeContributions:** organizer subtracts fees (**locked in: net_payment is take-home, e.g. ₦5,000 gross → ₦4,900 net**); contributor derives; gross===0 passthrough.
- **Invariant:** `available + pending == ledger` always.

These are **permanent** — any future PaymentService/Ledger change that alters a number breaks them. (One test caught a wrong assumption in my own reconcile fixtures during authoring — proof they bite.)

---

## 4. Balance Reconciliation Report (STEP 3)

`utils/financialReconcile.js` + `scripts/reconcileFinancials.js` (READ-ONLY; never writes).

- `expectedBalances()` recomputes the canonical balances from source rows using the **same** `normalizeContributions → computeWalletBalances` path the app uses.
- Because the stored `wallets.*` columns were written by whichever implementation last ran (**Node** `updateWalletStats` / **Deno** `refreshCollectionAndWallets` / **SQL** `process_deposit_settlements`), **agreement between `expected` and `stored` is the practical proof that all three implementations currently produce identical results.** `diffWallet()` reports any per-field drift beyond a ₦0.01 tolerance.
- **How to run (operator, non-prod or read-only):**
  `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run reconcile:financials` (or `RECONCILE_JSON=1` for machine output).
- **Cannot be run from the dev sandbox** (no DB creds); the pure comparison logic is unit-tested (8/8), so the tool is trustworthy the moment it is pointed at a project.

---

## 5. Financial Consistency Report (STEP 4)

`checkInvariants()` flags impossible / inconsistent states per collection (reusable, read-only):

| Code | Severity | Meaning |
|------|----------|---------|
| `NO_WALLET` | high | paid contributions but no wallet row |
| `MULTIPLE_WALLETS` | high | >1 wallet row (must dedup before G1) |
| `LEDGER_IDENTITY_BROKEN` | critical | `available + pending ≠ ledger` |
| `NEGATIVE_AVAILABLE` / `NEGATIVE_PENDING` | critical | negative balance |
| `OVER_WITHDRAWN` | critical | withdrawn > net raised |
| `AVAILABLE_EXCEEDS_RAISED` | critical | available > net raised |
| `PAID_WITHOUT_REFERENCE` | medium | paid contribution with no `payment_reference` (orphan) |

The runner prints a per-collection report and an overall verdict. **It does not auto-fix** — verification only, by design.

---

## 6. Withdrawal Race Condition Report (STEP 5)

**Confirmed bug** (audit §18): `requestWithdrawal` checks the cap and inserts in two separate round-trips — two concurrent requests can both pass before either commits ⇒ over-withdrawal.

**Chosen fix (safest, behavior-preserving):** `database/g2_atomic_withdrawal_request.sql` — a Postgres function that holds a **row lock** (`SELECT available_balance … FOR UPDATE`) on the collection's wallet, then checks the cap and inserts **in one transaction**. Concurrent requests for the same collection serialize; the second re-evaluates against the updated pending sum.
- **Why row-lock, not serializable/advisory or SQL balance re-math:** it preserves the *exact* cap the app uses today (`available_balance − pending sum`) without reimplementing `computeWalletBalances` in SQL (which would add a 4th balance implementation — the opposite of this phase's goal). Minimal, surgical, correct.
- **Rollout:** apply migration → deploy the **flag-gated** controller change (`USE_ATOMIC_WITHDRAWAL`, default OFF = zero change) → enable on one instance → soak → 100%. **Rollback = flag OFF, deploy-free.**
- **Not auto-applied:** the controller edit is documented in the migration (calls `supabase.rpc('request_withdrawal_atomic', …)`, maps SQLSTATE `P0001/P0002/P0003` to the *same* 400/404 responses). It is intentionally not wired this turn because the RPC must exist in the DB first.

---

## 7. Payment Reference Safety (STEP 6)

- **Init:** Paystack generates the reference; `deposits` gets one row (G1 makes `payment_reference` unique).
- **Verify / webhook / retries:** contributions are protected by the existing composite unique index; duplicate concurrent verifies collide on `23505` and the edge F2 handler recovers the existing rows — **already structural**.
- **Net effect after G1:** a reference can produce at most one `deposits` row and exactly N contribution line-rows, even under concurrency.

---

## 8. Observability & Audit Logging Report (STEP 8)

`utils/financialAudit.js` — one structured entrypoint, `auditFinancial(event, fields)`, built on the existing `utils/logger.js`:
- Stable event names (`financial.<event>`) for: payment initialized/verified/verify_failed, webhook received/duplicate, contribution created/paid, wallet refreshed, settlement completed/failed, withdrawal requested/approved/rejected/paid, reconciliation mismatch.
- Consistent fields: `requestId, userId, collectionId, contributionId, withdrawalId, payment_reference, amount, result, duration_ms`.
- **Never throws** (proven by test — even a throwing logger degrades silently); business rejections vs failures logged at the right level; `startFinancialAudit()` stamps latency.
- **Wiring plan (low-risk follow-up, additive, no behavior change):** call `auditFinancial` at each money transition in `deposit.js` (init, verify success/fail, webhook received/duplicate, wallet refreshed) and `withdrawal.js` (requested/approved/rejected). These are pure additive log lines; because the helper can't throw, they carry no behavior risk. Left as a reviewed follow-up rather than editing the 1,748-LOC payment god-file mid-phase.

---

## 9. Monitoring Dashboard Recommendations (STEP 7)

Derive all metrics from the structured `financial.*` + existing `http.request` log events (no new infra to start):

| Metric | Source | Alert |
|--------|--------|-------|
| Payment verification success rate | `payment_verified` vs `payment_verify_failed` | < 99% (5m) → page |
| Duplicate webhook attempts | `webhook_duplicate` | spike → investigate |
| Settlement failures | `settlement_failed` | any → page |
| Withdrawal failures / rejections | `withdrawal_rejected` + errors | spike → review |
| Balance mismatches | reconcile job `reconciliation_mismatch` count | any drift → investigate |
| Reconciliation failures | reconcile exit status | non-zero → page |
| Unexpected retries | webhook 500s / Paystack redelivery | trend |
| Latency | `duration_ms` on verify/wallet/withdrawal | p95 regression |

Keep it practical: one "Financial Health" board (success rate, latency p95, drift count, settlement status) + alerts on the three criticals (verify failure, settlement failure, reconciliation drift).

---

## 10. Production Safety Review & Validation (STEP 9 & 10)

**Safety review — confirmed:**
- **Zero API contract changes** — no routes/handlers behavior changed. New files are libraries/tests/SQL; the only controller touched earlier (`collection.js`) is unrelated and unchanged this phase.
- **Zero UI changes.**
- **Zero DB behavior changes** — the two migrations are **not applied**; when applied they only reject *new* duplicates the app already prevents, and add a function that is inert until a flag is flipped.
- **Zero business-rule changes** — the characterization tests encode existing behavior and pass; no financial number changed.
- **Backward compatible** throughout.

**Validation run (offline, this environment):**
- `npm test` → **58/58 pass** (24 financial characterization + 8 reconcile + 6 audit + 20 collection + others).
- All new files parse (`node --check`).
- Integration/reconcile/concurrency validation against a real project is **operator-run** (needs Supabase creds; I cannot reach a DB here). Commands provided (§4, G2).

---

## Go / No-Go Recommendation

- **GO — merge the code guardrails now** (characterization tests, reconciliation engine, audit helper). They are additive, tested (58/58), and change no behavior. They immediately make every future financial refactor verifiable.
- **GO — apply G1 and G2 in staging**, operator-run, after the pre-checks pass and (for G2) a concurrency test. **NO-GO for applying them blind to prod** without: (a) running `reconcile:financials` to confirm zero pre-existing drift, (b) resolving any `MULTIPLE_WALLETS` before `uq_wallets_collection_id`, and (c) validating G2 with the two-simultaneous-request test on staging.
- **First operator action recommended:** run `npm run reconcile:financials` against a read-only prod connection (or a restore). Its output is the empirical proof of Success Criterion "all current implementations produce identical results." If it reports zero drift, the balance-math triplication is confirmed safe to consolidate in the next phase.

### Success Criteria status
- Duplicate payments structurally prevented → **contributions ✅ (existing); deposits/wallets ✅ via G1 (operator-apply)**.
- Concurrent withdrawal safety → **designed & delivered (G2), flag-gated; operator-apply + validate**.
- Behavior locked by characterization tests → **✅ 24 tests, passing**.
- Reconciliation confirms implementations agree → **tool ✅ delivered; run pending DB access**.
- Every money-moving op observable → **helper ✅ delivered; wiring is the documented next step**.
- No user-facing / API / DB-behavior change → **✅ confirmed**.

---

## STOP

Phase 2.0 code guardrails are complete and validated offline. **Do NOT begin** PaymentService, WalletService, SettlementService, Ledger, Gateway abstraction, OPay, or Workspaces. Awaiting approval. The gating next step is operator-run reconciliation (proving the three balance implementations agree) plus applying G1/G2 in staging.

*Prepared Phase 2.0. Code guardrails shipped and tested; DB guards written and pre-checked but not applied; no production behavior changed.*
