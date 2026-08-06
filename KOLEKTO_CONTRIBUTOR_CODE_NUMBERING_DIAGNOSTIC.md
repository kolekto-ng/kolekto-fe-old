# Kolekto — Contributor Code Numbering Diagnostic

**Scope:** read-only code inspection (kolekto-fe-old, kolekto-be-old, kolekto-admin-control-panel-1) + read-only schema/function/data introspection against the **TEST** Supabase project (`lpeeckqsltxohppheucz`) only. Production was not accessed, queried, or modified in this pass. No schema changes, migrations, deploys, or flag changes were made anywhere. This is a diagnostic and design document — implementation is explicitly out of scope for this task.

---

## 1. Executive Summary

The architectural flaw first identified in the prior forensic investigation is confirmed to exist in the current TEST codebase and TEST database: **contributor-code sequence allocation (`next_contribution_code_number`) is committed independently of, and strictly before, the `contributions` insert it numbers.** This is true on both the default (flag-off) path and the H1 atomic (`claim_payment_contributions`) path — the atomic RPC receives the code **already minted**, so its own atomicity does not retroactively protect the mint step.

**New in this pass:**
- Live log evidence confirms `VERIFY_USE_ATOMIC_RPC` **has been exercised on TEST** (not merely theoretical) — `payment_recovery_log` contains real `new_contribution_recorded_atomic` and `capacity_exceeded_atomic` entries from `admin_reconcile` calls on 2026-07-21. This is direct proof the atomic path is live, working infrastructure on TEST, not an unused branch.
- **TEST's current data is fully clean: zero real gaps.** A full reconciliation across all 52 `(collection_id, prefix)` counters shows `counter.next_number == MAX(assigned number) == count(paid contributions with that prefix)` for every single one. This differs from production (where one collection showed a 1,650+ and growing gap, per the prior investigation) — TEST simply hasn't yet hit the specific failure mode (a permanently-failing insert retried forever) that exposes the flaw. The flaw itself is still architecturally present and provably reachable; it is dormant here, not absent.
- The one historical `capacity_exceeded_atomic` event found on TEST (collection `39820e1e-...`, tier `t1`, reference `g7wl5ufi1s6pp9g`, via `admin_reconcile`, 2026-07-21 14:18:22) is **inconclusive as direct proof of a burn** — the collection has since been deleted (`contribution_code_counters` cascades on `collections` deletion), so no residual counter/contribution evidence survives to confirm whether a prefix was even configured for that tier at the time. The static code path (§3, §5) remains the primary, stronger evidence that this class of event *can* burn a number; this specific historical instance neither confirms nor refutes it.

**Recommendation carried forward and reaffirmed:** modify `claim_payment_contributions` to allocate the contributor code *inside* the same transaction as the insert, immediately before it, instead of receiving a pre-minted code. This is Option 3 in §11 — the correct target invariant for a financial platform.

---

## 2. Exact Current Code-Generation Flow

```
Paystack payment success
    ↓
verify-paystack-payment (Edge Function)
    ↓
Idempotency check by payment_reference        [index.ts:303-323]
    ↓ (only if nothing found)
normalizePaymentRequest()                      [index.ts:345-351]
    (capacity checked HERE unless useAtomicRpc defers it)
    ↓
buildContributionUnits()                       [index.ts:434]
    ↓
Per-unit loop, builds builtRows[]              [index.ts:464-625]
    prefix = unit.prefix || collection.code_prefix     [index.ts:474-475]
    sequenceNumber = supabase.rpc('next_contribution_code_number',
                                    {p_collection_id, p_prefix})  [index.ts:486-521]
        ← its own committed statement, unconditionally, whenever prefix is set —
          regardless of whether useAtomicRpc is true or false
    uniqueCode = `${prefix}-${sequenceNumber}`
    contributorPayload.contributor_unique_code = uniqueCode      [index.ts:611]
    builtRows.push(contributorPayload)                            [index.ts:624]
    ↓
┌────────────────────────────────┬───────────────────────────────────┐
│ useAtomicRpc = true             │ useAtomicRpc = false (default)      │
│ [index.ts:627-719]              │ [index.ts:720+]                      │
│ rpcRows = builtRows + tier info │ per-row .insert(), one at a time      │
│ (code already baked in)         │ 23505 → recover existing rows        │
│ supabase.rpc(                   │ other error → roll back rows THIS    │
│  'claim_payment_contributions') │   call inserted, return 500          │
│  [index.ts:643-650]             │                                       │
│ Inside RPC (one tx, row lock):  │ Either way: the counter increment    │
│  idempotency → capacity →       │ from the per-unit loop above is      │
│  INSERT (code supplied,         │ never rolled back — it already      │
│  not minted here)               │ committed in its own transaction     │
│ capacity_exceeded / idempotent  │ before this branch even started.     │
│ (race-lost) → code already      │                                       │
│ minted above is burned          │                                       │
└────────────────────────────────┴───────────────────────────────────┘
    ↓
refreshCollectionAndWallets() → receipt / notification (application code, outside the DB transaction)
```

---

## 3. All Code-Generation Paths

| Path | Entry point | Allocator | Reachable today? | Can burn a number? |
|---|---|---|---|---|
| Live payment, default path | `verify-paystack-payment/index.ts`, flag off | `next_contribution_code_number` RPC, own tx | **Yes — this is production's live path** (no `VERIFY_USE_ATOMIC_RPC` env var found in production config in the prior pass) | Yes — any insert failure or duplicate-race loss |
| Live payment, atomic (H1) path | same file, `useAtomicRpc` branch | same RPC call, still in the per-unit loop, before the atomic RPC | **Yes on TEST** — confirmed exercised via `admin_reconcile` log entries this pass | Yes — `capacity_exceeded` / `idempotent` (race-lost) outcomes |
| `scheduled-payment-recovery` cron (`*/5 * * * *`) | `supabase/functions/scheduled-payment-recovery/index.ts` | re-enters the same edge function via HTTP | Yes — confirmed active (`cron.job`, jobid 6) on TEST | Yes, repeatedly, if the underlying insert fails permanently — **no retry cap found** (§6) |
| Legacy backend webhook path | `kolekto-be-old/controllers/deposit.js` (`verifyPayment`, `handleWebhook`) | `resolveContributionUniqueCode`/`nextContributorCodeNumber` (imported) | **No** — zero call sites for `resolveContributionUniqueCode` found in the file; dead on the write side. `shouldGenerateUniqueCode` remains in use, display-only | No |
| Offline backfill script | `scripts/backfillUniqueContributionCodes.js` | same `next_contribution_code_number` RPC, live mode; `--dry-run` is read-only | Manual/operator-invoked only | Negligible — infrequent, cautious, guarded by `.is("contributor_unique_code", null)` |
| Admin panel (`kolekto-admin-control-panel-1`) | — | — | No insert/mint path found — only type definitions and an unrelated debug JSON reference the column name | No |

Two counter functions exist; only `next_contribution_code_number(collection_id, prefix)` is called from any live path (confirmed via `pg_get_functiondef` on TEST). `next_contributor_code_number(collection_id)` is legacy/superseded with zero live call sites.

---

## 4. Transaction-Boundary Analysis

Confirmed directly against TEST via `pg_get_functiondef` / `pg_constraint` / `pg_trigger`:

- **`next_contribution_code_number`**: `LANGUAGE sql`, single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. Atomic as an isolated statement. Invoked as its own round trip from the edge function — never nested inside the same transaction as the later `contributions` insert.
- **`claim_payment_contributions`**: `LANGUAGE plpgsql`. `SELECT ... FOR UPDATE` on `collections` (serializes calls per collection) → idempotency re-check → collection-wide capacity check → per-tier capacity check → bulk `INSERT ... SELECT ... FROM jsonb_array_elements(p_rows)` → re-select and return. **`contributor_unique_code` is read verbatim from the caller's `p_rows` payload** (`NULLIF(r->>'contributor_unique_code','')`) — confirmed the function does not mint anything itself.
- **Constraints on `contributions`** (TEST): `UNIQUE (collection_id, contributor_unique_code)` (present under two index names — `contributions_collection_code_unique` and `uq_contributions_unique_code`, redundant but harmless) and `UNIQUE (collection_id, payment_reference, line_index) WHERE payment_reference IS NOT NULL`. Both are correctness backstops the design in §11 can safely depend on.
- **Triggers on `contributions`** (TEST):
  - `enforce_max_contributions` (`BEFORE INSERT OR UPDATE OF status ... WHEN status='paid'`, fn `check_max_contributions()`) — an **independent, third capacity gate** at the row level, re-querying `max_contributions` and the live paid count at insert time, `RAISE EXCEPTION` if already full. This can abort an insert whose code was already minted outside any transaction this trigger participates in.
  - `trg_contributions_ambassador_attribution` (`AFTER INSERT OR UPDATE OF status`) — runs inside the same transaction as the insert; narrow today, but a structurally identical rollback risk if it were ever to throw.

**Conclusion: sequence allocation and contribution insertion do not occur in the same transaction anywhere in the current system — confirmed on TEST, matching the prior production finding exactly.** Do not assume `claim_payment_contributions`'s own atomicity extends backward to the code that was computed before it was ever called — it does not, by direct inspection of the deployed function body.

---

## 5. H1 Atomic-Path Analysis

Answering each sub-question directly:

- **Is the code number allocated inside the same transaction as the insert?** No. It is allocated in the edge function's per-unit loop (`index.ts:486-521`), before `claim_payment_contributions` is ever called (`index.ts:643-650`). The RPC receives it as a plain `jsonb` field.
- **Can failed inserts still consume numbers?** Yes. If `claim_payment_contributions` returns `capacity_exceeded`, or an unhandled error occurs, the code minted in the edge function before the call was made is not, and cannot be, given back.
- **Can duplicate requests consume numbers?** Not for the *same, already-successful* reference — the edge function's own early idempotency check (`index.ts:303-323`) runs first and skips the entire mint-and-call sequence. A **genuine race** (two near-simultaneous calls for the same reference, neither having committed yet) can still result in the losing call's `outcome: 'idempotent'` — its pre-minted code is burned even though the RPC correctly avoided a duplicate insert.
- **Can concurrent requests consume numbers?** Yes, in the capacity-race case: two different references competing for one remaining slot both mint a code (in their respective per-unit loops) before either calls the RPC; the loser's `capacity_exceeded` outcome discards its already-minted code.
- **Does the RPC handle multiple contribution units?** Yes — `p_rows` is a `jsonb` array; the function loops per-tier for capacity aggregation and bulk-inserts all rows in one `INSERT ... SELECT`. This part is correctly designed and needs no change beyond the code-allocation modification in §11.
- **Do all payment paths use this same atomic path?** No. Confirmed: the edge function branches on `Deno.env.get("VERIFY_USE_ATOMIC_RPC") === "true"` — a per-project runtime configuration value, not a repo-visible constant. TEST has demonstrably run the atomic branch (real `_atomic`-suffixed `payment_recovery_log` entries exist); the prior investigation found no evidence this flag is set in production. **Both paths carry the identical code-allocation flaw regardless of which one is live** — this is why the recommended fix (§11) is designed to collapse them into one path rather than patch each separately.

---

## 6. Recovery Retry Analysis

`supabase/functions/scheduled-payment-recovery/index.ts`, confirmed via direct read:

- **Candidate selection** (`get_orphaned_payment_candidates`, confirmed via `pg_get_functiondef` on TEST): any `pending_payment_context` row older than 5 minutes with no matching `contributions` row and no `mark_resolved` admin action — **no upper bound on age or attempt count**.
- **Classification:** only one distinction exists — `isDefinitiveNonSuccess` (`verifyResponse.ok && !verifyBody.error`), meaning Paystack itself gave a clean "not successful" status. This is the **only** condition that ever marks a reference `mark_resolved` (auto-resolved, stops retrying).
- **Everything else — including a permanent internal DB error (constraint violation, type-length violation, any 5xx from the verify function) — falls into the catch-all `"scheduled_recovery_failed" / "will_retry_next_run"` bucket, with no cap.**
- **No maximum retry count exists.** `attemptNumber` is computed and logged (`priorAttempts + 1`) but is never compared against any ceiling anywhere in this file or its callers.
- **No dead-letter or manual-review queue exists** beyond the general-purpose admin Payment Monitoring dashboard (`kolekto-be-old/controllers/admin/paymentMonitoring.js`), which surfaces failed items for a human to inspect but does not itself stop the cron from retrying them.
- **Can an invalid contribution repeatedly consume sequence numbers?** Yes, confirmed directly in the prior production investigation (one reference retried 3,247+ times over 11 days, each retry re-minting and re-failing). On TEST specifically, no cluster of more than 5 failed attempts for the same reference currently exists (`payment_recovery_log` query returned zero rows above that threshold) — the *mechanism* is present and identical, but TEST has not yet encountered a permanently-failing reference to expose it.

---

## 7. Data Reconciliation Results (TEST only)

Read-only, corrected for prefixes containing embedded punctuation (a regex pitfall discovered in the prior production pass — matching only `[A-Za-z]+` undercounts prefixes like `CYTO_` or `MN-`; the corrected pattern `^(.*?)-?(\d+)$` captures the full prefix regardless of embedded characters):

- **52 total `(collection_id, prefix)` counters exist on TEST.** Highest is `FASSA` at 16, most are single digits.
- **Every counter reconciles exactly:** `next_number == MAX(assigned number) == COUNT(paid contributions with that prefix)`, for all 52 rows, with zero exceptions. Spot-checked prefixes with tricky shapes (`VIP1`/`VIP2`/`VIP` co-existing on one collection, `LRNCTBOY`, `GHA`/`ABY` co-existing on collection `531f8c19-...`) — all reconcile perfectly.
- **No genuine gaps exist on TEST at the time of this investigation.** This is a materially different result from production (where the prior pass found a live, actively-growing 1,650+ gap) — it does not mean the bug is TEST-specific or already fixed; it means TEST's payment volume and data shapes have not yet triggered the specific permanent-failure-plus-infinite-retry combination that exposes it (§6).
- **`payment_recovery_log` on TEST shows no reference with more than 5 failed `scheduled_recovery` attempts** — consistent with the clean counter state above.
- **One inconclusive historical event:** `capacity_exceeded_atomic` for reference `g7wl5ufi1s6pp9g`, collection `39820e1e-7c75-4e47-bcee-c6f3316c323e`, tier `t1`, via `admin_reconcile`, 2026-07-21 14:18:22. That collection, its contributions, and its counters have all since been deleted (cascade on `collections` deletion) — there is no surviving evidence to confirm whether that tier had a configured prefix at the time, so this event **cannot** be used as direct proof of an actual burn, only as confirmation that the atomic path's `capacity_exceeded` outcome is a real, reachable, exercised code path on TEST.

**Distinguishing false positives from real gaps** (methodology, carried forward from the prior investigation and re-verified against TEST specifically): a naive regex that assumes prefixes are letters-only will systematically undercount any prefix containing a digit, hyphen, or underscore, manufacturing an apparent gap that isn't real. The correct approach captures the prefix as "everything before the trailing run of digits, with at most one optional separating hyphen," which correctly recovers prefixes like `VIP1` (itself ending in a digit) as confirmed above.

---

## 8. Confirmed Root Causes

1. Contributor-code sequence allocation is committed independently of, and before, the contribution insert it numbers — true on both the default and H1 atomic paths, confirmed directly against TEST's deployed function bodies.
2. `claim_payment_contributions` provides true atomicity for idempotency, capacity, and insertion — but not for code allocation, which happens entirely outside its transaction boundary.
3. `scheduled-payment-recovery` has no retry ceiling and does not classify internal/permanent errors as non-retryable — only a clean Paystack non-success status halts retries.

## 9. Contributing Factors

1. Three independent, uncoordinated capacity gates exist (application-level `normalizePaymentRequest`, RPC-level `claim_payment_contributions`, and the DB trigger `enforce_max_contributions`) — any one rejecting after a code was minted elsewhere produces a burn.
2. An `AFTER INSERT` trigger (`trg_ambassador_payment_attribution`) executes inside the same transaction as every contribution insert; while narrow and not observed to have failed, it is a structurally identical rollback risk to the capacity trigger.
3. Two overlapping counter mechanisms exist in the schema (`next_contribution_code_number` per-prefix, `next_contributor_code_number` per-collection legacy) — only the former is live, but the latter's continued presence is a source of confusion for future maintainers, not a functional bug today.

## 10. Ruled-Out Hypotheses

- **Soft-deleted or archived contributor rows causing an apparent-but-not-real gap** — no `deleted_at`/`is_deleted` mechanism exists on `contributions`; not applicable.
- **TEST currently exhibiting the same runaway gap as production** — ruled out by direct reconciliation (§7): TEST is fully clean today. (This does not rule out the underlying architectural flaw, which is confirmed present by code inspection, §4-§5 — only that it has not yet manifested as visible data corruption on TEST.)
- **The historical `capacity_exceeded_atomic` TEST event as confirmed proof of a burn** — neither confirmed nor ruled out; the evidence was deleted along with its collection. Treated as inconclusive, not as proof, in this report.
- **Admin panel or any manual contribution-creation path contributing to the problem** — ruled out; no such write path exists.
- **The legacy `deposit.js` webhook path actively minting codes today** — ruled out; dead code on the write side, confirmed by exhaustive grep of the file.

---

## 11. Recommended Target Architecture

### Evaluating the three options

**Option 1 — Strictly gapless contributor numbers.** Requires that the number assigned always equal `count(successful contributions) + 1` at read time or under a strict serializing lock at write time. Achievable, but only by making allocation itself part of the same atomic decision as the insert (i.e., it collapses into Option 3's mechanism) — "gapless" is an outcome of correct atomicity, not a separate mechanism to build.

**Option 2 — Monotonically increasing, gap-tolerant numbers.** This is what exists **today**. It is simple and, for the narrow case of two genuinely concurrent *successful* payments, already race-free (the per-(collection,prefix) counter RPC guarantees distinct values). Its failure mode is exactly what this whole investigation is about: it has no way to distinguish "a gap because of legitimate concurrent success" from "a gap because an insert that was never going to succeed still got to burn a number, possibly repeatedly, forever." Accepting Option 2 as a permanent design means accepting that a single misclassified error and an uncapped retry loop can produce an unbounded, silently-growing discrepancy between the counter and reality — which is precisely what happened in production.

**Option 3 — Only successful contributions receive codes; allocation is atomic with insertion.** This directly targets the actual failure mode: no code is ever handed out except as an inseparable part of a commit that also produces the row it belongs to. A rollback of one rolls back the other, by construction, regardless of *why* the rollback happened (capacity, a trigger, a constraint, a data-validation bug, anything). This does not require inventing new locking — `claim_payment_contributions` already holds the necessary row lock and already performs its capacity/idempotency decision inside one transaction; it only needs to also perform the mint inside that same boundary instead of accepting it as pre-computed input.

### Recommendation

**Option 3.** For a financial/ticketing platform, the correct invariant is not "no gaps, ever" as an end in itself (Option 1) nor "gaps are an acceptable, permanent cost of doing business" (Option 2) — it is **"a number is only ever spent on an outcome that actually happened."** Gaps from genuinely concurrent, both-successful payments are not a bug and Option 3 does not try to eliminate those (nor should it — enforcing true contiguity would require a much heavier, `SELECT ... FOR UPDATE`-per-attempt-even-on-success serialization cost the platform doesn't currently need). What Option 3 eliminates is exactly the class of gap this investigation traced end-to-end: a gap that exists only because something *failed* and the number was spent anyway.

Concretely: extend `claim_payment_contributions` so that, after its existing idempotency check and both existing capacity checks pass, and immediately before the `INSERT`, it performs the same `INSERT INTO contribution_code_counters ... ON CONFLICT DO UPDATE ... RETURNING` statement inline, per row needing a prefix, within its own transaction — then builds `contributor_unique_code` and injects it into `contributor_information[0]._receipt.unique_code` via `jsonb_set` before inserting. The edge function stops minting anything; it only resolves and passes `prefix` per unit. Both the atomic and default branches in the edge function collapse into one (the default per-row-insert branch, with its separate rollback/duplicate-recovery logic, is retired entirely rather than separately patched — avoiding duplicated sequence logic, per the stated objective). `next_contribution_code_number` remains in the schema, unchanged, for the offline backfill script's continued use only.

---

## 12. Recommended Migration Strategy

1. Write the modified `claim_payment_contributions` as a new, additive migration (new function body via `CREATE OR REPLACE FUNCTION`; no table/column changes; no changes to `contribution_code_counters`'s shape or seeded values).
2. Apply to TEST only; deploy a modified edge function to TEST only that always calls the atomic RPC with `prefix`-bearing rows (no more `useAtomicRpc` branch, no more client-side minting).
3. Run the full test plan (§13/§14) against TEST exclusively.
4. Only after TEST soak is clean: apply the same migration and edge function to production, following this codebase's existing flag-then-soak-then-flip convention (as used for G2/H1 previously) rather than a hard cutover.
5. Track the `scheduled-payment-recovery` retry-ceiling fix and the phone-field-length validation fix (both identified as separate, real issues in the prior investigation) as their own follow-up items — they reduce operational noise and prevent a *different* permanently-failing reference from becoming the next incident, but are not blocking dependencies of the code-allocation fix itself.
6. No historical `contributor_unique_code` values are touched at any point in this migration path.

---

## 13. Risks and Edge Cases

- **Receipt-embedding correctness**: injecting the minted code into `contributor_information[0]._receipt.unique_code` via `jsonb_set` inside the RPC must be verified against every collection type (fixed, tiered, ticketed, open pool, fundraising) — this is new SQL logic, not a refactor of existing SQL, and needs the same per-type verification the original C-1/H1 migrations received.
- **Retiring the default (non-atomic) edge-function branch removes a currently-live production code path** — must be soaked on TEST first, not cut over directly in production.
- **The two other capacity gates (`normalizePaymentRequest`, `check_max_contributions` trigger) remain in place** — they are redundant with the RPC's own check but harmless as defense-in-depth once minting is safely inside the same transaction as the outcome they gate.
- **The ambassador-attribution `AFTER INSERT` trigger** is an adjacent, not-yet-observed risk (§9.2) — recommend hardening it (swallow-and-log instead of propagate) as a related but separately-scoped follow-up, since it bears on transaction-rollback safety generally, not specifically on code allocation.
- **This fix does not address the retry-ceiling gap (§6)** — without a separate fix there, a *different* future permanent failure could still produce unbounded retries; it simply would no longer also burn contributor codes while doing so.
- **No data migration risk**: because no historical row is touched, there is no scenario in which this change corrupts or renumbers existing data, on TEST or production.

---

## 14. Precise Implementation Plan (for the next phase — not executed in this task)

1. **Migration file** (new, e.g. `database/h2_atomic_contributor_code_allocation.sql`):
   - `CREATE OR REPLACE FUNCTION public.claim_payment_contributions(...)` — same signature (or additive: accept `prefix` per row alongside the existing, now-optional `contributor_unique_code` field for a transitional period), same lock/idempotency/capacity logic as today, plus:
     - a loop over `p_rows` elements that have a non-empty `prefix`, performing the per-(collection, prefix) counter increment inline and computing `v_code`;
     - use of `jsonb_set` to merge `v_code` into each row's `contributor_information[0]._receipt.unique_code` before the final bulk `INSERT`.
   - No change to `contribution_code_counters` DDL; no change to `contributions` DDL.
2. **Edge Function change** (`supabase/functions/verify-paystack-payment/index.ts`):
   - Remove the per-unit RPC call and fallback counting (`index.ts:478-521`).
   - Remove `contributor_unique_code` assignment in `contributorPayload` (`index.ts:611`); replace with `prefix` passthrough.
   - Collapse the `useAtomicRpc` branch (`index.ts:627+`) and the default branch (`index.ts:720+`) into a single call path that always uses `claim_payment_contributions`.
   - Read `contributor_unique_code` back from the RPC's returned rows for anything downstream (logs, response payload).
3. **Backend change** (`kolekto-be-old`): none required for the live path; add a doc comment on `utils/contributionCodeService.js#nextContributorCodeNumber` noting it must remain backfill-script-only.
4. **Test suite additions** (extending the existing H1 integration tests, e.g. `tests/integration/paymentVerificationAtomicity.integration.test.js`):
   - Case B: force an insert failure on the first attempt for a fresh prefix; assert the counter did not advance; assert a subsequent valid attempt receives the same number that would have been assigned the first time.
   - Case C/D/E: extend the existing `Promise.all` concurrency tests to assert on the exact `contributor_unique_code` sequence produced, not just on idempotency/capacity outcomes.
5. **TEST deployment and soak**: deploy migration + edge function to TEST only; run the extended test suite; run the same reconciliation query used in §7 before and after to confirm zero new gaps under deliberate failure injection.
6. **Production rollout**: only after a clean TEST soak, following the existing flag-then-flip convention already used for prior atomicity work in this codebase (G2, H1) — not part of this task.
7. **Separately scoped, not blocking**: fix `scheduled-payment-recovery`'s retry classification (§6) and the contributor phone-field length validation gap (identified in the prior investigation) as independent follow-up items.

---

## Final Recommendation for Next Phase

Proceed to implement the modification described in §11/§14 — extending `claim_payment_contributions` to own code allocation inline, retiring the standalone `next_contribution_code_number` call from the live payment path, and collapsing the edge function's two branches into one. This should be scoped, developed, and soaked on the **TEST** project first, with the same rigor (integration tests, concurrency tests, per-collection-type verification) already applied to the existing H1 work. Do not implement against production until a full TEST soak confirms zero gaps under deliberately injected failure and race conditions matching Cases A-F. The retry-ceiling and phone-validation fixes should be tracked as separate, parallel workstreams — they reduce the frequency and blast radius of future incidents but are not prerequisites for the code-allocation fix itself.

This document is diagnostic and design output only. No implementation, migration, deployment, or flag change has been made against TEST or production as part of this task.
