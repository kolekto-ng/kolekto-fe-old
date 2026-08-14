# KOLEKTO — PHASE 0.9: PUBLIC COLLECTION API SECURITY FIX

**Date:** 2026-08-13 · **Scope:** `kolekto-be-old` only (backend). No frontend code changed.
**Database:** all inspection against TEST (`lpeeckqsltxohppheucz`) only, read-only except for confirming no write occurred. Production (`busfgcmbndleljklrcbd`) was **never queried**.
**Precedes:** the finding this phase fixes was flagged (not fixed) in §17 of `KOLEKTO_WORKSPACE_WAVE2_AUTHORIZATION_HARDENING.md`.
**Not committed, not pushed, not merged, not deployed.** Working tree only.

---

## 1. Root cause

`GET /collection` (unauthenticated, backs the public contribution page) was handled by `controllers/contribution.js::getSingleCollection`, which ran:

```js
supabase
  .from('collections')
  .select(`*, wallets ( id, net_payment, currency, currency_symbol )`)
  .eq('id'|'slug', identifier)
  .single()
```

using `supabase` from `utils/client.js`, confirmed to be `serviceSupabase` — the **service-role** client, which bypasses Postgres RLS entirely (`utils/client.js:52`, `export const supabase = serviceSupabase`). Because the query was `select('*')` against the raw `collections` table, every internal column — `user_id`, `workspace_id`, `rejection_reason`, `next_contributor_number`, `code_prefix`, `support_phone_number`, and more — was returned to **any unauthenticated caller who knew a collection id or slug**, regardless of what RLS policy or database-level protection existed on the base table (service-role ignores RLS by design; it isn't a policy gap, it's a different trust boundary entirely).

This is the same class of exposure the project already fixed at the RLS layer by building `public_collection_view` and removing the old `collections_public_read` policy — but this particular Express route never queried that view, so the fix never reached it. The frontend had, independently, already worked around this correctly for its two other collection-lookup paths (UUID-based initial load and realtime refresh, both in `ContributePage.tsx`) by querying `public_collection_view` directly — this phase brings the third path (slug-based lookup, which must go through the backend) in line with the other two.

---

## 2. Exact files changed

| File | Change |
|---|---|
| `kolekto-be-old/controllers/contribution.js` | `getSingleCollection`: query source changed from `collections` (raw table, service-role, `select('*')`) to `public_collection_view`; wallet `net_payment` now fetched as a separate query (a view has no PostgREST-embeddable relationship to `wallets`) instead of an embedded join. Response shape, status codes, and identifier (id/slug) resolution logic are unchanged. |
| `kolekto-be-old/tests/publicCollectionExposure.test.js` (new) | 9 structural regression tests (see §9). |
| `kolekto-be-old/tests/productionHardening.test.js` | One pre-existing test (`M1`) updated — not weakened — because its string-slicing assumed the old function's shape (it captured source only up to the first `.limit(1)`, which used to be where the embedded wallet select also lived; it no longer is). The slice boundary was widened to the whole function; the assertions themselves (net_payment present, six wallet balance fields absent) are byte-identical to before. |

No frontend file was touched — the frontend's two `public_collection_view` code paths already existed and needed no change; only the backend's third path needed fixing.

---

## 3. Exact response fields removed from public exposure

Everything on the raw `collections` table that is **not** one of the 31 columns on `public_collection_view` — most notably:

- `user_id`
- `workspace_id`
- `rejection_reason`
- `next_contributor_number`

...plus every other internal/operational column on `collections` not in the view's SELECT list (e.g. any column added to the base table in the future is excluded by default — the view is an allowlist, not a denylist, so this protection does not erode as the schema grows).

---

## 4. Exact public fields preserved

All 31 columns of `public_collection_view`, confirmed live from TEST during this fix (`pg_get_viewdef`):

```
id, slug, created_at, title, description, banner_url, amount, currency,
currency_symbol, fee_bearer, target_amount, min_contribution, price_tiers,
status, type, collection_type, deadline, event_date, ticket_mode,
max_contributions, total_contributions, allow_multiple_quantity,
is_open_ended, unique_id_enabled, contributions_fields, code_prefix,
support_phone_number, story, story_images, campaign_summary,
campaign_category, campaign_keywords
```

Plus, from `wallets` (fetched as before, via a separate query, entirely unchanged in scope): `net_payment`, `currency`, `currency_symbol` — the same three fields the endpoint already limited itself to before this fix (a prior, separate hardening pass had already trimmed the wallet join down from six fields to these three; that scoping is untouched).

**Response shape is byte-identical:** `{ data: {...} }` on success, `{ message: "collection is full", data: {...} }` when the collection has reached `max_contributions`, `{ message: <error> }` with 404 on any lookup failure. Every field ever actually read by the one live frontend consumer of this endpoint (`ContributePage.tsx`'s slug-lookup branch — traced and confirmed the only caller; a second, dead code path in `useContributionStore.fetchCollectionById` exists but is never invoked anywhere in the codebase) is present on the view.

---

## 5. Whether `public_collection_view` was used

**Yes** — Option A from the task brief. It already existed, already contained every field required (confirmed by tracing what the frontend's other two paths, which already use it, actually render), and required no modification. This made the fix application-code-only.

---

## 6. Whether database was modified

**No.** `public_collection_view` was inspected read-only (`pg_get_viewdef`, grant listing) and used exactly as it already existed. No `CREATE`, `ALTER`, `DROP`, or any write statement was issued against it or any other TEST object. No migration file was created.

---

## 7. TEST project identity

`lpeeckqsltxohppheucz` ("Kolekto test") — the only Supabase project queried in this phase, confirmed against the known project list before any query ran (carried forward from earlier phases in this programme, re-confirmed by every query in this phase targeting that project id explicitly).

---

## 8. Confirmation production was untouched

**Confirmed.** The production project (`busfgcmbndleljklrcbd`) was not referenced in any database tool call in this phase. No deployment, migration, or configuration change was made to production or any production-adjacent system.

---

## 9. Security tests added and results

`tests/publicCollectionExposure.test.js` — 9 tests, all passing:

| Test | Proves |
|---|---|
| A. Route remains unauthenticated | `GET /collection` still has no `verifyToken`/auth middleware — the public contribution page keeps loading without a session |
| B/J. Required fields still sourced | The endpoint queries `public_collection_view`; every field `ContributePage.tsx` reads (title, description, amount, price_tiers, target_amount, contributions_fields, status, deadline, banner_url, max_contributions, total_contributions) is confirmed present on the live view |
| C-F. Internal fields structurally impossible to return | The function no longer queries the raw `collections` table anywhere; `user_id`/`workspace_id`/`rejection_reason`/`next_contributor_number` are confirmed absent from the view's live column list |
| G. `code_prefix` is documented, not accidental | Pinned as a deliberate inclusion (renders a contributor's public code prefix), distinguishing it from the forbidden columns |
| H. Private wallet fields never selected | `available_balance`, `ledger_balance`, `pending_balance`, `gross_payment`, `withdrawn`, `fee_breakdown` are absent from the function source; `net_payment` is confirmed present |
| I. Unknown/private collections still 404 | The `if (error) return res.status(404)` guard is unchanged |
| (unlettered) Deleted collections still 404 | Defense-in-depth check preserved, even though the view's own `WHERE status <> 'deleted'` now makes it structurally unreachable |
| (unlettered) Response shape unchanged | `{ data: responseData }` / `{ message: "collection is full", data: responseData }` pinned |
| (unlettered) List-consistency check | No contradiction between the required and forbidden column lists used above |

**Testing approach note:** these are structural/source assertions against the real controller, not mocks — following this codebase's own established convention for module-level-Supabase-import controllers with no dependency-injection seam (the same approach `tests/emailUnsubscribeFailClosed.test.js` documents and uses for an equivalently-shaped fix). The "required"/"forbidden" column lists these tests assert against are not guessed — they were captured live from TEST's actual `public_collection_view` definition during this fix. Refactoring the controller into an injectable shape purely to enable a different testing style would have been the "broad refactoring" the task brief explicitly ruled out.

---

## 10. Backend test result

**545 / 545 passing** (536 going into this phase + 9 new). One pre-existing test failed transiently during this fix (`productionHardening.test.js`'s `M1`, because its string-slicing assumed the old function shape) and was corrected — not weakened; see §2 — bringing the suite back to fully green.

---

## 11. Frontend test result

**47 / 47 passing**, unchanged from before this phase (no frontend file was touched).

---

## 12. Build result

`npm run build`: **PASS.** Unchanged output shape (no frontend code changed).

---

## 13. Typecheck result

**133 errors — unchanged.** This phase touched no TypeScript file.

---

## 14. Financial before/after comparison

| Metric | Before | After | Δ |
|---|---|---|---|
| Collections count | 72 | 72 | 0 |
| Contributions count | 197 | 197 | 0 |
| Contributions total | ₦50,204,804.00 | ₦50,204,804.00 | 0 |
| Withdrawals count | 30 | 30 | 0 |
| Withdrawals total | ₦559,031.00 | ₦559,031.00 | 0 |
| Wallets — available balance total | ₦49,815,548.09 | ₦49,815,548.09 | 0 |
| Wallets — ledger balance total | ₦49,815,548.09 | ₦49,815,548.09 | 0 |
| Wallets — withdrawn total | ₦388,300.00 | ₦388,300.00 | 0 |
| Wallets — pending balance total | ₦0.00 | ₦0.00 | 0 |

**Δ = 0 across every metric**, expected and confirmed — this phase made zero database writes.

---

## 15. Workspace invariant before/after

| Check | Before | After |
|---|---|---|
| Total collections | 72 | 72 |
| `workspace_id IS NULL` | 0 | 0 |
| `workspace.owner_id ≠ collection.user_id` | 0 | 0 |
| Dangling `workspace_id` reference | 0 | 0 |

**72/72 collections remain correctly workspace-bound. No drift.** This phase performed no workspace migration and touched no workspace-related code.

---

## 16. Browser verification result

**Browser verification not performed.** No Playwright (or any browser-automation tool) is installed or configured in `kolekto-fe-old`, and none is available as a tool in this environment — the same constraint noted in the Wave 2 report. Reported honestly per the task brief's instruction rather than approximated.

---

## 17. Remaining risks

- **No live network verification of the fix was run against a real HTTP request to `GET /collection`** — verification is structural (source-level) plus a live read-only check of the view's actual column definition, per this codebase's established testing convention for this class of module. A live smoke test (e.g. `curl` against a running local backend pointed at TEST, or a proper `tests/integration/*.integration.test.js` following the opt-in, env-var-gated, production-ref-refusing pattern already used elsewhere in this repo) would be a stronger, complementary check — not done here to stay within the phase's narrow scope, but a reasonable next step if this fix needs additional confidence before any future deploy.
- **The dead code path** (`useContributionStore.fetchCollectionById`, confirmed never called anywhere in the frontend) still exists and was not removed — out of scope for a narrowly-scoped security fix; flagged for a future cleanup pass, not urgent since it's unreachable.
- Production still has the original vulnerability (this phase, per instruction, touched TEST only) — the equivalent Express deployment on production presumably has the same code today, since it hasn't been fixed there. This is not new information (production was already known to lag TEST throughout this whole programme) but is restated here because this specific finding is a real, currently-exploitable public data leak wherever it's deployed unfixed.

---

## 18. Recommended next phase

1. **Deploy this fix to production** as its own explicit, reviewed, separately-authorized step — this is a genuine current data-exposure vulnerability on any environment still running the old code, and fixing TEST alone doesn't help production users.
2. Consider adding the live/integration-style smoke test noted in §17, using the repo's existing opt-in pattern (`tests/integration/`), for stronger end-to-end confidence before that production deploy.
3. Resume the Workspace programme's own next step (the equivalence-verification harness, per the Wave 1/Wave 2 reports) — this phase was a scoped detour to close a higher-severity, unrelated finding first, as recommended in Wave 2's own report.
