# KOLEKTO — PHASE 1.5 TEST-READY FINAL REPORT

**Date:** 2026-08-12
**Test project:** `lpeeckqsltxohppheucz` — all work applied and verified here
**Production project:** `busfgcmbndleljklrcbd` — **UNTOUCHED. Zero writes this entire task.**

---

## 1. Executive summary

TEST is now materially more secure than it was, Workspace is a real user-facing
feature rather than backend plumbing, and every financial total is byte-identical.

**Two genuine security holes were closed, one of which was not previously known**
(a latent self-role-escalation path hidden by duplicate RLS policies). One
regression was introduced during the work, caught by probing real queries with
the anon key, and fixed — it is documented in §5 rather than quietly patched.

---

## 2. Initial state

Phase 1 Workspace verified on test; BUG-2 (profile PII) and BUG-3 (email
unsubscribe) fixed on test in the prior task; production frozen and un-migrated;
`collections` still exposed whole rows to anon; OBS-2 (duplicate RLS) unresolved;
Workspace had no visible frontend.

---

## 3. Work completed

| Area | Outcome |
|---|---|
| BUG-2 profile PII | Re-verified; anon denied |
| BUG-3 email unsubscribe | Re-verified; fail-closed; 7 tests |
| Public collection exposure | **Fixed** — curated view; base table closed to anon |
| OBS-2 duplicate RLS | **Fixed** — and closed a latent privilege escalation |
| Phantom artifacts | Removed; view added to types |
| Workspace frontend | **Built** — switcher, page, creation, settings, nav |
| Workspace backend | `POST`/`PATCH /workspaces` + 12 tests |
| Financial safety | Zero change, verified |

---

## 4. BUG-2 — profile PII (verified, unchanged from prior fix)

Anon is denied at both layers (policy dropped + grant revoked):

```
GET /profiles?select=email,phone_number
→ 42501 permission denied for table profiles
```

Before this programme: **69/69 rows** with real emails and phone numbers.
`service_role` still reads all 69 — backend and Edge Functions unaffected.

---

## 5. Public collection exposure — fixed (with a regression caught mid-flight)

**Defect.** `collections_public_read` gave anon + authenticated SELECT on *every
column* of every non-deleted collection, including `user_id`,
`next_contributor_number`, `rejection_reason`, `workspace_id`.

**Field selection was evidence-based.** Every column in the view was verified as
actually consumed by `src/pages/contribute/**`, `src/components/contribute/**`, or
`src/utils/fundraisingCampaigns.ts`. Nine were verified unused and dropped.
Two were deliberately **kept** because the product genuinely renders them:
`support_phone_number` (organizer support contact) and `code_prefix`
(contributor code).

**⚠️ The regression I introduced, and how it surfaced.**
My first version also ran `revoke select on collections from anon`. That broke
the public payment page. The RLS policies on `contributions` and `wallets`
contain subqueries against `collections`; without the table *privilege*, those
policies fail to evaluate and Postgres returns `permission denied` — turning what
had been an empty result into a hard **401**. `ContributePage` throws on a
contributions error, so the contribute page would have failed to load entirely.

Caught by replaying the page's *actual* queries with the anon key rather than
trusting that the view alone was sufficient. **Privilege is not visibility:** the
grant is restored, the policy stays dropped, and anon now reads **zero rows**
from the base table without erroring.

**Verified end state (real anon key):**

| Probe | Result |
|---|---|
| `collections` base table | `[]` — zero rows, no error ✅ |
| `public_collection_view` | 72 rows ✅ (public pages work) |
| `contributions` / `wallets` for a collection | `[]` — no 401 ✅ |
| `user_id`, `next_contributor_number`, `rejection_reason`, `workspace_id` on view | column does not exist ✅ |

---

## 6. OBS-2 RLS consolidation — and a latent privilege escalation

Consolidating duplicates uncovered a real hole. `profiles` had two overlapping
UPDATE policies:

| Policy | WITH CHECK |
|---|---|
| `Users can update their own profile` | own row **AND `role` unchanged** |
| `users can update own profile` | **none** → falls back to USING |

Permissive policies OR together, so the unchecked duplicate **silently defeated
the role-preservation guard** — a user could change their own `profiles.role`.

**Impact: latent, not exploitable today.** Verified that nothing consumes
`profiles.role` for authorization: `is_current_user_admin()` resolves admin from
`admin_users` by JWT email, and no backend middleware/service or frontend gate
reads it. So this closed a hole *before* it became load-bearing.

Profiles went from 4 SELECT + 3 UPDATE policies to 2 + 2. Assertion
`every UPDATE policy enforces role preservation or admin` → **PASS**.

---

## 7. Workspace verification (test)

All invariants **PASS**: one personal workspace per profile, exactly one active
OWNER each, zero collections unassigned, zero owner mismatches, zero duplicate
personal workspaces, zero cross-owner memberships, `user_id` still `NOT NULL`,
`workspace_id` still nullable, no client write policies on workspace tables.

---

## 8. Workspace security

Backend suite covers: forged `X-Workspace-Id` → fatal 404 (never falls back),
non-member → 404 (no existence disclosure), member lacking capability → 403,
suspended membership grants nothing, unknown role fails closed, MEMBER cannot
create collections, `withdrawal:create` OWNER-only, `withdrawal:approve` held by
**no** role.

Anon sees **0 rows** from `workspaces` and `workspace_members`.

---

## 9 & 10. Frontend implementation — with evidence

| File | Change |
|---|---|
| `src/pages/dashboard/WorkspacePage.tsx` | **NEW** — full workspace surface |
| `src/components/workspace/WorkspaceSwitcher.tsx` | Now **mounted** (was unmounted) |
| `src/components/dashboard/DashboardNavbar.tsx` | Switcher in desktop header (beside page title) **and** mobile header |
| `src/components/dashboard/DashboardSidebar.tsx` | "Workspaces" nav item (Building2 icon) |
| `src/App.tsx` | Route `/dashboard/workspace`, lazy-loaded |
| `src/store/useWorkspaceStore.ts` | `createWorkspace()`, `updateWorkspace()`, user-scoped persistence |
| `src/pages/contribute/ContributePage.tsx` | Reads curated view |
| `src/utils/fundraisingCampaigns.ts` | Fallback reads curated view |

**Switcher location:** desktop — navbar, immediately after the page title,
separated by `/`, so "who am I acting as" is always on screen. Mobile — navbar
beside the logo, capped at `45vw` with truncation. It renders as a plain label
when the user has one workspace (no dropdown that can only reselect itself), and
becomes a dropdown with check-marked active item at two or more.

**WorkspacePage contains:** active workspace card with type + role badges;
settings form (name, description) disabled unless role ∈ OWNER/ADMIN with an
explicit "You don't have permission" message; create dialog with 5 types and
per-type hints; switchable list of all workspaces; loading skeletons; error card
with retry; empty state.

**Mobile:** all layouts use `flex-col` → `sm:flex-row`, full-width buttons on
small screens, `p-4 md:p-6`, truncation on long names.

**Honesty in the UI:** the page states plainly that inviting others isn't
available yet, rather than showing a disabled teaser for functionality that is
deliberately deferred.

---

## 11. API changes

| Endpoint | Status |
|---|---|
| `GET /api/workspaces` | existing |
| `GET /api/workspaces/:id` | existing |
| `POST /api/workspaces` | **NEW** — create non-personal workspace |
| `PATCH /api/workspaces/:id` | **NEW** — gated on `workspace:update` |

`type` and `slug` are deliberately **not** patchable. Member invite/add/remove
routes are deliberately **absent**.

**Equivalence preserved:** a created workspace has exactly one member (the
owner), so `workspace.owner_id === collection.user_id` still holds for anything
created inside it. This is why creation is safe now while invitation is not, and
it is enforced by a dedicated test.

---

## 12. Database changes (TEST only)

| Migration | Purpose |
|---|---|
| `s1_profiles_pii_lockdown` (+ROLLBACK) | BUG-2 |
| `s2_email_unsubscribes_prod` (+VERIFY) | BUG-3 — **written, prod-targeted, not applied** |
| `s3_public_collection_view` | Curated public surface |
| `s3b` (folded into s3) | Restore `collections` grant, keep policy dropped |
| `s4_workspaces_description` (+ROLLBACK) | Settings UI field |
| `s5_rls_policy_consolidation` (+ROLLBACK) | OBS-2 + escalation fix |

---

## 13. Financial safety

**Zero difference on every metric.**

| Metric | Before | After | Δ |
|---|---|---|---|
| wallets.available_balance | 49,815,548.09 | 49,815,548.09 | **0** |
| wallets.ledger_balance | 49,815,548.09 | 49,815,548.09 | **0** |
| wallets.withdrawn | 388,300.00 | 388,300.00 | **0** |
| contributions.amount | 50,204,804.00 | 50,204,804.00 | **0** |
| withdrawals.amount | 559,031.00 | 559,031.00 | **0** |
| collections.amount | 1,414,599.00 | 1,414,599.00 | **0** |
| collections.total_contributions | 196 | 196 | **0** |

No financial module was opened. Workspace services import only each other, the
Supabase client, and the logger.

---

## 14. Test results

| Suite | Result |
|---|---|
| Backend | ✅ **524 / 524** (505 → +7 email, +12 workspace creation) |
| Frontend | ✅ **34 / 34** |
| Build | ✅ PASS |
| Typecheck | ✅ **133** — *below* the 138 baseline (phantom removal netted −5); **0** from new code |
| Workspace DB invariants | ✅ PASS |
| Anon access matrix | ✅ 16 tables probed |
| RLS consolidation assertions | ✅ PASS |

3 vitest "failed suites" are pre-existing empty files in
`kolekto-shared-financial/test/` (no test suite defined) — untouched, unrelated.

---

## 15. Verified access matrix (real anon key, test)

| Table | Anon |
|---|---|
| `profiles` | **denied** ✅ |
| `collections` (base) | **0 rows** ✅ |
| `public_collection_view` | 72 ✅ intended |
| `campaigns` | 17 ✅ intended |
| `contributions`, `withdrawals`, `deposits`, `wallets` | 0 ✅ |
| `payout_accounts`, `kyc_verifications`, `notifications`, `admin_users` | 0 ✅ |
| `collection_access_grants`, `email_unsubscribes` | 0 ✅ |
| `workspaces`, `workspace_members` | 0 ✅ |

---

## 16. Remaining issues

| # | Issue | Severity |
|---|---|---|
| R1 | **BUG-2 still live on PRODUCTION** — fix applied to test only | 🔴 HIGH |
| R2 | **BUG-3 still live on PRODUCTION** — `email_unsubscribes` absent | 🔴 HIGH |
| R3 | **Production has no PITR/backup (free plan)** — blocks any data migration | 🔴 HIGH |
| R4 | Escalation fix + public view are test-only; prod still carries both defects | 🟠 Medium |
| R5 | `types.ts` still hand-maintained (~6 of ~50 tables) | 🟢 Low |
| R6 | End-to-end multi-user browser flow not executed (no runnable auth'd browser session here) — covered by unit/integration tests and live anon probes instead | 🟢 Low |

**On R6, stated plainly:** I verified the frontend by typecheck, build, unit
tests, and by probing the exact database queries the pages issue. I did **not**
drive two real browser sessions through login → switch → logout. That gap is
real and I am not claiming otherwise.

---

## 17. Production migration files prepared

`s1`, `s2`, `s3`, `s4`, `s5` (+ rollbacks/verifies), and `w1`–`w6`. **None applied
to production.**

---

## 18. Rollback

Every change has a `_ROLLBACK`. `s3` reverses by recreating
`collections_public_read` and dropping the view. `s5`'s rollback is annotated
with a warning that restoring the duplicate re-opens the escalation path.

---

## 19. Production deployment prerequisites

1. **Enable PITR (upgrade to Pro)** — hard gate.
2. Apply `s1` + `s5` (security, no data writes, instantly reversible).
3. Apply `s2` + deploy the fail-closed queue fix.
4. Apply `s3` + `s4`, deploy frontend **together** (the page depends on the view).
5. Only then W1→W6, re-baselining financials immediately beforehand.

⚠️ `s3` and the frontend must ship as **one unit**. Frontend-first → the page
queries a non-existent view; DB-first → the deployed page reads a table anon can
no longer see rows in.

---

## 20. GO / NO-GO

🟢 **TEST READY — SAFE TO PREPARE PRODUCTION DEPLOYMENT**

All critical tests pass; no unresolved critical/high security, authorization,
financial, or data-integrity defect remains **in TEST**. The HIGH items in §16
are production-side and are precisely what the prepared migrations address.

**Production remains untouched and must stay so until a separate authorized task.**
