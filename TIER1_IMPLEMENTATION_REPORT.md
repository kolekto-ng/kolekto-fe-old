# TIER1_IMPLEMENTATION_REPORT (Phase 2.1C-2 — Tier 1)

**Goal:** eliminate every runtime dependency on the `deposits` table while preserving the entire payment lifecycle. `controllers/deposit.js` **kept** (runtime-critical); only its `deposits` coupling removed. `deposits` table **not dropped** (Tier 2).

## Files modified
| File | Change |
|------|--------|
| `kolekto-be-old/controllers/deposit.js` | removed all `deposits` reads/writes; kept webhook, verify, transactions, admin-reconcile |
| `kolekto-fe-old/supabase/functions/verify-paystack-payment/_shared1.ts` | removed the `deposits` sibling lookups in `attemptDeterministicCollectionRecovery` |

## STEP 3 proof — the `deposits` writer is dead (safe to remove the INSERT)
The only `deposits` writer is `deposit.initializePayment` (`POST /api/payments/initialize-payment`). Its caller chain is **dead**:
- `usePaystackStore.initializePayment` → the endpoint, called **only** by `ContributionForm.tsx:328`.
- `ContributionForm` is imported **only** by `ContributionWrapper.tsx`, which is **imported nowhere**.
- The live contribute route `/contribute/:collectionId` → `ContributePage` renders **`ContributeFlow`** (the edge `initiate-paystack-payment` path), not `ContributionForm`.
- Live DB: `deposits` = **0 rows** — consistent with the Express init never being used.
⇒ No frontend/API client populates `deposits`; the live payment initiation is the Edge function.

## What was removed (STEP 2 categorized + STEP 4/5)
| Location | `deposits` op | Category | Action |
|----------|---------------|----------|--------|
| `deposit.initializePayment` | INSERT deposit row | **write** (dead — no caller) | removed |
| `deposit.initializePayment` | UPDATE `init_email_sent`; link `contribution.payment_id` | write (dead) | removed |
| `deposit.verifyPayment` | SELECT by reference | **read** (always empty) | removed; fallback (Paystack + `contributions`) made the sole path |
| `deposit.verifyPayment` | idempotent-hit + mark-paid via deposit | **dead branch** | removed (577-line dead block) |
| `deposit.handleWebhook` | SELECT by reference (F2) | **read** (always empty) | removed; F1 (`contributions`) + recovery (edge verify) preserved |
| `deposit.handleWebhook` | mark-paid + emails via deposit | **dead branch** | removed |
| `_shared1.ts` recovery | SELECT `deposits` (Strategy C & E) | **read** (always empty) | removed; `contributions` is the sole source |

**Method:** the deposit-based branches were **provably unreachable** — `deposits` is empty and its only writer is dead, so `existingDeposit`/`deposit` are always null and the code always took the fallback/recovery path. I removed the dead branches and made the always-executing fallback/recovery unconditional. The kept bodies do not reference the removed `deposit`/`depositError` variables (verified).

## Behavior preserved
- **Payment initiation:** unchanged (live path = Edge `initiate-paystack-payment`).
- **Verification:** `verifyPayment` now always does what it *already* did — verify with Paystack and read `contributions` (the fallback that ran 100% of the time).
- **Webhook:** unchanged flow — F1 (already-paid no-op) → recovery via the idempotent edge verify. HMAC/signature verification untouched.
- **Retry:** webhook still returns 500 on failure so Paystack retries (unchanged).
- **Admin reconciliation:** `invokeVerifyEdgeFunction` (used by `admin/payments.js`, `admin/paymentMonitoring.js`) **untouched**.
- **Receipts:** `sendReceiptNotification` and the fallback receipt email **untouched**.

## Validation (see TIER1_VALIDATION_REPORT.md)
- `deposit.js` **parses** (`node --check`); **zero** runtime `deposits`-table references repo-wide.
- Reconciliation: 57 wallets, **drift 0**, negatives 0, identity holds, available/pending **unchanged**; `deposits` still 0 rows.
- BE unit tests **63/63**.
- Live payment/webhook/reconciliation validation is the **soak period** (per the task) — not run here.

## Git commit
- be-old: `<HASH_BE>` (deposit.js).
- fe-old: `<HASH_FE>` (_shared1.ts + docs).
(Hashes appended after commit.)

## Rollback
`git revert` the two commits (deposit.js + _shared1.ts). The pre-edit `deposit.js` is also backed up at `/tmp/deposit.js.tier1bak` this session. No DB change was made, so nothing to reverse there.

## STOP
Runtime `deposits` dependency removed; validation (static + reconciliation) passed. **Did NOT** drop the `deposits` table, delete `deposit.js`, modify WalletService, touch settlement, or consolidate financial math. Soak, then Tier 2.
