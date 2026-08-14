# KOLEKTO WORKSPACE — WAVE 2: AUTHORIZATION HARDENING + COLLECTION WORKSPACE BINDING

**Date:** 2026-08-13 · **Scope:** `kolekto-fe-old`, `kolekto-be-old` (branch `ghazali/fix-with-claude` in both). `kolekto-admin-control-panel-1` inspected read-only in Phase 1 (git state only — clean, no workspace code, out of scope otherwise).
**Database:** all inspection and verification against TEST (`lpeeckqsltxohppheucz`) only, read-only. Production (`busfgcmbndleljklrcbd`) was **never queried in this wave** — not even read-only.
**Companion document:** `KOLEKTO_WORKSPACE_2.0_ARCHITECTURE_AUDIT.md` (Wave 1). This wave executes that document's §19 "Wave 2" and the mandatory §19 "Wave 3" equivalence harness (numbered "Wave 2" here per this task's own brief — same work, different label).
**Not committed, not pushed.** All changes are in the working tree only, per instruction.

---

## 1. Executive summary

Every hypothesis the task brief asked this wave to test came back the same way: **real but already well-mitigated.** The uncommitted removal of `requireCapability`/`canCreateCollection` from `workspaceAuthorizationService.js` is confirmed dead-code cleanup, not a regression — zero call sites, 100% of workspace routes still enforced via the service layer, 536/536 backend tests green with the diff applied. The frontend wizard's implicit dependency on the axios interceptor for workspace context is real and has now been closed: the wizard passes its workspace id explicitly, and the interceptor no longer silently overwrites an explicitly-set header. The `user_id`/`workspace_id` equivalence invariant holds with zero drift on TEST (72/72 collections, re-verified live before and after this wave's changes). A 12-scenario equivalence harness (task brief's lettered list A–J plus a full cross-product matrix) now exists and is wired into the backend's regular test run.

One finding fell outside this wave's stated scope but is important enough to report prominently rather than bury: the unauthenticated public collection-detail route (`GET /collection`, backing the contribute page) queries the raw `collections` table with `select('*')` using the **service-role client**, which bypasses RLS entirely — so it returns `user_id`, `workspace_id`, `rejection_reason`, `next_contributor_number`, `code_prefix`, and other internal columns to any unauthenticated caller who knows a collection id or slug. This is the same class of exposure the Wave 1 audit found already fixed at the RLS layer (`public_collection_view` + removal of `collections_public_read`) — but this particular Express route never queries that view, and service-role access bypasses RLS regardless. **Not fixed in this wave** (out of the stated "workspace authorization hardening" scope, and the task brief explicitly says not to silently repair findings) — flagged for a separate, deliberate fix. See §6 and §17.

**No production access. No TEST database writes. No migrations. Financial totals unchanged (Δ=0, re-verified). No multi-member functionality was built.**

---

## 2. Git state — before and after

### Before (start of this wave)

| Repo | Branch | Relative to origin | Uncommitted changes |
|---|---|---|---|
| `kolekto-fe-old` | `ghazali/fix-with-claude` | 1 commit ahead | Wave 1 audit artifacts (docs) + pre-existing unrelated `useAuthStore.ts` fix + stray Next.js/Supabase-SSR file removals (all pre-dating this wave) |
| `kolekto-be-old` | `ghazali/fix-with-claude` | 1 commit ahead | `CLAUDE.md` (Workspace status section) + `services/workspaceAuthorizationService.js` (the `requireCapability`/`canCreateCollection` removal) — **this is the change Phase 1 was tasked with investigating** |
| `kolekto-admin-control-panel-1` | `ghazali/fix-with-claude` | up to date, clean | none |

### After (this wave's additions, on top of the above — nothing from before was reverted)

| Repo | New/changed this wave |
|---|---|
| `kolekto-fe-old` | `src/utils/axios.tsx` (interceptor fix), `src/store/useCollectionStore.ts` (explicit `workspaceId` param), `src/components/collections/wizard/CreateCollectionWizard.tsx` (wires the active workspace explicitly), `src/store/useCollectionStore.test.ts` (+2 tests), **new** `src/utils/axios.test.ts` (+3 tests). Plus `KOLEKTO_WORKSPACE_2.0_ARCHITECTURE_AUDIT.md` and this document (both new, from Wave 1 and this wave respectively). |
| `kolekto-be-old` | `services/workspaceAuthorizationService.js` (added a documentation block recording the Wave 2 authorization-architecture decision — see §7 — no behavioral change), **new** `tests/workspaceEquivalenceHarness.test.js` (+12 tests). |

Nothing was committed. `git status`/`git diff --stat` for both repos is reproduced in full in §3.

---

## 3. Exact files changed (this wave only)

```
kolekto-fe-old:
 M src/components/collections/wizard/CreateCollectionWizard.tsx  |  8 ++-
 M src/store/useCollectionStore.test.ts                          | 35 ++++++++++++
 M src/store/useCollectionStore.ts                                | 30 +++++++++--
 M src/utils/axios.tsx                                            |  9 +++-
?? src/utils/axios.test.ts

kolekto-be-old:
 M services/workspaceAuthorizationService.js  | +14 lines (comment only)
?? tests/workspaceEquivalenceHarness.test.js
```

(Full pre-existing diffs from before this wave — `CLAUDE.md` in both repos, the doc supersession banners, the stray file cleanup, `useAuthStore.ts` — are unchanged from Wave 1 and are not re-described here; see the companion audit document.)

---

## 4. Authorization architecture found

**Capability-based, centralized, service-layer-only.** `services/workspaceAuthorizationService.js` is the single place `membership.role` is interpreted; every call site asks for a capability (`workspace:read/update/members.manage`, `collection:create/read/update/delete`, `transaction:read`, `withdrawal:create/approve`, `reports:read`). `assertCapability` returns 404 (not 403) for non-members, deliberately, to avoid confirming a workspace's existence to an outsider.

**Confirmed: zero route in this codebase bypasses the service layer for workspace-touching operations.** `controllers/workspace.js`'s four controllers all delegate immediately to `workspaceService` methods, which call `authz.assertCapability` internally. `controllers/collection.js`'s `createCollection` delegates to `collectionService.create`, which calls `workspaceService.resolveWorkspaceForWrite`, which calls `authz.assertCapability` when an explicit id is supplied. There is no controller anywhere that touches `workspace_id` or a workspace-scoped resource without going through one of these two services.

---

## 5. Capability-middleware finding and resolution

**Finding:** the uncommitted diff on `services/workspaceAuthorizationService.js` removes two exports: `requireCapability(capability)` (a generic Express-middleware factory for route-level gating) and `canCreateCollection(userId, workspaceId)` (a convenience wrapper). Both existed in the last commit (`0f7a80f`), both were removed in the uncommitted working-tree change.

**Investigation (repo-wide grep, both names):**
- `requireCapability` — zero references anywhere else in `kolekto-be-old`, before or after the diff. No route ever imported it.
- `canCreateCollection` — 5 files matched the name, but four of them (`services/collectionService.js`, `services/featureAccessService.js`, `tests/featureAccessService.test.js`, `controllers/collectionTransfer.js`) import a **completely different, unrelated function of the same name** from `featureAccessService.js` — the KYC creation-limit gate, nothing to do with workspaces. The fifth match, `database/g2_structural_write_guards.sql`, is a comment mentioning the KYC function by name, not a code reference to the workspace one. **Zero call sites reference `workspaceAuthorizationService`'s `canCreateCollection` or `requireCapability`, before or after the diff.**
- The full backend test suite (536 tests, including the 27 pre-existing workspace tests) passes identically with the diff applied.

**Resolution: this is confirmed dead-code cleanup, not a regression, not a security downgrade.** It was left in the working tree exactly as found — not restored, not further modified. A documentation block was added to the top of `workspaceAuthorizationService.js` (§7) recording this as a deliberate architectural decision — service-layer enforcement is the single authoritative model for as long as every route continues to go through it — so a future engineer doesn't wonder whether the removal was accidental.

---

## 6. Collection authorization paths audited

| Path | Route | Auth middleware | Workspace resolution | Membership/capability check | Handler | user_id used | workspace_id used | Fallback behavior |
|---|---|---|---|---|---|---|---|---|
| **Create collection** | `POST /create-collection` | `verifyToken` + `requireVerifiedOrganizer("create_collection")` | Yes — `X-Workspace-Id` header → `collectionService.resolveWorkspaceId` → `workspaceService.resolveWorkspaceForWrite` | Yes — `assertCapability(collection:create)`, **only when an explicit id is supplied** | `collectionService.create` (service layer) | Authoritative on every insert | Stamped, nullable, additive | Explicit id + failed check → **fatal** (404/403, no fallback). No id + resolution failure → swallowed to `null`, logged, creation still succeeds |
| **Edit collection** (title/description/etc.) | `PUT /collections/update/:id` | `verifyToken` only | **None** | **None** — plain `existing.user_id !== requestingUserId` check inline in the controller | `controllers/collection.js::editCollection` (direct `supabase.from()`, bypasses the service layer entirely) | Sole authorization mechanism | Never referenced | N/A |
| **Status change** (pause/close/publish) | `PUT /collections/status/:id` | `verifyToken` + `requireVerifiedOrganizer("publish_collection")` | **None** | **None** — same inline `user_id` check | `controllers/collection.js::updateCollectionStatus` (direct `supabase.from()`) | Sole authorization mechanism | Never referenced | N/A |
| **List own collections** (dashboard) | `GET /collections` | `verifyToken` | **None** | **None** | `controllers/collection.js::getUserCollections` (direct `supabase.from()`, `.eq('user_id', ...)`) | Sole scoping mechanism | Never referenced | N/A |
| **Public collection detail** (contribute page) | `GET /collection` | **None — intentionally unauthenticated**, backs the public contribution page | **None** | **None** | `controllers/contribution.js::getSingleCollection` (direct `supabase.from()` — **service-role client**, `select('*')` on the raw `collections` table) | Not used for authz (route is public by design) | Never referenced | **See §17 — this is the finding flagged out of scope** |
| **List contributions** | `GET /contributions` | `verifyToken` | **None** | **None** — scoped via owned-collection-ids + `collection_access_grants` (a separate, older, collection-level sharing feature), computed inline | `controllers/contribution.js::getContributions` (direct `supabase.from()`) | Sole scoping mechanism | Never referenced | Explicit `collectionId` not in caller's visible set → 403 |
| **Create contribution** (public payment intake) | `POST /contributions/:id` | **None — public**, this is the payment entry point | **None** | **None** | `controllers/contribution.js::createContribution` | N/A (organizer identity irrelevant to a contributor) | Never referenced | N/A |
| **Request withdrawal** | `POST /withdrawal/request` | `verifyToken` + `requireVerifiedOrganizer("withdraw")` | **None** | **None** — `collection.user_id !== userId` check (`controllers/withdrawal.js:515`) | `controllers/withdrawal.js::requestWithdrawal` (direct `supabase.from()`) | Sole authorization mechanism | Never referenced | N/A |
| **Approve/reject withdrawal** | `POST /withdrawal/approve`\|`/reject` | `verifyToken` + `requireSuperAdmin` | **None** | Platform-admin only (`admin_users` table, separate system) | `controllers/withdrawal.js` | Not applicable — admin acts on another user's request by design | Never referenced | N/A |

**What this table proves:** exactly one path — collection **creation** — is workspace-aware, in either direction (writing `workspace_id`, or checking a capability). Every other collection/contribution/withdrawal read and write, including edit, status change, and withdrawal request/approval, is **pure `user_id` ownership**, unchanged, with zero reference to `workspace_id` or the capability system anywhere in the call chain. This matches — and sharpens with file:line precision — the Wave 1 audit's finding that `workspace_id` is "additive/inert... read nowhere for authorization." It is not a regression introduced by this wave; it is the pre-existing, by-design state, now fully traced rather than inferred.

---

## 7. Changes made

### 7a. Backend — documentation only, no behavior change

`services/workspaceAuthorizationService.js`: added a comment block (no code change) recording the Wave 2 decision from §5 — service-layer enforcement is the single authoritative model; route-level middleware should be rebuilt only when a route is added that bypasses the service layer, or when member/invite routes arrive and defense-in-depth becomes worth the complexity.

### 7b. Frontend — eliminating the implicit workspace-context side channel

The task brief's core hypothesis (a Phase-3/4-style concern) was that collection creation depends on an implicit, out-of-band mechanism for its workspace context rather than an explicit one. Investigation confirmed this precisely: the axios request interceptor (`src/utils/axios.tsx`) reads the active workspace id from `localStorage` and attaches it as `X-Workspace-Id` to every outgoing request — a global side effect the wizard has no visibility into or control over.

Two changes close this gap **without changing the wire contract** (the header-based `X-Workspace-Id` design, and the backend's "explicit id → fatal on failure, implicit → swallowed" asymmetry, were both found sound in Wave 1 and are preserved exactly):

1. **`src/utils/axios.tsx`** — the interceptor now only attaches its localStorage-derived header when the caller hasn't already set one (`!config.headers["X-Workspace-Id"]`). Previously it attached unconditionally, which meant an explicit per-call header would have been **silently overwritten a moment later** — making "pass it explicitly" ineffective in practice even if a caller tried. This is the one-line root fix that makes everything else in this section actually work.

2. **`src/store/useCollectionStore.ts`** — `createCollection` gained an optional second parameter, `workspaceId`. When supplied, it is sent as an explicit `X-Workspace-Id` header on that specific Express request, instead of relying solely on the interceptor. When omitted, behavior is byte-identical to before (verified — see the "backwards compatible" test in §8). The legacy Edge Function path (`supabase.functions.invoke`) is documented as unaffected: it has zero workspace awareness server-side (confirmed: no `workspace` reference anywhere in `supabase/functions/create-collection/index.ts`), so passing an id there would be a no-op. That path is a demoted backstop, not the default (`getCreateCollectionPath()` hard-defaults to `"express"`); fixing the Edge function itself is a larger, separate change, explicitly out of scope here.

3. **`src/components/collections/wizard/CreateCollectionWizard.tsx`** — now reads `activeWorkspaceId` from `useWorkspaceStore` and passes it explicitly to `createCollection`. The wizard's own call site now states which workspace it's creating into; it no longer depends on the wizard being unaware of workspace context.

**What this does and does not change:** the backend already re-verifies membership/capability on every use and already rejects (never silently downgrades) an unauthorized explicit id — that was correct before this wave and remains correct. This change makes the *frontend's* behavior deterministic and legible rather than incidentally-correct-because-nothing-has-tested-it-yet — closing exactly the "S4" risk the Wave 1 audit flagged (works today only by equivalence; would silently misattribute the moment that equivalence breaks).

---

## 8. Tests added

| File | New tests | What they prove |
|---|---|---|
| `kolekto-be-old/tests/workspaceEquivalenceHarness.test.js` (new) | 12 | The mandatory equivalence harness — task brief scenarios A–J plus one exhaustive matrix test — proving legacy ownership (`user_id === callerId`) and workspace-capability authorization agree on every tested caller×collection combination, and that every negative case (forged id, foreign id, non-member, suspended, unknown workspace, missing context) is denied identically and without existence leakage. |
| `kolekto-fe-old/src/store/useCollectionStore.test.ts` | 2 | (a) an explicit `workspaceId` is sent as `X-Workspace-Id` on the specific create request; (b) omitting it produces the exact same 2-argument `axios.post()` call as before this wave (arity-checked, not just value-checked) — proving backwards compatibility, not just new behavior. |
| `kolekto-fe-old/src/utils/axios.test.ts` (new) | 3 | The interceptor: (a) still falls back to the global active workspace when the caller sets nothing; (b) **never overwrites an explicitly-set header** — the specific regression this wave's fix targets; (c) sends no header at all when neither source has one. |

All 17 new tests exercise real production code paths (the actual `workspaceAuthorizationService`/`workspaceService`, the actual axios interceptor via its registered handler, the actual `useCollectionStore.createCollection`) — none are fakes-testing-fakes.

---

## 9. Existing tests — before and after

| Suite | Before this wave | After this wave |
|---|---|---|
| Backend (`npm test`) | 524 passing (per task brief's stated baseline) | **536 / 536 passing** (524 + 12 new) |
| Frontend (`vitest run`) | 42 passing (per task brief's stated baseline) | **47 / 47 passing** (42 + 5 new) |

No pre-existing test was modified or skipped to make this pass.

---

## 10. Build result

`npm run build` (frontend): **PASS.** Completed cleanly in ~65s, PWA precache generated (167 entries), no build errors or warnings beyond the pre-existing, unrelated "CJS build of Vite's Node API is deprecated" notice.

---

## 11. Typecheck result

**133 errors — identical count to the task brief's stated pre-existing baseline.** Verified two ways: (a) total error count via `grep -c "error TS"` on the typecheck output, both before conceptually and after this wave's changes (133 in both), and (b) the two errors that appear in a file this wave touched (`CreateCollectionWizard.tsx`, lines 275–276, `Property 'user'/'createCollection' does not exist on type '{}'`) were confirmed to be the same pre-existing untyped-Zustand-store errors that existed at the original line numbers before this wave's one-line import addition shifted them down by exactly one line — not new errors introduced by the `useWorkspaceStore` import or the `activeWorkspaceId` usage itself, which produced zero errors of their own.

---

## 12. Browser test result

**Not performed.** No Playwright (or any browser-automation tool) is installed or configured in `kolekto-fe-old` (`node_modules/.bin/playwright` absent, no `playwright` reference in `package.json`), and none is available as a tool in this environment. Per the task brief's own instruction ("Do not claim something was browser-tested unless it actually was"), this is reported honestly as not done rather than approximated. If browser verification is required before this wave is considered complete, it needs either a Playwright install + a running local backend pointed at TEST + valid TEST login credentials, none of which were provisioned for this task, or execution in an environment with browser-automation tooling available.

---

## 13. Workspace invariant result

Re-verified live against TEST, both **before** any code change in this wave and **again after**, using the exact invariant specified in the task brief's Phase 7:

```
collection.workspace_id IS NOT NULL
  AND workspace.owner_id = collection.user_id     -- for every existing collection
```

| Check | Before | After |
|---|---|---|
| Total collections | 72 | 72 |
| `workspace_id IS NULL` | 0 | 0 |
| `workspace.owner_id ≠ collection.user_id` | 0 | 0 |
| Dangling `workspace_id` reference (no matching workspace row) | 0 | 0 |

**No mismatch at any point. No STOP condition was triggered.** (Nothing in this wave could plausibly have changed this, since no DB write occurred — but per the task brief's instruction, it was verified fresh rather than assumed.)

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

**Δ = 0 across every metric, exactly as required.** This is the expected and unremarkable result of a wave that made zero database writes — captured and compared per the task brief's instruction rather than assumed.

---

## 15. Security test matrix

| Scenario (task brief §9) | Covered | Where |
|---|---|---|
| Forged workspace id (write) | ✅ | `workspaceEquivalenceHarness.test.js` (C), pre-existing `workspaceAuthorization.test.js` |
| Forged `X-Workspace-Id` header specifically | ✅ | Frontend: `axios.test.ts` proves the header can no longer be silently clobbered/confused; backend: same as above (the header ultimately becomes `requestedWorkspaceId` in the service layer, already covered) |
| Non-member | ✅ | Harness (E), pre-existing `workspaceAuthorization.test.js` |
| Suspended member | ✅ | Harness (F), pre-existing `workspaceAuthorization.test.js` |
| Wrong owner / cross-user collection access | ✅ | Harness (B), full matrix test |
| Cross-workspace collection access | ✅ | Harness (D) — foreign-but-real workspace id |
| Missing workspace context | ✅ | Harness (H) — deterministic per-caller fallback, never cross-boundary |
| Unauthorized collection creation | ✅ | Harness (C), pre-existing `collectionWorkspaceStamping.test.js` |
| Unauthorized collection **update**/**deletion** | ⚠️ **Not covered, and cannot meaningfully be** — see note below |
| No existence disclosure | ✅ | Harness (G) — unknown vs. real-foreign workspace produce identical 404s |

**Note on the "not covered" row:** collection edit, status-change, and withdrawal-request/approve are, per §6's trace table, **pure `user_id` ownership checks with zero workspace/capability involvement** — there is no workspace-authorization logic on those paths to test, because none exists. Writing a "workspace capability" test against a path that has no workspace capability check would be a hollow test. This is not a gap this wave introduced or is positioned to close: extending those paths to the capability system only becomes meaningful once a role can diverge from plain ownership (i.e., once ADMIN/MEMBER are real, per Wave 5 of the companion audit) — building that now would be exactly the multi-member-adjacent work Phase 12 of this task explicitly forbids. Recommended as an explicit line item for the wave that ships real ADMIN/MEMBER roles, not before.

---

## 16. Unresolved issues

1. **§17 below — public collection-detail route exposes internal columns via service-role bypass of RLS.** Found during this wave's Phase 2 trace, out of this wave's stated scope, not fixed. Highest-priority follow-up.
2. **Collection edit/status/withdrawal paths remain pure ownership-based**, with no capability check at all (§6, §15). Not a regression — this is the current, correct, by-design state for a single-member-per-workspace system — but it is the reason those paths have no meaningful "workspace security test" yet, and it is where the equivalence this wave proved will need to be re-extended once roles diverge from ownership.
3. **Browser verification not performed** (§12) — tooling unavailable in this environment.
4. `email_unsubscribes` / other pre-existing prod gaps noted in the companion Wave 1 audit remain unaddressed on production — explicitly out of scope for both waves.

---

## 17. Public collection-detail exposure (flagged, not fixed)

**Finding:** `GET /collection` (unauthenticated, backs the public contribute page) is handled by `controllers/contribution.js::getSingleCollection`, which runs `supabase.from('collections').select('*, wallets(id, net_payment, currency, currency_symbol)')` using `utils/client.js`'s `supabase` export — confirmed to be `serviceSupabase` (the **service-role** client, which bypasses RLS entirely; `utils/client.js:52`). Because this is a raw `select('*')` against the base `collections` table rather than the curated `public_collection_view` (which Wave 1 confirmed was built specifically to prevent this class of exposure), every unauthenticated caller who knows a collection id or slug receives the full row — including `user_id`, `workspace_id`, `rejection_reason`, `next_contributor_number`, `code_prefix`, and `support_phone_number`.

The route's own code comments show real, deliberate security work already happened here once: the wallet join used to select `available_balance`, `ledger_balance`, `pending_balance`, `gross_payment`, `withdrawn`, and `fee_breakdown`, and was trimmed down to `net_payment` only, specifically because those other fields leaked an organizer's private financial position. **That fix addressed the joined `wallets` data but not the base `collections.select('*')` it sits alongside** — the same category of problem, in the same function, only partially closed.

**Why this is flagged rather than fixed here:** it is not a workspace-authorization issue (this task's stated scope) — it is a pre-existing, independent public-data-exposure gap in a route this wave's trace happened to pass through. Fixing it means either switching this query to the same curated column list as `public_collection_view`, or querying the view itself and re-joining `wallets.net_payment` separately, which is a deliberate, scoped change of its own — not something to make as a side effect of a workspace-hardening wave, per the task brief's explicit instruction not to silently repair findings outside the stated scope. **Recommended as the next priority fix, ahead of Wave 3.**

---

## 18. Migrations created

**None.** This wave made no database schema changes and issued no `INSERT`/`UPDATE`/`DELETE`/`ALTER`/`CREATE`/`DROP` statements. All database interaction was read-only `SELECT` against TEST, for verification purposes only (Phase 7, §13, §14 of this document).

---

## 19. Whether TEST DB was modified

**No.** Confirmed by: (a) every database tool call this wave issued was a `SELECT`; (b) the financial totals and the collection/workspace invariant are byte-identical before and after (§13, §14); (c) all substantive changes this wave made are frontend/backend application code, not database state.

---

## 20. Explicit confirmation that PROD was untouched

**Confirmed.** The production Supabase project (`busfgcmbndleljklrcbd`) was **never referenced in any database tool call this wave** — every query targeted `lpeeckqsltxohppheucz` (TEST) exclusively, and project identity was the first thing verified in the companion Wave 1 audit before any database work began in this whole programme. No deployment, migration, or configuration change of any kind was made to production or to any production-adjacent system in this wave.

---

## 21. Recommendation for the next wave

1. **Fix §17 first** (public collection-detail exposure) — independent of workspace work, higher severity than anything in this wave, and now precisely diagnosed with a file:line root cause.
2. **Proceed to the companion audit's Wave 3** (equivalence-verification harness) — this wave's `workspaceEquivalenceHarness.test.js` is a strong logic-level proof but is unit-level against fakes, not a live, repeatable job against real TEST data as that wave specifies. Promoting it to a scheduled/automated live check (matching the task brief's own Phase 6 framing) is the natural next step before any invitations work begins.
3. **Do not build invitations or multi-member workspaces yet** — nothing in this wave's findings changes the companion audit's central conclusion: the equivalence this wave proved at the logic level is exactly what a second member would break, and that must be continuously verified, not just proven once, before that boundary is crossed.
4. Consider extending capability checks to collection edit/status/withdrawal-request paths (§15/§16) as part of whichever future wave first gives ADMIN/MEMBER real, assignable meaning — doing it earlier would be speculative, unused authorization surface for roles nothing can create yet.
