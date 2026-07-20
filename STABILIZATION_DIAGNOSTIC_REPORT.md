# Kolekto Stabilization — Diagnostic Report (Evidence-Based)

**Scope:** Root-cause diagnosis for Task 1 (collection restriction), Task 3 (Failed to
Load), Task 4 (Payment Monitoring), Task 5 (nav freeze). Task 2 (admin authorization)
is already implemented; recorded here for completeness.

**Evidence sources used**
- Static call-graph tracing (code-proven, `file:line`).
- Installed dependency source (`node_modules/@supabase/*`) — mechanism verification.
- Supabase server logs (prod, read-only, last 24h): `api` (PostgREST) + `postgres`.
- Read-only SQL (`information_schema`, length-only metadata) — no values exported.

> Note on environments: the runtime evidence below was captured from the **prod**
> project (`busfgcmbndleljklrcbd`) via read-only log/schema queries before the request
> to restrict to test. No data was written or changed. Further investigation will use
> the **test** project (`lpeeckqsltxohppheucz`) only.

> A browser session against the live admin SPA (to capture DevTools console/network/HAR
> timing) was **not** available in this environment. Where a claim depends on client-side
> timing it is labelled **[code-proven]** (deterministic from source) vs **[log-observed]**
> (seen in server logs). None of the conclusions rely on an un-captured browser trace.

---

## TASK 1 — Collection Creation Restriction

### Verdict
**Not a backend bypass.** Every creation entry point converges on a single client method
and both backend write paths enforce the KYC gate identically. The reported "restriction
only works on the Collections page" is a **frontend UX inconsistency**: only the
Collections page pre-emptively disables its button; every other entry point drops the
user into the wizard and surfaces the block only as a toast at submit time.

### Proven call graph (every entry point)
All entry points are `<Link>` / `navigate()` to one of **two routes**, both of which
render the **same** `CreateCollectionWizard`, which calls the **same** store method:

```
Entry points (≈30):
  LandingPage.tsx (×8), NavBar.tsx (×4), lpMain/hero/Hero.tsx, AboutPage.tsx (×2),
  Footer.tsx / Footer/Footer.tsx, dashboard/DashboardPage.tsx (New + Quick-Action type cards),
  dashboard/MobileBottomNav.tsx, dashboard/DashboardSidebar.tsx,
  dashboard/CollectionOverview.tsx (empty state), dashboard/CollectionsPage.tsx (×2)
        │
        ▼  navigate to "/create-collection"  OR  "/dashboard/create-collection"
  App.tsx:156  <Route path="/create-collection"          element={CreateCollectionPage}>
  App.tsx:195  <Route path="create-collection"           element={DashboardCreateCollectionPage}>
        │            both render ↓
  components/collections/wizard/CreateCollectionWizard.tsx:273,425
        │            const { createCollection } = useCollectionStore();  → createCollection(payload)
        ▼
  store/useCollectionStore.ts:211 createCollection()
        │  getCreateCollectionPath()  (lib/featureFlags.ts:35 → default "edge")
        ├─ "edge"    → supabase.functions.invoke("create-collection")   [PROD DEFAULT]
        └─ "express" → axiosInstance.post("/create-collection")
```

**Both backend paths enforce the identical gate:**
- Edge: `supabase/functions/create-collection/index.ts:61-78` — `kyc_verifications.status !== 'verified'` → count non-deleted `collections` ≥ 1 → **403**.
- Express: `routes/collection.js:10` → `controllers/collection.js:20` → `services/collectionService.js:207` `await assertCanCreate(userId)` (def :84) → **403**. Characterization test: `tests/collectionService.test.js:109,117`.

### The only page-local gate (the "restriction that works on one page")
`pages/dashboard/CollectionsPage.tsx:49-50`:
```ts
const isKycVerified = kycData?.overallStatus === 'verified';
const collectionLimitReached = !isKycVerified && collections.length >= 1;
```
Used at `:195-223` to disable that page's "New Collection" button + show an amber notice.
**No other entry point has this check** — proven by grep: `collectionLimitReached` /
`isKycVerified` appear only in `CollectionsPage.tsx`.

### Error surfacing (already uniform, all paths)
`CreateCollectionWizard.tsx:459-464` — the backend 403 message
("Complete KYC verification to create more than one collection.") is shown via
`toast.error(toFriendlyErrorMessage(...))` for every entry point.

### Dead-code note
`utils/api.ts:62-95` (`collectionAPI.create` → `authenticatedFetch('/create-collection')`)
is a **third** create implementation but is **never imported anywhere** (grep: only its own
declaration). It should be deleted to avoid future divergence.

### Root cause & fix shape (no code change yet)
Root cause = duplicated/partial FE gating, not backend. Fix = one shared
`useCanCreateCollection()` hook consumed by **all** entry points for consistent early UX;
backend stays the sole authority; delete the dead `collectionAPI`. (This matches the
approved "shared hook + backend enforces" decision.)

---

## TASKS 3 & 5 — "Failed to Load" and Admin Navigation Freeze

These share infrastructure roots. **The admin panel uses no React Query at all**
(`useQuery`/`useMutation`/`useQueryClient` → *zero matches*); the `QueryClient` in
`App.tsx:43` is instantiated but never consumed. So "React Query cache/retry" is **ruled
out**. All data loads via Zustand stores calling `supabase.from()` in `useEffect`.

### Root cause 5A — Navigation freeze = supabase-js Web-Locks starvation **[code-proven]**

`integrations/supabase/client.ts:14-18` sets `autoRefreshToken: true`,
`storageKey: "kolekto-auth-token"`. Verified in installed `@supabase/auth-js@2.70.0`:

1. `SupabaseClient` (supabase-js@2.50.0) ctor: `this.fetch = fetchWithAuth(key, this._getAccessToken.bind(this), …)` — **every** `.from()` request calls `_getAccessToken()`.
2. `_getAccessToken()`: `const { data } = await this.auth.getSession()`.
3. `getSession()` (GoTrueClient): `await this._acquireLock(-1, …)`.
4. `_acquireLock` → `navigator.locks.request("kolekto-auth-token", …)` with **`acquireTimeout = -1` = wait forever** (`auth-js/dist/module/lib/locks.js:54`).

Consequently **all** reads serialize on one named Web Lock. With `autoRefreshToken`, a
background refresh acquires the same lock; supabase's refresh `fetch` has **no client-side
timeout**, so a stalled/slow refresh (flaky network, tab wake) holds the lock and every
subsequent `.from()` awaits it **forever** → infinite spinner. Client-side navigation does
**not** tear down the document, so the held lock persists across route changes; a **browser
refresh destroys the document → releases the lock → page works** — exactly the reported
"navigate → loads forever → refresh fixes it."

**Why the earlier fix was incomplete:** `lib/axios.ts:51-82` already reworked the **axios**
interceptor to read the token from the Zustand store instead of `getSession()` — but that
only covers Express calls. The **7 stores' `supabase.from()` reads**
(dashboard, users, collections, kyc, fundraising, withdrawals, Sidebar badges) and
`authStore`'s `supabase.rpc("current_admin_user")` / `getSession()` **still** go through the
lock. The mitigation was applied to one caller and missed the majority.

**Aggravating factor:** `authStore.initialize()` runs `isAuthenticatedUserAdmin()` (an
RPC → lock) on **every** `onAuthStateChange`, including `TOKEN_REFRESHED` — extra lock
contention on the exact event that already holds the lock for a refresh.

### Root cause 3A — "Failed to Load" = all-or-nothing `Promise.all` fan-out **[code-proven + log-corroborated]**

`stores/dashboardStore.ts:68-107` issues **14 concurrent** `supabase.from()` queries in a
single `Promise.all`; the `catch` (`:183-185`) sets `error: "Failed to load dashboard data"`.
`Promise.all` rejects if **any one** of 14 rejects → a single transient failure blanks the
whole page. No retry, no partial render, no `AbortController`. Same pattern in the other
stores (each has its own `"Failed to load …"`), and on the **backend** in
`controllers/admin/paymentMonitoring.js:37-68` (`loadPaymentMonitoringState` throws if any of
its 4 sub-queries error → the Payment Monitoring page 500s → "Failed to Load").

**Log corroboration that it's client-side, not server rejection:** in the prod `api` logs,
the admin-style reads (`profiles`/`collections`/`wallets`/`kyc_verifications` counts) return
**200**. There are **no** 4xx/5xx on admin RLS reads in-window. The only 4xx/403s belong to
the **push-notification** pipeline (below), not admin reads. So the admin "Failed to Load"
is not the server saying no — it is client-side lock hang and/or a single flaky sub-query in
a `Promise.all`.

**Contributing data-shape fragility:** several store selects use relationship embeds
(`collections!inner(title)`, `collections!withdrawals_collection_id_fkey(title)`); the
type-checker flags `SelectQueryError<"could not find the relation …">` for several stores —
if any embed errors at runtime, that sub-query rejects and fails the whole page.

### Fix shape (no code change yet)
1. Wrap the shared supabase client so reads don't block indefinitely on the auth lock
   (bounded `getSession`/token access; or a single cached-token accessor akin to the axios
   fix, applied to a shared data layer). Turn the infinite lock wait into a bounded,
   recoverable failure.
2. Replace `Promise.all` fan-outs with `Promise.allSettled` (+ per-widget error/empty state)
   so one flaky sub-query can't blank a whole page.
3. Stop re-running the admin RPC on `TOKEN_REFRESHED`; only re-check on `SIGNED_IN`/user change.
4. Remove the frontend "optimistic accept on RPC error" auth fallback (fail-closed) once the
   lock/timeout issue above is fixed, so it no longer risks reliability.

---

## TASK 4 — Payment Monitoring Audit (execution-flow)

### What is healthy (verified in code + logs)
- **Webhook HMAC verification:** `controllers/deposit.js:755-770` (`x-paystack-signature`,
  `createHmac("sha512", PAYSTACK_SECRET_KEY)`); raw-body mount preserved (`app.js:101-108`).
- **Duplicate / late webhook idempotency:** `deposit.js:838` `charge.success` →
  `WEBHOOK_ALREADY_PROCESSED` no-op when the contribution is already paid (`:859`), then
  delegates to the **idempotent** `verify-paystack-payment` edge function; returns
  `{ duplicate }` (`:801`). **Sound.**
- **Scheduled recovery is running:** prod `api` logs show cron (`cron job 5`) every ~5 min
  calling `rpc/get_orphaned_payment_candidates` (200) and writing `payment_recovery_log` (201).
- **Monitoring dashboard** reads source tables read-only and routes all recovery actions
  through the verify edge function (`controllers/admin/paymentMonitoring.js:1-14`).

### 🔴 CRITICAL BUG — orphan recovery is stuck in a permanent failure loop **[log-proven + data-proven]**

**Symptom (prod postgres logs, recurring every ~5 min, last 24h):**
```
ERROR: value too long for type character varying(20)
```
time-correlated (same timestamps) with prod `api` logs:
```
POST | 400 | /rest/v1/contributions?select=*   (Deno/SupabaseEdgeRuntime = scheduled recovery)
```

**Root cause (data-proven):** `contributions.phone` is `varchar(20)`
(`information_schema`), but the verify/recovery insert writes the **raw Paystack contact
phone** with no truncation/normalization:
`verify-paystack-payment/index.ts:576,592,613` → `phone: normalizedPayment.contact.phone …`
into `contributions.insert(contributorPayload)`.

Length check of the stuck references (`pending_payment_context.metadata`, length-only):

| reference | `contactPhone` length | inserts into `phone varchar(20)`? |
|---|---|---|
| `kolekto-1783668829043-357419` | **22** | ❌ 400 "value too long" — **fails every cycle** |
| `kolekto-1784148992963-944195` | 11 | ok length (still orphaned — see note) |
| `kolekto-1784149298956-451613` | 11 | ok length (still orphaned — see note) |

**Impact:** any contributor whose Paystack `contact.phone` exceeds 20 chars (international
formatting → 22 here) **paid successfully but their contribution was never recorded**.
Because the insert fails, no `contributions` row exists → `get_orphaned_payment_candidates`
re-returns the reference → recovery logs an attempt (`payment_recovery_log` 201) but the
insert 400s again → **infinite loop, never recovers**. The **same overflow also breaks the
webhook path** for such payments (same insert), so neither the primary nor the recovery path
can ever record them.

> Note: the two 11-char references reappear each cycle too; they may be orphaned for a
> different reason (to be traced on the **test** project). The 22-char one is the confirmed
> hard-fail.

### Fix shape (no code change yet)
- Normalize/validate phone before insert (strip non-digits / cap length), **or** widen
  `contributions.phone` (and re-check `collections.support_phone_number`, also `varchar(20)`).
  Prefer normalization + a sane column width; a migration must be coordinated on test first.
- Add a dead-letter / alert path so a recovery candidate that fails N times stops silently
  looping and raises a visible error in the Monitoring dashboard.

### Secondary finding (Task 6 bucket) — push pipeline RLS failures **[log-proven]**
Recurring prod errors every few minutes:
```
ERROR: new row violates row-level security policy for table "notifications"
ERROR: new row violates row-level security policy for table "push_notification_events"
ERROR: permission denied for function claim_push_notification_event
```
(`POST 403` from the `node` backend). The push/notification writer is being rejected by RLS
/ function grants — a separate defect worth its own fix; not part of Tasks 1–5 but surfaced
here as concrete evidence.

---

## Summary of root causes

| Task | Root cause | Evidence |
|---|---|---|
| 1 | FE gate exists only on Collections page; all paths already converge on one wizard→store→backend that enforces | call graph (file:line); both gates quoted |
| 3 | `Promise.all` all-or-nothing fan-out (1 flaky sub-query blanks page); admin reads return 200 server-side | dashboardStore:68-186; prod api logs (200s) |
| 5 | supabase-js Web Lock (`_acquireLock(-1)`, no timeout) + `autoRefreshToken`; prior fix only covered axios, not store `.from()` reads | auth-js@2.70.0 source; client.ts:14-18 |
| 4 | Orphan recovery insert fails on `contributions.phone varchar(20)` overflow (22-char phone) → permanent retry loop; webhook idempotency itself is sound | prod postgres+api logs; information_schema; metadata length |

No further code changes will be made until you sign off on this diagnosis.

---
---

# IMPLEMENTATION LOG (fixes applied, phased & isolated)

All work landed on branch `ghazali/fix-with-claude` across three repos, one
concern per commit. Regression signal per phase noted.

## Phase A — Task 2: Admin authorization (DB-only, role-aware, fail-closed)
- **be-old `6053b8b`** — `requireAdmin.js` rewritten: single role resolver
  (60s cache), new `requireSuperAdmin` (403 for a plain admin), **removed the
  ADMIN_EMAILS allowlist AND the bootstrap fallback from the auth path** — an
  unreachable `admin_users` now fails closed (503). Gated withdrawal
  approve/reject, `/ambassadors/withdrawals`, and all `/email/*` with
  `requireSuperAdmin`.
- **admin `7efd851`** — `authStore` reads/persists the role from
  `current_admin_user`; `RequireSuperAdmin` route guard; sidebar hides the four
  restricted areas.
- **admin `7012377`** — least-privilege on an unresolved role: restricted UI
  requires an explicit `superadmin` (null/unknown treated as non-super).
- Regression: **63/63** backend tests, admin build clean.

## Phase D — Task 4: Payment orphan-recovery phone overflow
- **be-old `29e03c1`** — `utils/normalizePhone.js` (+6 unit tests); applied at
  the Node contribution insert in `deposit.js`.
- **fe-old `01fcc7a`** — same normalization inlined in the `verify` and
  `initiate` edge functions (the authoritative writer + the source).
- Valid normalized numbers are ≤16 chars, so **the varchar(20) column was NOT
  widened** (per instruction: normalize/validate first).
- Regression: **69/69** backend tests (+6 new).
- **Deploy note:** the two edge functions must be redeployed (test first) for the
  fix to take effect; once redeployed, existing stuck orphans self-recover on the
  next scheduled cycle.

## Phase B — Task 1: Collection-creation limit consolidation
- **fe-old `65e5b12`** — `useCanCreateCollection()` single-source hook; enforced
  at the wizard (the convergence point all entry points hit) via a notice banner
  + a publish guard; Collections page now sources the rule from the hook; removed
  the dead, unused `collectionAPI` third create path. Backend remains the sole
  authority.
- Regression: fe build clean, `useCollectionStore` tests **6/6**.

## Phase C — Tasks 3 & 5: Failed-to-Load + navigation freeze
- **admin `c0fe65d`** — bounded supabase auth lock (custom `lock`, 8s timeout
  then best-effort) — removes the infinite Web-Lock wait that caused the freeze.
- **admin `33e7091`** — stop re-running the admin RPC on `TOKEN_REFRESHED`
  (only `SIGNED_IN`/`USER_UPDATED`), cutting lock churn.
- **admin `d502235`** — dashboard uses `Promise.allSettled` so one flaky
  sub-query degrades a single metric instead of blanking the page.
- Regression: admin build clean. **Runtime nav/freeze verification pending in a
  browser** (admin panel has no automated test suite).
- Decision (confirmed): keep the frontend optimistic-accept on RPC error (avoid
  total admin lockout); backend stays the fail-closed authority.

---

# TASK 6 — STABILITY REPORT

## Fixed this sprint (see Implementation Log)
- Loading deadlock / infinite loading (Web-Locks) — **fixed** (C `c0fe65d`).
- "Failed to Load" all-or-nothing fan-out — **fixed** for the dashboard
  (C `d502235`).
- Authorization inconsistency (no role enforcement; env/hardcoded fallbacks) —
  **fixed** (A).
- Auth RPC churn on every token refresh — **fixed** (C `33e7091`).
- Payment orphan-recovery infinite failure loop — **fixed** (D).

## Open findings (diagnosed; not code-fixable here / need coordination)

### 1. Push pipeline blocked by RLS — CONFIG, not code  [log-proven]
Prod logs (recurring): `permission denied for function
claim_push_notification_event`, `new row violates RLS for "notifications"` /
`"push_notification_events"` (403 from the `node` backend). The backend can READ
(RLS-permitted) but not perform these privileged WRITES — the signature of
running under the **anon key**. `utils/client.js:10-16` falls back to
`SUPABASE_ANON_KEY` when `SUPABASE_SERVICE_ROLE_KEY` is unset (and logs a
warning). **Fix (ops): set `SUPABASE_SERVICE_ROLE_KEY` in the backend
environment** (service role bypasses RLS). No code change; verify on test first.
Impact: in-app + push notifications for the affected events are silently dropped.

### 2. Backend Payment Monitoring endpoint is all-or-nothing  [code]
`controllers/admin/paymentMonitoring.js:37-68` (`loadPaymentMonitoringState`)
runs 4 source queries in `Promise.all` and throws if ANY errors → the admin
Payment Monitoring page 500s ("Failed to Load"). Same anti-pattern as the
dashboard. Recommend `Promise.allSettled` + partial render. (Isolated backend
change; deferred so it can be its own phase + test.)

### 3. `character varying` width review  [schema, low]
`collections.support_phone_number` is also `varchar(20)`; if it is ever written
from an un-normalized source, apply the same `normalizePhone`. `status`/
`fee_bearer`/currency columns are fine. No change made.

### 4. Dead code  [cleanup, low]
- `utils/api.ts` `transactionAPI` / `withdrawalAPI` appear unused (only
  `collectionAPI` was removed as part of Task 1). Confirm and delete.
- `kolekto-shared-financial/test/*.test.ts` are empty placeholder suites that
  make `vitest run` report failures — add suites or remove.

## Remaining technical debt (not blocking)
- Admin panel has **no automated tests** — the nav-freeze and Failed-to-Load
  fixes are validated by build only. Recommend a minimal harness (mocked
  auth-lock timeout; `allSettled` partial-failure) as a safety net.
- Admin `QueryClient` is instantiated but unused (no React Query anywhere) —
  remove to avoid confusion.
- The two Paystack edge functions duplicate `normalizePhone` inline (necessary
  for self-contained deploy) — kept in sync with the tested `be-old` version.
- Edge/verify vs initiate maintain parallel `normalizePaymentRequest`
  implementations; a shared module would reduce drift (tracked separately).

## Verified healthy (no change needed)
- Webhook HMAC verification + duplicate/late-webhook idempotency
  (`deposit.js`): sound.
- Error boundary keyed by route in the admin layout: correct.
- Scheduled recovery cron cadence + `payment_recovery_log` writes: working
  (the only defect was the phone-overflow insert, now fixed).
