# KOLEKTO PERFORMANCE WAVE REPORT

**Date:** 2026-08-20
**Branch:** `ghazali/fix-with-claude`
**Scope:** `kolekto-fe-old`, `kolekto-be-old`, `kolekto-admin-control-panel-1`
**Database touched:** TEST (`lpeeckqsltxohppheucz`) only, read-only + existing integration suite. **Production (`busfgcmbndleljklrcbd`) was never contacted. No migrations were written or applied. Wave 6.7F.8 was not started.**

---

## 1. Executive summary

Kolekto was not slow because of React, or Supabase, or the number of requests. It was slow because of **one endpoint returning 4.81 MB of base64 images that nothing rendered**.

`GET /collections` — called by the dashboard home store, the collections page, the wallet page and a 30-second poll — took **12.4 seconds and returned 4.81 MB** for a workspace with 20 collections. Two independent defects stacked:

1. **The response body was serialized twice.** `controllers/collection.js` ended with
   `res.json({ ...formatted, data: collections })`. `formatted` is an *array*; spreading an array into an object literal produces numeric keys `{"0": …, "1": …}`. Every collection appeared once under `data` and once under its index. Nothing ever read the numeric keys. That alone doubled 2.35 MB to 4.81 MB.
2. **`collections.banner_url` and `collections.story_images` hold base64 `data:` URIs inline in the database.** Images are not in Supabase Storage. Those two columns were 2.37 MB of a 2.35 MB row set — 99% of the payload — and **no list view in the app renders either field**.

Everything else the brief asked about was largely already right: requests were already parallel, workspace cache keys were already correct, routes were already lazy-loaded, auth already used local JWT verification. The remaining findings were smaller and are listed below.

Net result on the measured workspace: **`GET /collections` 12,434 ms → 914 ms (13.6×), 4,813 KB → 35 KB (137×)**, and a workspace switch went from **~10.9 s with nothing on screen** to **~1.7 s with the first section painting at ~0.9 s**.

---

## 2. Performance baseline

TEST project, local Express on `:3000`, median of 3 runs, warm connection, workspace `5c77db77` (20 collections). Full data in `scratchpad/BASELINE.md`.

| Endpoint | Before | Payload before |
|---|---:|---:|
| `GET /collections` | **12,434 ms** | **4,813.3 KB** |
| `GET /dashboard/stats` | 1,650 ms | 0.2 KB |
| `GET /dashboard/activities?limit=5` | 1,466 ms | 34.8 KB |
| `GET /withdrawals` | 966 ms | 27.6 KB |
| `GET /workspaces` | 698 ms | 7.0 KB |
| `GET /auth/me` | 915 ms | 2.4 KB |
| `GET /settings/profile` | 1,055 ms | 0.9 KB |

Parallel dashboard burst (the three requests a dashboard load / workspace switch fires): **10,941 / 8,986 / 19,450 ms**.

**Important calibration:** a single Supabase round-trip from this development machine costs **~800–1,000 ms**. A production backend co-located with the database will not see that. This means *round-trip count* is exaggerated in these numbers and *payload size* is not — and payload is what matters most for the actual user base on Nigerian mobile networks. I optimized accordingly and explicitly declined a round-trip optimization for this reason (§12).

---

## 3. Frontend findings

| # | Finding | Severity |
|---|---|---|
| F1 | Dashboard rendered a **full-page skeleton** until the slowest of three parallel requests returned. `if (loading) return <DashboardHomeSkeleton/>` replaced the greeting, workspace badge and shortcuts too. | P2 |
| F2 | The store applied all three responses in **one `set()` after `Promise.all`** — parallel fetching, serial rendering. | P2 |
| F3 | **Every dashboard request fired twice on first login.** With no persisted selection `activeWorkspaceId` starts `null`; the dashboard fires immediately (header-less → backend resolves personal workspace), then `fetchWorkspaces` resolves, `null → id` counted as a "switch", all stores were wiped and everything refetched. | P1 |
| F4 | `CollectionDetailsPage` **double-fetched on mount**: the mount effect fired `loadContributions`/`loadBalanceStats`, then the realtime `SUBSCRIBED` callback fired them again microseconds later. | P1 |
| F5 | `PaymentSuccessful.tsx` **statically imported `html2pdf.js`** — a 776 KB (235 KB gzip) chunk, the largest in the build — into the *public contributor* payment path. | P1 |
| F6 | Service worker precached **170 entries / 8.94 MB**, over half of it landing-page artwork (`featuresImage.png` 2.40 MB, `kolekto-on-campus.png` 1.86 MB, four hero avatars ~0.92 MB) that a signed-in organizer never renders. | P2 |
| F7 | No in-app way to see request timings; both headline defects were invisible from inside the app and needed an out-of-band benchmark to find. | P2 |
| F8 | `WalletOverview.tsx` calls `/dashboard/stats` independently with `[collections]` as its effect dependency — but it is **mounted nowhere**. Dead component. | P3, not fixed |
| F9 | Realtime subscriptions on `contributions` / `wallets` / `withdrawals` are **unfiltered**, so any user's row change anywhere triggers a forced refetch for every connected client. | P1, **not fixed** — see §12 |

Verified as *already correct*, no change needed: workspace-scoped cache keys in every store, stale-in-flight response guards, `inFlight` request de-duplication, route-level lazy loading, local-JWT auth (no per-request GoTrue call).

---

## 4. Backend findings

| # | Finding | Severity |
|---|---|---|
| B1 | `getUserCollections` **spread an array into the response object**, serializing every collection twice. The duplicate was also *wrong*: it set `price_tiers` from `collection.pricing_tiers`, which is not a column, so tiered collections' tiers were `[]` in that copy. | P1 |
| B2 | The collections **list** query selected `*`, pulling the two base64 image columns. | P1 |
| B3 | `GET /dashboard/activities` **ignored `?limit`**. The frontend has always sent `?limit=5`; the controller read 100 contributions *and* 100 withdrawals, merged, sorted and sliced to 100, to render five rows. | P1 |
| B4 | `workspaceContext` middleware costs one membership round-trip per request; three parallel dashboard requests do three identical lookups. | P2, **not fixed** — see §12 |

Verified as already correct: `/dashboard/stats` and `/dashboard/activities` already `Promise.all` their contribution/withdrawal reads; `collectionScopeService` is a single clean scope seam; capability gating happens *at the query* so unauthorized money is never read.

---

## 5. Database findings

- **No N+1 queries found.** The scope-service pattern reads collection ids once and then uses `.in(...)`.
- **No missing index was demonstrable.** TEST holds 89 collections / 199 contributions / 43 withdrawals — far too small for index choice to be measurable. Proposing indexes off this data would be guesswork, and the brief says not to create indexes blindly. **No index migrations are proposed.** The workspace-scoped patterns (`workspace_id`, `workspace_id + status`, `collection_id`, `created_at DESC`) should be re-examined against production row counts and `pg_stat_statements` after the w1–w15 migration lands.
- **The real database-shaped problem is the schema, not the queries:** images are stored as base64 in `collections.banner_url` / `story_images`. Moving them to Supabase Storage would shrink the rows themselves and remove the need for the column allow-list added in this wave. That needs a migration plus backfill — correctly out of scope here.
- **Admin panel (correctness, not performance):** `dashboardStore.ts` sums *all* paid contributions and *all* wallet balances client-side with no pagination. Supabase caps unpaginated reads at 1,000 rows, so **these totals will silently under-report once either table exceeds 1,000 rows.** Not fixed — the correct fix is a server-side aggregate RPC, i.e. a migration. Flagged as the highest-priority admin follow-up.

---

## 6. Workspace-switch analysis

The request *graph* was already parallel. What changed is payload, duplicate rounds, and when pixels appear.

### BEFORE
```
workspace switch (click)
      │
      ├─ activeWorkspaceId set              ← instant (already fine)
      ├─ all workspace stores wiped
      ├─ page replaced by FULL-PAGE SKELETON
      │
      ├──┬─ GET /dashboard/stats            1,650 ms      0.2 KB
      │  ├─ GET /collections               12,434 ms  4,813.3 KB  ← the wall
      │  └─ GET /dashboard/activities       1,466 ms     34.8 KB
      │
      └─ ALL THREE held, applied in ONE set() after Promise.all
         → nothing on screen for ~10.9 s, then everything at once
```

### AFTER
```
workspace switch (click)
      │
      ├─ activeWorkspaceId set + toast "Switched to <name>"   ← < 100 ms
      ├─ page SHELL, greeting, badge, shortcuts STAY ON SCREEN
      ├─ only data-backed sections show skeletons
      │
      ├──┬─ GET /dashboard/stats            ~1,000 ms   0.2 KB ─→ balances paint
      │  ├─ GET /collections                  ~914 ms  35.1 KB ─→ cards paint
      │  └─ GET /dashboard/activities         ~900 ms   2.1 KB ─→ feed paints
      │
      └─ each commits its OWN slice on arrival (workspace re-checked per commit)
         → first section at ~0.9 s, fully settled ~1.7 s
```

On first login the `null → personal-workspace` settle no longer counts as a switch, removing an entire duplicate round of all three requests.

---

## 7. Changes made

### `kolekto-be-old`
| File | Change |
|---|---|
| `controllers/collection.js` | Removed the `{ ...formatted, data }` array-into-object spread. Returns `{ data: collections }`. Halves every collections response. |
| `repositories/collectionScopeRepository.js` | Added `LIST_COLUMNS` allow-list excluding `banner_url` / `story_images`; the **list** query uses it, the **detail** query deliberately keeps `*` (the edit and share dialogs need the banner). Exported `__listProjectionContract` for testing. |
| `controllers/dashboard.js` | `collectionActivities` now honours `?limit`, clamped to 100. Each source query is capped at `limit` (not `limit/2` — the merge picks the true top N across both sources). |
| `tests/collectionListProjection.test.js` | **New.** Six tests pinning: image columns absent from the list, FE-consumed columns present, list uses `LIST_COLUMNS`, detail keeps `*`, no array spread in the response, `?limit` honoured and clamped. |

### `kolekto-fe-old`
| File | Change |
|---|---|
| `store/workspaceInvalidation.ts` | Added the narrow `null → personal workspace` bootstrap exemption. Every other transition still resets; fails closed when the workspace list is unloaded. |
| `store/workspaceInvalidation.test.ts` | **+5 tests** pinning both sides of that exemption (personal skips, non-personal wipes, unloaded list wipes, real switch still wipes, sign-out still wipes). |
| `store/useDashboardHomeStore.ts` | Progressive commit: `statsLoading` / `collectionsLoading` / `activitiesLoading`; each request commits its own slice on arrival. Stale-workspace guard moved *inside* each commit point. Activities no longer wait on `/collections` for titles (the backend already labels every row). |
| `pages/dashboard/DashboardPage.tsx` | Removed the full-page skeleton early-return. Added `StatValue`, `CollectionCardsSkeleton`, `ActivityRowsSkeleton` sized to their content. Loading and empty states are now distinguishable — "No contributions yet" no longer shows while the feed is still loading. |
| `components/workspace/WorkspaceSwitcher.tsx` | `handleSelect` gives immediate named acknowledgement ("Switched to X"); re-selecting the active workspace is a silent no-op. |
| `pages/dashboard/CollectionDetailsPage.tsx` | First realtime `SUBSCRIBED` no longer refetches what the mount effect just fetched; every *re*-subscribe still does (the socket-drop gap it exists for). |
| `components/contribute/PaymentSuccessful.tsx` | `html2pdf.js` moved to a dynamic import inside the handler, matching the pattern already used in `CollectionDetailsPage`. Also now catches chunk-load failure. |
| `utils/requestTiming.ts` | **New.** Dev-only tracing: `window.kolektoRequestTimings()` prints per-request timing + a per-endpoint call-count summary. No bodies, no headers, query strings stripped, disabled in production. |
| `utils/axios.tsx` | Interceptor hooks for the above. |
| `vite.config.ts` | `globIgnores` excluding landing-page artwork and the PDF/canvas vendor chunks from the SW precache. Images still hit the existing `CacheFirst` runtime rule. |

### `kolekto-admin-control-panel-1`
**No code changes.** Audited: routes already lazy-loaded via `lazyWithReload`, vendor chunks already split (charts 382 KB, RichTextEditor 480 KB, both behind their own routes), collections store already uses a lean projection, dashboard already runs its 16 queries via `allSettled`. The one real issue found is a *correctness* bug requiring a migration (§5) and is reported, not patched.

---

## 8. Performance measurements

All measured, none estimated. Median of 3, same machine, same TEST workspace, before and after.

| Operation | Before | After | Change |
|---|---:|---:|---|
| `GET /collections` | 12,434 ms | **914 ms** | **13.6× faster** |
| `GET /collections` payload | 4,813.3 KB | **35.1 KB** | **137× smaller** |
| `GET /dashboard/activities?limit=5` | 1,466 ms | 1,346 ms | 1.1× |
| `GET /dashboard/activities` payload | 34.8 KB | **2.1 KB** | **16.6× smaller** |
| `GET /workspaces` | 698 ms | 466 ms | 1.5× |
| `GET /dashboard/stats` | 1,650 ms | 1,415 ms | 1.2× |
| Dashboard burst (3 parallel) | 10,941 / 8,986 / 19,450 ms | **2,261 / 1,613 / 1,482 ms** | **~6× faster** |
| Workspace switch, total | ~10.9 s | **~1.7 s** | **6.4× faster** |
| Workspace switch, **time to first section on screen** | ~10.9 s (nothing until all done) | **~0.9 s** | **12× faster** |
| Workspace switch, total payload | ~4.9 MB | **37.4 KB** | **131× smaller** |
| PWA precache | 8,942 KB (170 entries) | **2,835 KB (162 entries)** | **−68%** |
| Payment-success path static JS | included html2pdf (776 KB / 235 KB gz) | on demand only | **−235 KB gz** |

Verified structurally, not just by timing: the built `paymentCallback` chunk statically imported `html2pdf-*.js` before and does not after.

### Against the brief's budgets (§30)
| Target | Status |
|---|---|
| Workspace switch acknowledgement < 100 ms | **Met** — synchronous store write + toast, no network in the path |
| Workspace data begins appearing < 500 ms | **Not met on this machine** (~900 ms) — floor is the ~800 ms dev round-trip to Supabase, not app code. Plausible in production; must be re-measured there |
| Dashboard usable ~1–2 s | **Met** (~1.7 s) even with the inflated dev round-trip |
| No blank screen for seconds on switch | **Met** — shell persists, sections skeleton independently |

---

## 9. UX improvements

- **The page shell never disappears.** Greeting, workspace badge, action buttons and the create-collection shortcuts stay mounted through a switch. Previously all of it was replaced by a skeleton.
- **Section-level skeletons**, each sized to the content it replaces, so nothing shifts when data lands.
- **Progressive rendering** — balances, collection cards and the activity feed appear independently as each request returns.
- **Named acknowledgement on switch** — "Switched to *Kolekto Business*" with "Loading this workspace's collections, wallet and activity…". This describes a local state change that has already happened; it makes no claim about a server call.
- **Loading and empty are no longer confused.** The activity feed previously rendered "No contributions yet" while still loading — telling a user something false about their own money.
- **Silent no-op on re-selecting the active workspace** — no toast for a switch that did not occur.
- **Background refreshes stay quiet.** A silent/forced refresh keeps current values on screen instead of flashing skeletons over data the user is reading.

---

## 10. Security verification

A 19-check verification script was run against the live backend on TEST with real minted tokens, exercising an OWNER workspace and a MEMBER workspace for the same user. **All 19 passed.**

- **Workspace isolation** — no collection appears in both workspaces; every returned row carries the requested `workspace_id`.
- **Forged / foreign workspace ids** — a workspace the caller is not a member of returns **404**, not a silent downgrade; a garbage UUID returns **404**; no token returns **401**.
- **Financial redaction by capability** — OWNER receives the `wallets` embed and contribution amounts and balance figures; MEMBER receives **no `wallets` key at all**, **no `amount` on contribution rows**, and a **money-free `/dashboard/stats`**. Redaction still happens at the query, so unauthorized money is never read from the database.
- **Response shape** — `GET /collections` now returns exactly one key, `data`.
- **Projection** — image columns absent from list rows, present on the detail row.

**Nothing in this wave touched an authorization path.** No capability check, membership check, ownership check or financial computation was modified, weakened, or bypassed. The two client-side changes that could conceivably affect correctness are both narrowed and tested:

- The `null → personal` invalidation exemption is sound because those requests were sent *without* `X-Workspace-Id`, so the backend had already scoped them to exactly that personal workspace. It fails closed on an unloaded workspace list, and every other transition still resets.
- Splitting one commit into three made the stale-workspace guard *more* frequent, not less: it is now re-evaluated at each of the three commit points instead of once at the end.

No financial value is cached, no balance is displayed stale, no error is suppressed, and no request was cancelled to improve a number.

---

## 11. Tests

Every result below was produced by an actual run.

| Suite | Command | Result |
|---|---|---|
| Backend unit | `npm test` | **702 passed, 0 failed** |
| Backend integration (TEST Supabase) | `npm run test:integration` | **117 passed, 0 failed, 64 skipped** (181 total) |
| Frontend unit | `npx vitest run` | **119 passed, 0 failed** (14 files) |
| Frontend typecheck | `tsc -p tsconfig.app.json --noEmit` | **129 errors — down from a 130-error baseline. Zero new.** |
| Frontend build | `vite build` | **Success** |
| Admin build | `vite build` | **Success** |

- New tests added: **6** backend (`collectionListProjection.test.js`), **5** frontend (`workspaceInvalidation.test.ts`).
- The 129 TypeScript errors are **pre-existing** and unrelated — verified by stashing all changes and re-running (identical errors, different line numbers). The count dropped by one because a now-unused variable was removed.
- **Post-run data check:** TEST row counts are unchanged from baseline (collections 89, contributions 199, withdrawals 43, workspaces 129, workspace_members 155). Integration teardown left no orphans. `notifications` rose 99 → 103, which is expected test-generated activity.
- Frontend lint was not run: `eslint .` is not currently usable in this repo without pre-existing noise unrelated to this wave.

### Workspace-switch matrix (§37)
Exercised A → B → A alternating, for the same user holding **OWNER** in one workspace and **MEMBER** in another. Correct data appeared, no previous-workspace data leaked (§10 check 1), requests ran concurrently, and payloads were correctly capability-redacted per role. **ADMIN was not exercised** — no ADMIN membership exists on TEST for the benchmark user. That gap is stated rather than papered over; the capability derivation is shared code covered by the backend suite, but the end-to-end ADMIN switch is untested here.

---

## 12. Remaining bottlenecks

Honest list of what is still slow or unresolved.

1. **Base64 images in the database (root cause, not fixed).** `banner_url` / `story_images` still hold inline `data:` URIs. This wave stopped *shipping* them where they are not needed; it did not remove them. Until images move to Supabase Storage, the detail endpoint still returns multi-hundred-KB rows, and the list projection must stay an allow-list — a new column will not appear in list responses until added to `LIST_COLUMNS` (the new test guards this).
2. **Unfiltered realtime subscriptions (F9) — deliberately not fixed.** `DashboardPage` and `TransactionHistoryPage` subscribe to `contributions` / `wallets` / `withdrawals` with **no filter**, so any row change anywhere triggers a forced refetch for every connected client. This is a genuine scalability problem. I did not change it because getting the filter wrong would stop organizers from seeing live payment updates — a worse failure than the cost. The 137× payload reduction defuses the blast radius for now. **Recommend a dedicated follow-up** to scope these channels to in-workspace collection ids and confirm RLS coverage on the realtime publication.
3. **Per-request workspace membership lookup (B4) — deliberately not fixed.** One DB round-trip per request, three per dashboard load. A short-TTL cache would save ~450 ms *on this machine*, but that number is an artifact of dev-machine latency; in a co-located production backend the same lookup is likely ~15 ms. Caching positive membership would also introduce a revocation lag on a security-relevant check. Not worth it on current evidence — **re-measure in production before considering**.
4. **Admin totals silently truncate above 1,000 rows** (§5). Correctness, not performance. Needs an aggregate RPC.
5. **Wallet page polls every 30 s plus on focus plus on visibility change**, each a forced `/collections` refetch. Far cheaper now (35 KB vs 4.8 MB) but still more aggressive than necessary.
6. **`WalletOverview.tsx` is dead code** with a `[collections]`-dependent fetch effect. It has an existing test and staged changes from a prior wave, so removing it was out of scope.
7. **Production numbers are unknown.** Every measurement here is from a development machine with ~800 ms Supabase round-trips. The payload wins will hold or improve in production; the latency figures will not transfer directly.
8. **No index work was done**, by design — TEST is too small to justify any index, and guessing was explicitly out of bounds.

---

## 13. Production readiness

# **GO**

For the performance wave itself.

**Why:**
- The dominant defect is fixed and measured: 13.6× faster, 137× smaller on the endpoint that dominated every screen.
- Both root causes were genuine bugs — a duplicated response body and a payload of images nothing renders — not tradeoffs. One of them (`price_tiers` from a non-existent column) was also silently wrong.
- All test suites pass with zero new failures and zero new type errors, verified against a stashed baseline.
- Workspace isolation and financial redaction were re-verified end-to-end against a live backend across two roles: 19/19 checks pass.
- No authorization, capability, membership or financial code path was modified.
- Changes are small and reversible; each is covered by a new test pinning the contract.

**Conditions:**
- Re-measure on production after the w1–w15 migration. The latency figures here are dev-machine figures; only the payload reductions transfer directly.
- Treat the unfiltered realtime subscriptions (§12.2) as the next performance item — it is the one remaining finding with real scale risk.
- The `LIST_COLUMNS` allow-list needs a line whenever a column is added to `collections`. The new test fails loudly if a FE-consumed column goes missing, but a reviewer should know the constraint exists.

**Explicitly not done, as instructed:** no production database contact, no migrations authored or applied, Wave 6.7F.8 not started.
