# Incident: `verify-paystack-payment` tier-collision → silent payment loss (2026-08-06)

**Severity:** P1 — contributor money captured by Paystack, never recorded in Kolekto.
**Status: RESOLVED 2026-08-07 05:05 UTC.** Fix deployed (v35), all money
recovered, zero orphaned payments platform-wide. See §8 Remediation Record.
**Money affected:** ₦520,200 across **6** references (the report named 4; a
5th was found during investigation and a **6th** was lost overnight before the
fix shipped).
**Collection:** `86b80455-6684-477f-9830-6ce9a8d94da0` — "FARSTECH SIWES MALETE".

> Note: this is **not** the collection investigated in
> `kolekto-be-old/docs/incident_2026-08-06_tiered-payment-amount-regression.md`.
> That investigation examined `da3e3a24-1133-4cdd-8e2a-c3ca53389db1`, a
> *different* collection with the *same title* and *unique* tier names, and
> concluded the ₦51,000 symptom "could not be reproduced". The original
> reporter was right; the wrong collection was audited. This collection
> reproduces ₦51,000 exactly.

---

## 1. Root cause (one sentence)

Production's `verify-paystack-payment` runs a `matchTier()` that resolves a
price tier by **`id` OR `name` in a single array-order pass**, so on a
collection where several tiers share a display name every selection collapses
to the array-earliest tier of that name (₦50,000 → ₦51,000 with fees); the
payment-*initialization* path was fixed to resolve **id-first** and charges the
correct amount, so verification now computes a different expected total than
what was actually charged, fails its `amount_mismatch` guard, returns HTTP 400,
and **inserts nothing**.

The fix already exists in git. It was never deployed.

---

## 2. Evidence

### 2.1 The failing code — production vs git

`diff` of the only file that differs between git `main` and the source
downloaded from production (`verify-paystack-payment.pre-download-2026-08-06/`);
`index.ts` and `_shared2.ts` are **byte-identical**, so this is the entire delta:

```diff
--- verify-paystack-payment.pre-download-2026-08-06/_shared1.ts   (PRODUCTION)
+++ verify-paystack-payment/_shared1.ts                           (GIT main)
@@ -1012,11 +1012,22 @@
-  return tiers.find((tier) => {
-    if (requestedTierId && tier.tierId === requestedTierId) return true;
-    if (requestedTierName && tier.tierName === requestedTierName) return true;
-    return false;
-  }) || null;
+  if (requestedTierId) {
+    const byId = tiers.find((tier) => tier.tierId === requestedTierId);
+    if (byId) return byId;
+  }
+  if (requestedTierName) {
+    const byName = tiers.find((tier) => tier.tierName === requestedTierName);
+    if (byName) return byName;
+  }
+  return null;
 }
```

Production runs the top (buggy) version.

### 2.2 The collection's tiers — 12 tiers, 4 names, each repeated 3×

| idx | id | name | price |
|---|---|---|---|
| 0 | `1` | UI/UX (Physical Classes) | **50,000** |
| 1 | `1785530772978` | Data Analysis (Physical Classes) | **50,000** |
| 2 | `1785530791245` | Frontend (Physical Classes) | **50,000** |
| 3 | `1785530809013` | Cyber Security (Physical Classes) | **50,000** |
| 4 | `1785530837952` | UI/UX (Physical Classes) | 40,000 |
| 5 | `1785530959818` | Data Analysis (Physical Classes) | 40,000 |
| 6 | `1785531023333` | Frontend (Physical Classes) | 45,000 |
| 7 | `1785531101500` | Cyber Security (Physical Classes) | 60,000 |
| 8 | `1785531141906` | UI/UX (Physical Classes) | 80,000 |
| 9 | `1785531176329` | Data Analysis (Physical Classes) | 80,000 |
| 10 | `1785531198058` | Frontend (Physical Classes) | 90,000 |
| 11 | `1785531222849` | Cyber Security (Physical Classes) | 120,000 |

The four array-earliest tiers are all ₦50,000. Fees are a flat 2 %
(0.5 % platform + 1.5 % gateway), so any name-collision match yields
**50,000 × 1.02 = ₦51,000** — the exact `expectedTotal` recorded for all five
failures. This is the "₦51,000 bug".

### 2.3 The five dropped payments

All five: webhook received, signature valid, Paystack status `success`,
collection resolved correctly, amount check failed, **HTTP 400, no insert**.

| Reference | Contributor | Tier selected (id) | Tier price | Charged (`verifiedTotal`) | `expectedTotal` |
|---|---|---|---|---|---|
| `kolekto-1786028435175-131541` | Ayanda Tesleem Olamide | Cyber Security `1785531222849` | 120,000 | **122,400** | 51,000 |
| `kolekto-1786041467638-950277` | Wadud Aderemi Adelabu | Data Analysis `1785531176329` | 80,000 | **81,600** | 51,000 |
| `kolekto-1786043753831-451960` | Khaleed Abdulrauf opeyemi | Cyber Security `1785531101500` | 60,000 | **61,200** | 51,000 |
| `kolekto-1786048831088-540562` | Abdulrahman Abdulazeez ayinla | Frontend `1785531198058` | 90,000 | **91,800** | 51,000 |
| `kolekto-1786051931181-92380` ⚠️ **not in original report** | Rafiu Wahab Omogbolahan | Cyber Security `1785531222849` | 120,000 | **122,400** | 51,000 |
| | | | **470,000** | **479,400** | |

`verifiedTotal` is read from Paystack's own verify response inside the
`transaction.status === "success"` branch (`index.ts:300`) — independent proof
Paystack captured the money.

### 2.4 Where execution stopped — exact line

`supabase/functions/verify-paystack-payment/index.ts:379-389`

```ts
if (Math.abs(verifiedTotal - normalizedPayment.totalPayable) > mismatchTolerance) {
  console.error("Amount mismatch:", { reference, collectionId, verifiedTotal, expectedTotal: ... });
  await logAttempt({ ..., errorCode: "amount_mismatch", ... });
  return new Response(JSON.stringify({ error: "Payment amount validation failed. ..." }),
                      { status: 400, ... });   // ← nothing is ever inserted
}
```

Never reached: `claim_payment_contributions` (index.ts:590) → contribution
insert → wallet update → contributor code → receipt email → push.

### 2.5 Database state — confirms total loss, no partial writes

| Table | Rows for these 5 references |
|---|---|
| `contributions` | **0** |
| `deposits` | **0** |
| `pending_payment_context` | 5 (written at init — correct amounts) |
| `payment_recovery_log` | **99 `amount_mismatch` + 5 `attempt_cap_exceeded`** |

`wallets.available_balance` = ₦305,000, exactly the sum of the 6 legitimate
pre-incident contributions (40k+40k+80k+45k+50k+50k). No partial credit, no
rollback residue, no orphaned/mis-assigned rows. The payments were never
inserted — not soft-deleted, not attached to another collection.

### 2.6 Timeline (all UTC, 2026-08-06)

| Time | Event |
|---|---|
| `03:43:16` | **`verify-paystack-payment` v34 deployed** — the "merged atomic-RPC" build, which carried the *old* `matchTier` forward. **This is the regression point.** |
| `13:47:54` | `initiate-paystack-payment` v14 deployed *with* the id-first fix (per the sibling incident doc) — init and verify now disagree |
| `14:13:59` | Collection `updated_at` — organizer edits the collection |
| `15:00:35` | Ref …131541 initialized (₦122,400) |
| `15:02:28` | First `amount_mismatch`. Money captured, contribution dropped |
| `15:10 – 15:55` | 10 scheduled-recovery retries, all fail identically |
| `16:00:01` | `attempt_cap_exceeded` — automatic recovery gives up permanently |
| `18:39` / `19:17` / `20:41` / `21:34` | Refs …950277, …451960, …540562, …92380 fail the same way |
| `21:32 – 21:33` | Admin Reconcile attempted on …131541 → **also `amount_mismatch`** (reconcile calls the same broken code path) |
| `21:45:36` | Most recent failure — **still live** |

### 2.7 Why the pre-incident payments succeeded

Contributions on 2026-08-01 → 08-05 recorded ₦40,000 / ₦45,000 / ₦80,000 —
i.e. non-array-first tiers of duplicated names. Under the buggy `matchTier`
those would have failed. They succeeded because verify was still running the
pre-v34 source. The duplicate tier names are **not** new (all tier ids
timestamp to 2026-07-31); the *deploy at 03:43* is what changed. The last
successful contribution to this collection is `2026-08-05 18:45:58` — nothing
has landed since v34 shipped.

---

## 3. Questions from the brief, answered

| Question | Answer |
|---|---|
| Did Paystack send the webhook? | **Yes** — `invocation_source='webhook'` on 41 log rows across the 5 refs |
| Did our server receive it? | **Yes** |
| Signature validated? | **Yes** — execution reached the amount check, far past signature/status gates |
| Retries? | **Yes** — Paystack retried (400 response), plus 10 scheduled-recovery attempts per ref, plus frontend-callback attempts |
| Returned 200? | **No — HTTP 400** |
| Timeout? | No |
| Processed more than once? | Yes, 18–27 times each; all failed identically |
| Metadata contains `collection_id`? | **Yes** — `collectionId` present and correct in every `pending_payment_context` row |
| Exists with wrong/null `collection_id`? | No — never inserted at all |
| Soft-deleted / rolled back? | No |
| Idempotency wrongly rejected it? | **No** — failure occurs *before* `claim_payment_contributions` is reached |
| Race condition / partial commit? | No — single pre-insert guard, no transaction opened |
| Collection active / accepts payments? | **Yes** — `status='active'`, `deleted_at` null, deadline 2026-08-09, owner `d0ee7f49…`, wallet exists |
| Swallowed exception / silent failure? | No — the rejection is explicit, logged, and returned |

Nothing about webhook delivery, metadata, idempotency, or collection state
contributed. The single cause is the tier-resolution regression.

---

## 4. Blast radius

Collections with duplicate tier display names (all currently exposed):

| Collection | Title | Status | Tiers | Max same name |
|---|---|---|---|---|
| `86b80455-…` | FARSTECH SIWES MALETE | **active** | 12 | 3 |
| `e83c70cc-…` | SIWES ILORIN (Codeverse) | paused | 8 | 2 |
| `f3cc97a5-…` | ILORIN SIWES (Arptechnology) | paused | 8 | 2 |

The two paused collections will begin losing money the moment they are
unpaused, unless the fix is deployed first.

---

## 5. Recovery plan

**Do not hand-write contribution INSERTs.** Contributor codes, `line_index`,
tier `sold_quantity`, wallet balances, receipts and push notifications are all
allocated inside `claim_payment_contributions`; manual SQL would desynchronise
them. Use the existing idempotent code path.

`claim_payment_contributions` locks the collection `FOR UPDATE`, then returns
`{"outcome":"idempotent"}` without inserting if a row already exists for
`(collection_id, payment_reference)` — so re-running verification **cannot**
double-credit. This is what makes the plan below safe.

### Step 1 — Deploy the fix (this alone stops the bleeding)

The corrected source is already at
`kolekto-fe-old/supabase/functions/verify-paystack-payment/` (git `main`,
clean). Deploy via the CLI per
`kolekto-be-old/docs/VERIFY_PAYSTACK_PAYMENT_DEPLOYMENT_RUNBOOK_2026-08-06.md`
— **explicitly re-link to `busfgcmbndleljklrcbd` first**; the local scaffold is
linked to the *test* project `lpeeckqsltxohppheucz`.

```bash
cd "C:/Users/USER/Desktop/Kolekto-codebase/kolekto-fe-old"
supabase link --project-ref busfgcmbndleljklrcbd
cat supabase/.temp/project-ref     # MUST print busfgcmbndleljklrcbd
supabase functions deploy verify-paystack-payment \
  --project-ref busfgcmbndleljklrcbd --no-verify-jwt
```

### Step 2 — Verify the deploy byte-for-byte (non-negotiable)

Two prior deploys of this function shipped placeholder content (v30, v32).

```bash
supabase functions download verify-paystack-payment \
  --project-ref busfgcmbndleljklrcbd -o /tmp/vpp-check
diff -r /tmp/vpp-check supabase/functions/verify-paystack-payment   # must be empty
grep -c "const byId = tiers.find" supabase/functions/verify-paystack-payment/_shared1.ts  # must be 1
```

### Step 3 — Replay the 5 payments, oldest first, one at a time

```
POST /adminurlabdkole/payment-monitoring/:reference/manual-reconcile
```

in this order, checking `contributions` after each:

1. `kolekto-1786028435175-131541` → expect ₦120,000
2. `kolekto-1786041467638-950277` → expect ₦80,000
3. `kolekto-1786043753831-451960` → expect ₦60,000
4. `kolekto-1786048831088-540562` → expect ₦90,000
5. `kolekto-1786051931181-92380` → expect ₦120,000

### Step 4 — Verification query (read-only)

```sql
SELECT c.payment_reference, c.name, c.amount, c.gross_amount, c.status,
       c.contributor_unique_code
FROM contributions c
WHERE c.payment_reference IN (
  'kolekto-1786028435175-131541','kolekto-1786041467638-950277',
  'kolekto-1786043753831-451960','kolekto-1786048831088-540562',
  'kolekto-1786051931181-92380')
ORDER BY c.created_at;
-- expect exactly 5 rows: 120000, 80000, 60000, 90000, 120000

SELECT available_balance FROM wallets
WHERE collection_id='86b80455-6684-477f-9830-6ce9a8d94da0';
-- expect 305,000 + 470,000 = 775,000
```

Duplicate guard (must return zero rows):

```sql
SELECT payment_reference, count(*)
FROM contributions
WHERE collection_id='86b80455-6684-477f-9830-6ce9a8d94da0'
GROUP BY 1 HAVING count(*) > 1;
```

### Step 5 — Contact the five contributors

They paid and received nothing. Emails are in §2.3.

---

## 6. Permanent fix

1. **Deploy parity gate (highest value).** Every incident on this function —
   v30, v32, and now v34 — is the same disease: the deployed function and git
   disagree, with no CI to notice. Add a job that downloads each deployed edge
   function and diffs it against git, failing the build on drift. This class of
   incident is *only* closable here.
2. **Share the tier-resolution code.** `matchTier` exists in at least three
   places (`kolekto-be-old/services/pricingService.js`,
   `initiate-paystack-payment`, `verify-paystack-payment`). Init was fixed;
   verify was not — and the divergence is precisely what turned a pricing bug
   into total payment loss. One implementation, imported by all.
3. **Make duplicate tier names impossible or harmless.** Enforce unique tier
   names per collection at write time (`create-collection`/`update-collection`),
   and drop the name fallback in `matchTier` whenever a tier id is present.
4. **Never drop a captured payment.** A payment Paystack has already settled
   must never be discarded by a validation rule. On `amount_mismatch`, record
   the contribution against the **Paystack-verified amount** and flag it for
   review, rather than returning 400 and losing it. This is a defence-in-depth
   change: it would have reduced this incident to a reconciliation task.
5. **Alert on the signal we already collect.** `payment_recovery_log` captured
   99 failures over 6.5 hours and nobody was paged. Alert on
   *any* `attempt_cap_exceeded`, and on N>3 `amount_mismatch` within an hour.

---

## 7. Tests to prevent recurrence

- **Collision regression test** (mirroring the existing
  `initiate-paystack-payment/index.audit.test.ts` discipline — load the *real*
  `_shared1.ts`, don't re-implement it): a 12-tier fixture with 4 names × 3
  prices; assert every tier id resolves to its own price, and specifically that
  the ₦120,000 Cyber Security tier does **not** resolve to ₦51,000.
- **Init/verify parity test:** for each collection type and every tier, assert
  `initiate`'s `totalPayable` == `verify`'s `expectedTotal`. This exact
  invariant was the one broken here, and no test asserted it.
- **Deployed-source test:** CI downloads the live function and asserts the
  `matchTier` id-first body is present in production, not just in git.
- **Reject-nothing test:** assert that a Paystack-`success` transaction never
  results in zero DB writes.

---

## 8. Remediation record (2026-08-07)

### 8.1 Sequencing decision

The minimal, already-validated one-hunk fix was deployed **first**, before any
refactor. Money was actively being lost (a 6th payment, ₦40,800, was dropped
overnight at 21:53 UTC). Restructuring the pricing layer before stopping the
bleeding would have delayed the fix and added risk to a freshly-destabilised
payment path — which is precisely how v34 shipped in the first place.

### 8.2 Deploy

`verify-paystack-payment` **v34 → v35**, deployed via the Supabase CLI from
files already validated on disk (not agent-reconstructed tool payloads — that
is what shipped placeholder content as v30 and v32).

```
supabase functions deploy verify-paystack-payment \
  --project-ref busfgcmbndleljklrcbd --no-verify-jwt --use-api
```

Post-deploy verification (all passed):

| Check | Result |
|---|---|
| `functions download` + `diff -r` vs local | **empty — byte-identical** |
| `_shared1.ts` sha256 (git = deployed) | `5fdb5d85c8701d88…` |
| id-first `matchTier` present in deployed artifact | yes (1 occurrence) |
| legacy `id \|\| name` find present | **no (0 occurrences)** |

### 8.3 Recovery execution log

Recovered through `verify-paystack-payment` itself — the exact code path
Admin Reconcile uses (`invokeVerifyEdgeFunction`, same URL/headers/body,
`invocationSource: "admin_reconcile"`). **No rows were inserted by hand.**
`claim_payment_contributions` created every record, allocated contributor
codes, updated tier `sold_quantity`, and recomputed wallet balances.

| # | Reference | HTTP | Captured | Recorded | Code |
|---|---|---|---|---|---|
| 1 | `kolekto-1786028435175-131541` | 200 | 122,400 | 120,000 | `FCYB-001` |
| 2 | `kolekto-1786041467638-950277` | 200 | 81,600 | 80,000 | `FDAT-001` |
| 3 | `kolekto-1786043753831-451960` | 200 | 61,200 | 60,000 | `HCYB-001` |
| 4 | `kolekto-1786048831088-540562` | 200 | 91,800 | 90,000 | `FFTE-001` |
| 5 | `kolekto-1786051931181-92380` | 200 | 122,400 | 120,000 | `FCYB-002` |
| 6 | `kolekto-1786053094654-431629` | 200 | 40,800 | 40,000 | `HUIX-002` |
| | **Total** | | **520,200** | **510,000** | |

Every contributor code carries the correct tier prefix (`FCYB` = full Cyber
Security ₦120,000, `HCYB` = half ₦60,000, …), which independently confirms the
right tier was resolved — the exact thing that was broken.

### 8.4 Post-recovery validation

| Check | Expected | Actual |
|---|---|---|
| Contributions in collection | 12 | **12** |
| Sum of paid contributions | 815,000 | **815,000** |
| `available + pending = ledger` | invariant holds | **true** (305,000 + 510,000 = 815,000) |
| Duplicate `payment_reference` | 0 | **0** |
| Tier `sold_quantity` correctness | per-tier | **correct** (₦120k→2, ₦60k→1, ₦90k→1, ₦80k→1, ₦40k UI/UX→2) |
| Orphaned successful payments (platform-wide) | 0 | **0** |

`available_balance` deliberately remains ₦305,000: the recovered payments are
recorded as *today's* payments, so they sit in `pending_balance` until the next
settlement cycle. This is the documented design (`ledger = available +
pending`), not a partial update. One real consequence of recovering a day late:
these funds become withdrawable one settlement cycle later than if they had
been recorded on time.

### 8.5 Idempotency (Objective 4) — verified against production

All six references were replayed a second time. Every call returned HTTP 200
with the **same contribution IDs**, and:

- contributions: 12 → **12** (unchanged)
- sum paid: 815,000 → **815,000** (unchanged)
- duplicate references: **0**
- rows created after the first recovery pass: **0**

`claim_payment_contributions` locks the collection `FOR UPDATE`, then returns
`{"outcome":"idempotent"}` when a row already exists for
`(collection_id, payment_reference)`. Re-running reconciliation any number of
times is a no-op.

### 8.6 Regression tests

`kolekto-be-old/tests/paymentTierParity.test.js` — 12 tests, run via
`npm run test:payment-parity` (and included in `npm test`).

It loads **both real implementations** — the Node backend's
`services/pricingService.js` (live initialization authority) and the Deno edge
function's `_shared1.ts` (live verification authority) — and asserts they
agree. No hand-written mirror: a mirror would have kept passing through this
entire incident.

Coverage: every colliding tier resolves by id; the specific ₦51,000 bug;
init↔verify parity across all 12 tiers, both fee bearers, and fixed /
fundraising / open_pool; id-beats-misleading-name; name-only legacy fallback;
unknown id; duplicate tier IDs; replay of all 6 lost references at their
captured amounts; and that the mismatch guard is not weakened.

**Proven to have teeth:** mechanically reinstating the pre-fix `matchTier`
body makes **8 of 12 fail**; restoring it returns to **12/12**. The source file
was then restored via `git checkout` and re-hashed to confirm it is
byte-identical to what is deployed.

### 8.7 Deploy-parity check

`kolekto-be-old/scripts/verifyEdgeDeployParity.mjs` (`npm run verify:edge-parity`)
downloads what is actually running in production and byte-diffs it against
git, then asserts specifically that the deployed verify function contains
id-first resolution and does **not** contain the legacy `id || name` find.
Exits non-zero on drift. Current output:

```
verify-paystack-payment   ... OK (3 files identical)
initiate-paystack-payment ... OK (1 files identical)
  id-first resolution present : yes
  legacy id||name find present: no
PASS — production matches git.
```

This is the check that addresses the actual root cause. **Wire it into CI.**

### 8.8 Monitoring

`kolekto-be-old/database/payment_loss_monitoring_2026-08-07.sql` (applied to
production; rollback file alongside). Four read-only views, no behaviour
change:

- `v_orphaned_successful_payments` — the headline detector: captured money
  with no contribution row. **Currently 0.**
- `v_payment_mismatch_rate` — hourly `amount_mismatch` per collection.
- `v_payment_recovery_exhausted` — references automatic recovery abandoned.
- `v_collections_with_duplicate_tier_names` — blast-radius watchlist.

Tuning note discovered while validating against real data: keying the orphan
detector on the *last* error code produced false positives, because the
terminal `attempt_cap_exceeded` marker masks the real reason — three abandoned
checkouts ("Transaction reference not found", Paystack never captured them)
looked identical to real losses. The view now keys on **post-capture rejection
codes only**, each reachable exclusively from the `transaction.status ===
"success"` branch, making a row in it proof of capture. The same correction
applies to the exhausted-recovery alert, which must be intersected with the
orphan view rather than alerted on directly.

### 8.9 Still open — deliberately not shipped in this pass

These are real and should be scheduled, but each is a behaviour change to the
live payment path and none is required to hold the system safe today. Shipping
them in the same session as the incident fix would repeat the mistake that
caused it.

1. **Objective 5 — persist captured payments as `needs_review` instead of
   returning 400.** The highest-value remaining change: a payment Paystack has
   settled should never be discarded by a validation rule. Requires a schema
   change (`payment_status` / `needs_review` plus mismatch context) and a
   change to the rejection branch at `index.ts:379`. This would have reduced
   this incident from "money invisible" to "money flagged for review". It is
   **not currently masking anything** — `v_orphaned_successful_payments` now
   detects the same condition.
2. **Objectives 1/6 — one shared pricing module.** Genuinely blocked by a
   runtime/repo split: initialization runs in Node (`kolekto-be-old`),
   verification runs in Deno (Supabase edge), and edge functions cannot import
   across that boundary without a build step. The parity test (§8.6) enforces
   the *invariant* today; collapsing to one physical module needs either a
   shared-package build step or moving verification into the backend per the
   CLAUDE.md write-authority rule. The latter is the architecturally correct
   end state.
3. **Objective 7 (write-path half) — reject duplicate tier names** at
   `create-collection` / `update-collection`. Resolution is already safe by id,
   so this is defence in depth. `v_collections_with_duplicate_tier_names` gives
   visibility meanwhile (1 active collection today).
