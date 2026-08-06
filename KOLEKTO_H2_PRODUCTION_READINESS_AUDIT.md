# H2 Atomic Contributor Code Allocation — Production Readiness Audit

**Scope:** read-only audit against production (`busfgcmbndleljklrcbd`). No migration, deploy, secret change, or data write was performed against production at any point in this audit. Every query below was `SELECT` / `information_schema` / `pg_catalog` introspection only.

---

## 1. Executive Summary

**Critical, audit-changing finding: `claim_payment_contributions` does not exist in production at all.** Neither H1 nor H2 has ever been deployed there — production is still running the original, pre-H1 architecture in full: the deployed `verify-paystack-payment` edge function (version 26) contains zero references to `claim_payment_contributions`, `useAtomicRpc`, `VERIFY_USE_ATOMIC_RPC`, or `deferCapacityChecks`. It mints codes client-side via `next_contribution_code_number` and inserts per-unit exactly as it did before any atomicity work began.

This means what's being audited is not "is H2 compatible with an H1 already running in production" — **it is the first-ever production deployment of both H1's transactional-atomicity model and H2's inline code allocation, together, in one change.** That is a materially bigger step than the phrasing of this task implied, and it changes the risk posture from "incremental fix" to "first production rollout of new financial-write infrastructure." It does not change the underlying soundness of the work — H2 has been thoroughly tested on TEST, including against the real `enforce_max_contributions` trigger — but it does change the rollout discipline this deployment deserves.

**Second confirmed finding, independent of the above: the original BBN incident is still active and growing right now.** A fresh read at the time of this audit shows the counter at **3,388** (was 3,361 when first investigated, 3,363→1,650-gap at the time of the design report) against 34 real contributions — the gap has grown to **1,677** and is climbing in real time, because `scheduled-payment-recovery` is still retrying the same permanently-broken reference every 5 minutes on production, and production has no fix deployed yet. **Deploying H2 to production will stop this specific gap from growing further immediately** — even without also fixing the underlying phone-validation bug or the recovery cron's retry ceiling — because the counter increment and the failing insert will then roll back together on every retry, exactly as proven on TEST (Case B/I).

**Third finding:** the ambassador-attribution trigger (`trg_contributions_ambassador_attribution` / `trg_ambassador_payment_attribution`) that exists on TEST **does not exist on production**. This is unrelated schema drift (a TEST-only feature/fixture, not part of the payment-atomicity work) — it *reduces* deployment risk for H2 in production, since one of the two triggers flagged as a rollback-safety concern in the design phase simply isn't present there to interact with.

**No other schema drift found.** `contributions`, `contribution_code_counters`, both unique constraints, all relevant indexes, and `enforce_max_contributions` are present and identical in shape between TEST and production.

**Decision: CONDITIONAL GO** — see §10 for the exact conditions. The work is sound and directly addresses a live, worsening incident; the condition is treating this as a first production rollout of new RPC infrastructure (proper staged rollout, not a same-day full cutover), not a reason to withhold it.

---

## 2. Production Schema Comparison

| Item | TEST | Production | Compatible? |
|---|---|---|---|
| `claim_payment_contributions` | Exists (H2 version, deployed and tested) | **Does not exist** | ⚠️ Must be created — this is the deployment itself, not a drift problem |
| `next_contribution_code_number` | Exists, unchanged | Exists, identical definition | ✅ |
| `next_contributor_code_number` (legacy) | Exists, unused | Exists, unused | ✅ (harmless parity) |
| `contribution_code_counters` (table) | `PRIMARY KEY (collection_id, prefix)`, FK cascade to `collections` | Identical: `PRIMARY KEY (collection_id, prefix)`, FK cascade | ✅ |
| `contributions.phone` | `varchar(20)` | `varchar(20)` | ✅ (the historical trigger condition is identical in both) |
| `contributions.contributor_unique_code` | `varchar(50)` | `varchar(50)` | ✅ |
| `UNIQUE (collection_id, contributor_unique_code)` | Present (as two redundant indexes, `contributions_collection_code_unique` + `uq_contributions_unique_code`) | Present, identically named and shaped | ✅ |
| `UNIQUE (collection_id, payment_reference, line_index)` | Present (`uq_contributions_collection_ref_line`) | Present, identical | ✅ |
| `enforce_max_contributions` trigger | `BEFORE INSERT OR UPDATE OF status ... WHEN status='paid'` | Identical trigger, identical function body | ✅ |
| Ambassador-attribution trigger | Present (`trg_contributions_ambassador_attribution`) | **Absent** | N/A for production — one fewer rollback-interaction surface to worry about there |
| `check_max_contributions()` function body | Verified identical to production in the design phase | Confirmed identical | ✅ |

**No unexpected drift found** beyond the ambassador trigger (a feature difference, not a payment-atomicity concern) and the absence of `claim_payment_contributions` itself (the thing being deployed).

---

## 3. RPC Security Comparison

| Function | TEST grants | Production grants |
|---|---|---|
| `claim_payment_contributions` | `{postgres=X/postgres, service_role=X/postgres}` — **anon/authenticated explicitly revoked, PUBLIC revoked** | N/A — does not exist yet; must be created with the identical `REVOKE ... FROM anon/authenticated/PUBLIC; GRANT ... TO service_role` statements from `database/h2_atomic_contributor_code_allocation.sql` |
| `next_contribution_code_number` | `{=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}` — PUBLIC (and thus anon/authenticated) can call it | Identical grants — anon/authenticated can call it in production too |

**Confirmed: on TEST, `claim_payment_contributions` cannot be called by `anon` or `authenticated` roles — only `service_role`.** This matches the intended design (the edge function calls it with the service-role key; no client-side path can invoke it directly). The migration script includes the exact REVOKE/GRANT statements needed to reproduce this on production.

**Separate, pre-existing observation (not a regression, not blocking):** `next_contribution_code_number` is callable by `anon`/`authenticated` in **both** environments today. Its blast radius is limited to burning a cosmetic sequence number (it does not insert a contribution or move money), but this is worth a follow-up ticket to tighten to `service_role`-only in both environments — unrelated to this deployment's scope.

---

## 4. Data Reconciliation (Production, Read-Only)

21 `(collection_id, prefix)` counter rows exist in production. Reconciliation (same corrected-regex methodology used throughout this investigation):

| Collection | Prefix | Counter | Highest committed code | Paid codes | Gap |
|---|---|---|---|---|---|
| Busybrain Night Of Majesty (`f4c30113-...`) | `BBN` | **3,388** | 1,711 | 34 | **1,677 — active, growing** |
| (all other 20 counter rows) | — | — | — | — | **0** |

**Duplicates:** zero raw `(collection_id, contributor_unique_code)` duplicate pairs found — the unique constraint has never been violated.

**Invalid-shaped codes:** 3 rows found with a `_DUP` suffix (`PHS_535_DUP`, `TSU_061_DUP`, `TSU-M_014_DUP`) — these read as a manual, historical dedup intervention (an admin/support action renaming a duplicate off the canonical slot), not a system-generated code, not matched by the counter-reconciliation regex, and not touched by anything in this task. **Flagged as a historical curiosity, not a blocker — not repaired, per the explicit instruction not to touch historical data.**

### Historical gaps vs. gaps H2 could newly create

- **Historical / ongoing (not caused by H2, exists today, growing right now):** the BBN gap. Root cause fully documented in the prior investigation (a phone value exceeding `varchar(20)`, retried every 5 minutes by `scheduled-payment-recovery`, forever, under the pre-H1 architecture currently live in production). **This task did not and must not repair it** — it is explicitly out of scope, and doing so would be a manual data repair this audit is instructed not to perform.
- **New gaps H2 could create:** none identified. H2's failure modes were exhaustively tested on TEST (Cases B, C, D, F, G, H, I) and every one of them left the counter unchanged or advancing by exactly the number of *successful* contributions. The one genuine new code path (the `jsonb_set` receipt-embedding logic) was bug-tested and fixed during implementation (see the H2 implementation report §6) — it affects only the `_receipt.unique_code` field inside `contributor_information`, never the counter or the top-level `contributor_unique_code` column, so a defect there could produce a cosmetically-wrong receipt but never a numbering gap.
- **Net effect of deploying H2 to production specifically for the BBN situation:** the counter will stop advancing on each of `scheduled-payment-recovery`'s repeated failed attempts against that same broken reference (its insert will still fail — the phone-length bug is unrelated and unfixed — but the failure will now roll back the mint too). The gap freezes at whatever value it's at when H2 goes live; it does not shrink (this task does not renumber historical data) and does not grow further from this specific cause.

---

## 5. Edge Function Compatibility

Production's currently deployed `verify-paystack-payment` (version 26, last updated ~2026-07-19):
- Does **not** call `claim_payment_contributions` — the function doesn't exist for it to call.
- **Does** call `next_contribution_code_number` (confirmed present in the deployed source), exactly the pre-H1 client-side minting pattern.
- Contains **no** `useAtomicRpc` branch, no `VERIFY_USE_ATOMIC_RPC` check, no `deferCapacityChecks` — this is the original, single, non-atomic per-unit-insert path.

**Answering the four specific questions:**
- *Does it still call `next_contribution_code_number`?* Yes — unconditionally, as the only code path that exists.
- *Does it already contain H1 logic?* No.
- *Can H2 be deployed without breaking existing payment behavior?* Yes, provided both halves ship together (the migration creating `claim_payment_contributions`, and the edge function replacing the old code path with the new one) — deploying only one half would break payments outright (edge function calling a non-existent RPC, or a new RPC nothing calls). This is a paired, atomic deployment, not two independent changes.
- *Does the production function expect any schema/RPC behavior H2 changes?* No — H2 does not alter `contributions`, `contribution_code_counters`, or either unique constraint. It only adds one new function. The production function's current expectations (columns, constraint behavior) are fully satisfied by the unchanged schema.

`scheduled-payment-recovery` (version 4, production): calls `verify-paystack-payment` via HTTP exactly as documented in the prior investigation — it has no direct dependency on `claim_payment_contributions` or the edge function's internal branching; it will simply inherit whatever `verify-paystack-payment` does once redeployed. No separate change needed there for this deployment (its retry-ceiling issue remains a separate, tracked follow-up).

---

## 6. Payment Behavior Compatibility

Cross-checked against the H2 implementation and the current production edge function:

| Behavior | Preserved? | Note |
|---|---|---|
| Idempotency | ✅ | Same early-check-then-RPC-idempotency-check pattern; RPC's own check is unconditionally reached now (no flag) |
| Capacity enforcement | ✅ | Collection-wide + per-tier checks unchanged; now always deferred to the RPC's live, locked check instead of the edge function's earlier, less authoritative one |
| Tier resolution | ✅ | `buildContributionUnits` / `matchTier` logic untouched |
| Multi-unit contributions | ✅ | Proven directly (Case H): one call, N rows, N sequential codes, one transaction |
| Fee calculations | ✅ | Not touched by H2 — `calculateFees`/`allocateAmounts` untouched, still computed client-side exactly as before, only persistence of the resulting rows moved |
| Wallet behavior | ✅ | `refreshCollectionAndWallets` runs after the RPC call returns, identical to before |
| Receipts | ✅ (with one fix applied and verified — see §4/design report §6) | `contributor_unique_code` and `_receipt.unique_code` both now populated server-side; downstream receipt/email code reads them off the RPC's returned rows exactly as before |
| Organizer notifications | ✅ | Unaffected — fires after the RPC call, unchanged logic |
| Recovery behavior | ✅, and specifically improved | `scheduled-payment-recovery` continues to work unmodified; its repeated-failure case no longer burns a number (Case I, directly proven) |
| Ambassador attribution | N/A in production | Trigger doesn't exist there (§2) — no interaction to verify in this environment |

---

## 7. Deployment Sequence

1. **Pre-deployment backup/recovery verification.** Confirm Supabase's automated point-in-time recovery / daily backup is active and recent for the production project (standard platform feature — verify via the dashboard, not part of this audit's tool access). Record the current BBN counter value (3,388 at time of audit) and total contribution count as a pre-deployment baseline snapshot for post-deploy comparison.
2. **Production database preflight (read-only, repeat this audit's queries immediately before deploying):** re-confirm `claim_payment_contributions` still doesn't exist (no one else has deployed it out-of-band), re-confirm the schema/constraint/trigger state in §2 is unchanged, re-run the reconciliation query in §4 as a final "last known state" snapshot.
3. **H2 migration application:** apply `database/h2_atomic_contributor_code_allocation.sql` verbatim (the version with the corrected `jsonb_set` logic — confirm it's the *second*, fixed migration content, not the first draft) via `CREATE OR REPLACE FUNCTION`, followed by the REVOKE/GRANT block. Purely additive — no existing object is altered or dropped.
4. **RPC security verification:** immediately after applying, re-run the grants query from §3 against production and confirm `claim_payment_contributions`'s `proacl` shows `service_role` only (matching TEST exactly) before proceeding.
5. **Edge Function deployment:** deploy the exact `verify-paystack-payment` source currently live on TEST (the version with `useAtomicRpc` removed, `prefix`-based rows, unconditional `deferCapacityChecks: true`) to production.
6. **Smoke testing:** immediately after deploy, run a single real low-value test payment through the production flow end-to-end (or, if a synthetic path exists, use it) and confirm: a contribution is recorded, its `contributor_unique_code` is correctly formed, the receipt shows the code, and the wallet updates. This is the one step this audit cannot perform itself (it requires initiating a real or sandboxed Paystack transaction against production, which is outside a read-only audit's scope) — flag explicitly as the responsible team's action.
7. **Controlled production rollout:** given this is the first production use of this RPC (not an incremental flip of an already-soaked flag), do not consider this "done" after the smoke test — actively watch the first cohort of real payments (see monitoring plan, §9) before treating it as fully rolled out.
8. **Monitoring period:** minimum 24–48 hours of active watching per §9 before considering this deployment complete and moving attention elsewhere.
9. **Rollback conditions:** see §8.

---

## 8. Rollback Plan

**What can be rolled back safely:** the edge function. Redeploying the previous (pre-H2, pre-H1) `verify-paystack-payment` source immediately restores the exact behavior production had before this change — client-side minting via `next_contribution_code_number`, per-unit insert, no RPC dependency. This is a clean, fast, safe rollback path with no data implications, because the previous code path never depended on `claim_payment_contributions` existing.

**What cannot be rolled back after real payments are processed:** any `contributor_unique_code` values and `contribution_code_counters` increments produced by real, successful payments while H2 was live are **real, committed financial/identity records** — rolling back the edge function does not and must not attempt to undo them. They remain valid, permanent contributor codes exactly like every code minted before this change.

**Is the H2 migration itself reversible?** Yes, cleanly: `claim_payment_contributions` can be dropped or reverted to not exist (it did not exist before this deployment), and the edge function no longer calls it once rolled back. **However, do not drop the function purely to "revert" — leaving it in place, unused, is harmless** (matches the same posture already taken with `next_contributor_code_number`, the legacy function kept around unused) and avoids any risk of dropping something a delayed in-flight request is still mid-call on.

**How historical data remains protected:** the migration is `CREATE OR REPLACE` on a function that didn't previously exist in production — there is no prior version of `claim_payment_contributions` in production to lose, and nothing in this deployment touches `contributions`, `contribution_code_counters`, or any historical row. A rollback of the edge function alone is sufficient to fully revert behavior; no data migration or repair step is ever needed for rollback.

**What happens to transactions processed during a rollback window:** because `claim_payment_contributions`'s idempotency check is authoritative and keyed by `(collection_id, payment_reference)`, a payment whose verify-call started under the new (H2) edge function but completes (or is retried) after a rollback to the old edge function is still handled correctly — the old code path's own idempotency check (`SELECT ... WHERE payment_reference = ...`) will see any row H2 already committed and treat it as already-recorded, never double-inserting. No payment can be lost or duplicated across a rollback boundary.

---

## 9. Monitoring Plan

For the first 24–48 hours after production deployment:
- Watch `payment_recovery_log` for any new `claim_rpc_failed` entries (would indicate a schema/grant problem missed by this audit — e.g., a grant not applied correctly).
- Re-run the §4 reconciliation query on a schedule (e.g., hourly for the first day) and confirm the BBN gap **stops growing** (it should freeze at its pre-deploy value) and no *new* collection/prefix pair develops a gap.
- Watch for any `capacity_exceeded` rate change (would indicate the always-on `deferCapacityChecks: true` behaves differently than the previous conditional check for some edge case not covered by this audit's per-type test gap, §11 of the implementation report).
- Confirm receipt emails continue to show correct `contributor_unique_code` values for a sample of real post-deploy payments (validates the `jsonb_set` fix under real, not just synthetic, payload shapes).
- Watch `scheduled-payment-recovery`'s run logs for the specific BBN-adjacent references — confirm they continue to fail (the underlying phone-length bug is unfixed) but no longer correlate with counter movement.

---

## 10. Go/No-Go Decision

# CONDITIONAL GO

The implementation is correct, thoroughly tested against the real production-mirroring TEST schema (including the real `enforce_max_contributions` trigger), and directly stops an active, worsening incident. It is not a NO-GO. It is not an unconditional GO, because this audit discovered the deployment is larger in scope than assumed — a first-time production rollout of new RPC infrastructure, not a flip of an already-soaked flag — which changes the *discipline* the rollout deserves without changing the *soundness* of the code.

**Conditions for GO:**
1. Both halves (migration + edge function) must be deployed together, in the sequence in §7 — never one without the other.
2. Step 4 (RPC security verification) must be executed and pass **before** step 5 (edge function deploy) — do not deploy the edge function against a `claim_payment_contributions` whose grants haven't been confirmed `service_role`-only.
3. A real smoke-test payment (§7 step 6) must be confirmed successful before considering the rollout complete — this audit could not perform this step itself.
4. The monitoring plan (§9) must actually be watched for the stated window — not just scheduled and ignored.
5. No attempt to repair the BBN historical gap, the `_DUP`-suffixed codes, or renumber any historical code, as part of this deployment — confirmed out of scope and not touched by this audit.
6. The retry-ceiling fix for `scheduled-payment-recovery` and the phone-validation fix remain tracked as separate follow-ups — this deployment does not need to wait for them, but they should not be forgotten (the BBN reference will keep failing and retrying, harmlessly with respect to numbering, until one of them ships).

---

## 11. Exact Next Action

**Get explicit human sign-off to proceed with the production deployment sequence in §7**, with the person deploying aware that this is creating `claim_payment_contributions` in production for the first time (not toggling an existing flag) — then execute §7 steps 1–6 in order, verifying step 4 before step 5, followed by the monitoring window in §9. This audit does not authorize or perform that deployment itself; it confirms the pre-conditions are met and hands off a precise sequence for a human (or a separately-authorized action) to execute.
