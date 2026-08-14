# KOLEKTO WORKSPACE 2.0 — ARCHITECTURE AUDIT

**Date:** 2026-08-13 · **Wave:** 1 (Audit only — no implementation, no migrations, no data changes)
**Status:** Supersedes `KOLEKTO_WORKSPACE_PHASE_1_IMPLEMENTATION.md`, `KOLEKTO_WORKSPACE_PHASE_1_5_AUDIT.md`, `KOLEKTO_WORKSPACE_PHASE_2_ARCHITECTURE.md` as the single current source of truth. Those three documents are not deleted — they record real design decisions and rationale that this document builds on and, where cited, quotes directly — but where they disagree with what is verified below, **this document wins.**
**Scope:** `kolekto-fe-old` (customer PWA), `kolekto-be-old` (Express API), Supabase project `lpeeckqsltxohppheucz` ("Kolekto test"). Production (`busfgcmbndleljklrcbd`, "kolekto prod") was inspected **read-only where explicitly noted**; no other production access occurred.
**Method:** every claim below is either (a) a live query against the TEST Supabase project run during this audit, (b) a file:line citation from the current working tree of `kolekto-fe-old` or `kolekto-be-old`, or (c) explicitly marked as carried forward from a prior document with its own citation. Nothing here is speculative.

**Absolute rule observed throughout:** all database inspection in this audit targeted `lpeeckqsltxohppheucz` (TEST) exclusively. Project identity was confirmed via `list_projects` before any query ran. Zero `INSERT`/`UPDATE`/`DELETE`/`ALTER`/`CREATE`/`DROP` statements were issued against either project during this audit — every database operation was a `SELECT` against `information_schema`, `pg_policies`, `pg_class`, `pg_constraint`, `pg_indexes`, or application tables.

---

## Executive summary

Workspace is **further along than the task brief assumed.** Personal-workspace tenancy is fully built, verified, and *has already been exercised end-to-end on TEST* — 69/69 users have exactly one personal workspace, all 72 collections are correctly assigned with zero cross-owner mismatches, and one real non-personal workspace already exists (created through the live UI, not seeded). Two adjacent security items the task brief describes as still-open on TEST (anonymous PII exposure on `profiles`, the overbroad public collection policy) were **found already fixed** during this audit — evidently completed after the most recent prior audit doc (`PHASE_1_5_AUDIT.md`, 2026-08-12) and before this one (2026-08-13). This report treats that as verified current state, not as something to redo.

What is *not* further along: this is still single-member-only. Every workspace in the database has exactly one member (its OWNER); no code path anywhere — DB trigger, backfill, or service — has ever inserted an ADMIN or MEMBER row. Invitations, member management, and ownership transfer are **not implemented at all**, not partially — zero tables, zero routes, zero UI. The capability-based authorization model the task brief asks for already exists and is well-designed, but its one piece of route-level reusable middleware was just removed in an uncommitted backend diff, and the frontend has a material gap: the collection-creation wizard and most collection reads are entirely unaware `workspace_id` exists, relying on an opportunistic HTTP header that a meaningful fraction of financial requests never pass through.

**GO/NO-GO for this task's remaining scope:** GO for Wave 2 (see §19), conditional on closing the gaps in §8/§9 first. Multi-member support specifically is **NO-GO** until the equivalence-verification step already designed in the superseded Phase 2 doc (§19 Wave 6 below) has run, because it is the only thing that will prove the `user_id`/`workspace_id` backfill was correct before the safety net (one-member-only) is removed.

---

## 1. Current architecture

```
auth.users ──1:1── profiles ──AFTER INSERT trigger──▶ ensure_personal_workspace()
     │                                                          │
     │                                                          ▼
     │                                              workspaces (type=personal)
     │                                                          │
     │                                              workspace_members (role=OWNER)
     │
     └── collections.user_id (NOT NULL, authoritative) ─┬─ wallets
                                                          ├─ contributions
                                                          ├─ withdrawals
                                                          └─ workspace_id (nullable, additive, write-only)
```

Three deployed surfaces sit over one Supabase project (TEST):

- **Frontend** (`kolekto-fe-old`): React 18 + Vite + TS PWA. Zustand store (`useWorkspaceStore`) + a bootstrap hook + per-user `localStorage` persistence + an axios interceptor that opportunistically attaches `X-Workspace-Id`.
- **Backend** (`kolekto-be-old`): Express. `routes/workspace.js` → thin controllers → `workspaceService.js` (rules) → `workspaceRepository.js` (only place that calls `supabase.from()`), plus a separate, centralized `workspaceAuthorizationService.js` that every capability question routes through.
- **Database**: `workspaces`, `workspace_members`, `collections.workspace_id`, one DB trigger (`ensure_personal_workspace`), RLS on all three, no invitation/transfer tables.

This mirrors the design in `KOLEKTO_WORKSPACE_PHASE_1_IMPLEMENTATION.md` §1–2 almost exactly as built — the implementation matches its own contract document, which is itself a good sign about how this branch has been run.

---

## 2. Current database state (TEST, `lpeeckqsltxohppheucz`, verified live)

### Schema

| Table | Key columns | Constraints |
|---|---|---|
| `workspaces` | `id`, `name`, `slug` (unique), `type` (CHECK: `personal\|association\|organization\|community\|event\|group`), `status` (CHECK: `active\|suspended\|archived`), `owner_id` → `auth.users` (`ON DELETE RESTRICT`), `created_by`, `description` | Partial unique index `workspaces_one_personal_per_owner` on `(owner_id) WHERE type='personal'` — DB-enforced, not app-enforced |
| `workspace_members` | `id`, `workspace_id` → `workspaces` (`ON DELETE CASCADE`), `user_id` → `auth.users` (`ON DELETE CASCADE`), `role` (CHECK: `OWNER\|ADMIN\|MEMBER`), `status` (CHECK: `active\|invited\|suspended`), `invited_by`, `joined_at` | Unique `(workspace_id, user_id)`; indexed on both FK columns |
| `collections` | + `workspace_id` (nullable) → `workspaces` (`ON DELETE RESTRICT`) | Indexed (`collections_workspace_id_idx`); `user_id` remains `NOT NULL` and unchanged |

`role`/`status` are `text` + `CHECK`, not Postgres enums — deliberate, per the migration comment, so future roles/statuses don't need a destructive `ALTER TYPE`.

### Row counts and integrity (live, 2026-08-13)

| Metric | Value |
|---|---|
| `auth.users` / `profiles` | 69 / 69 |
| `workspaces` total | 70 |
| — of which `type='personal'` | 69 |
| — of which non-personal | **1** (created through the live UI — evidence the creation flow works end-to-end, not just in tests) |
| `workspace_members` | 70 |
| `collections` total | 72 |
| `collections.workspace_id IS NOT NULL` | 72 / 72 (zero orphans) |
| `collections` where `workspace.owner_id ≠ collections.user_id` | **0** (zero cross-owner assignment) |
| Users with ≠1 personal workspace | **0** |

All of this matches the 12/12 PASS result recorded in the superseded `PHASE_1_5_AUDIT.md` §3, re-verified live rather than trusted from the doc.

### RLS (verified live via `pg_policies` + `pg_class.relrowsecurity`)

| Table | RLS enabled | Policies (all `SELECT` only) |
|---|---|---|
| `workspaces` | ✅ | `workspaces_owner_read` (`owner_id = auth.uid()`); `workspaces_member_read` (active membership EXISTS) |
| `workspace_members` | ✅ | `workspace_members_own_read` (`user_id = auth.uid()`) |
| `collections` | ✅ | own (`user_id = auth.uid()`) + admin (`is_current_user_admin()`) for all of SELECT/INSERT/UPDATE/DELETE. **No policy references `workspace_id`.** |

**No `INSERT`/`UPDATE`/`DELETE` policy exists for `authenticated` on `workspaces` or `workspace_members`.** Every write goes through the Express service-role client. This is a real, DB-enforced guarantee, not a convention — a compromised or malicious client-side JWT cannot self-grant membership, self-promote a role, or create a workspace directly against Supabase.

`anon`/`authenticated` both carry table-level `SELECT` grants on `workspaces` and `workspace_members` (standard Supabase pattern), but RLS's `auth.uid()`-based predicates return zero rows for `anon` (no session ⇒ `auth.uid()` is `NULL` ⇒ no `owner_id`/`user_id` match). Verified empirically in the prior audit (`PHASE_1_5_AUDIT.md` §7: "0 rows returned to anon" for both tables) and structurally reconfirmed here (RLS enabled + only `auth.uid()`-scoped policies exist).

### Adjacent security state — reconciled against the task brief

The task brief (§4, §6, §7) describes BUG-2 (profile PII), the public-collection over-exposure, and duplicate profile RLS policies as items already fixed on TEST. **This audit independently confirms all three are in fact fixed, as of right now:**

| Item | Task brief claim | Verified live |
|---|---|---|
| BUG-2 (anon reads all profile PII) | Fixed on TEST | ✅ `profiles` has zero `anon`-role policy and zero `anon` grant; only `authenticated`-scoped, `auth.uid()`-gated policies remain. `PHASE_1_5_AUDIT.md` (2026-08-12) recorded this as **still broken** — it was fixed between that audit and this one. |
| Public collection over-exposure (`collections_public_read`) | Fixed on TEST via `public_collection_view` | ✅ The broad `anon`-readable policy on `collections` is gone. `public_collection_view` exists, grants `SELECT` to `anon`+`authenticated`, and exposes 31 curated columns — confirmed it excludes `user_id`, `workspace_id`, `rejection_reason`, `next_contributor_number` exactly as claimed. This is precisely the view design proposed in the superseded `PHASE_2_ARCHITECTURE.md` §7, apparently already built ahead of that doc's own sequencing (it lists this as step "2H," last). |
| Duplicate/overlapping `profiles` RLS policies (OBS-2 in the superseded audit) | Not mentioned in task brief | ✅ Consolidated — 6 policies now, one per (command × own/admin) combination, no near-duplicates. `PHASE_1_5_AUDIT.md` recorded 9 with three overlapping own-read variants; that overlap is gone. |
| `email_unsubscribes` fail-closed / prod gap (BUG-3) | Fixed on TEST | ✅ Table exists, RLS enabled, zero policies (deny-by-default to non-service-role) — consistent with the fail-closed design in the task brief. Prod state not checked (out of scope; task brief already states prod is unfixed and this audit did not re-verify prod). |

None of this is Workspace-specific, but it materially changes the risk picture in §9 below relative to what the task brief assumes — the two most severe items it flags as open are, on TEST, already closed.

### Related pre-existing tables (not to be conflated with Workspace)

`collection_access_grants` (`collaborator_user_id`, `can_view_earnings`, `can_view_contributors`, `revoked_at`) is a **collection-level**, boolean-capability, proto-membership system predating Workspace — it grants a second person read visibility into one specific collection, not workspace membership. `collection_access_invites`/`collection_access_invite_items` and `collection_transfer_requests` are its OTP-based invite/transfer plumbing. These are real, separate, already-shipped features that solve a narrower version of the problem Workspace membership will eventually solve. They are the natural migration source once Workspace membership ships (superseded `PHASE_2_ARCHITECTURE.md` §3 already flags this: "migrate `collection_access_grants` → `workspace_members`, then retire").

---

## 3. Current backend state (`kolekto-be-old`, verified in working tree, branch `ghazali/fix-with-claude`)

### Routes (`routes/workspace.js`, mounted at `/api/workspaces` in `app.js`)

| Method | Path | Controller | Auth |
|---|---|---|---|
| GET | `/` | `listWorkspaces` | `verifyToken` |
| POST | `/` | `createWorkspace` | `verifyToken` |
| GET | `/:workspaceId` | `getWorkspace` | `verifyToken` |
| PATCH | `/:workspaceId` | `updateWorkspace` | `verifyToken` |

No member/invite routes exist — the route file's own header comment states this is deliberate. Controllers (`controllers/workspace.js`) are thin: no DB access, delegate immediately to the service.

### Services / repositories

- `services/workspaceService.js` — `ensurePersonalWorkspace` (self-heal fallback; the DB trigger is the authoritative provisioning path), `listForUser`, `getById`, `resolveWorkspaceForWrite`, `createWorkspace`, `updateWorkspace`. Header explicitly forbids financial logic in this file.
- `repositories/workspaceRepository.js` — pure Supabase access, explicitly documented as containing no business rules.
- No membership-management repository/service methods exist anywhere (add/remove/list-members) — confirmed absent, consistent with §6/§7 below.

### Authorization — capability-based, centralized (this is a genuine strength)

`services/workspaceAuthorizationService.js` is the single place any "may this user do X in this workspace?" question is answered. Its own header states the intent explicitly: nothing outside this file may read `membership.role` directly. Capabilities: `workspace:read/update/members.manage`, `collection:create/read/update/delete`, `transaction:read`, `withdrawal:create/approve`, `reports:read`. Role→capability map:

| Capability | OWNER | ADMIN | MEMBER |
|---|:--:|:--:|:--:|
| `workspace:read` | ✅ | ✅ | ✅ |
| `workspace:update`, `workspace:members.manage` | ✅ | ✅ | ❌ |
| `collection:create/update` | ✅ | ✅ | ❌ |
| `collection:read` | ✅ | ✅ | ✅ |
| `collection:delete` | ✅ | ❌ | ❌ |
| `transaction:read`, `reports:read` | ✅ | ✅ | ❌ |
| `withdrawal:create` | ✅ | ❌ | ❌ |
| `withdrawal:approve` | ❌ | ❌ | ❌ |

`assertCapability` throws `404` (not `403`) for non-members — deliberate, to avoid confirming a workspace's existence to an outsider probing IDs. `withdrawal:approve` is granted to no role at all, by design — approval stays a platform-admin function entirely outside the workspace system, in every phase.

**Gap found (new, not in any prior doc):** an uncommitted working-tree diff on `services/workspaceAuthorizationService.js` **removes** `requireCapability(capability)` (a generic Express-middleware factory for route-level gating) and `canCreateCollection` from the module's exports. Nothing else in the tree calls either function, so nothing is currently broken — but this means **route-level declarative capability gating does not exist right now**; every check happens inside the service layer instead. Combined with the `CLAUDE.md` diff being edited in the same uncommitted change, this reads as one deliberate cleanup pass (removing genuinely-unused code) rather than an accident — but it also means anyone adding a new workspace-scoped route today has no reusable middleware to reach for and must call `assertCapability` manually inside the service, as the existing routes do. Worth a decision (rebuild it now vs. accept service-layer-only enforcement) before Wave 2 adds new routes.

### Collection integration

`collections.workspace_id` is stamped on create and **read nowhere for authorization**. `services/collectionService.js::resolveWorkspaceId` resolves it via `workspaceService.resolveWorkspaceForWrite`, with asymmetric failure handling that is a genuinely good design choice: an **explicit** client-supplied `X-Workspace-Id` that fails membership/capability is fatal (404/403, never silently downgraded); an **implicit** (no header) resolution failure is swallowed to `null` and logged, so a workspace-lookup hiccup can never block collection creation. Collection **read/list/update/delete** never reference `workspace_id` at all — enforcement exists only at the moment of write-resolution.

### Role model reality

Despite the full OWNER/ADMIN/MEMBER capability map existing in code, **every membership row ever inserted, by every code path (DB trigger, backfill, self-heal, workspace creation), is `role='OWNER'`.** No code path anywhere inserts ADMIN or MEMBER. This is not a bug — it is the intended invariant for this phase (every workspace currently has exactly one member) — but it means the capability matrix is currently unreachable dead-weight for two of its three roles, and multi-role behavior is entirely unverified against real data.

### Tests

Two files, 27/27 passing, **unit tests with hand-written in-memory fake repositories — no Supabase, no HTTP layer, no `supertest`, no real Express app instantiation.** Coverage includes real security-relevant cases: forged `X-Workspace-Id` rejected with 404 not a silent fallback; non-member isolation; suspended-membership grants nothing; unknown role fails closed; creating a workspace never adds a second member (the "EQUIVALENCE" invariant the whole design leans on); update isolation (non-member cannot patch someone else's workspace); `type`/`slug` immutability enforced even if supplied in a PATCH body.

**Not covered by any test:** the actual Express routes/controllers (no HTTP-level test verifies `verifyToken` wiring, status codes as Express actually returns them, or response shape); the RLS policies themselves against a real Postgres instance (zero automated coverage — they are currently verified only by the manual probes recorded in the superseded audit doc); the DB trigger and backfill SQL (verified only by manual `_VERIFY`/`_DRYRUN` scripts, not by `npm test`); any real concurrency/race scenario (the unique-index-race test fakes the DB error rather than issuing concurrent requests); the `'suspended'` workspace status, which is a legal DB `CHECK` value with no application code path that can ever set it and no test asserting that gap.

---

## 4. Current frontend state (`kolekto-fe-old`)

### Components & state

- `WorkspaceSwitcher.tsx` (dropdown, `full`/`compact` variants) + `ActiveWorkspaceBadge` — visible in both `DashboardSidebar` (full) and `DashboardNavbar` (compact, desktop *and* mobile header).
- `WorkspacePage.tsx` (`/dashboard/workspace`) — create dialog (Name/Type/Description, no logo field, `personal` excluded from the type choices), an editable name/description card gated to OWNER/ADMIN, and a workspace list/switcher. It contains an explicit, user-facing disclaimer: *"Inviting other people into a workspace isn't available yet."*
- `useWorkspaceStore.ts` (Zustand, in-memory) + `useWorkspaceBootstrap.ts` (three-state auth resolution: resolving / resolved-with-user / resolved-without-user — deliberately does nothing while auth is still resolving, to avoid wiping a valid persisted selection) + `activeWorkspace.ts` (standalone `localStorage` persistence, **scoped per signed-in user** — `{userId, workspaceId}`, not a bare id — specifically so one account on a shared browser can never inherit another's selection).

### API integration — the most important frontend gap

There is no dedicated workspace API client; the store calls `axiosInstance` directly. Propagation of workspace context is an axios **interceptor** that attaches `X-Workspace-Id` to every request that happens to go through `axiosInstance` and has an active workspace selected. This is not universal:

- `useCollectionStore.fetchCollections` / `fetchCollectionById` call `supabase.from("collections")` **directly**, bypassing `axiosInstance` entirely — these can never carry workspace context, and filter strictly by `user_id`.
- The legacy `create-collection` Edge Function path (`supabase.functions.invoke`) likewise never goes through `axiosInstance`.
- The **collection-creation wizard** (`src/components/collections/wizard/`) has **zero** workspace references anywhere in it — confirmed by a repo-wide grep returning no matches. It builds and submits a payload with no `workspace_id` field, relying entirely on the header being attached out-of-band by a piece of code the wizard has no visibility into.
- Only the Express `/create-collection` path (the current default for most collection types, always forced for fundraising) actually carries the header.

Net effect: a user can switch workspace via the switcher, then create a collection through the wizard, and the wizard itself never reads `useWorkspaceStore` or knows which workspace is active. It currently works only because every user has exactly one workspace-equivalent-to-`user_id` today (§2's equivalence guarantee) — it would silently misattribute the moment that stops being true.

### UX placement

Visible in sidebar (full variant, "the standard home for 'which space am I in'" per its own comment) and navbar (compact, both mobile and desktop headers) and on the dashboard home (`ActiveWorkspaceBadge`). **Not present in `MobileBottomNav.tsx`** — the bottom nav is `Home | Collections | Wallet | Profile`, no Workspaces entry. Not present as breadcrumb context on `CollectionDetailsPage`, `CollectionsPage`, `TransactionHistoryPage`, or `ActivitiesPage`.

### Tests

Two files, 13/13 passing — both **pure unit tests of standalone logic modules** (`activeWorkspace.ts` persistence isolation, `switcherState.ts` visibility resolution). **No component-level test exists** for `WorkspaceSwitcher` or `WorkspacePage` (no React Testing Library render test), no test covers `useWorkspaceStore`'s actions (fetch/create/update/switch/reset), no test covers `useWorkspaceBootstrap`'s auth-resolution branching, and no integration/E2E test exercises the full create-workspace → switch → create-collection flow.

### Error handling

Reuses the existing app-wide system correctly — `toFriendlyErrorMessage` + the single Sonner toast (`src/lib/toast.ts`) for user-facing failures on the `WorkspacePage`; `useWorkspaceBootstrap` deliberately swallows fetch errors without a toast (by design, so a workspace-fetch hiccup never degrades the rest of the app), but still records the error in store state for any UI that wants it.

---

## 5. Current authorization model

**Capability-based, correctly designed, correctly isolated from the rest of the app.** `hasCapability`/`assertCapability` are the only entry points; role strings are interpreted in exactly one place (the `ROLE_CAPABILITIES` map). This is a genuinely good pattern and should be preserved, not rebuilt, in every future wave — it already satisfies the task brief's §19 requirement ("Do not scatter `if (role === 'ADMIN')` checks").

For contrast: platform-admin authorization (`utils/requireAdmin.js`) is **not** capability-based — it does scattered role-string comparisons (`row.role === 'superadmin'`). This is a separate, older, unrelated system and out of scope to change here, but it is worth naming so a future engineer doesn't assume the capability pattern is used everywhere in the codebase.

**What's real vs. declared-but-unreachable:** OWNER-path enforcement (non-member isolation, forged-header rejection, capability checks) is real, tested, and DB-backed (no write RLS policy exists for `authenticated`). ADMIN/MEMBER enforcement is declared in the capability map and unit-tested against fakes, but has never been exercised against a real membership row of that role, because no code path creates one. Treat the two- and three-member cases as **designed, not verified**.

---

## 6. Current collection ownership model

`user_id` is authoritative for every read, every RLS policy, every financial calculation, unconditionally, right now. `workspace_id` is nullable, populated on create (with the asymmetric explicit/implicit failure handling in §3), never read for authorization or money. For every existing row, `workspace.owner_id = collection.user_id` holds exactly (0 mismatches, verified live) — this is the "equivalence" the superseded `PHASE_2_ARCHITECTURE.md` correctly identifies as the entire safety mechanism for a future authorization cutover, and it is real and currently true.

---

## 7. What already works (verified, not assumed)

- Personal workspace auto-provisioning on signup (DB trigger, exception-swallowing so it can never break signup) plus a backend self-heal fallback plus a one-time backfill — three mechanisms, one DB-enforced idempotency guarantee (partial unique index), zero possibility of duplicates by construction.
- Workspace creation (non-personal types), name/description editing, and workspace switching — end-to-end, through the real UI, with at least one real non-seeded organization/association-type workspace already existing on TEST as evidence.
- Server-side membership/capability enforcement with no client-trust gap: a forged `X-Workspace-Id` is rejected with 404, never silently downgraded to the caller's own workspace — this exact scenario is unit-tested and passing.
- Per-user-scoped `localStorage` persistence of the active workspace selection, with correct rehydration ordering relative to auth resolution (a real bug here — wiping the selection before auth resolved — was found and fixed in the prior Phase 1.5 audit; the fix is present and regression-tested).
- The two most severe adjacent security items the task brief describes as open (BUG-2 profile PII, broad public-collection exposure) are, on TEST, already closed (§2).
- Financial isolation: zero occurrences of `workspace` in any payment/settlement/pricing service file (backend); the entire backend Workspace change touches 8 files, of which only 3 are shared with existing collection code, and no financial column ever appears in a `workspace_id`-writing statement.

---

## 8. What is incomplete

Exactly as the task brief anticipates, and confirmed with no surprises beyond what's listed:

- **Invitations** — zero implementation. `workspace_members.status='invited'` and `.invited_by` exist as unused schema columns; nothing ever writes them.
- **Member management** (add/remove/list beyond self) — zero implementation, no routes, no repository methods.
- **ADMIN/MEMBER roles in practice** — declared in the capability map, never assigned by any code path (§3, §5).
- **Ownership transfer** (workspace-level) — zero implementation. Do not confuse with the existing, unrelated `collectionTransfer.js` feature, which transfers a single *collection's* `user_id` via OTP and has no interaction with `workspaces`/`workspace_members` at all.
- **Capability administration UI / audit logs** — zero implementation.
- **Route-level capability middleware** — existed, was just removed in an uncommitted diff (§3); currently zero reusable route-level gate, enforcement is service-layer-only.
- **Frontend workspace-awareness in the money-adjacent write path** — the collection wizard and most collection reads don't know `workspace_id` exists (§4). This is the most concrete near-term risk: it works today only because of the equivalence in §6, and will silently misattribute the moment a workspace gets a second member.
- **Mobile bottom-nav workspace entry** — absent; workspace is reachable only via the switcher, not a first-class bottom-nav destination.
- **Component/integration/E2E test coverage** — both repos have solid *unit* coverage of pure logic and service-layer authorization, and near-zero coverage above that layer (no HTTP-level backend test, no rendered-component frontend test, no full-flow E2E).

---

## 9. Security risks

| # | Risk | Severity | Status / mitigation |
|---|---|---|---|
| S1 | Forged/guessed `X-Workspace-Id` used to write into a foreign workspace | High if unmitigated | **Mitigated and tested** — server always re-verifies membership; header is "a request, never an authorization" throughout the codebase's own comments, confirmed accurate |
| S2 | Client self-grants membership or role via Supabase directly | High if unmitigated | **Mitigated by DB design** — zero write RLS policy for `authenticated` on `workspaces`/`workspace_members`; only the service-role Express backend can write |
| S3 | Route-level capability middleware absent (uncommitted removal) | Low today, grows with Wave 2 | New routes must remember to call `assertCapability` manually inside the service; no framework-level guardrail catches an engineer who forgets. Decide before adding member/invite routes. |
| S4 | Collection wizard / direct-Supabase collection reads carry no workspace context | Medium, latent | Works today only by equivalence (§6); becomes a real cross-workspace data-exposure risk once a workspace can have collections a viewer shouldn't see and `collection:read` capability differs from plain ownership |
| S5 | Two-of-three roles (ADMIN/MEMBER) are unverified against real data | Medium | Capability map is unit-tested against fakes only; no membership row of either role has ever existed in the database |
| S6 | RLS policies have zero automated test coverage against a real Postgres instance | Medium | Verified only by the manual anon-key probes recorded in the superseded audit; a future migration could silently regress a policy with nothing catching it in CI |
| S7 | `'suspended'` workspace status is a reachable DB value with no application code path and no test | Low | Dead corner, but an untested one — if any future code path (or a direct DB edit) sets it, behavior is unverified |
| S8 (adjacent, not Workspace) | Both BUG-2 and the broad `collections_public_read` policy remain open on **production** | High for prod, N/A for this task's scope | Explicitly out of scope per the task brief; noted here only so it isn't lost — TEST being fixed must not be read as prod being fixed |

**No workspace-specific authorization bypass was found.** The design is sound; the gaps are coverage and completeness, not a broken trust boundary.

---

## 10. Data migration risks

The migration the task brief asks about (§13: assign every collection to its owner's personal workspace) is **already done on TEST** — 72/72 collections assigned, 0 mismatches, 0 orphans, live-verified in §2. The risks below are therefore about *repeating this safely on production* and about *what comes after*, not about the TEST migration itself, which already happened without incident.

| Risk | Mitigation already designed (superseded `PHASE_1_IMPLEMENTATION.md` §3/§11) |
|---|---|
| Backfill corrupts financial data | Backfill statements write only `workspace_id` / new tables; no financial column ever appears in a backfill's `SET` clause — verifiable by grep, and was verified as such on TEST |
| Duplicate personal workspaces | DB-level partial unique index is the arbiter, not application logic — cannot be duplicated regardless of caller behavior |
| A user with no `profiles` row gets skipped, not guessed at | Confirmed as the intended, documented behavior (one such row existed on prod as of the last read-only prod dry-run recorded in the superseded audit) |
| Rollback | Every migration (W1–W6) has a paired `_ROLLBACK.sql`; rollback touches no pre-existing column except `collections.workspace_id`, which didn't exist before Workspace |

**New risk this audit surfaces that the superseded docs don't fully address:** none of the migration risk analysis above accounts for the frontend gap in §4/§8 (S4). A production rollout that ships the DB/backend migration correctly but ships the frontend with the wizard's workspace-blindness intact is not a *migration* risk, but it is a rollout-sequencing risk worth flagging here since §13 of the task brief treats "collection migration" as primarily a database concern.

---

## 11. Financial risks

**None identified specific to Workspace, and the existing evidence for that claim is strong, not asserted:** zero `workspace` references in `paymentService.js`, `pricingService.js`, `settlementService.js`, `paymentRepository.js`, `utils/financial.js`, `controllers/deposit.js`, `controllers/withdrawal.js` (confirmed by the backend audit's grep, consistent with the superseded audit's independent grep). `withdrawal:create`/`withdrawal:approve` capabilities are *declared* (OWNER-only / no-role respectively) but **wired to nothing** — withdrawal authorization today is still 100% `user_id`-based, unchanged. Wallets remain keyed to `collection_id`, not workspace. This is exactly the boundary the task brief's §24 demands stay untouched, and it is untouched.

The one financial-adjacent risk worth naming explicitly for Wave 2 planning: the moment `withdrawal:create`/`withdrawal:approve` get wired to anything, that wiring must be *additive* (both the existing `user_id` check AND the capability must pass) — never a replacement, and never a way to widen who can move money. This is already the stated design principle in the superseded `PHASE_2_ARCHITECTURE.md` §6 and this audit finds no reason to revise it.

---

## 12. Recommended Workspace architecture

Keep the architecture as built. It is sound: additive columns, `user_id` authoritative until proven otherwise, capability-based authorization centralized in one service, DB-enforced (not app-enforced) uniqueness and write-authority guarantees. The recommendation is **evolve, not redesign**:

```
User → WorkspaceMember(role) → capabilities (centralized map) → Resource
                                        │
                          Phase-appropriate map: hardcoded (now) →
                          DB-backed workspace_role_capabilities (later, only if
                          per-workspace custom roles become a real product need)
```

Do not move the capability map to a database table until there is a concrete product requirement for per-workspace custom roles — the hardcoded map is simpler, equally correct for a fixed 3-role system, and the superseded `PHASE_2_ARCHITECTURE.md`'s own DB-table design is explicitly deferred behind that need, not a Wave 2 requirement.

Restore the `requireCapability` route middleware (§3 S3) before adding any new workspace routes — it costs little, it already existed and worked, and it closes S3 before it compounds.

---

## 13. Recommended role/capability matrix

Adopt the matrix already designed in the superseded `PHASE_2_ARCHITECTURE.md` §4 verbatim — it correctly extends the current 3-role map with a `VIEWER` role that absorbs the existing `collection_access_grants` booleans, and it is already reviewed and consistent with the non-negotiable financial rule (`withdrawal:approve` belongs to no role, ever):

| Capability | OWNER | ADMIN | MEMBER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| `workspace:read` | ✅ | ✅ | ✅ | ✅ |
| `workspace:update` | ✅ | ✅ | ❌ | ❌ |
| `workspace:delete` | ✅ | ❌ | ❌ | ❌ |
| `workspace:members.read` | ✅ | ✅ | ✅ | ❌ |
| `workspace:members.manage` | ✅ | ✅ | ❌ | ❌ |
| `collection:create` | ✅ | ✅ | ❌ | ❌ |
| `collection:read` | ✅ | ✅ | ✅ | ✅ |
| `collection:update` | ✅ | ✅ | ❌ | ❌ |
| `collection:delete` | ✅ | ❌ | ❌ | ❌ |
| `contributors:read` | ✅ | ✅ | ✅ | ✅ |
| `contributors:export` | ✅ | ✅ | ❌ | ❌ |
| `reports:read` | ✅ | ✅ | ✅ | ✅ |
| `withdrawal:view` | ✅ | ✅ | ❌ | ❌ |
| `withdrawal:create` | ✅ | ❌ | ❌ | ❌ |
| `withdrawal:approve` | ❌ | ❌ | ❌ | ❌ |

No change recommended to this matrix — it was designed with the correct financial constraint already in place and this audit found no reason to widen or narrow it.

---

## 14. Recommended invitation architecture

Adopt the design already sketched in `PHASE_2_ARCHITECTURE.md` §3/§8, refined per the task brief's §18 security requirements:

**Schema** (net-new): `workspace_invites(id, workspace_id, email citext, role, token_hash, invited_by, expires_at, accepted_at, declined_at, revoked_at)`. Store a **hash** of the token (never the raw token) — matches the pattern already used elsewhere in this codebase for OTP-based flows (`collection_access_invites`, `collectionTransfer.js`).

**State machine:** `PENDING → {ACCEPTED | DECLINED | EXPIRED | REVOKED}`, terminal states are terminal (no re-transition). Enforce at the DB layer with a `CHECK` on status plus application-level guards, mirroring the `role`/`status` `CHECK`-not-enum pattern already used for `workspace_members`.

**Required guards** (each maps directly to a task-brief §18/§25 requirement and to an existing pattern in this codebase):
- Token reuse → single-use, hash checked against `accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()` inside one transaction with the acceptance write (mirrors `resolveWorkspaceForWrite`'s "assert then act" pattern already used for capability checks).
- Expired/revoked acceptance → rejected by the same transactional check above, not a separate pre-check (avoids a TOCTOU gap).
- Email mismatch → the accepting user's authenticated email must equal `workspace_invites.email`; do not accept based on token possession alone.
- Duplicate active invitations → unique partial index on `(workspace_id, email) WHERE status='PENDING'`, same pattern as `workspaces_one_personal_per_owner` — DB-enforced, not app-enforced.
- Unauthorized invitation creation → gated behind `workspace:members.manage` through the existing `assertCapability` path, no new authorization mechanism needed.
- Acceptance must be transactional → insert the `workspace_members` row and mark the invite `ACCEPTED` in one transaction; a partial success (member added, invite left `PENDING`) must be impossible.

This is intentionally not a new subsystem — it reuses this codebase's existing "hash the token, DB-enforced uniqueness, transactional accept, centralized capability gate" idioms rather than inventing new ones.

---

## 15. Recommended ownership-transfer architecture

Adopt the design implied by the task brief §20 and the state-machine pattern already used for `collectionTransfer.js` (an existing, working, OTP-based collection-ownership transfer — reuse its shape, don't reinvent it):

```
OWNER → select active, non-suspended member (not self) → request transfer
      → target accepts (own action, not automatic)
      → transactional: target.role = OWNER, requester.role = ADMIN
      → old owner is NEVER removed from the workspace, only demoted
```

**Non-negotiables carried directly from the task brief and consistent with everything already true about this codebase:**
- Exactly one OWNER at all times — enforceable the same way `workspaces_one_personal_per_owner` enforces exactly-one-personal-workspace: a DB constraint, not application discipline. (A partial unique index on `(workspace_id) WHERE role='OWNER'` in `workspace_members` would do this directly.)
- Target must be an active, non-suspended member — checked via the existing `findMembership(..., status='active')` filter already used everywhere else in `workspaceRepository.js`.
- Owner cannot transfer to themselves — trivial guard, but must be explicit and tested (no such test exists yet for anything transfer-related, since transfer doesn't exist yet).
- Transactional, auditable — write to `workspace_activity` (net-new append-only table, per §12) in the same transaction as the role swap.
- **Does not touch `collections.user_id` or any financial record.** This is the single most important constraint: workspace ownership transfer is a `workspace_members.role` change, full stop. It must never cascade into collection or financial ownership — that would resurrect exactly the "financial architecture rewrite" the task brief's §26 explicitly forbids.

---

## 16. Recommended collection migration strategy

No further collection migration is needed for existing data — §2/§10 already confirm 72/72 collections correctly assigned with zero mismatches on TEST, and the same backfill script, already written and dry-run against production (per the superseded audit's read-only prod dry-run: 262/262 collections resolvable, 0 conflicts), is ready to run against prod when that becomes an authorized, separate decision.

**What remains is not a migration but a rollout-sequencing decision**, and this is the audit's clearest concrete recommendation: apply the DB/backend changes, run the backfill, and *then* — before treating `workspace_id` as authoritative for anything — close the frontend gap in §4/§8 (S4) so the wizard and all collection reads carry explicit workspace context instead of relying on the header side-channel. Doing this in the other order (flip authorization to `workspace_id` while the wizard still doesn't know it exists) is the one sequencing mistake this audit would flag as a hard blocker.

---

## 17. Recommended frontend UX

Largely: finish what's started, don't redesign it.

- **Wire the wizard.** `CreateCollectionWizard.tsx`'s `buildPayload()`/`publishCollection()` should read `useWorkspaceStore`'s active workspace directly and include it explicitly in the request, rather than depending entirely on the axios interceptor. This closes S4 and is the single highest-value frontend change identified in this audit.
- **Route `useCollectionStore`'s direct-Supabase reads through a workspace-aware path**, or explicitly document why they don't need to be (e.g., if `user_id`-filtering remains correct as long as equivalence holds) — right now the omission looks unintentional, not deliberate, because nothing marks it as a conscious decision the way the wizard's other gaps are commented.
- **Add a Workspaces entry to `MobileBottomNav.tsx`** once there is more than the current one-screen surface to reach (defer until member management ships — not worth a nav slot for switch-only today, but worth planning for).
- **Manage Workspace** (task brief §21): build it as the natural next tab set on the existing `WorkspacePage.tsx` — Overview (exists) → Members (Wave: invitations) → Invitations (Wave: invitations) → Roles & Permissions (Wave: roles) → Settings (exists) → Ownership (Wave: transfer) → Activity (Wave: activity log). Do not build placeholder tabs for unshipped functionality — the existing page's honest "not available yet" disclaimer is the right pattern; keep it per-feature as each ships instead of front-loading empty UI.
- **Component + integration test coverage** should land alongside each new UI surface, not after — right now zero component-level tests exist for the two components that do exist (`WorkspaceSwitcher`, `WorkspacePage`), which is a gap worth closing even before new features, since it's cheap now and expensive once Members/Invitations UI adds real interaction complexity.

---

## 18. Testing strategy

Layer the tests the task brief's §25 checklist demands directly onto the existing, working patterns in this codebase — every item below already has a structurally similar precedent to copy:

| Layer | Current state | What to add, and the pattern to copy |
|---|---|---|
| Backend unit (service/authz) | Strong (27/27, covers most of §25's list already) | Extend the same in-memory-fake pattern for invitation/transfer logic once built |
| Backend HTTP/integration | **None** | Add `supertest`-based route tests — nothing in this repo does this yet for any feature, so this is a repo-wide gap, not workspace-specific, but workspace is a good place to start given how well-isolated its service layer already is |
| Database/RLS | **None automated** — manual anon-key probes only | A scripted probe (real anon key against TEST, asserting row counts) turned into an automated test, run in CI against a TEST-project connection, would convert the manual verification already done into a regression guard |
| Frontend unit (pure logic) | Strong (13/13) | Keep this pattern for `workspace_invites`/transfer client-side validation logic |
| Frontend component | **None** | React Testing Library render tests for `WorkspaceSwitcher`/`WorkspacePage` before adding Members/Invitations UI on top of them |
| Frontend integration/E2E | **None** | One flow test: create workspace → switch → create collection → verify `workspace_id` on the created row — this single test would have caught the wizard gap (S4) immediately |
| Security (task brief §25 list) | Backend: non-member access ✅, forged header ✅, suspended member ✅, self-role-modification (moot, untestable until roles exist), unauthorized workspace update ✅. **Everything invitation/transfer-related**: none exist to test yet — write these test-first, alongside the feature, not after |

The financial characterization test pattern already used for Phase 1 (byte-identical sums before/after) should be repeated for every future migration per the task brief's §24 — it is cheap, already proven to work, and is the single best safeguard against the failure mode this whole programme is most worried about.

---

## 19. Implementation waves

Building on the sequencing already designed in the superseded `PHASE_2_ARCHITECTURE.md` §10, adjusted for what this audit found already done vs. still needed:

| Wave | Objective | Depends on | Completion criteria |
|---|---|---|---|
| **1 (this document)** | Audit | — | Done |
| **2** | Close the frontend gap (§4/§8 S4): wizard + collection reads carry explicit workspace context; restore route-level capability middleware (S3) | Wave 1 | Wizard payload includes explicit workspace id; new-route capability gating has a reusable primitive again |
| **3** | Equivalence-verification harness | Wave 2 | Automated job asserts `user_id`-based and `workspace_id`-based authorization return identical result sets for every user, run repeatedly, zero drift — **this is the wave that must not be skipped**, per the superseded Phase 2 doc's own strongest warning |
| **4** | `workspace_role_capabilities` groundwork only if a concrete need for custom/per-workspace roles emerges; otherwise skip | Wave 3 | N/A unless triggered by product need |
| **5** | Invitations (§14) | Wave 3 (equivalence proven) — **not before**, since invitations are what ends the single-member equivalence guarantee | Second member can be added; every §25 security scenario for invitations passes |
| **6** | Ownership transfer (§15) | Wave 5 | Transfer is transactional, exactly-one-OWNER invariant DB-enforced, no financial record touched |
| **7** | Member management UI + capability admin surface | Wave 5 | `Manage Workspace` tabs (§17) filled in per-feature |
| **8** | Collection authorization cutover (reads/RLS move to `workspace_id`, dual-policy-then-drop-old, per the superseded Phase 2 §5 pattern) | Wave 3 green ≥1 week, Wave 5 stable | Every scoped query workspace-based; result sets unchanged; old `user_id`-only policies removed only after verified identical |
| **9** | Full test-layer buildout (§18) | Ongoing, ideally alongside each wave above rather than deferred | HTTP/integration/RLS/component/E2E coverage exists for every shipped surface |
| **10** | Production rollout of Waves 2–3 foundation (Wave 1 DB/backend/personal-workspace portion is prod-ready per §23/§24 below; this wave is for whatever ships in Waves 2–3) | All above conditions for whatever is being shipped | Per §24 |

This differs from the task brief's suggested default sequence (§27) mainly in ordering **invitations after** an equivalence-verification wave, not before — this is a direct, deliberate carry-forward of the superseded Phase 2 doc's central warning, re-endorsed by this audit: *"Multi-member workspaces are the LAST thing to ship, not the first,"* because adding a second member is precisely what destroys the `user_id`≡`workspace_id` equivalence that makes every other verification in this document possible.

---

## 20. Files likely to change

**Backend** (`kolekto-be-old`): `services/workspaceAuthorizationService.js` (restore `requireCapability`), `routes/workspace.js` + new `routes/workspaceInvites.js`/`routes/workspaceMembers.js`, `services/workspaceService.js` (add member/invite/transfer methods), `repositories/workspaceRepository.js` (add member/invite CRUD), new `services/workspaceInvitationService.js`, new `services/workspaceTransferService.js`, `database/` (new migrations, see §21).

**Frontend** (`kolekto-fe-old`): `src/components/collections/wizard/CreateCollectionWizard.tsx` (wire active workspace explicitly — highest priority), `src/store/useCollectionStore.ts` (audit/fix direct-Supabase reads), `src/store/useWorkspaceStore.ts` (add member/invite/transfer actions), `src/pages/dashboard/WorkspacePage.tsx` (add Members/Invitations/Ownership tabs incrementally), new `src/components/workspace/MembersList.tsx`, `InviteMemberDialog.tsx`, `TransferOwnershipDialog.tsx`, `src/components/dashboard/MobileBottomNav.tsx` (add Workspaces entry once Wave 5+ ships).

---

## 21. Database migrations likely required

All additive, all on TEST first, all following the existing `w<N>_<name>_<date>.sql` + `_ROLLBACK.sql` + `_VERIFY.sql` convention already established and used consistently for W1–W6/S4:

1. `workspace_invites` table + partial unique index on `(workspace_id, email) WHERE status='PENDING'`.
2. Partial unique index on `workspace_members (workspace_id) WHERE role='OWNER'` — DB-enforced "exactly one OWNER," needed before ownership transfer ships.
3. `workspace_activity` append-only audit table.
4. RLS additions for the two new tables above, following the same "no write policy for `authenticated`, service-role only" pattern already used for `workspaces`/`workspace_members`.
5. (Only if Wave 4 is triggered) `workspace_role_capabilities` table + the `user_has_workspace_capability()` SQL helper, exactly as designed in the superseded Phase 2 doc §5.
6. (Wave 8 only, after equivalence is proven) new workspace-based RLS policies added *alongside* existing `user_id` policies (never replacing in place), verified identical, old policies dropped only after that verification.

No migration in this list touches `contributions`, `wallets`, `withdrawals`, or any existing financial column — consistent with the superseded Phase 2 doc's rule that a table only gets `workspace_id` if it cannot derive scope through an existing join, and none of the financial tables meet that bar.

---

## 22. What must remain untouched

Restating the task brief's §26/§14 constraints, cross-checked against what this audit found to already be true (i.e., these are not aspirational — they currently hold and should keep holding):

- `collections.user_id` — authoritative, `NOT NULL`, unchanged by any migration to date. Do not remove or demote it before Wave 8's equivalence proof.
- Wallet balance math, settlement logic, Paystack verification — zero `workspace` references found anywhere in these paths; keep it that way through every wave in §19.
- `withdrawal:approve` — grants to no role, in any phase, per the non-negotiable rule already encoded in the current capability map.
- Production Supabase (`busfgcmbndleljklrcbd`) — not modified during this audit, and not to be modified by any wave in §19 until an explicit, separate, authorized rollout decision.

---

## 23. TEST-only verification plan

Every wave in §19 should repeat the same three-part verification pattern already proven to work for Phase 1 (§2, §10 of this document; §3–5 of the superseded `PHASE_1_5_AUDIT.md`):

1. **Before/after financial characterization** — capture row counts and aggregate sums for `wallets`, `contributions`, `withdrawals`, `collections`, `deposits` before any migration; diff after. Expect Δ=0 outside intentional test records. This exact pattern already caught nothing wrong in Phase 1 and should be run again for every future migration, not skipped because "it passed last time."
2. **Empirical anon-key probes** — for any new table or RLS policy, probe with the real `anon` key against TEST and assert actual row counts, not just policy text. This is how BUG-2 was originally discovered and how the current fixed state was reconfirmed live in §2 of this document — policy definitions alone are not sufficient evidence.
3. **Unit + (new, per §18) HTTP/integration tests green**, run against TEST, before considering any wave complete.

---

## 24. Production rollout prerequisites — planning only

No production action is authorized by this document. For when a rollout decision is made separately, the prerequisites already identified (superseded `PHASE_1_5_AUDIT.md` §4/§13, re-affirmed here) remain accurate: the W1–W6 personal-workspace foundation has a clean, already-executed read-only dry-run against production (606 profiles, 0 conflicts, 262 collections, 0 mismatches, as of the last dry-run) and is describable as rollout-ready *for that scope only*. Confirmed prod backup/PITR before any write migration is a hard prerequisite, not optional. Nothing built in Waves 2–8 of this document has been dry-run against production and none of it should be treated as rollout-ready until it has been, following the same read-only-dry-run-first discipline used for Phase 1.

---

## 25. GO/NO-GO recommendation for implementation

| Scope | Recommendation |
|---|---|
| Wave 2 (frontend wizard/read-path workspace-awareness, restore route middleware) | **GO** — low risk, closes a real gap, no schema change, no authorization change |
| Wave 3 (equivalence-verification harness) | **GO, and treat as mandatory**, not optional — it is the prerequisite for everything after it |
| Waves 5–8 (invitations, transfer, member UI, authorization cutover) | **CONDITIONAL GO** — authorized to design and build against TEST now, but Wave 5 (invitations, the step that first breaks single-member equivalence) must not start until Wave 3 has run and shown zero drift, per §19 |
| Production rollout of anything beyond the already-verified Phase 1 personal-workspace foundation | **NO-GO** until a separate, explicit rollout decision is made, per the task brief's own instruction that this is a completely separate future phase |

**Overall: proceed.** The foundation is sound, more complete than the task brief assumed, and the two most severe adjacent risks it flagged as open are already closed on TEST. The one hard rule to hold from here forward is the one the superseded Phase 2 document states most forcefully and this audit independently re-derives from the evidence: **do not let multi-member workspaces ship before the equivalence-verification harness has run.** Everything else in this programme is reversible; that step, once real second-member data exists, is not.
