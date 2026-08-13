# KOLEKTO — PHASE 1.5 REMEDIATION & PHASE 2A ROLLOUT — FINAL REPORT

**Date:** 2026-08-12
**Test project:** `lpeeckqsltxohppheucz` — remediation applied & verified
**Production project:** `busfgcmbndleljklrcbd` — **UNCHANGED. Zero writes. Every interaction was a `SELECT` or metadata read.**

---

## 1. Executive summary

| | |
|---|---|
| **Starting state** | Phase 1 built & verified on test; two HIGH pre-existing prod bugs open; prod not migrated |
| **Ending state** | Both HIGH bugs fixed & verified **on test**; phantom artifacts cleaned; Workspace re-verified; prod migration **prepared but NOT executed** |
| **Overall status** | 🔴 **BLOCKED — Phase 2A production rollout did not proceed** |

**Remediation succeeded. The production rollout is blocked by a hard gate that cannot be satisfied on the current Supabase plan.**

### The blocker

Audit condition **C4** required confirmed backup/PITR before executing W5/W6. Verified via the Supabase management API:

```
Organization : Kolekto Org (wzkhbvbimazkabmdbawa)
Plan         : free
```

Point-in-Time Recovery is a **Pro-plan add-on**; Free-tier projects have no automated backup to restore from. Task §17 states plainly: *"If PITR/backup cannot be confirmed: STOP. Do not execute W5/W6."*

W5/W6 would write **868 new rows** and touch **262 existing collection rows** in a live fintech database holding ₦66.3M of contribution history. Doing that with no restore point — when the migration is not time-critical — is not a defensible trade. **Stopped and reported rather than proceeding.**

> The user additionally instructed mid-task: *"do not do anything on supabase prod project."* This matches the decision already taken. No production change was made.

---

## 2. Scope performed

| Phase | Status |
|---|---|
| A — Re-scan codebase & DB | ✅ |
| B — BUG-2 public PII exposure | ✅ fixed & empirically verified on test |
| C — BUG-3 email unsubscribe | ✅ migration written; fail-open → fail-closed fixed; 7 tests |
| D — Phantom transaction cleanup | ✅ |
| E — Workspace re-verification | ✅ |
| F — **Production migration** | 🔴 **NOT EXECUTED — backup gate failed** |

---

## 3. BUG-2 resolution — public profile PII exposure

**Root cause.** `profiles` carried `"Public profiles are viewable by everyone" FOR SELECT TO public USING (true)` plus an `anon` SELECT grant. Anyone holding the anon key — shipped inside the public frontend bundle — could enumerate every user's email and phone number.

**Dependency investigation (done before any change).** Nothing relies on anon/authenticated RLS access to `profiles`:

| Consumer | Access path | Affected? |
|---|---|---|
| React frontend | **zero** direct `supabase.from("profiles")` reads — all via Express API | No |
| Express backend | `serviceSupabase` (service_role) — bypasses RLS; all 51 read sites | No |
| Edge Functions (4 that read profiles) | all use `SUPABASE_SERVICE_ROLE_KEY` | No |
| `profile-update` anon client | used **only** for `auth.getUser()`, never to read profiles | No |

Because public pages never read this table, **no replacement view for organizer data was required.**

**Change applied (test):** `database/s1_profiles_pii_lockdown_2026-08-12.sql` — drop the blanket policy; revoke `anon` SELECT (defence in depth: RLS *and* grants must both fail before PII leaks).

**Empirical before/after — real anon key, live HTTP:**

| Probe | Before | After |
|---|---|---|
| `GET /profiles?select=email,phone_number` | real emails + phone numbers returned | `401 — permission denied for table profiles` |
| anon profile row count | **69 / 69** | **0 (denied)** |
| `collections` (public payment pages) | 72 | **72 — unchanged** ✅ |
| `campaigns` (public fundraising) | 17 | **17 — unchanged** ✅ |
| `service_role` read (backend/edge) | 69 | **69 — unchanged** ✅ |

**Verification:** 8/8 policy assertions PASS. Own-profile read and admin read both retained.

⚠️ **This fix is applied to TEST ONLY. Production is still exposed** — see §14.

---

## 4. BUG-3 resolution — email unsubscribe

**Why the table was missing:** `database/email_unsubscribes.sql` was authored but never applied to prod. It also never enabled RLS — on test, RLS was enabled by a later lockdown pass, leaving RLS ON with zero policies (service_role only), which is the correct posture.

**Migration prepared:** `database/s2_email_unsubscribes_prod_2026-08-12.sql` (+ `_VERIFY`). Idempotent; reproduces the test end-state explicitly rather than depending on a second lockdown step; `revoke all` from `anon`/`authenticated` because the suppression list is itself a list of email addresses. **Not applied to prod** (prod frozen).

**Fail-open → fail-closed (`jobs/emailCampaignQueue.js:217`):**

```diff
- const { data: unsubRows } = await supabase.from('email_unsubscribes')...
+ const { data: unsubRows, error: unsubError } = await supabase.from('email_unsubscribes')...
+ if (unsubError) {
+   console.error('[email-queue] unsubscribe lookup failed — refusing to send this batch (fail-closed):', unsubError.message);
+   await releaseClaims(batch.map((r) => r.id));
+   return { processed: 0, sent: 0, failed: 0, throttled: 0 };
+ }
```

The batch is **released, not consumed**, so it retries on a later tick — reusing the exact recovery path `claimBatch()` already uses when campaigns fail to load. Sending to an unsubscribed recipient is irreversible; delaying a batch is not.

**Tests:** 7 new in `tests/emailUnsubscribeFailClosed.test.js`, all passing — including a guard that fails if the original error-discarding shape ever returns, and an ordering assertion that the guard precedes both the suppression set and the send loop. `controllers/emailUnsubscribe.js` confirmed already idempotent via upsert (duplicate unsubscribe is safe).

---

## 5. Phantom transaction cleanup

| Artifact | Finding | Action |
|---|---|---|
| `public.transactions` | **absent from BOTH databases**; no migration ever created it | none — correctly absent, **do not create** |
| `public.payment_config` | **absent from BOTH databases** | none |
| `types.ts` declarations | both declared → source of repeated false conclusions | **removed** (104 lines) + header explaining the trap |
| `transactionAPI` (`src/utils/api.ts`) | dead: defined, imported nowhere, pointed at routes removed for security | **removed**, with a note not to reintroduce |
| `GET /transactions` route | intentionally removed; `productionHardening.test.js` guards it | **not** reintroduced |

Transaction history in the UI is a **derived view** over `collections` + `contributions` + `withdrawals` (`useTransactionStore.ts`). Durable records are `contributions` (5,539) and `deposits` (6,201).

---

## 6. Workspace verification (test)

| Migration | Result |
|---|---|
| W1 `workspaces` | ✅ table, partial unique index, RLS, `ON DELETE RESTRICT` |
| W2 `workspace_members` | ✅ table, `unique(workspace_id,user_id)`, RLS, no write policies |
| W3 `collections.workspace_id` | ✅ nullable, FK RESTRICT, indexed; `user_id` still `NOT NULL` |
| W4 provisioning trigger | ✅ present, `SECURITY DEFINER`, pinned `search_path`, exception-safe |
| W5 personal backfill | ✅ 69/69, exactly one OWNER each |
| W6 collection backfill | ✅ 72/72 assigned, 0 mismatches |

State re-confirmed intact after the BUG-2 change.

---

## 7. Production dry run — final numbers (not executed)

| Metric | Expected | Actual | Match |
|---|---|---|---|
| Profiles | 606 | **606** | ✅ |
| Workspaces to create | 606 | **606** | ✅ |
| OWNER memberships | 606 | **606** | ✅ |
| Slug conflicts | 0 | **0** | ✅ |
| Collections | 262 | **262** | ✅ |
| Owner mismatches / unresolved | 0 | **0** | ✅ |
| Rows failing `validate_collection_amount` | 0 | **0** | ✅ |
| auth users without profile (get no workspace) | 1 | **1** | ✅ |

**The migration is ready. Only the backup gate blocks it.**

---

## 8. Financial safety

**Production baseline captured (read-only), for comparison after any future migration:**

| Metric | Baseline |
|---|---|
| wallets.available_balance | 3,323,037.07 |
| wallets.pending_balance | 70,000.00 |
| wallets.ledger_balance | 3,393,037.07 |
| wallets.withdrawn | 41,489,309.80 |
| wallets.gross_payment | 45,540,109.44 |
| wallets.net_payment | 44,633,588.72 |
| contributions | 5,539 rows / 66,340,379.98 |
| withdrawals | 267 rows / 41,967,769.80 |
| collections.amount | 3,223,379.93 |
| collections.total_contributions | 3,909 |
| deposits | 6,201 rows |

*Note: contributions moved 5,537 → 5,539 between audit passes. That is live user activity on production, not migration drift — expected, and a reason to re-baseline immediately before any future migration rather than reusing these figures.*

**Test financials — unchanged, exact:** wallets 49,815,548.09 · contributions 50,204,804.00 · withdrawals 559,031.00 · collections.amount 1,414,599.00. **Difference: 0 on every metric.**

**Diff proof:** added lines across the backend contain **zero** matches for `wallet`, `withdrawal`, `payment`, `paystack`, `contribution`, `settlement`, `fee_bearer`, or `amount`. No financial module was opened.

---

## 9. Security verification (test, real anon key)

| Table | Anon rows |
|---|---|
| **profiles** | **0 — DENIED (was 69)** ✅ |
| collections | 72 (public payment pages — by design) |
| campaigns | 17 (public fundraising — by design) |
| contributions / withdrawals / deposits / wallets | 0 ✅ |
| payout_accounts / kyc_verifications / notifications / admin_users | 0 ✅ |
| collection_access_grants | 0 ✅ |
| **workspaces / workspace_members** | **0** ✅ |

**Remaining exposure:** `collections` still returns whole rows to anon (incl. `support_phone_number`, `user_id`, `code_prefix`). Load-bearing for payment pages; column-narrowing via a curated view is Phase 2H.

---

## 10. Automated tests

| Suite | Before | After |
|---|---|---|
| Backend | 505/505 | ✅ **512/512** (+7 email fail-closed) |
| Frontend | 34/34 | ✅ **34/34** |
| Frontend build | PASS | ✅ PASS |
| Typecheck | 138 pre-existing | ✅ **138** — no new errors |
| Workspace DB assertions | 12/12 | ✅ 12/12 |
| BUG-2 policy assertions | — | ✅ 8/8 |
| Empirical anon RLS probes | — | ✅ 14 tables |

3 vitest "failed suites" are pre-existing empty files in `kolekto-shared-financial/test/` — untouched.

---

## 11. Files changed

| File | Change | Reason | Risk |
|---|---|---|---|
| `database/s1_profiles_pii_lockdown_*.sql` (+ROLLBACK) | new | BUG-2 | Low — policy only, no data |
| `database/s2_email_unsubscribes_prod_*.sql` (+VERIFY) | new | BUG-3 | Low — additive table |
| `jobs/emailCampaignQueue.js` | fail-closed guard | BUG-3 | Low — worst case delays a batch |
| `tests/emailUnsubscribeFailClosed.test.js` | new (7) | BUG-3 regression | None |
| `src/integrations/supabase/types.ts` | −104 lines (phantoms) | OBS-1 | Low — unreferenced |
| `src/utils/api.ts` | removed `transactionAPI` | dead code | Low — unimported |

Plus Phase 1 Workspace files carried from the prior task (unchanged this round).

---

## 12. Production changes

**NONE.**

| Timestamp | Change | Result |
|---|---|---|
| — | *no production migration executed* | prod schema, data, RLS, and grants byte-identical to session start |

Production interactions were exclusively: `SELECT` dry-run queries, schema introspection, `get_project`, `get_organization`. No INSERT/UPDATE/DELETE/DDL.

---

## 13. Rollback plan

**For test-applied changes:**

| Change | Rollback |
|---|---|
| `s1` profiles lockdown | `s1_..._ROLLBACK.sql` — re-grants + recreates policy (⚠️ re-opens the leak) |
| Code changes | `git checkout` the listed files |
| Workspace W1–W6 | existing `w6 → w1` rollback files, in reverse order |

**For production:** nothing to roll back — nothing was applied.

---

## 14. Remaining risks

| # | Risk | Severity | Status |
|---|---|---|---|
| R1 | **BUG-2 still LIVE on production** — 606 users' emails/phones readable by anon | 🔴 **HIGH** | Fix written & test-proven; **awaiting authorization to apply to prod** |
| R2 | **BUG-3 still LIVE on production** — no `email_unsubscribes`; unsubscribe endpoint non-functional | 🔴 **HIGH** | Migration written; code fix will fail closed once deployed |
| R3 | **No production backup/PITR** (free plan) | 🔴 **HIGH** | Blocks all data migration; architectural risk beyond Workspace |
| R4 | `collections` whole-row anon exposure | 🟠 Medium | Phase 2H |
| R5 | Duplicate/overlapping RLS policies (OBS-2) | 🟢 Low | Phase 2 cleanup |
| R6 | `types.ts` still hand-maintained (covers ~5 of ~50 tables) | 🟢 Low | Regenerate via CLI |

**R3 deserves emphasis beyond this task.** A revenue-bearing fintech database holding ₦66M of contribution history on a plan with no PITR is a standing business risk independent of Workspace. Upgrading to Pro is the prerequisite for this rollout *and* prudent regardless of it.

---

## 15. Phase 2 readiness

| Question | Answer |
|---|---|
| Can Phase 2B (equivalence harness) begin? | **NO** — 2B measures production Workspace data; 2A must land first |
| Can Phase 2C begin? | **NO** — requires 2B green |
| Can multi-member workspaces begin? | **NO** — would destroy the `user_id ↔ workspace_id` equivalence before it is verified |

---

## FINAL EXECUTIVE VERDICT

```
PRODUCTION STATUS:      UNCHANGED — Phase 2A NOT executed (backup gate failed)
SECURITY STATUS:        BUG-2 fixed and proven on TEST; STILL LIVE on PROD
FINANCIAL SAFETY:       INTACT — zero financial modules touched; test deltas = 0
WORKSPACE STATUS:       VERIFIED on test (12/12); prod dry-run exact; ready to migrate
EMAIL SYSTEM STATUS:    Fail-closed in code; prod table migration written, not applied
ROLLBACK STATUS:        Nothing to roll back in production; all test changes reversible
NEXT RECOMMENDED PHASE: Enable PITR → apply s1 + s2 to prod → then Phase 2A
```

### Engineering recommendation

Do these in order:

1. **Upgrade the Supabase org to Pro and enable PITR.** This is the gate blocking everything else, and it is warranted on its own merits for a database holding ₦66M of financial history.
2. **Apply `s1` (profiles lockdown) to production.** It writes no data and reverses in one statement, so it is the lowest-risk, highest-value change available — and it stops an active PII leak affecting 606 real users. I would ship this *first*, ahead of Workspace.
3. **Apply `s2` (email_unsubscribes) to production** and deploy the fail-closed queue fix together.
4. **Then, and only then, execute Phase 2A** (W1→W6 with per-stage verification), re-baselining financials immediately beforehand since production is live.

I stopped rather than migrating because the migration was safe *except* for having no restore point — and "the dry run was clean" is not a substitute for one. Nothing about this rollout is time-critical; the backup is cheap insurance against the one class of failure that cannot be undone.
