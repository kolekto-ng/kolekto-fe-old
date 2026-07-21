# Kolekto — Contributor Unique-ID Atomicity Investigation & Design

**Scope:** read-only code inspection (kolekto-fe-old, kolekto-be-old, kolekto-admin-control-panel-1) + read-only schema/function introspection against the **TEST** Supabase project (`lpeeckqsltxohppheucz`) only. Production (`busfgcmbndleljklrcbd`) was not accessed in this pass. No writes, migrations, deploys, or flag changes were performed. This is an investigation and design document only — nothing described here has been implemented.

---

## 1. Executive Summary

The prior forensic investigation established that contributor codes (`PREFIX-NNN`) can develop permanent gaps because the sequence number is minted in a **standalone, already-committed** RPC call (`next_contribution_code_number`) **before** the `contributions` row that number belongs to is ever inserted. If that insert then fails, loses a race, or is rejected, the number is gone forever — non-transactional by construction, the same way a Postgres `nextval()` sequence behaves.

This pass confirms, with current code and live TEST-project schema/function definitions:

1. **The existing H1 atomic RPC (`claim_payment_contributions`) does NOT fix this.** It makes idempotency + capacity + insert atomic, but it receives `contributor_unique_code` **already pre-computed** by the edge function's per-unit loop, which calls `next_contribution_code_number` *before* the atomic RPC is ever invoked (`supabase/functions/verify-paystack-payment/index.ts:486-521` mints the code; `:634-639` copies that already-minted code into the RPC payload). So even with `VERIFY_USE_ATOMIC_RPC=true`, a `capacity_exceeded` or `idempotent` (race-lost) outcome still burns a number that was minted outside the atomic boundary.
2. **The default (flag-off) path — what's actually live in production today — has the identical problem**, plus it also mints the code *before* its own capacity check can even run in some orderings, and definitely before the per-row `INSERT` that can fail for any reason (a DB error, a trigger, a unique-constraint race).
3. A **newly-identified, DB-level amplifier** exists on both TEST and (confirmed separately, in the prior investigation) production: a `BEFORE INSERT ... WHEN (status = 'paid')` trigger `enforce_max_contributions` (`check_max_contributions()`) re-enforces `max_contributions` at the row level, **independently of** both the application-level check in `normalizePaymentRequest` and the RPC-level check in `claim_payment_contributions`. If this trigger fires, the whole `INSERT` statement aborts — rolling back the contribution, but not a code minted before the RPC was ever called.
4. An `AFTER INSERT OR UPDATE OF status` trigger (`trg_ambassador_payment_attribution`) also runs **inside** the same transaction as the contribution insert. It's currently narrow and defensive-looking, but if it ever threw, it would roll back an otherwise-legitimate, already-committed-looking payment — a structurally identical risk to the two above, just not yet observed to have fired.
5. No admin/manual contribution-creation path exists that also mints codes (`kolekto-admin-control-panel-1` contains only type definitions, no insert path). The legacy `deposit.js` webhook handler imports `resolveContributionUniqueCode` but has **zero live call sites** for it — it's dead code on the unique-code-write side (confirmed by grep across the whole file); `shouldGenerateUniqueCode` is still used, but only for display flags, not for minting.
6. Both required uniqueness constraints (`(collection_id, contributor_unique_code)` and `(collection_id, payment_reference, line_index)`) are present on TEST, so any future design can rely on them as a hard backstop.

**Recommendation (summary — full reasoning in §9):** the current H1 atomic RPC is **necessary but not sufficient**. It must be **modified**, not replaced: move code allocation *inside* `claim_payment_contributions`, in the same transaction, after the capacity check and immediately before the `INSERT`. The edge function should stop minting codes entirely and instead pass a `prefix` per row; the RPC becomes the single place a contributor code is ever assigned. The standalone `next_contribution_code_number` / `next_contributor_code_number` RPCs should stop being called from any live payment path (kept only for the offline backfill script). The flag-gated default (non-atomic) path should be retired as part of this rollout — it cannot be fixed without duplicating the same atomic logic a second time, which is exactly the kind of duplicated sequence logic this task asks to avoid.

---

## 2. Complete Current ID-Generation Flow

```
Paystack payment success
    ↓
verify-paystack-payment (Edge Function)
    ↓
Idempotency check by payment_reference        [index.ts:303-323]
    (protects: same reference re-verified AFTER it already succeeded — no mint, no insert)
    ↓ (only if nothing found yet)
normalizePaymentRequest()                      [index.ts:345-351, _shared1.ts]
    (capacity checks run HERE unless deferCapacityChecks/useAtomicRpc is true)
    ↓
buildContributionUnits()                       [index.ts:434]
    ↓
Per-unit loop — builds builtRows[]             [index.ts:464-625]
    prefix = unit.prefix || collection.code_prefix        [index.ts:474-475]
    sequenceNumber = supabase.rpc('next_contribution_code_number',
                                    {p_collection_id, p_prefix})   [index.ts:486-521]
        ← COMMITTED HERE, in its own standalone transaction, before anything else
    uniqueCode = `${prefix}-${sequenceNumber}`
    contributorPayload.contributor_unique_code = uniqueCode        [index.ts:611]
    builtRows.push(contributorPayload)                              [index.ts:624]
    ↓
┌─────────────────────────────┬──────────────────────────────────────────┐
│ useAtomicRpc = true (H1)     │ useAtomicRpc = false (DEFAULT — LIVE)     │
│ [index.ts:627-719]           │ [index.ts:720+]                          │
│                              │                                          │
│ rpcRows = builtRows + tier   │ for each builtRows[i]:                   │
│   info (code already baked   │   INSERT one row at a time               │
│   in from the loop above)    │   on 23505 duplicate → recover existing  │
│ supabase.rpc(                │     rows, discard this attempt           │
│  'claim_payment_contributions'│   on other error → roll back inserted   │
│  , {...})                    │     rows THIS call made, return 500      │
│  [index.ts:643-650]           │   [F2 rollback logic, further in file]  │
│                              │                                          │
│ Inside the RPC (single tx,   │ Either way: the counter increment that   │
│ SELECT...FOR UPDATE on       │ happened in the per-unit loop above is   │
│ collections):                │ NEVER rolled back — it already          │
│  - idempotency re-check      │ committed in ITS OWN transaction before  │
│  - live capacity re-check    │ this branch even started.                │
│  - INSERT (codes already     │                                          │
│    supplied, not minted here)│                                          │
│  - outcome: idempotent /     │                                          │
│    inserted / capacity_exceeded                                        │
│  If capacity_exceeded or     │                                          │
│  idempotent (race lost): the │                                          │
│  code minted above is burned │                                          │
│  for nothing.                │                                          │
└─────────────────────────────┴──────────────────────────────────────────┘
    ↓
refreshCollectionAndWallets() → receipt / notification (application code, OUTSIDE the DB transaction — cannot roll back a committed contribution)
```

Two counter mechanisms exist in the schema, confirmed live on TEST:

| Function | Scope | Called from live payment path? |
|---|---|---|
| `next_contribution_code_number(collection_id, prefix)` | per (collection, prefix) — the one actually used | Yes — `verify-paystack-payment/index.ts:488-491`, and `kolekto-be-old/utils/contributionCodeService.js:88-89` (legacy backend helper, itself uncalled from any live route — see §3) |
| `next_contributor_code_number(collection_id)` | per collection (legacy, superseded) | No live call site found anywhere in either repo — dead but not removed |

Both are `LANGUAGE sql`, single `INSERT/UPDATE ... RETURNING`, atomic **as a standalone statement** — that's exactly the property that makes them individually race-free but *not* transactionally tied to whatever happens next.

---

## 3. All Code Paths That Generate IDs

| Path | Entry point | Sequence allocator | Transaction boundary | Insert | Duplicate handling | Rollback behavior | Can burn a number? |
|---|---|---|---|---|---|---|---|
| **Live payment, default path** (flag off — what's actually running in production) | `verify-paystack-payment/index.ts`, `serve()` | `next_contribution_code_number` RPC, own transaction, per unit | Separate from insert | Per-row `.insert()`, one at a time | 23505 → recover existing rows, discard | Non-duplicate error → deletes rows this call inserted; counter untouched | **Yes** — any insert failure, any duplicate-race loss |
| **Live payment, atomic path** (flag on — H1, not enabled anywhere today) | same file, `useAtomicRpc` branch | same `next_contribution_code_number` call, still happens in the per-unit loop **before** the RPC | Still separate from the RPC's own transaction | `claim_payment_contributions` (its own atomic tx: idempotency + capacity + insert) | RPC handles idempotency/capacity re-check authoritatively | RPC's own insert/capacity failure rolls back only what's inside the RPC — the pre-minted code is outside that boundary | **Yes** — `capacity_exceeded` or `idempotent` (race lost) outcomes |
| **`scheduled-payment-recovery` cron** (`*/5 * * * *`, confirmed active on both TEST and production) | `supabase/functions/scheduled-payment-recovery/index.ts` | Re-enters the exact same edge function above via HTTP call | Same as whichever path above is active | Same as above | Same as above | Same as above; **also has no retry cap or backoff**, so a permanently-failing reference re-enters this whole flow every 5 minutes forever | **Yes, repeatedly, unboundedly** if the underlying insert fails for a permanent reason |
| **Legacy backend webhook/verify path** (`kolekto-be-old/controllers/deposit.js`) | `verifyPayment`, `handleWebhook` | `resolveContributionUniqueCode` / `nextContributorCodeNumber` (`utils/contributionCodeService.js`) — imported but **zero call sites found** in `deposit.js` | N/A — not reachable | N/A | N/A | N/A | **No** — dead code on the write side; `shouldGenerateUniqueCode` is still used, display-only |
| **Offline backfill script** (`scripts/backfillUniqueContributionCodes.js`) | manual CLI invocation only | Same `next_contribution_code_number` RPC, live mode; read-only preview in `--dry-run` | Own transaction per call, same as the live path | `.insert()`/`.update()` per contribution, guarded by `.is("contributor_unique_code", null)` | Idempotent by construction (guard + pre-mint re-check) | Not part of normal traffic; a failed backfill run can still leave a burned number, but this is an operator-invoked, infrequent, already-cautious path | Yes in theory, negligible in practice |
| **Admin panel** (`kolekto-admin-control-panel-1`) | — | — | — | — | — | No insert/mint code found; only `types.ts` type definitions and a local debug JSON reference `contributor_unique_code` | **No** — no write path exists here |

---

## 4. Database Transaction-Boundary Analysis (confirmed live on TEST)

**Functions inspected (`pg_get_functiondef`, TEST project):**

- `next_contribution_code_number(uuid, text)` — `LANGUAGE sql`, single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. Atomic in isolation. **Not** invoked from inside any other transaction that also does the contribution insert — it is always its own, separately-committed round trip from the edge function.
- `next_contributor_code_number(uuid)` — same shape, legacy, unused.
- `claim_payment_contributions(uuid, text, jsonb)` — `LANGUAGE plpgsql`. Confirmed structure: `SELECT ... FOR UPDATE` on `collections` (serializes all calls for one collection) → idempotency re-check → capacity re-check (collection-wide, then per-tier) → single bulk `INSERT INTO contributions (...) SELECT ... FROM jsonb_array_elements(p_rows)` → re-select and return. **`contributor_unique_code` is read directly from the caller-supplied `p_rows` payload (`NULLIF(r->>'contributor_unique_code','')`) — the function never mints anything itself.** This is the central finding: the atomicity this function provides does not extend to code allocation.
- `get_orphaned_payment_candidates(int)` — candidate selection for the recovery cron; confirmed **no upper bound on attempt count or age**, only a lower bound (`created_at < now() - interval '5 minutes'`) and an exclusion for rows explicitly marked `mark_resolved`.

**Constraints on `public.contributions` (TEST):**
- `contributions_pkey` (id)
- `contributions_collection_code_unique` **and** `uq_contributions_unique_code` — both enforce `UNIQUE (collection_id, contributor_unique_code)` (duplicated under two names, redundant but harmless — likely applied by two separate migrations across environments)
- `uq_contributions_collection_ref_line` — `UNIQUE (collection_id, payment_reference, line_index) WHERE payment_reference IS NOT NULL`
- `contributions_collection_id_fkey`

**Triggers on `public.contributions` (TEST) — new findings this pass:**
- `enforce_max_contributions` (`BEFORE INSERT OR UPDATE OF status ... WHEN (new.status = 'paid')`, function `check_max_contributions()`): re-queries `collections.max_contributions` and `COUNT(*) ... WHERE status='paid'` **at insert time**, `RAISE EXCEPTION` if already at capacity. This is a **third, independent capacity gate** (application-level in `normalizePaymentRequest`, RPC-level in `claim_payment_contributions`, and now this trigger) — any one of the three can abort an insert, and only the RPC's own aborts are "safe" today (nothing was minted inside it); the other two abort *after* a code was already minted outside.
- `trg_contributions_ambassador_attribution` (`AFTER INSERT OR UPDATE OF status`, function `trg_ambassador_payment_attribution()`): updates `ambassador_influenced_organizers` when the paying collection's owner is ambassador-tracked. Currently narrow (returns early in most cases) but **runs inside the same transaction as the contribution insert** — if it ever raised, it would roll back an otherwise-fully-valid, already-atomically-decided contribution. This is a generalizable risk for **any** future `AFTER INSERT` trigger added to this table, not specific to the ID problem, but directly bears on "is the insert transaction actually safe."

**Conclusion:** sequence allocation and contribution insertion do **not** occur in the same transaction anywhere in the current system, on either the default or the H1 atomic path. The `contribution_code_counters` table itself is fully sound (atomic per-statement); the flaw is entirely in *when* it's called relative to the insert.

---

## 5. Confirmed Root Causes

1. **CONFIRMED — Non-transactional allocation.** `next_contribution_code_number` commits independently of, and strictly before, the `contributions` insert it numbers. (§2, §4)
2. **CONFIRMED — H1 does not close this gap.** `claim_payment_contributions` receives a pre-minted code; its own atomicity guarantees (idempotency/capacity/insert) do not extend backward to cover the minting step. (§2, §4)
3. **CONFIRMED — Triple-redundant, uncoordinated capacity gates.** Application code, the atomic RPC, and a DB trigger (`enforce_max_contributions`) each independently enforce capacity; only the RPC's own rejection happens *after* nothing has been minted in the current code (once codes are moved inside the RPC, this stops mattering — see §9). Today, the other two gates can reject *after* a code was already minted.
4. **CONFIRMED — unbounded retry amplifier.** `scheduled-payment-recovery` has no cap on attempts and does not distinguish "permanent internal failure" from "transient" — every retry of a permanently-broken reference re-runs the full mint step. (Prior investigation quantified this at 3,250+ retries over 11 days for one broken reference in production; the same cron, same lack of a cap, is confirmed active on TEST as well.)
5. **RULED OUT — admin/manual contribution paths.** No such path mints codes.
6. **RULED OUT — legacy backend write path.** Dead code (imported, never called) on the code-minting side.

---

## 6. Concurrency Analysis

### Case A — Normal success
Payment A mints `PXY-001`, inserts successfully. Next call for a *different, new* payment mints `PXY-002`. **Works correctly today** — this is the case the current design already handles.

### Case B — Insert failure
Payment A mints `PXY-001`; the insert then fails (DB error, trigger abort, anything). **Today:** the counter stays at 1 (correct), but the *contribution* is gone and `PXY-001` is never assigned to anyone — the next real payment mints `PXY-002`, skipping `001` forever. **Required fix:** minting must happen in the same transaction as the insert, so that when the insert aborts, the counter increment aborts with it — the next attempt (this one retried, or a genuinely new payment) gets `PXY-001` again, not `PXY-002`.

### Case C — Concurrent different-reference payments
`claim_payment_contributions` already serializes all calls for one `collection_id` via `SELECT ... FOR UPDATE`. Once minting moves inside the function, two concurrent successful payments for the *same* collection will queue on that lock, each seeing the live, just-updated counter and capacity state — no duplicate codes, no lost contributions, fully deterministic. Payments for *different* collections have independent locks and independent counters, so they proceed fully in parallel with no contention — matches the existing per-(collection, prefix) counter design.

### Case D — Same payment reference twice
`claim_payment_contributions`'s idempotency check already runs **before** any capacity or (future) minting logic, under the same row lock (§4). A second call for an already-successful reference returns `outcome: 'idempotent'` immediately — no counter touched. This already works correctly for calls that reach the RPC; the only gap is the edge function's **own** early idempotency check (`index.ts:303-323`), which is separate from and precedes the RPC and already correctly skips the entire mint-and-insert block on a same-reference replay. No change needed here — both idempotency checks already run *before* any minting.

### Case E — Capacity race (two references, one remaining slot)
Under the recommended design, minting happens **after** the live, locked capacity check and immediately before the `INSERT`. The losing request's capacity check (re-read under the same lock, after the winner has already committed and released it) sees the slot as taken and returns `capacity_exceeded` **before reaching the mint step at all**. Zero codes burned on the losing side — a strict improvement over both of today's paths, where minting happens before the outcome is known.

### Case F — Notification/receipt failure after insert
Receipt/email/push sending happens in **application code**, after the RPC call returns (`refreshCollectionAndWallets` and subsequent notification logic in `index.ts`) — entirely outside the database transaction, so it **cannot** roll back a committed contribution or its code. The one *DB-side* AFTER-INSERT trigger (`trg_contributions_ambassador_attribution`) is a structurally identical risk if it ever throws, though narrower in scope (ambassador-tracked organizers only) and not observed to have fired. **Recommendation (defensive, not required for this design):** wrap that trigger's body in a `BEGIN ... EXCEPTION WHEN OTHERS THEN` that logs and returns `NEW` rather than propagating, so a bug in ambassador attribution can never take down a real, paid contribution.

---

## 7. Failure and Rollback Analysis

| Failure point | Today | Under recommended design |
|---|---|---|
| `check_max_contributions()` trigger fires | Contribution rolled back; pre-minted code (from either path) already burned | Trigger fires inside the same transaction as minting → both roll back together → no burn |
| `contributions_collection_code_unique` / `uq_contributions_collection_ref_line` violation | Recovered as a duplicate-race (existing rows fetched), pre-minted code still burned on the losing side | Since minting happens per-attempt inside the transaction and only commits alongside a successful insert, a genuine race here means the loser's mint+insert both abort together; `claim_payment_contributions`'s existing `EXCEPTION WHEN unique_violation` handler already re-fetches and returns `idempotent` — extend it to simply not have minted anything irrecoverable in the first place |
| `varchar(20)`/type/constraint violation on any column (e.g., the phone-length bug from the prior investigation) | Same as above — permanent failure, retried forever by the cron, burning one code per retry | Insert failure rolls back the mint in the same transaction — **zero cumulative burn regardless of how many times the cron retries**, though the underlying data-validation bug and the cron's lack of a retry cap should still be fixed separately (§9, §13) |
| Capacity exceeded (any of the 3 gates) | Code already minted before the rejection in both current paths | Mint happens after the authoritative capacity decision — rejection means no mint occurred |
| AFTER-INSERT trigger throws (ambassador attribution) | Rolls back the whole insert (and, today, leaves a pre-minted code stranded) | Rolls back the whole insert *and* the mint together — no burn; separately, recommend hardening the trigger so a bug there can't reject a legitimate payment at all |

---

## 8. Evaluation of the Five Architecture Options

### Design 1 — Existing standalone counter RPC (current state)
Atomic *as a single statement*, but invoked as a separate round trip from the insert it numbers. Any failure between the mint and the insert — for any reason, including ones entirely unrelated to numbering (a trigger, a network blip, a validation bug) — burns the number permanently. **This is the confirmed root cause; not viable as-is.**

### Design 2 — Allocation inside one atomic PostgreSQL RPC
Validate → allocate → insert → commit-or-rollback-together, all in one `plpgsql` function, under the row lock `claim_payment_contributions` already takes. This directly eliminates every burn scenario in §6/§7 because the counter increment and the contribution insert live or die as one unit. **Recommended** — see §9 for exactly how this extends the existing RPC rather than replacing it.

### Design 3 — Database sequence / `nextval()`
A native Postgres `SEQUENCE` behaves *identically* to today's `next_contribution_code_number` in the one way that matters here: `nextval()` is **guaranteed non-transactional** by design (that's what makes it fast under high concurrency — a rolled-back transaction does not "give back" a sequence value it consumed). Switching to a native sequence would not fix anything; it would formalize the exact bug already present. **Not appropriate** for a field where "no unexplained gaps for a successful contribution" is a stated requirement. (A sequence remains perfectly appropriate for something like an internal, gap-tolerant audit/event ID — just not for the customer-facing contributor code.)

### Design 4 — Counter allocation after successful insert
Insert the contribution first (without a code, or with a placeholder), then mint and `UPDATE` the code in afterward. This avoids burning numbers on insert failure (nothing to number yet if the insert never happened), but introduces a **new** window: between the insert committing and the follow-up mint+update committing, the row is visible with no code (or a placeholder) — a second concurrent process (a page load, a receipt render, a webhook) could read the contribution before it has a real code, and if the follow-up `UPDATE` itself fails or is never reached (process crash, network drop between the two statements), the contribution now has **no code at all** — a worse and harder-to-detect failure than a numbering gap, since it silently produces a paid contribution with a missing customer-facing ID rather than a skipped number. This also requires the mint-and-update step to itself be retried/reconciled, reintroducing a smaller version of exactly the same problem one level down. **Not recommended** — it trades a visible, cosmetic problem (gaps) for an invisible, worse one (missing codes on real paid contributions).

### Design 5 — Existing `claim_payment_contributions` atomic path
As established in §2/§4: it already provides true transactional **idempotency and capacity decisioning**, but **not** code allocation — it takes the code as a pre-computed input. It is the correct **foundation** to build on (the row-lock/serialization strategy, the idempotency-first ordering, and the capacity re-check are all sound and don't need to be re-derived), but it is **not sufficient as it stands**. It must be modified per Design 2.

---

## 9. Recommended Design

**Modify `claim_payment_contributions` to own contributor-code allocation, and stop minting codes anywhere else in the live payment path.**

This is Design 2, built as a modification of Design 5 rather than a new parallel mechanism — it reuses the row lock, idempotency check, and capacity check that already exist and are already tested, and adds exactly one new responsibility to the same atomic boundary.

### Schema changes
- **No changes to `contribution_code_counters`** — same table, same `(collection_id, prefix)` key, same seeding from historical max. Continuity with every existing code is automatic since nothing about the counter's *values* changes, only *who increments it and when*.
- **No changes to `contributions` columns or constraints.** The existing `UNIQUE (collection_id, contributor_unique_code)` and `UNIQUE (collection_id, payment_reference, line_index)` constraints remain the hard backstop; they're unaffected by moving the mint step.
- **No renumbering, no backfill, no historical data touched.**

### RPC changes (`claim_payment_contributions`)
1. Change `p_rows` contract: each row carries a `prefix` (nullable text) instead of a pre-computed `contributor_unique_code`. (Transitional option: accept both, preferring server-side minting whenever `prefix` is present and `contributor_unique_code` is absent — lets the edge function migrate row-shape without a hard cutover instant.)
2. After the existing idempotency check and both existing capacity checks pass (collection-wide, then per-tier — unchanged), and **before** the `INSERT`: for each row that has a `prefix`, run the exact same `INSERT INTO contribution_code_counters (...) VALUES (...) ON CONFLICT (collection_id, prefix) DO UPDATE SET next_number = next_number + 1 ... RETURNING next_number` statement **inline, in the same `plpgsql` function invocation** (i.e., the same transaction as everything else in the function) — build `v_code := upper(v_prefix) || '-' || lpad(v_next_number::text, 3, '0')`.
3. Attach the minted code both to the row's `contributor_unique_code` column value and into `contributor_information[0]._receipt.unique_code` via `jsonb_set` before that row's `INSERT`, so the receipt payload stored on the row matches without a second write.
4. Keep the existing `EXCEPTION WHEN unique_violation` handler — it remains a correct last-resort backstop; it will now also correctly imply "nothing was actually minted for the burned attempt," since the whole function's transaction (including the counter increments) rolls back together on any unhandled path.
5. `next_contribution_code_number(uuid, text)` **stays in the schema**, unchanged, for the offline backfill script's continued use — it is simply no longer called from any live payment path.

### Edge Function changes (`verify-paystack-payment/index.ts`)
1. Delete the per-unit RPC call and in-memory fallback counting at `index.ts:478-521` — the loop building `builtRows` no longer computes or assigns `contributor_unique_code` at all; it only resolves and attaches `prefix` per unit.
2. Both branches (`useAtomicRpc` true/false) collapse into **one** path that always calls `claim_payment_contributions` with `prefix`-bearing rows. The non-atomic per-row insert loop (today's default, live-in-production path, `index.ts:720` onward) is retired — its rollback/duplicate-recovery logic becomes dead code once the atomic RPC is the only path, which directly satisfies "no duplicated sequence logic."
3. Read the minted `contributor_unique_code` back from the RPC's returned `contributions` rows (already returned in full by `claim_payment_contributions`) for anything downstream that needs it (receipt response, logs) — no separate re-fetch required.
4. `VERIFY_USE_ATOMIC_RPC` retires as a flag once this ships everywhere (test soak, then production) — see rollout in §10.

### Backend changes (`kolekto-be-old`)
- No functional change required for the live path — the dead `resolveContributionUniqueCode` call site in `deposit.js` doesn't exist today (§3), so there's nothing there to migrate.
- `utils/contributionCodeService.js` (`nextContributorCodeNumber`) remains as-is for the backfill script's use; add a one-line comment noting it must never be called from a live request-handling path (documentation hardening, not a code change to logic).

### Transaction boundary
Everything — idempotency check, capacity check (collection + per-tier), code allocation, and insert — executes inside the single implicit transaction of one `claim_payment_contributions` call, under the `SELECT ... FOR UPDATE` row lock already taken on `collections`. This is the entire fix: **one business operation, one transaction, one place code is ever assigned.**

### Locking strategy
Unchanged from today's H1 design — the existing `FOR UPDATE` lock on the `collections` row already serializes every call for a given collection, which is sufficient to make the *new* per-(collection, prefix) counter increment safe too (it's a strict subset of what's already being serialized). No new lock is required.

### Unique constraints
Unchanged — both existing unique indexes remain the correctness backstop for the pathological case (a bug in the new minting logic, a manual SQL edit, an out-of-band script) exactly as they do today.

### Rollback behavior
On any exception anywhere in the function body (a trigger abort, a constraint violation not explicitly handled, a capacity rejection returned before insert, anything) — Postgres unwinds the **entire** function invocation, including every counter increment performed earlier in that same call. This is the property that was structurally impossible under Design 1 and is exactly what closes every case in §6/§7.

---

## 10. Migration and Rollout Strategy

1. **Test-only implementation and soak** (this repo already follows this pattern for H1/G2): write the modified `claim_payment_contributions` as a new migration file, apply to TEST only, deploy the modified edge function to TEST only, run the full concurrency/failure test suite (§11) against TEST.
2. **Do not flip any production flag or apply any production migration as part of this task** — this document is investigation/design output only, per the explicit constraint of this task.
3. Once validated on TEST: apply the migration to production, deploy the edge function with the collapsed single-path logic (no more `useAtomicRpc` branch), confirm via the same read-only forensic queries used in the prior investigation that the `BBN`-style runaway gap pattern cannot recur (i.e., deliberately reproduce Case B/E against a disposable TEST collection and confirm zero burn — see §11).
4. **Separately but urgently:** the `scheduled-payment-recovery` cron's lack of a retry cap is an amplifier independent of this fix — even with atomic allocation, an infinitely-retried, permanently-failing reference is still an operational problem (every retry still costs a DB round trip, still pollutes `payment_recovery_log`/monitoring, and still fails for the *contributor*, who never gets their contribution recorded). Recommend a follow-up, scoped separately: classify internal DB errors (not just Paystack-confirmed non-success) as eligible for a bounded retry count or an explicit "needs manual attention" terminal state.
5. **Also separately:** the phone-field length bug from the prior investigation (no validation before a `varchar(20)` column) should be fixed regardless of this ID-allocation fix — it's the trigger, not the root cause, but leaving it open means the *next* over-length field will still produce a permanently-failing, endlessly-retried reference; the difference after this fix is simply that it will no longer also burn contributor codes while it fails.

---

## 11. Test Plan (against TEST project only)

All tests below use disposable TEST-project collections created and torn down within the test run — no production access, no shared/real collection data touched.

1. **Case A regression:** single successful payment → code `X-001`; second, different successful payment → `X-002`. (Existing integration test coverage for H1 already does something adjacent; extend to assert on `contributor_unique_code` specifically, not just idempotency outcome.)
2. **Case B (the core fix):** force the `INSERT` to fail deterministically (e.g., a test-only oversized field, or a temporary trigger that raises for a specific test marker) on the *first* attempt for a fresh prefix; assert the counter row for `(collection_id, prefix)` was **not** incremented (`next_number` still 0), then let a second, valid attempt succeed and assert it receives `X-001`, not `X-002`.
3. **Case C (concurrency, different references):** `Promise.all([verify(refA), verify(refB)])` against the same collection/prefix with ample capacity; assert both succeed with **distinct, sequential** codes and no duplicate-key error surfaces to the caller.
4. **Case D (same reference twice):** `Promise.all([verify(ref), verify(ref)])`; assert exactly one contribution, one code, and the `contribution_code_counters.next_number` incremented by exactly 1 total (not 2).
5. **Case E (capacity race):** a tier/collection with exactly 1 remaining slot; `Promise.all([verify(refA), verify(refB)])`; assert exactly one contribution and one code consumed; assert the counter for that prefix incremented by exactly 1, not 2 (i.e., the loser's rejection must not have minted at all — this is the specific new behavior this design adds beyond what H1 already tested).
6. **Case F sanity:** confirm (by code inspection, already done in §6, and optionally by temporarily forcing the ambassador trigger to raise in a TEST-only sandbox collection not linked to any real ambassador) that a downstream AFTER-INSERT trigger failure rolls back the mint along with the insert — i.e., no burn even from a completely unrelated trigger.
7. **Regression on historical codes:** confirm, read-only, that every pre-existing `contributor_unique_code` on TEST is untouched (row count and values identical before/after applying the migration) — the migration must be additive/behavioral-only, never touching existing rows.
8. **Load/soak:** replay a burst of N concurrent distinct references against one collection/prefix (N well above the tier capacity) and confirm: exactly `capacity` codes minted, exactly `capacity` contributions inserted, zero gaps in the resulting code sequence, zero duplicate codes.

---

## 12. Explicit List of Things That Must NOT Be Changed

- Existing `contributor_unique_code` values on any historical row — no renumbering, no backfill, no re-derivation.
- The `contribution_code_counters` table's key shape `(collection_id, prefix)` or its seeded starting values.
- The public code *format* (`PREFIX-NNN`, zero-padded to 3 digits) — unaffected by where minting happens.
- The existing unique constraints (`(collection_id, contributor_unique_code)`, `(collection_id, payment_reference, line_index)`) — kept as-is, as the correctness backstop.
- The `next_contribution_code_number` / `next_contributor_code_number` function **definitions** — kept in the schema for the offline backfill script; only their *caller* in the live payment path changes.
- Any production data, configuration, or deployed function — this task is TEST-only and investigation/design-only.
- Any collection's `max_contributions`, `price_tiers`, or capacity semantics — the three existing capacity gates are documented, not redesigned, in this pass (beyond noting their interaction with minting order).

---

## 13. Production Risks and Rollback Strategy

**Risks if implemented as designed:**
- Collapsing the two edge-function branches into one means every live payment now depends on `claim_payment_contributions` — this RPC already exists, is already the H1-tested path, and this change adds one more well-scoped responsibility to it; the main new risk is the `jsonb_set` receipt-embedding logic being subtly wrong for some contribution shape (ticketed vs. fixed vs. tiered) — mitigated by the same per-collection-type test coverage the prior unique-ID investigation already established (Round 3's tiered-collection verification, Round 2/3/4's format-collision checks).
- Retiring the non-atomic default path removes a currently-live code path in production — this must be soaked on TEST first and rolled out with the same flag-then-flip discipline already used for H1/G2 in this codebase, not a hard cutover.
- The `scheduled-payment-recovery` amplifier and the phone-validation gap are **not** fixed by this design — they should be tracked and fixed as separate, explicitly scoped follow-ups (§10.4-10.5), or the same *class* of runaway retry can still cause operational noise (just without burning codes anymore).

**Rollback strategy:**
- Because the new minting logic lives entirely inside `claim_payment_contributions`, rolling back is: redeploy the previous edge function build (which still has the `useAtomicRpc` branch and the standalone per-unit mint call) and revert the RPC to its current (pre-change) definition. Since the `contribution_code_counters` table and its key shape are never altered, a rollback cannot orphan or corrupt any counter state — worst case reverts to today's known, already-documented "cosmetic gap" behavior, not a new failure mode.
- No data migration is required to roll back, because no historical data is touched by the forward migration either.

---

## Final Recommendation

- **Is the current H1 atomic RPC sufficient?** No. It correctly makes idempotency, capacity, and insertion atomic, but contributor-code allocation happens entirely outside that boundary today.
- **Must it be modified, or does it need a new atomic RPC?** **Modified.** `claim_payment_contributions` already has the right lock, the right ordering (idempotency before capacity before insert), and the right transaction boundary — extending it to also allocate the code is strictly additive and avoids creating a second, parallel atomic mechanism (which would itself become "duplicated sequence logic," the exact thing this task's objectives ask to avoid).
- **Where should contributor-code allocation live?** **Inside `claim_payment_contributions`, immediately after the capacity check and immediately before the `INSERT`, in the same transaction/lock as everything else.** The edge function's job shrinks to resolving *which prefix* applies to each unit (unchanged logic) and passing it through — it should never again compute or commit a sequence number itself.

This document is investigation and design output only. No implementation, migration, deployment, or flag change has been made against TEST or production as part of this task.
