# KOLEKTO — WAVE 6.7F.8 / REALTIME + SCALE HARDENING

**Date:** 2026-08-20
**Branch:** `ghazali/fix-with-claude`
**Databases:** TEST (`lpeeckqsltxohppheucz`) only. **Production (`busfgcmbndleljklrcbd`) was never contacted — no read, no write, no migration. Wave 6.7F.8 production migration NOT started.**

---

## 1. Executive Summary

I re-derived the realtime architecture from the code and from TEST rather than trusting the previous wave's report — and **the previous wave's headline remaining issue was overstated, while a more serious one sat underneath it.**

**What the previous report said:** unfiltered subscriptions mean "any row change anywhere triggers a refetch for every connected client."

**What is actually true:** Supabase Realtime only delivers an event to a client whose JWT passes the table's RLS `SELECT` policy for that row — the repo's own `database/realtime.sql` says so, and I verified it on TEST. Ordinary users see *exactly* their own rows (`geeekyfocus` sees 16/199 contributions, 3/89 collections). So there was never a cross-tenant storm for ordinary users. The real waste was narrower: **within-user cross-workspace noise**, plus **admin accounts** (3 rows in `admin_users`), which *can* SELECT every row and so did receive every event platform-wide.

**The finding that matters more, and that this audit surfaced:**

> **Realtime is silently dead for workspace ADMINs and MEMBERs.**

RLS on `collections` / `contributions` / `wallets` is ownership-based (`user_id = auth.uid()`), with no workspace-membership clause. I proved this with a reversible TEST fixture: a non-admin user made an active `MEMBER` of a workspace **sees a collection through the Express API but cannot `SELECT` it via RLS** — so they receive **zero** live updates for any collection they did not personally create. The entire workspace-collaboration feature about to be migrated to production ships with non-functional realtime for collaborators.

That cannot be fixed here: it requires widening an RLS `SELECT` policy, which is (a) a migration and (b) a security-sensitive change granting browser-side read access to workspace financial rows. It is designed and documented below, not applied.

**What I fixed:**
- Realtime is now workspace-scoped and burst-coalesced: a 20-event burst goes from **60 HTTP requests to 3**, and a burst in a *different* workspace from **60 to 0**.
- Wallet refresh policy rebuilt: realtime primary, staleness-gated focus/visibility, **polling demoted to a fallback that only runs when realtime is down**.
- Admin console: `owner_rejected` (terminal) was rendering as **"Pending"** on the dashboard and transactions list — 4 real rows on TEST. Fixed with a canonical status model.
- Admin console: "Pending withdrawals" KPI silently excluded `pending_owner_approval`; "approved withdrawals" total missed three payout statuses; three money sums were subject to a silent 1,000-row truncation. All fixed.

**Is the app materially faster?** For this wave, not in endpoint latency — that was the previous wave's win and I did not target it. This wave removed **request volume** and fixed **displayed-money correctness**. Both are measured below.

---

## 2. Before vs After

Endpoint latency was **not** a target of this wave. Numbers are shown for continuity but the run-to-run spread on this machine (~±400 ms) is wider than any difference; **do not read these as improvements from this wave's changes.**

| Metric | Before | After | Improvement |
|---|---:|---:|---:|
| `GET /collections` | 552–914 ms / 35.1 KB | 552 ms / 35.1 KB | unchanged (not targeted) |
| `GET /dashboard/stats` | 802–1,415 ms / 0.2 KB | 802 ms / 0.2 KB | unchanged (not targeted) |
| `GET /dashboard/activities?limit=5` | 747–1,346 ms / 2.1 KB | 747 ms / 2.1 KB | unchanged (not targeted) |
| `GET /withdrawals` | 584 ms / 27.6 KB | 584 ms / 27.6 KB | unchanged |
| `GET /workspaces` | 264 ms / 18.9 KB | 264 ms / 18.9 KB | unchanged¹ |
| Workspace switch (3 parallel reqs) | ~1.7 s | ~1.7 s | unchanged (preserved) |
| Time to first content | ~0.9 s | ~0.9 s | unchanged (preserved) |
| **Realtime: 20-event burst, active workspace** | **60 requests** | **3 requests** | **20×** |
| **Realtime: 20-event burst, other workspace** | **60 requests** | **0 requests** | **eliminated** |
| **Wallet page: idle 10 min, realtime healthy** | **~20 polled refetches** | **0** | **eliminated** |

¹ `/workspaces` grew 7.0 KB → 18.9 KB purely from **orphaned integration-test fixtures** accumulating on TEST (§6), not from a code change.

The realtime figures are produced by `src/utils/realtimeScope.test.ts` driving the **actual shipped functions** (not a model), with fake timers at 50 ms event spacing. Each "request" counts one dashboard refetch = 3 HTTP calls.

---

## 3. Realtime Architecture

### Every subscription in the frontend (independently mapped)

| Channel | Tables / events | Filter | Verdict |
|---|---|---|---|
| `collection-live-{id}` (ContributePage) | contributions `*`, collections UPDATE | `collection_id=eq`, `id=eq` | already correct |
| `col-details-{id}` (CollectionDetailsPage) | contributions, wallets, collections | `collection_id=eq` ×2, `id=eq` | already correct |
| `collections-list-{user}-{ws}` (CollectionsPage) | collections `*` | `user_id=eq` | see note ² |
| `dashboard-rt-{user}-{ws}` (DashboardPage) | contributions INSERT+UPDATE, wallets `*`, collections UPDATE | **none** | **fixed** |
| `wallet-live-{user}-{ws}` (TransactionHistoryPage) | wallets `*`, withdrawals `*` | **none** | **fixed** |
| `notifications:{userId}` | notifications INSERT/UPDATE | `user_id=eq` | already correct |
| `kyc-status-{userId}` | kyc_verifications `*` | `user_id=eq` | already correct |

² Filtered by `user_id`, not workspace — so it misses workspace-mates' collections. Same root cause as the RLS gap; not a storm source, left alone.

### The filtering strategy, and why it is what it is

I checked the actual columns on TEST before designing anything:

| Table | `workspace_id` | `collection_id` |
|---|---|---|
| `collections` | **YES** | — |
| `contributions` | NO | YES |
| `wallets` | NO | YES |
| `withdrawals` | NO | YES |

So:
- **`collections` is filtered SERVER-SIDE** with `workspace_id=eq.{active}` — the only subscription where that is expressible. When no workspace has resolved the filter is omitted rather than guessed.
- **The other three are scoped CLIENT-SIDE** against the active workspace's collection id set. Supabase Realtime filters are a single-column comparison on the changed row — no joins, no `IN` — so a workspace filter is *not expressible* for them. I did not invent one.

To make client-side scoping possible, `useDashboardHomeStore` now keeps `workspaceCollectionIds` (every id from the `/collections` response it already fetched — the previous code kept only the top 3). No extra request.

### The fail-open rule

`shouldHandleRealtimeEvent` suppresses in **exactly one** case: the active collection set is positively known *and* the row belongs to a different collection. Everything else — unknown set, empty set, missing `collection_id`, empty payload — **handles the event**. On a payments product an extra request is trivially cheap; a swallowed "your money arrived" is not. 21 tests pin this, most of them asserting the fail-open direction.

### Coalescing, cleanup, duplicate prevention

- `createCoalescer` collapses a burst into one trailing call (400 ms quiet window) with a **2 s `maxWait`** so a *continuous* stream still refreshes — a plain debounce starves forever under sustained load, which here would mean the dashboard freezing during the busiest moment.
- Every effect calls `refresh.cancel()` **and** `supabase.removeChannel()` on cleanup. `activeWorkspaceId` is in the dependency array, so React tears the old channel down before creating the new one — a switch cannot leave an old-workspace subscription alive.
- The wallet page tracks channel health via `.subscribe(status => …)` and re-syncs once on a `false → SUBSCRIBED` transition, because realtime does not backfill events missed while the socket was down.

### ⚠️ Workspace isolation — the RLS gap (NOT fixed, needs a migration)

Proven on TEST with a reversible fixture (`workspace_members` row inserted, tested, deleted):

| As an active workspace MEMBER | Result |
|---|---|
| `SELECT` the workspace's collection via RLS | **NO** |
| `SELECT` its contributions via RLS | **NO** |
| `SELECT` its wallet via RLS | **NO** |
| See it via `GET /collections` (Express) | **YES** |

Realtime delivers only what a client could `SELECT`. Therefore **ADMIN/MEMBER users get no live updates for collections they did not create.** The API path is correct; the browser path is not.

**Recommended fix (design only, deliberately not written as a migration):** add a workspace-membership clause to the `SELECT` policies on `collections`, `contributions` and `wallets`, e.g. `EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = collections.workspace_id AND m.user_id = auth.uid() AND m.status = 'active')`. This must be designed deliberately because it **widens browser-side read access to financial rows** and interacts with the Phase 0.9 PII work and the project's "client is read-only for financial data" rule. It is a security change wearing a performance hat, and it does not belong in a performance wave.

---

## 4. Workspace Switching

Unchanged from the previous wave and verified not to have regressed: activeWorkspaceId is set synchronously (toast + check-mark < 100 ms), the page shell stays mounted, and the three requests fire in parallel with per-section progressive commits.

**A → B**, **B → A**, **A → B → C → A** — stale-request prevention:

Every commit re-checks `getActiveWorkspaceId() === requestWorkspaceId` at the moment it writes. This wave's predecessor split one commit into three, so the guard now has to hold at **three independent points**; `src/store/rapidWorkspaceSwitch.test.ts` (4 tests) pins that it does:

- A late response from an abandoned workspace lands **nothing** (stats, cards and activities all rejected).
- With stats committing *before* a switch and collections/activities *after*, only the pre-switch commit survives — each guard is genuinely independent.
- After `A → B → C → A` the store holds **A's** data, never C's.
- `workspaceCollectionIds` always describes the current workspace — important because the realtime scope check reads it; if it lagged, events would be scoped against the wrong workspace.

On switch, the coalescer is cancelled and the channel removed before the new one is created, so an in-flight coalesced refresh from the old workspace cannot fire against the new one.

---

## 5. Admin Console

### Withdrawal status display — real bug, real rows

`stores/dashboardStore.ts` and `pages/TransactionsPage.tsx` both collapsed status with
`approved → success : rejected → failed : else pending`. That `else` caught both two-stage workspace statuses. Actual TEST data:

| status | rows | OLD badge | NEW badge |
|---|---:|---|---|
| approved | 26 | success | Approved (success) |
| rejected | 4 | failed | Rejected by Super Admin (failed) |
| pending | 5 | pending | Awaiting Super Admin Approval (pending) |
| pending_owner_approval | 4 | pending | Awaiting Workspace Owner Approval (pending) |
| **owner_rejected** | **4** | **pending** ❌ | **Rejected by Workspace Owner (failed)** ✅ |

**4 terminally-rejected withdrawals were displayed as in-progress on a financial console.** `WithdrawalsPage` and `WithdrawalDetailPage` already had the correct labels inline — the admin simply had no central model, so the two coarse surfaces drifted. Added `src/lib/withdrawalStatus.ts`, mirroring the organizer app's `utils/withdrawalStatus.ts` (same buckets, same membership); `Transaction` gained an optional `statusLabel` so the badge can be precise without changing the three-way colour bucket.

### Aggregation — was an RPC required? **No.**

Three dashboard figures summed rows client-side with unpaginated reads: paid contributions, withdrawal amounts, wallet balances. PostgREST caps those at `db.max_rows` (1,000 default) and truncates **silently** — no error, just fewer rows and a confident wrong total.

I did **not** create an aggregate RPC, for two reasons:
1. Kolekto's balance math is **already implemented three times** (Node `utils/financial.js`, Deno edge functions, SQL atomic withdrawal RPCs) and that duplication is a known drift source. A fourth implementation buys one round-trip and costs a reconciliation risk.
2. It needs a migration; this wave is explicitly pre-migration.

Instead, `fetchAllRows()` walks the full set with explicit `.range()` pages. **The arithmetic and the source rows are identical — only the row set becomes complete.** Bounded at 100k rows with a `truncated` flag so a capped figure can be *labelled* rather than silently shown as exact.

Two more fixes in the same store: the "Pending withdrawals" KPI used `.eq("status","pending")`, excluding `pending_owner_approval` (4 invisible rows on TEST); and "approved withdrawals" recognised only `approved`/`success`, missing `completed`/`successful`/`processed` that the backend's own engine treats as paid out.

**Tests:** the status mapping was verified against the real TEST status distribution above. The admin has no test runner configured (`package.json` has no `test` script), so this was verified by applying the shipped helper's logic to the real row counts and by the build/typecheck.

---

## 6. Database

- **Query findings:** no N+1 found. The scope-service pattern reads ids once then uses `.in(...)`. The three admin client-side sums were the only unbounded reads that mattered, now paginated.
- **Indexes: none created, none proposed.** TEST's largest relevant table is 200 rows — far too small for index choice to be measurable. Proposing indexes off that would be guesswork. **Re-evaluate `workspace_id`, `(workspace_id, status)`, `collection_id` and `created_at DESC` against production row counts and `pg_stat_statements` after w1–w15 lands.**
- **Base64 images (Phase 9 assessment):** `collections.banner_url` / `story_images` hold inline `data:` URIs; images are **not** in Supabase Storage. The previous wave stopped shipping them in list responses; the detail endpoint still returns them. A full assessment (upload path, size distribution, Storage bucket provisioning, public/private URL policy, backfill, frontend assumptions) was **not** completed in this wave — I prioritised the realtime and admin-correctness findings, which are the ones that block the migration. This remains open and is listed under HIGH in §10.
- **Migrations created:** **none.** No TEST-only migration was needed, because the one change that would have required one (the RLS widening) is a security decision that should not be made inside a performance wave.
- **TEST database changes:** one `workspace_members` row inserted and deleted as a proof fixture (§3). Otherwise read-only.
- **⚠️ TEST data hygiene:** the integration suite **leaks workspace fixtures**. Across my 3 runs, workspaces went 129 → 224 and `workspace_members` 155 → 349. **70 of 165 workspaces on TEST (42%) are orphaned fixtures** named `W12 Fixture WS A/B`, `W67 Fixture WS A/B`, `W6.7F.5/6 Fixture WS A/B` — **36 from my runs, 34 pre-dating this session.** Sources: `withdrawalAdminInitiation.integration.test.js` and `withdrawalOwnerApprovalListing.integration.test.js`. This inflated `/workspaces` from 7.0 KB to 18.9 KB. **I have not deleted them** — that is destructive on a shared database and includes rows I did not create. Say the word and I will clean up the 36 from my session, or all 70.

---

## 7. Frontend

- **Bundle:** unchanged this wave — the previous wave already lazy-loaded `html2pdf` and trimmed the precache (8,942 KB → 2,836 KB). Re-audited: admin routes are all lazy via `lazyWithReload`, and `vendor-charts` (382 KB) / `RichTextEditor` (480 KB) sit behind their own routes. Nothing new worth moving. No changes made for bundle numbers alone.
- **Realtime / caching / polling:** rebuilt per §3. The wallet page's refresh policy is now:

  | Trigger | Before | After |
  |---|---|---|
  | Realtime event | immediate, unfiltered, per-event | coalesced + workspace-scoped |
  | 30 s interval | always | **only while realtime is unhealthy** |
  | Window focus | always refetch | refetch **only if > 20 s stale** |
  | Visibility change | always refetch | refetch **only if > 20 s stale** |
  | Realtime reconnect | — | one re-sync if stale (realtime does not backfill) |

  **This is not less fresh in the normal case:** realtime fires on the very row changes the poll existed to catch, and it fires sooner. The poll survives precisely as the safety net for when realtime is down.
- **Skeletons / progressive rendering:** preserved unchanged from the previous wave and explicitly not regressed — per-section commits, no full-page skeleton, background refreshes stay silent (`silent: true`), loading and empty states remain distinct.

---

## 8. Security / Financial Verification

Explicitly, for each area the brief names:

| Area | Changed? |
|---|---|
| Authorization | **No.** No capability, membership or ownership check was touched. |
| Workspace isolation | **No weakening.** The realtime scope check only *suppresses refetches*; it grants nothing. RLS and `workspaceContext` remain the actual gates. The audit **found** an isolation-adjacent gap (§3) and reported rather than papered over it. |
| Wallet calculations | **No.** `fetchAllRows` changes the row *set*, not the arithmetic. |
| Contribution calculations | **No.** |
| Withdrawal logic | **No.** Only *display* bucketing and *counting* changed; no state machine, no authorization, no amounts. |
| Payment logic | **No.** |

Additional assurances:
- No financial value is cached; no balance is served stale. The one realtime suppression path cannot hide a money event affecting the workspace on screen — that is the fail-open rule, with 21 tests behind it.
- Nothing was computed from realtime event payloads. Realtime remains a pure invalidation signal; the backend stays authoritative for every figure.
- `owner_rejected` moving from "pending" to "failed" makes the admin console **more** truthful, not less.
- One deliberate honesty improvement: a truncated admin total is now flagged rather than silently shown as exact.

---

## 9. Tests

Exact counts, all actually run.

| Suite | Command | Result |
|---|---|---|
| Backend unit | `npm test` | **702 passed, 0 failed** |
| Backend integration (TEST) | `npm run test:integration` | see note below |
| Frontend unit | `npx vitest run` | **141 passed, 0 failed** (16 files) |
| Frontend typecheck | `tsc -p tsconfig.app.json --noEmit` | **129 errors — baseline 129. Zero new.** |
| Frontend build | `vite build` | **Success** (precache 2,836 KB) |
| Admin build | `vite build` | **Success** |
| Admin typecheck | `tsc --noEmit -p tsconfig.app.json` | **27 errors — baseline 26.** See below. |

**New tests added: 25** — `src/utils/realtimeScope.test.ts` (21) and `src/store/rapidWorkspaceSwitch.test.ts` (4). Frontend went 119 → 141 (the other +1 is a rename-free count difference in existing files).

**Backend integration — three full runs, honestly reported:**

| Run | pass | fail | skipped |
|---|---:|---:|---:|
| 1 | 116 | **1** | 64 |
| 2 | 117 | 0 | 64 |
| 3 | 115 | **2** | 64 |

All three failures were `TypeError: fetch failed` — **transport errors against live TEST Supabase, not assertion failures.** The affected file re-run in isolation passes **4/4**. I attribute this to hammering TEST with repeated full-suite runs; it is not a code regression. I am flagging it rather than quoting only the green run.

**Admin typecheck 26 → 27 (+1), explained precisely:** none of the new errors are in files I edited. Importing the new `@/lib/withdrawalStatus` module into `TransactionsPage`/`RecentTransactions` shifts TypeScript's type-instantiation ordering (the project already has `TS2589: Type instantiation is excessively deep` in `Sidebar.tsx`), which **un-masked two latent pre-existing errors in `withdrawalsStore.ts` — a file I never touched — while masking one other.** Both un-masked errors are genuine: `status: string` not narrowing to the union, and `owner_rejection_reason` missing from the generated Row type. **The latter is a useful signal in its own right: the admin's generated `src/integrations/supabase/types.ts` is stale relative to the w9/w10 migrations and should be regenerated.** I left them rather than fix 2 of that file's 8 same-class errors, which would have been an unrelated refactor.

---

## 10. Remaining Issues

### BLOCKING
*None for this wave's scope.*

### HIGH
1. **Realtime is dead for workspace ADMIN/MEMBER** (§3). The workspace collaboration feature about to be migrated has non-functional live updates for everyone who is not the collection's creator. Needs a deliberate RLS design decision + migration. **This should be settled before, or explicitly accepted as a known limitation of, the production migration.**
2. **Base64 images still in the database.** Full Phase 9 architecture assessment not completed. Detail responses still carry multi-hundred-KB rows, and `LIST_COLUMNS` must stay an allow-list until this is resolved.
3. **Admin generated Supabase types are stale** vs w9/w10 (`owner_rejection_reason` unknown to the type system). Regenerate before relying on admin type safety around withdrawals.

### MEDIUM
4. **Admin platform totals paginate client-side.** Correct now, but at large scale this pulls many rows to the browser. Proper fix is a backend admin endpoint using the existing Node financial engine — *not* new SQL.
5. **Integration suite leaks workspace fixtures** (§6). 42% of TEST workspaces are orphaned. Teardown in the two named test files needs the same FK-safe cleanup the other integration tests already do.
6. **`CollectionsPage` realtime filters on `user_id`,** so it misses workspace-mates' collection changes. Same root cause as HIGH-1.

### LOW
7. `WalletOverview.tsx` remains dead code with a `[collections]`-dependent fetch effect.
8. Production latency still unmeasured; all timings here carry ~800 ms dev round-trips to Supabase.
9. No index work possible on TEST-scale data.

---

## 11. Production Recommendation

# **GO WITH CONDITIONS**

**Why GO:** Everything changed in this wave is either a strict correctness improvement (admin status bucketing, pending KPI, payout-status set, row-cap truncation) or a strict reduction in wasted work (realtime scoping, coalescing, polling demotion). No authorization, workspace-isolation, or financial-calculation code was modified. Backend unit 702/702, frontend 141/141, both builds green, frontend typecheck at baseline, and the integration failures are demonstrably transport flakes.

**Conditions:**
1. **Decide on HIGH-1 before migrating.** Either accept "workspace collaborators get no live updates" as a documented launch limitation, or schedule the RLS widening as its own reviewed security change. Migrating without a decision means shipping a feature whose realtime half silently does not work.
2. **Regenerate the admin's Supabase types** (HIGH-3) so w9/w10 withdrawal columns are type-checked.
3. **Re-measure on production** after w1–w15. Only the payload and request-count reductions transfer directly.
4. **Fix the integration-suite fixture leak** before it makes TEST unusable as a measurement baseline.

---

## 12. Next Step

Before Wave 6.7F.8 production migration, in order:

1. **Make the RLS decision (HIGH-1).** This is the one finding that materially changes what "the workspace feature works in production" means. It is a security review, not a performance task.
2. **Regenerate admin Supabase types** — small, mechanical, removes a real type blind spot around withdrawal columns the migration is about to add.
3. **Clean up TEST fixture litter** (I can do this on your say-so — 36 rows from my runs, or all 70) so post-migration benchmarks start from a clean baseline.
4. Then proceed with w1–w15.

Items 2–4 are hours. Item 1 is the gate.
