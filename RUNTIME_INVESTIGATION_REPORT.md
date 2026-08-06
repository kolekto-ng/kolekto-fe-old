# Runtime Investigation Report — Orphan Monitoring & Communication/Mail

**Method:** execution-path tracing (code, `file:line`) + runtime evidence from the
**test** project (`lpeeckqsltxohppheucz`) only — read-only Postgres logs, RLS/policy
introspection, and the actual payment rows. **No production access. No code changed.**

---

## 1. Orphan Payment Timeline

**Traced against the real test payment `kolekto-1784556863591-704214` (≈11 min old at
investigation time).**

| Stage | Executed? | Successful? | Evidence |
|---|---|---|---|
| Paystack payment | yes | yes | `pending_payment_context` row exists for the ref |
| Initiate → **pending_payment_context persisted** | yes | yes | row present; written by the **edge** `initiate-paystack-payment/index.ts:1435` (the *only* writer) |
| Payment verification | yes | yes | `frontend_callback` recovery-log entries exist |
| **Contribution creation** | **yes** | **yes** | `contributions` row, `status='paid'`, **created 14:15:42.697** (`verify-paystack-payment/index.ts:612`) |
| Downstream failure (receipt/capacity) | yes | n/a | `payment_recovery_log` `success=false, "Habeebulahi is sold out."` at **14:15:42.814** — i.e. **after** the contribution was already inserted |
| Retry | yes | yes | `frontend_callback success=true` at 14:15:42.915 |
| **Orphan detection** | ran | correctly excluded | classifier: a paid contribution ⇒ `successful`/`recovered`, **never** `orphaned` (`paymentMonitoring.js:90-101`) |

**Where the chain "stopped":** it did not stop. The contribution was recorded
successfully **before** the receipt/downstream step. Every `pending_payment_context`
row on test (12 checked, incl. this one) has a matching **paid** contribution →
**zero orphans currently exist**, so there is nothing to show in the Orphaned tab.

### Root cause (Issue 1) — evidence-backed, not hypothetical
**"Orphan" is defined as a payment with _no contribution recorded_**
(`paymentMonitoring.js:90-101`: an item is `orphaned` only when there is **no** paid
contribution, it is unresolved, age ≥ 5 min, and no failed attempt). **Preventing
receipt generation does not prevent contribution creation** — the contribution
`INSERT` (`verify-paystack-payment/index.ts:612`) runs and commits *before* any receipt
handling. So the payment legitimately has a paid contribution and is classified
`successful`/`recovered`. **The monitoring pipeline is working correctly; the test
methodology (block the receipt) does not create an orphan condition.**

The frontend is also correct: backend returns `categories.orphaned`
(`paymentMonitoring.js:227-235`); the page renders `data.categories[activeTab]` and a
dedicated Orphaned tab (`PaymentMonitoringPage.tsx:227,328,356`). No shape/render bug.

### Secondary (latent) finding — not the current cause
`pending_payment_context` is written **only** by the edge `initiate-paystack-payment`.
The Node `deposit.js` payment path does **not** write it (only references it in a
comment). Any payment initiated through the Node path would be **invisible** to Payment
Monitoring (which is 100% driven by `pending_payment_context`). The live customer flow
uses the edge path (`usePaystack.ts:65`), so this is a latent gap, not today's issue —
worth closing so monitoring can never have a blind spot.

### How to actually reproduce / test an orphan
Make the **contribution insert** fail or never run — e.g. block `verify-paystack-payment`
entirely (no callback, no webhook, no recovery), or force the `contributions` insert to
error. Then, after 5 minutes with a `pending_payment_context` row and no paid
contribution, the item classifies as `orphaned`.

---

## 2. Communication → Mail Loading Investigation

**Request-by-request (list campaigns):**

| Step | Result | Evidence |
|---|---|---|
| React route `/communications/campaigns` | mounts | lazy route in `App.tsx` (under `RequireSuperAdmin`) |
| Component mount → `load()` | fires | `EmailCampaignsPage.tsx:59-79`, `finally { setLoading(false) }` |
| API request `GET /adminurlabdkole/email/campaigns` | sent | `communications/api.ts:126` via `axiosInstance` (Bearer token) |
| Frontend route guard | **passed** | request reached the backend/DB (proven below) — a non-super would have been redirected, never reaching the API |
| Backend `requireSuperAdmin` | **passed** | ditto — a 403 would stop before any DB query; we instead see a **DB-level** error |
| Supabase query (backend client) | **blocked by RLS** | Postgres log (test): `ERROR: new row violates row-level security policy for table "email_campaigns"` |
| Response | empty list / error | SELECT under `anon` returns **0 rows**; INSERT throws |
| Frontend render | "display nothing" / toast | empty `campaigns` state |

**Decisive DB facts (test project):**
- `email_campaigns`, `email_templates`, `email_campaign_recipients`: **RLS enabled, ZERO
  policies.** RLS-on + no policy ⇒ only the **service_role** key (which bypasses RLS)
  can read/write; `anon`/`authenticated` get **0 rows** on SELECT and a **violation** on
  INSERT.
- The backend client (`utils/client.js:10-11`) uses
  `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY` and **warns** when the service key is
  missing. The observed RLS violation is **only possible under the anon key** —
  service_role would bypass RLS entirely.

### Root cause (Issue 2) — evidence-backed
**The Express backend is running without a valid `SUPABASE_SERVICE_ROLE_KEY` and falls
back to the anon key.** Because the email tables are service-role-only (RLS on, no
policies), every backend email query is denied: **reads return empty → Communication
pages show nothing; writes throw the RLS violation seen in the logs.** This is the
**same root cause** as the push-pipeline RLS failures documented in the stability report
(`notifications`, `push_notification_events`, `claim_push_notification_event`).

**This is NOT caused by the recent admin-role changes, and NOT a frontend bug.** The RLS
error proves the request passed both the frontend `RequireSuperAdmin` guard *and* the
backend `requireSuperAdmin` and reached the database — the failure is purely at the DB
access layer (anon vs service_role). The role gating is exonerated by this evidence.

---

## 3. Root Causes (summary)

1. **Orphan monitoring:** No defect. Orphan = *no contribution*. The tested payment has
   a paid contribution (created before the receipt step), so it is correctly
   `successful`/`recovered`, not `orphaned`. Blocking the receipt cannot create an
   orphan.  *(Latent: Node initiate path doesn't persist `pending_payment_context`.)*
2. **Communication/Mail:** Backend is on the **anon key** (missing/incorrect
   `SUPABASE_SERVICE_ROLE_KEY`); email tables are **RLS-enabled with no policies**
   (service-role-only) → reads empty, writes rejected. Config issue, not code, not auth.

---

## 4. Fix Plan (minimal — not yet implemented)

### Issue 2 (the real, actionable bug)
- **Primary (config, no code):** set a valid `SUPABASE_SERVICE_ROLE_KEY` in the backend
  environment. This immediately restores Communications **and** the push pipeline (same
  root cause). Verify on the **test** backend first.
- **Code hardening (minimal, recommended):** make `utils/client.js` **fail fast at
  startup** (throw) when `SUPABASE_SERVICE_ROLE_KEY` is missing in production instead of
  silently falling back to anon — this class of outage (privileged writes silently
  denied) would then be impossible to ship unnoticed. One-file change.
- **Optional defense-in-depth:** the email `/email/*` list endpoints could surface a
  clear error (e.g. distinguish "empty" from "backend-unauthorized") so a future
  misconfig shows a message instead of a silent empty list.

### Issue 1 (no pipeline fix required)
- **No code change** to orphan detection — it is correct.
- If the intent is to surface **receipt/notification failures** (a different concern
  from orphaned payments), that is a **new feature** (track `receipt_failed` on the
  contribution), not an orphan-detection fix — scope separately.
- **Recommended (close the latent gap):** ensure the Node `deposit.js` initiate path
  also writes `pending_payment_context` (or route all initiation through the edge
  function) so no payment can be invisible to monitoring. Small, isolated change.

**Awaiting your go-ahead before implementing anything.**

---
---

# CORRECTION (after render-proof for ref kolekto-1784556863591-704214)

**My earlier "Issue 1 has no defect" was incomplete.** Proving the render path
exposed that **Issue 1 and Issue 2 share ONE root cause**: the backend runs on the
anon key, and the Payment Monitoring driver table is service-role-only.

**Proven for the exact payment `kolekto-1784556863591-704214` (test project):**
- `pending_payment_context`: row EXISTS (collection `531f8c19…`, tier "Habeebulahi",
  ₦50,000, created 2026-07-20 14:14:23).
- `contributions`: row EXISTS — `status='paid'`, ₦50,000, code `ABY-002`,
  created 14:15:42.697.
- **Correct classification** (`paymentMonitoring.js:90-101`): paid contribution +
  the only success log is `invocation_source='frontend_callback'` (NOT in
  `RECOVERY_SOURCES`) ⇒ category = **`successful`** (not `recovered`, not
  `orphaned`). It belongs in the **All** and **Successful** tabs.
- **But it does not render**, because:
  - `pending_payment_context` is **RLS-enabled with ZERO policies** → service-role-only.
  - The backend is on the **anon key** → that SELECT returns **0 rows**.
  - `loadPaymentMonitoringState` → `contexts=[]` → `items=[]` → the endpoint returns
    empty categories + zero stats (HTTP 200, no error) → **the entire dashboard shows
    "Nothing here" on every tab.**

**Unified root cause:** backend missing/invalid `SUPABASE_SERVICE_ROLE_KEY` +
service-role-only RLS tables (`pending_payment_context`, `email_campaigns`,
notifications, push_notification_events). **One config fix (set the service-role key)
restores Payment Monitoring AND Communications AND push at once.** After the fix, this
payment renders in All/Successful (badge "Successful"), correctly absent from Orphaned.

**"Habeebulahi is sold out" is NOT a receipt failure** — it's a tier capacity guard
(`verify…/_shared1.ts:1262-1263`, error_code `tier_sold_out`) from a double-invoked
payment callback (two `frontend_callback` verifies raced; the first took the tier's
last slot, the second correctly aborted). Net: exactly one paid contribution.
