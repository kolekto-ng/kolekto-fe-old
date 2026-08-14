# KOLEKTO WORKSPACE — PHASE 1.5 PRODUCTION READINESS AUDIT

> **SUPERSEDED (2026-08-13):** current state is tracked in `KOLEKTO_WORKSPACE_2.0_ARCHITECTURE_AUDIT.md`. In particular, BUG-2 (anon profile PII) and the broad `collections_public_read` policy — both open when this audit was written — were independently re-verified as **fixed on TEST** in the superseding document. This document is retained for its methodology and historical findings.

**Date:** 2026-08-12 · **Scope:** audit + discovery only. No Phase 2 built.
**Test project:** `lpeeckqsltxohppheucz` (Phase 1 applied) · **Prod:** `busfgcmbndleljklrcbd` — **inspected READ-ONLY, unchanged.**

Every prod statement in this document is a `SELECT`. No INSERT/UPDATE/DELETE/DDL was issued against production.

---

## 1. Verdict: 🟡 PASS WITH CONDITIONS

The **Workspace Phase 1 implementation itself is sound and safe to roll out.** Isolation holds, financial logic is untouched, the production dry-run is clean, and every migration is reversible.

The conditions are **not defects in Workspace**. They are three pre-existing production problems this audit uncovered, two of which are more serious than anything in the Workspace work. They do not technically block the rollout — but shipping Workspace while leaving them unrecorded would be negligent.

---

## 2. Executive summary

| Area | Result |
|---|---|
| Phase 1 correctness (12 DB assertions) | ✅ all PASS |
| Production dry-run (W5/W6) | ✅ clean — 0 conflicts, 0 ambiguity |
| Production migration prerequisites | ✅ all present |
| Financial safety | ✅ zero coupling — proven by grep + diff + tests |
| Workspace isolation (anon-probed) | ✅ `workspaces`/`workspace_members` return 0 rows to anon |
| Phase 1 defects found | 1 (frontend bootstrap) — **fixed + regression-tested** |
| Backend tests | ✅ 505/505 |
| Frontend tests | ✅ 34/34 (+7 new) |
| Typecheck | ✅ 138 pre-existing, **0** from Workspace |
| **Pre-existing prod issues found** | 🔴 3 — see §10 |

**The single most important finding is not about Workspace at all:** any holder of the public `anon` key can read **every user's email address and phone number**. Verified empirically, not inferred.

---

## 3. Phase 1 verification (test project)

All 12 assertions PASS:

| Check | Result |
|---|---|
| W1 `workspaces` + partial unique index + RLS + `ON DELETE RESTRICT` | PASS |
| W2 `workspace_members` + `unique(workspace_id,user_id)` + RLS | PASS |
| W1/W2 **no write policy** granted to `authenticated` | PASS |
| W3 `workspace_id` NULLABLE + FK RESTRICT + indexed | PASS |
| W3 `collections.user_id` still `NOT NULL` | PASS |
| W3 collection RLS **still `user_id`-based, unchanged** | PASS |
| W4 trigger present, `SECURITY DEFINER`, pinned `search_path` | PASS |
| W5 every profile has **exactly one** personal workspace (69/69) | PASS |
| W5 every personal workspace has **exactly one** active OWNER | PASS |
| W6 all 72 collections assigned, **0** owner mismatches | PASS |
| Rollback safety: workspace delete blocked while collections reference it | PASS |
| Isolation: **0** cross-owner membership rows | PASS |

**W4 signup-safety (the highest-risk object)** was verified end-to-end: inserting an `auth.users` row produced exactly `workspaces=1, memberships=1, role=OWNER`. The probe ran inside a self-aborting block and left nothing behind (`probe_users_left = 0`). The function's `EXCEPTION WHEN OTHERS` handler guarantees a provisioning failure downgrades to a `WARNING` and returns `NEW` — **signup cannot be broken by workspace provisioning.**

---

## 4. Production dry-run (READ-ONLY)

### Prerequisites — all present on prod

| Prerequisite | Status |
|---|---|
| `update_updated_at_column()` (W1/W2 depend on it) | PRESENT |
| `gen_random_uuid()` | PRESENT |
| `handle_new_user()` + `on_auth_user_created` | PRESENT |
| `trg_profiles_ensure_personal_workspace` | ABSENT (expected) |
| Workspace tables already present | 0 (expected) |
| `profiles.first_name/full_name/email` | 3 of 3 |
| PostgreSQL | **15.8** (test is 17.4) — nothing used is version-sensitive |

### W5 — personal workspace backfill

| Metric | Prod |
|---|---|
| Total profiles (candidates) | **606** |
| Profiles with valid `auth.users` row | 606 |
| Profiles with NO auth user (skipped) | **0** |
| Personal workspaces to CREATE | **606** |
| OWNER memberships to CREATE | **606** |
| Predicted slug collisions | **0** |
| `auth.users` without profile (get no workspace, by design) | 1 |

### W6 — collection ownership backfill

| Metric | Prod |
|---|---|
| Total collections | **262** |
| Deleted collections (still assigned) | 8 |
| Owner has a profile | **262 / 262** |
| Owner missing from `profiles` | **0** |
| Owner missing from `auth.users` | **0** |
| Rows that would fail `validate_collection_amount` | **0** |
| Distinct collection owners | 108 |

**Conclusion: the production backfill is deterministic and unambiguous.** Every collection resolves to exactly one valid owner, therefore to exactly one personal workspace. No §24 stop condition is triggered.

The one `auth.users` row without a profile receives no workspace. That is correct: the backfill keys on `profiles` and skips rather than guesses. It will self-heal via `ensurePersonalWorkspace()` if that account ever signs in.

---

## 5. Financial safety verification

Four independent lines of evidence:

1. **Grep:** zero occurrences of `workspace` in `paymentService.js`, `pricingService.js`, `settlementService.js`, `paymentRepository.js`, `utils/financial.js`, `controllers/deposit.js`, `controllers/withdrawal.js`.
2. **Imports:** `workspaceService` / `workspaceAuthorizationService` / `workspaceRepository` import only each other, the Supabase client, and the logger. No financial module.
3. **Diff:** the entire backend change is **85 insertions / 1 deletion across 4 files**. `git diff` shows **zero removed `user_id` lines** — no query was switched from `user_id` to `workspace_id`. Exactly one line writes `workspace_id`.
4. **Data:** every financial sum on test is byte-identical before and after the whole phase — wallets available `49,815,548.09`, contributions `50,204,804.00`, withdrawals `559,031.00`, collections.amount `1,414,599.00`.

Workspace touches **8 backend files total**, of which only 3 are non-workspace-specific (`collectionService.js`, `controllers/collection.js`, `app.js`).

**Withdrawal authorization is unchanged.** It still authorizes on `user_id`. The `withdrawal:*` capabilities are declared but wired to nothing — deliberately, so a future implementer cannot casually widen them.

---

## 6. `transactions` investigation — definitive

**The premise of the task brief is incorrect, and so was my own earlier report. I got this wrong and am correcting it.**

> ❌ Claimed: "Test lacks a `transactions` table; production has it."
> ✅ **Reality: NEITHER database has a `transactions` table.**

Evidence:

| Question | Answer |
|---|---|
| Does prod have `public.transactions`? | **No** — `relation "public.transactions" does not exist`; absent from the full 51-table prod listing |
| Does test have it? | No |
| When was it introduced? | **Never.** No migration in `database/` creates it |
| What writes to it? | Nothing |
| What reads from it? | Nothing at runtime |

**Where the belief came from — three stale artifacts:**

1. **`src/integrations/supabase/types.ts`** declares `transactions` *and* `payment_config`. **Neither exists in either database.** The file is hand-maintained and aspirational, not generated. It is the root cause of this myth.
2. **`GET /transactions` was deliberately removed** from the backend for security (it returned rows unfiltered by caller). `tests/productionHardening.test.js:54` actively asserts the route *must not* be mounted.
3. **`transactionAPI` in `src/utils/api.ts:68` is dead code** — defined, never imported, and points at that removed route.

**What "transactions" actually is in Kolekto:** a *derived UI view*. `useTransactionStore.ts` composes it at read time from `collections` + `contributions` + `withdrawals`. The real payment records are `contributions` (5,537 rows on prod) and `deposits` (6,201 rows).

**Recommendation:** `transactions` needs **no Workspace ownership** because it does not exist. Do not create it. Instead: regenerate `types.ts` from the live schema (removing the two phantom tables) and delete the dead `transactionAPI`. Contributions inherit workspace scope through `collection_id` — no new column required.

---

## 7. Public RLS investigation

### Verified access matrix

Probed empirically with the real `anon` key against **test** (policies are identical on prod). Numbers are rows actually returned.

| Table | Anon (public) | Notes |
|---|---|---|
| `profiles` | 🔴 **ALL 69** | **email + phone_number of every user** |
| `collections` | ⚠️ **ALL 72** | incl. `amount`, `support_phone_number`, `user_id`, `code_prefix` |
| `campaigns` | ⚠️ 17 | public fundraising — by design |
| `contributions` | ✅ 0 | blocked |
| `withdrawals` | ✅ 0 | blocked |
| `deposits` | ✅ 0 | RLS on, no policies → deny-all |
| `wallets` | ✅ 0 | blocked |
| `payout_accounts` | ✅ 0 | blocked |
| `kyc_verifications` | ✅ 0 | blocked |
| `notifications` | ✅ 0 | blocked |
| `admin_users` | ✅ 0 | blocked |
| `collection_access_grants` | ✅ 0 | RLS on, no policies → deny-all |
| **`workspaces`** | ✅ **0** | **Phase 1 RLS correct** |
| **`workspace_members`** | ✅ **0** | **Phase 1 RLS correct** |

### Role-by-role (derived from policy definitions)

| Resource | Public | Auth non-owner | Owner | Platform admin |
|---|---|---|---|---|
| Collection metadata | ✅ all non-deleted | ✅ all | ✅ | ✅ |
| Contributors (`contributions`) | ❌ | ❌ (unless access-grant) | ✅ | ✅ |
| Wallet / balances | ❌ | ❌ (unless grant w/ `can_view_earnings`) | ✅ | ✅ |
| Withdrawals | ❌ | ❌ | ✅ own | ✅ |
| Profiles (PII) | 🔴 **✅ ALL** | 🔴 **✅ ALL** | ✅ | ✅ |
| Workspace / membership | ❌ | ❌ | ✅ own | ❌ (no admin policy yet) |

**The good news:** the money and contributor tables are correctly locked, and `collection_access_grants` already implements a working capability-ish pattern (`can_view_earnings` / `can_view_contributors`) that Phase 2 can migrate into `workspace_members`.

**`collections_public_read` is genuinely load-bearing** for public contribute/payment pages — it must not simply be dropped. But it exposes the *whole row* when the public page needs perhaps eight fields. Phase 2 fix in the architecture doc §Public Collection Model.

---

## 8. Workspace security audit

| Control | Status | Evidence |
|---|---|---|
| Server-side membership enforcement | ✅ | `assertCapability` re-queries membership on every use |
| Forged `X-Workspace-Id` rejected | ✅ | fatal 404, **never** falls back to personal — tested |
| Non-member gets 404 not 403 | ✅ | avoids confirming workspace existence to outsiders |
| No self-granted membership | ✅ | no INSERT/UPDATE/DELETE policy for `authenticated` |
| MEMBER cannot create collections | ✅ | capability map + test |
| Membership never implies withdrawal | ✅ | `withdrawal:create` OWNER-only; `withdrawal:approve` **no role** |
| Unknown role fails closed | ✅ | `capabilitiesForRole()` returns `[]` |
| Suspended membership grants nothing | ✅ | repo filters `status='active'` |
| Layering respected | ✅ | only `workspaceRepository` calls `supabase.from()` |
| Race safety | ✅ | unique index is the arbiter; loser re-reads |

**No authorization bypass was found.**

---

## 9. Frontend audit

| Scenario | Result |
|---|---|
| Bootstrap on login | ✅ |
| Persistence across reload | 🔴 **BROKEN — found & fixed** (see §10 BUG-1) |
| A logs out → B logs in | ✅ now isolated by user-scoped storage |
| Stale/deleted/suspended workspace id | ✅ dropped — server list is authoritative |
| Membership revoked | ✅ falls back to personal |
| Switch to unknown workspace | ✅ ignored client-side, rejected server-side |
| Ambassador requests | ✅ never receive the header (early return) |
| Error state | ✅ swallowed; app never degrades |

---

## 10. Bugs found

### BUG-1 · Workspace bootstrap wiped persistence on every page load — **MEDIUM** — ✅ FIXED

- **Root cause:** `useAuthStore` initialises `user: null` and resolves the session asynchronously via `checkAuth()`. `useWorkspaceBootstrap` treated *any* falsy user as "signed out" and called `reset()`, which cleared `localStorage` **before auth had resolved** — on every single page load.
- **Impact:** persistence was silently non-functional. Invisible today (every user has exactly one personal workspace, so the fallback re-selects the same one). In Phase 2 with multiple workspaces it would reset the user's selection to personal on every refresh, and collections created in that window would be mis-attributed to the personal workspace. Not a data-leak; a correctness bug.
- **Fix:** distinguish the three states using `isLoading` (`true` = auth still verifying → do nothing). Additionally the persisted value is now **scoped to a user id**, so a shared browser can never hand account A's selection to account B. Legacy plain-string values from the previous build are ignored rather than mis-attributed.
- **Verification:** 7 new tests in `src/utils/activeWorkspace.test.ts`, all passing.

### BUG-2 · 🔴 Anon key can read every user's email and phone — **HIGH — PRE-EXISTING, NOT FIXED**

- **Root cause:** `profiles` carries policy `Public profiles are viewable by everyone [SELECT to public] USING (true)` plus an `anon` SELECT grant.
- **Impact:** anyone holding the `anon` key — which ships inside the public frontend bundle — can enumerate **all 606 production users' email addresses and phone numbers**. Empirically confirmed on test: 69/69 rows returned with real emails and phone numbers.
- **Why not fixed here:** out of scope (§14/§25 — not a Workspace defect), prod is read-only, and tightening it needs verification of which public pages depend on profile reads. **This should be triaged independently of, and probably ahead of, the Workspace rollout.**

### BUG-3 · 🔴 `email_unsubscribes` missing on prod — **HIGH — PRE-EXISTING, NOT FIXED**

- **Root cause:** the table exists on **test** but **not on prod**; `database/email_unsubscribes.sql` was never applied to production.
- **Impact, two failure modes:**
  - `utils/audienceMaterializer.js:51` checks the error and **throws** → campaign segment materialisation fails loudly.
  - `jobs/emailCampaignQueue.js:217` **ignores the error** (`const { data: unsubRows }`) → `unsubRows` is `null` → the final unsubscribe suppression set is empty → **already-queued campaign emails would be sent to people who unsubscribed.** That is a silent compliance failure.
  - `controllers/emailUnsubscribe.js:42` → the unsubscribe endpoint itself cannot work on prod.
- **Recommendation:** apply the migration to prod, and fix the ignored error at `emailCampaignQueue.js:217` so suppression fails closed rather than open.

### OBS-1 · Phantom tables in `types.ts` — LOW

`transactions` and `payment_config` are declared but exist in neither database (§6). Plus dead `transactionAPI`. Regenerate types from the live schema.

### OBS-2 · Duplicate/overlapping RLS policies — LOW

`profiles` carries 9 policies with three near-identical own-read variants; `collections` and `campaigns` similar. Harmless (permissive policies OR together) but they make the effective policy hard to reason about — exactly the condition under which BUG-2 went unnoticed. Consolidate in Phase 2.

---

## 11. Changes made

Only BUG-1 was fixed. Permitted under §25 as "broken frontend Workspace bootstrap": a clear Phase 1 defect, no architectural change, no financial impact, no production change, fully tested.

| File | Change |
|---|---|
| `src/utils/activeWorkspace.ts` | Store `{userId, workspaceId}`; added `getActiveWorkspaceIdForUser()`, `clearActiveWorkspace()`; ignore legacy/corrupt values |
| `src/hooks/useWorkspaceBootstrap.ts` | Gate on `isLoading` — only clear when auth has **resolved** with no user |
| `src/store/useWorkspaceStore.ts` | `fetchWorkspaces(userId)` / `switchWorkspace(id, userId)` — user-scoped reconciliation |
| `src/components/workspace/WorkspaceSwitcher.tsx` | Pass `userId` when switching |
| `src/utils/activeWorkspace.test.ts` | **New** — 7 isolation/robustness tests |

**No backend, database, or migration file was changed. Production was not touched.**

---

## 12. Tests

| Suite | Result |
|---|---|
| Backend (`npm test`) | ✅ **505 / 505** |
| Frontend (`vitest run`) | ✅ **34 / 34** (was 27; +7) |
| Frontend build | ✅ succeeds |
| Typecheck | ✅ **138** pre-existing, **0** from Workspace |
| DB VERIFY (test) | ✅ **12 / 12** |
| W4 signup probe | ✅ 1 workspace, 1 OWNER, 0 residue |

The 3 "failed suites" in vitest are pre-existing empty files under `kolekto-shared-financial/test/` (no test suite defined) — untouched by this work.

---

## 13. Production rollout recommendation

**🟡 PASS WITH CONDITIONS — Workspace itself is approved for controlled rollout.**

Everything fails soft, so ordering is forgiving: if the API ships before the tables exist, implicit workspace resolution swallows the error and collection creation proceeds; if the frontend ships before the API, `/workspaces` 404s, no header is sent, and the backend falls back to the personal workspace.

**Recommended order:**

1. Apply **W1 → W2 → W3 → W4** (additive; no behaviour change). Run each `_VERIFY`.
2. Re-run the **W5 dry-run against prod** and confirm it still reads 606 / 0 conflicts.
3. Execute **W5**. Verify 606 workspaces + 606 OWNER memberships.
4. Re-run the **W6 dry-run** (expect "cannot safely assign" to drop to 0 after W5).
5. Execute **W6**. Verify 262 assigned, 0 mismatches, and re-run the financial characterization sums.
6. Deploy backend, then frontend.
7. Soak. `workspace_id` stays inert — nothing reads it.

**Conditions (none are Workspace defects):**

| # | Condition | Blocking? |
|---|---|---|
| C1 | Triage **BUG-2** (anon PII exposure). Severity exceeds anything in Workspace. | Not technically blocking — but should be scheduled first |
| C2 | Apply `email_unsubscribes` to prod and fix the ignored error (**BUG-3**) | Independent |
| C3 | Regenerate `types.ts`; delete dead `transactionAPI` | No |
| C4 | Confirm prod backup/PITR before W5/W6 | **Yes** |

---

## 14. Phase 2 summary

Phase 2 is where `workspace_id` stops being inert. Design detail: **`KOLEKTO_WORKSPACE_PHASE_2_ARCHITECTURE.md`**.

The sequencing principle: **make workspace ownership *equivalent* before making it *authoritative*.** While every workspace has exactly one member, `workspace_id` and `user_id` are provably interchangeable — that equivalence is the safety net that lets reads and RLS switch over with no behavioural change. It only breaks the moment a second member is added, so **multi-member support must ship last, not first.**
