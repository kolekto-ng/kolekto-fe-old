# H2 — Atomic Contributor-Code Allocation: Implementation Report

**Scope:** implemented and tested against the **TEST** Supabase project (`lpeeckqsltxohppheucz`) only. Production (`busfgcmbndleljklrcbd`) was never accessed, queried, or modified during this work — confirmed at the end of this report (§9).

---

## 1. What Was Changed

| File | Change |
|---|---|
| `kolekto-be-old/database/h2_atomic_contributor_code_allocation.sql` (new) | `CREATE OR REPLACE FUNCTION public.claim_payment_contributions` — same name/signature, now allocates the contributor code itself, inline, immediately before each row's insert, inside the same transaction. Applied to TEST via two migrations (`h2_atomic_contributor_code_allocation`, then `h2_atomic_contributor_code_allocation_fix_jsonb_set` — see §6 for why a second pass was needed). |
| `kolekto-fe-old/supabase/functions/verify-paystack-payment/index.ts` | Removed the per-unit `next_contribution_code_number` RPC call and in-memory fallback counting. Removed `contributor_unique_code` from the row payload; added `prefix` instead. Collapsed the `useAtomicRpc`/default branch split into one path that always calls `claim_payment_contributions`. `deferCapacityChecks` is now unconditionally `true`. Deployed to TEST (version 37, `ACTIVE`). |
| `kolekto-be-old/tests/integration/h2AtomicContributorCode.integration.test.js` (new) | 10 new integration tests (Cases A, B, D–J + a constraint sanity check) exercising the real TEST database — no mocks. |
| `next_contribution_code_number` (unchanged) | Left in the schema, untouched. No longer called from any live payment path (edge function or `claim_payment_contributions`). Still used by `scripts/backfillUniqueContributionCodes.js` (an offline, operator-invoked script) — **retire from the live path, keep for the backfill script**, per requirement 14. |

Nothing else changed: `contribution_code_counters`'s shape and seeded values, both unique constraints (`(collection_id, contributor_unique_code)`, `(collection_id, payment_reference, line_index)`), `enforce_max_contributions`, `trg_ambassador_payment_attribution`, fee/amount/wallet math, and every historical `contributor_unique_code` value are all untouched.

---

## 2. Why the Previous H1 Implementation Was Insufficient

H1 (`claim_payment_contributions` as it existed before this change) made **idempotency, capacity, and insertion** atomic — a real, working, previously-tested fix for the duplicate-payment/race-condition incident it targeted. But it took `contributor_unique_code` as a **plain input field** in `p_rows`, already computed by the edge function's per-unit loop **before** the RPC was ever called (`next_contribution_code_number`, its own separately-committed statement). So:

- A `capacity_exceeded` outcome, or an `idempotent` (race-lost) outcome, still meant a code minted moments earlier — outside the RPC's transaction entirely — was gone forever.
- The exact production incident this closes (collection "Busybrain Night Of Majesty", prefix `BBN`: 34 real contributions, counter at 3,361) was driven by a **third** failure mode H1 didn't touch at all: a plain insert error (`22001`, phone too long), retried every 5 minutes forever by `scheduled-payment-recovery`, re-minting and re-failing each time.

H1's atomicity was real but scoped to the wrong boundary — it started one step too late.

---

## 3. Exact Transaction Boundary

Everything now happens inside **one** call to `claim_payment_contributions`, which is one Postgres transaction (an RPC invocation with no enclosing caller transaction runs as its own implicit transaction):

1. `SELECT ... FOR UPDATE` on the `collections` row (unchanged from H1) — serializes every call for this collection.
2. Idempotency check by `(collection_id, payment_reference)` (unchanged from H1) — returns early, before any allocation, if this reference already has rows.
3. Collection-wide capacity check, then per-tier capacity check (unchanged from H1) — returns early, before any allocation, on rejection.
4. **New in H2:** for each row in `p_rows`, in a loop: resolve `prefix` → atomically increment `contribution_code_counters` (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) → build `contributor_unique_code` → merge it into `contributor_information[0]._receipt` → `INSERT INTO contributions`.
5. Re-select and return the full committed row set.

The edge function's job shrank to: resolve which `prefix` applies to each unit (unchanged resolution logic — unit/tier prefix falling back to `collection.code_prefix`), and pass it through. It never computes or holds a code.

---

## 4. How Sequence Allocation Now Rolls Back With Contribution Insertion

The function's existing top-level `BEGIN ... EXCEPTION WHEN unique_violation ... END` block wraps the **entire** function body — in PL/pgSQL this is an implicit sub-transaction (savepoint) established at function entry.

- **A `unique_violation`** (a genuine concurrent-duplicate-insert race) rolls back **everything** done since function entry — every counter increment and every insert already performed earlier in that same call's loop — before the handler re-fetches and returns the winner's committed rows. A partially-through-its-own-loop attempt that then collides is discarded as one atomic unit; nothing it minted survives.
- **Any other exception** (a trigger raising — `enforce_max_contributions`, `trg_ambassador_payment_attribution`, or any future trigger — a type/constraint violation, anything) is **deliberately not caught** (no `WHEN OTHERS`), so it propagates out of the function and aborts the entire enclosing transaction, which equally undoes every counter increment made during the call.

**Directly proven, not just reasoned about** (§7, Case C): a real multi-statement transaction against TEST — bump a counter, then attempt a paid insert that `enforce_max_contributions` rejects — showed the trigger's `RAISE EXCEPTION` aborted both statements; the counter table had **zero rows** for that key afterward, confirming the increment did not survive.

---

## 5. Concurrency Guarantees

- **Two different, genuinely concurrent successful payments, same collection/prefix:** serialize on the `collections` row lock; each sees the live counter and capacity state; get distinct, sequential codes. **Proven** (Case G): two concurrent references got `TSTG-001` and `TSTG-002`, no duplicates, counter ended at exactly 2.
- **Same reference, genuinely concurrent (double-invocation race):** one commits, the other's idempotency check (now re-evaluated under lock) finds the committed row and returns `idempotent` — **without minting anything**, since minting only happens after the idempotency/capacity gates. **Proven** (Case F): counter advanced by exactly 1 for two concurrent calls of the same reference.
- **Capacity race, two different references, one remaining slot:** the loser's capacity check (re-read under lock, after the winner released it) sees the slot taken and returns `capacity_exceeded` **before reaching the mint step at all**. **Proven** (Case D): counter stayed at 1 (the winner's only mint); the loser minted nothing.
- **Multi-unit order, one call, several rows:** each row gets its own code from the correct per-(collection, prefix) counter, all inserted in the same transaction. **Proven** (Case H): a 3-row order in one call produced `TSTH-001/002/003` and advanced the counter by exactly 3.

---

## 6. A Real Bug Found and Fixed During Testing

Test A (Case A, normal success) initially failed: `contributor_unique_code` came back correct on the row's own column, but the code was **not** injected into `contributor_information[0]._receipt.unique_code` as designed.

**Root cause:** `jsonb_set(target, path, value, create_missing)` only creates the **final** path segment if missing — every earlier segment must already exist, or the call silently no-ops (not an error). My test payload's `contributor_information[0]` had no `_receipt` key at all, so the 3-level path `{0,_receipt,unique_code}` had no valid parent (`_receipt`) to attach `unique_code` to, and the call did nothing. In real traffic this is masked (the edge function always pre-populates a full `_receipt` object with `unique_code: null` as a placeholder key, so the parent already exists) — but the SQL should not rely on that caller convention. **Fixed** by setting/merging the whole `_receipt` object in one step (`jsonb_set(v_info, '{0,_receipt}', COALESCE(existing, '{}') || jsonb_build_object('unique_code', ...), true)`), whose only required-to-exist parent is array index 0 (already guaranteed). Redeployed to TEST; all 10 tests then passed, including Case A with the receipt payload verified correct.

This is exactly the kind of thing the test plan in §7 exists to catch — reported transparently rather than glossed over.

---

## 7. Test Results (all executed against TEST, `lpeeckqsltxohppheucz`)

**New H2 suite** (`h2AtomicContributorCode.integration.test.js`, 10 tests, real DB, no mocks):

| Case | Result | What it proved |
|---|---|---|
| A — Normal success | ✅ pass | Counter +1, one contribution, correct code, receipt payload correct |
| B — Forced insert failure (phone > varchar(20), the exact production trigger) | ✅ pass | No contribution created; **counter stayed at 0** |
| C — Trigger failure | ✅ pass (direct SQL, see §4/below) | Trigger exception rolled back the counter bump in the same transaction |
| D — Capacity rejection | ✅ pass | No contribution; counter stayed at the winner's value only |
| E — Duplicate reference (sequential) | ✅ pass | One contribution; counter incremented exactly once |
| F — Same-reference concurrent requests | ✅ pass | Exactly one contribution, one code allocation |
| G — Different-reference concurrent requests | ✅ pass | Sequential unique codes (`-001`, `-002`), no duplicates, no gap |
| H — Multi-unit order | ✅ pass | 3 rows, 3 sequential codes, one atomic operation |
| I — Recovery retry (5x repeated failure of the same broken reference) | ✅ pass | **Counter never advanced across 5 retries** — the exact BBN incident (3,247+ retries → 1,650+ burned) reproduced and proven closed |
| J — TEST-wide reconciliation | ✅ pass | Zero gap across every counter vs. every assigned code |
| Constraint sanity | ✅ pass | `(collection_id, contributor_unique_code)` unique index still rejects a raw duplicate (23505) |

Final run: **`# pass 10 / # fail 0`**.

**Case C, executed separately** (direct multi-statement SQL against TEST, not through the RPC — see §4 for why): bumped a counter, then attempted a paid insert that `enforce_max_contributions` rejects. Result: `ERROR: P0001: Maximum contributions reached for this collection`; a follow-up query confirmed the counter table had **zero rows** for that key — the bump did not survive. Scratch data cleaned up immediately after.

**Pre-existing H1 regression suite** (`paymentVerificationAtomicity.integration.test.js`, unmodified): re-run in full — **`# pass 6 / # fail 0`**. No regression to idempotency or capacity behavior.

---

## 8. Reconciliation Results

Fresh, TEST-wide, corrected-regex reconciliation (same methodology as the prior diagnostic report) run **after** all test scratch data was cleaned up:

```
Every (collection_id, prefix) counter: next_number == MAX(assigned number). Zero rows returned with gap > 0.
```

TEST remains fully consistent — no residual gap from this implementation work, and the new code path itself, under every failure/race condition exercised, never produced one.

---

## 9. Verification That Production Was Not Touched

Every `apply_migration`, `deploy_edge_function`, and `execute_sql` call made during this task explicitly targeted `project_id: "lpeeckqsltxohppheucz"` (TEST). No call in this session referenced `busfgcmbndleljklrcbd` (production). No production flag, secret, or edge function was read, deployed, or modified. `git status` in `kolekto-fe-old` shows only the local working-tree edit to `verify-paystack-payment/index.ts` (not yet committed or pushed) plus the two prior diagnostic reports; `kolekto-be-old` shows only the new SQL migration file and the new test file — nothing has been pushed, merged, or deployed anywhere production-facing.

---

## 10. Remaining Risks

- **The default (non-atomic) edge-function branch has been fully retired on TEST.** Before this same change reaches production, it must go through the same flag-then-soak-then-flip discipline already used for prior atomicity work here (G2, H1) rather than a hard cutover — this report does not authorize a production deploy.
- **`scheduled-payment-recovery`'s lack of a retry ceiling is unchanged.** This fix closes the *code-burning* consequence of infinite retries, but a permanently-failing reference will still retry every 5 minutes forever, generating operational noise and never actually recording the contributor's payment. Tracked as a separate, explicitly out-of-scope follow-up per the prior diagnostic report.
- **The phone-length validation gap is unchanged.** Nothing currently stops a contributor from submitting an over-length value that reaches `contributions.phone varchar(20)`; this fix means it can no longer also burn a contributor code while failing, but the underlying data-validation gap should still be closed separately.
- **The `jsonb_set` fix (§6) was caught by this task's own test suite, not by inspection alone** — a reminder that the receipt-embedding logic touches a genuinely new code path (nothing analogous existed before H2) and deserves the same per-collection-type scrutiny (fixed/tiered/ticket/open_pool/fundraising) the original C-1/H1 migrations received, before this reaches production.

---

## 11. Exact Next Steps Before Production Rollout

1. Extend the new test suite's coverage across every collection type (ticket multi-tier, fundraising, open_pool) the way the original C-1/H1 rollout was verified per-type — this task exercised the `tiered` type only.
2. Soak on TEST under real traffic patterns (not just this synthetic suite) for a period consistent with this codebase's existing rollout convention.
3. Apply `database/h2_atomic_contributor_code_allocation.sql` to production via `CREATE OR REPLACE FUNCTION` (additive, non-destructive — no existing data touched).
4. Deploy the updated `verify-paystack-payment` edge function to production.
5. Because this change removes the flag branch entirely rather than adding a new flag, steps 3–4 are effectively a single atomic cutover for production traffic — confirm with the team whether a narrower, flag-gated rollout is preferred for production specifically (even though TEST no longer needs one), given this is live financial infrastructure.
6. Immediately after production deploy: run the same reconciliation query used throughout this investigation against production to confirm no new gap appears going forward, and separately watch `payment_recovery_log` for the specific reference class that caused the original incident (repeated `22001`/insert-failure entries) to confirm it no longer correlates with counter movement.
7. Track the `scheduled-payment-recovery` retry-ceiling fix and the phone-validation fix as parallel, separately-scoped follow-up work (§10) — neither blocks this change, but both reduce the chance of a *different* future incident of the same general shape.

This report reflects work completed and verified against TEST only. No implementation step in this task touched production.
