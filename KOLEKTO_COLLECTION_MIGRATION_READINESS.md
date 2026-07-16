# Kolekto — Collection Migration Readiness Report (Phase 1.2)

**Scope:** validate the new Express `CollectionService` as a production-ready replacement for the live Supabase Edge function `create-collection`, under full backward compatibility. **No migration has been executed.** The frontend still calls the Edge function.

**Companion docs:** `KOLEKTO_PHASE1_ENGINEERING_AUDIT.md`, `KOLEKTO_ENGINEERING_STANDARDS.md`, `KOLEKTO_DOMAIN_DEPENDENCY_GRAPH.md`.

**Verdict up front:** **GO for shadow/canary validation; NO-GO for a blind full cutover.** The service is behavior-faithful and well-tested at the unit level, but it has **not been executed against a real Supabase project**, and the one intentional auth/error divergence must be confirmed in a shadow run before the frontend is repointed. Production-readiness score: **7.5 / 10** (details §7).

---

## STEP 1 — Full Collection Parity Audit (Edge ↔ Service)

Baseline = the **live** Edge function `supabase/functions/create-collection/index.ts` (what the wizard calls today). Target = `kolekto-be-old/services/collectionService.js`.

| # | Behavior | Edge (live) | CollectionService | Match | Notes |
|---|----------|-------------|-------------------|-------|-------|
| 1 | Title required | `400 "Title is required"` | same | ✅ | |
| 2 | KYC gate (unverified ⇒ ≤1 collection) | 403 message | same message, 403 | ✅ | identical rule |
| 3 | Collection types supported | fixed, tiered, fundraising, ticket, open_pool | all 5 | ✅ | |
| 4 | `legacyType`/`type` DB-trigger mapping | flat / tiered / open_pool / fundraising | identical `resolveLegacyType()` | ✅ | trigger contract preserved |
| 5 | Status | fundraising→`pending_review`, else `active` | same | ✅ | |
| 6 | Default values | fee_bearer=contributor, unique_id=false, min_contribution=0, allow_multiple_quantity=true, is_open_ended=false, auto_close=false, campaign_country=Nigeria, story_images=[], banner_url=null | identical defaults | ✅ | field-by-field port |
| 7 | Currency | NGN / ₦ hardcoded | same | ✅ | |
| 8 | Slug generation | base(40) + random5 | identical algorithm | ✅ | |
| 9 | Wallet creation | upsert, `ignoreDuplicates`, zeros; warn on error (non-fatal) | same | ✅ | |
| 10 | `wallets.fee_breakdown` | **not written** | **not written** | ✅ | **intentional** parity (see §Intentional) |
| 11 | Fundraising campaign row | insert with social mapping, `pending_verification` | identical | ✅ | |
| 12 | Verification documents | supports `{url,name}` and legacy string; default names; non-fatal | identical | ✅ | tested both shapes |
| 13 | Campaign images | ordered `display_order`, non-fatal | identical | ✅ | |
| 14 | `campaignId` fallback on campaign error | `campaign?.id || collection.id` | same | ✅ | |
| 15 | Insert failure | `400` + DB message | `400` + DB message | ✅ | |
| 16 | Success response body | `{ data: collection }` | `{ data: collection, requestId }` | ⚠️ **intentional** | additive `requestId` field, non-breaking |
| 17 | Success HTTP status | `200` | `200` | ✅ | |
| 18 | Auth model | decodes JWT **unverified**, `SERVICE_ROLE` | real `verifyToken` (`req.user.id`) | ⚠️ **intentional** | more secure; identical for valid tokens |
| 19 | KYC-query error handling | ignored (proceeds) | throws → `500` | ⚠️ **intentional** | safer; rare path |
| 20 | Deadline / amount>100 validation | **not enforced** at creation | **not enforced** (matches live) | ✅ | the *dead* Express path enforced these; deliberately **not** carried, to match live |
| 21 | Logging | `console.*` | structured, correlated (`collection.create.*`) | ⚠️ **intentional** | observability, additive |

### Intentional differences (there are zero *accidental* ones)
1. **Response adds `requestId`** (#16) — additive; existing clients ignore unknown fields.
2. **Real token verification** (#18) — the Edge path's unverified JWT decode is a security smell ("test env" comment). The Express service authenticates via `verifyToken`. For any **valid** token the resulting `user_id` is identical; invalid/forged tokens are now correctly rejected. This is the one difference that must be watched in a shadow run.
3. **KYC-query errors fail closed** (#19) — Edge silently proceeds on a KYC lookup error; the service surfaces `500`. Safer, extremely rare.
4. **Structured logging** (#21) — replaces `console.*` with correlated JSON events. Additive.
5. **Deadline/amount validation intentionally omitted** (#20) — matches the *live* Edge behavior, not the dead Express controller.

**Conclusion:** behavioral parity is **complete** for the live path; every divergence is deliberate, enumerated, and either additive or strictly safer.

---

## STEP 2 — Shadow Migration Plan

**Principle:** never replace the Edge function in one step. Introduce the Express path additively, run it in shadow, canary a slice of traffic, then cut over, keeping the Edge function as a hot fallback.

```
Phase A (today)     Wizard ──► Edge create-collection ──► DB
Phase B (shadow)    Wizard ──► Edge (authoritative) ──► DB
                              └─(mirror, no-persist)─► Express CollectionService  [compare only]
Phase C (canary)    Wizard ──► [flag] ──► Express (N%) | Edge (100-N%) ──► DB
Phase D (cutover)   Wizard ──► Express CollectionService ──► Repository ──► DB
                    Edge kept deployed as fallback (flag can revert instantly)
Phase E (cleanup)   Edge retired only after a clean soak (separate, later approval)
```

- **Deployment order:** (1) deploy Express service (done — dormant, no caller). (2) Add a FE feature flag `USE_EXPRESS_CREATE_COLLECTION` defaulting **off**. (3) Optional shadow-compare in a non-prod project. (4) Canary flag to a small % / internal accounts. (5) Flip flag to 100%. (6) Soak. (7) Retire Edge (later).
- **Rollback capability:** flip the flag off → wizard calls Edge again. No redeploy needed (§7).
- **Validation checkpoints:** unit tests green (✅ now); shadow diff = 0 rows differ; canary error-rate ≤ Edge baseline; p95 latency within +50ms; zero KYC-gate regressions.
- **Monitoring:** the `collection.create.*` events + `http.request` line (§4/§5).
- **Success criteria:** ≥ 99.5% success rate over canary window, no correctness diffs, no increase in support tickets, rollback verified working.

---

## STEP 3 — Request Correlation (implemented)

Built on the existing `middleware/requestContext.js` (assigns `req.id`, sets `X-Request-Id`). Wave 1.2 threads it end-to-end:

```
Controller (req.id) ──► collectionService.create({ ..., requestId })
   ├─► structured events carry { requestId } (utils/logger.js)
   ├─► thrown errors tagged err.requestId  (traceable)
   └─► HTTP response echoes { requestId }  (user can quote it)
```

- The **repository stays pure** (no logging/requestId) per the layering standard; the **service** logs around repo calls with the correlation id. This is a deliberate boundary choice, not an omission.
- Verified by tests: `err.requestId` set on rejection; `collection.create.succeeded` carries `requestId`.

---

## STEP 4 — Structured Logging Review

**Current state:** the backend already has a good, dependency-free structured logger (`utils/logger.js`, JSON-lines, auto-expands `err`) and a per-request child logger (`req.log`). The problem was **inconsistent adoption** — `deposit.js` and others still use `console.log`/`console.error`.

**Standard adopted for the Collection domain (the blueprint for all domains):**
- Emit `log.<level>('<domain>.<event>', meta)` — never bare `console.*`.
- Event names are dotted + past/imperative facts: `collection.create.started|succeeded|rejected|failed`, `collection.create.wallet_warning`, `collection.campaign.*`.
- Standard meta fields: `requestId`, `userId`, `collectionId`, `collectionType`, `status`, `duration_ms`, and `err` (Errors only — never plain objects/PII).
- **Levels:** expected business rejections (401/400/403) → `warn` with `reason` (no stack); unexpected failures (≥500) → `error` with `err` (stack). Success → `info`.

Do not add pino/winston — the existing logger is production-friendly. The work is **consistency**, applied here and rolled forward.

---

## STEP 5 — Observability Plan (metrics)

All derivable from the structured events already emitted (no new infra needed to start; these become dashboards later):

| Metric | Source event/field | Why |
|--------|--------------------|-----|
| Creation success rate | `succeeded` vs `rejected`+`failed` | primary SLO |
| Creation latency p50/p95/p99 | `duration_ms` on `succeeded` | perf regression guard on flip |
| Validation/rejection rate | `collection.create.rejected` by `status` | 400/401/403 distribution |
| Unexpected failure rate | `collection.create.failed` (500) | pages on spike |
| KYC-gate blocks | `rejected` where `status=403` | product signal, not an error |
| Wallet-creation warnings | `collection.create.wallet_warning` | silent-data-integrity risk |
| Campaign side-effect failures | `collection.campaign.*_failed` | fundraising completeness |
| DB latency (proxy) | `duration_ms` delta vs Edge baseline | Supabase health |
| Error distribution | `err.name`/`reason` | triage |
| Canary vs Edge deltas | compare `http.request` status/duration | go/no-go input |

**Alerts to define at cutover:** failure-rate > 1% (5m), p95 > Edge baseline +50ms (10m), any `wallet_warning` burst.

---

## STEP 6 — Frontend Migration Plan

**Audited every collection-creation entry point in `kolekto-fe-old/src`:**

- ✅ **Single live caller:** `components/collections/wizard/CreateCollectionWizard.tsx:425` → `useCollectionStore().createCollection` (`store/useCollectionStore.ts:205`) → `supabase.functions.invoke('create-collection')` (Edge).
- ✅ **Dead component removed** (Wave 0): `CreateCollectionForm.tsx`.
- ⚠️ **One dead latent path found:** `utils/api.ts` `collectionAPI.createCollection` → Express `POST /create-collection`. `collectionAPI` is **imported nowhere** — fully unused. Recommend either deleting `collectionAPI` or repurposing `collectionAPI.createCollection` as the migration target (preferred: it already points at the right route).
- ✅ No other hidden create paths (route-path string matches are navigation/redirect only).

**Exact migration steps (execute only after shadow/canary validation):**
1. In `useCollectionStore.ts` `createCollection` (line ~205), behind flag `USE_EXPRESS_CREATE_COLLECTION`, call the Express route via the API client instead of `functions.invoke('create-collection')`. Keep the Edge call as the `else` branch.
2. Ensure the payload sent equals what the Edge function received (the wizard's `buildPayload` output already uses Edge field names — no transform needed).
3. Response handling is unchanged (`{ data: collection }`).
4. Ship flag **off**; enable per §2 (canary → 100%).
5. Only after soak: remove the Edge branch and delete/retire the Edge function (separate approval).

---

## STEP 7 — Rollback Plan

| Scenario | Detection | Action | Speed | Deploy needed? |
|----------|-----------|--------|-------|----------------|
| Canary error spike | failure-rate alert | flip `USE_EXPRESS_CREATE_COLLECTION` **off** | seconds | **No** (runtime flag) |
| Subtle correctness diff | shadow/canary diff | flag off + investigate | seconds | No |
| Express host down | 5xx / health | flag off → Edge serves 100% | seconds | No |
| Flag infra unavailable | — | revert FE to last release (Edge default) | minutes | Yes (FE deploy) |
| Bad service logic already at 100% | alerts | revert BE to commit before flip **or** flip flag | seconds–minutes | flag: no / code: yes |

**Rollback guarantees:** (1) the Edge function is **never retired** during this phase, so a flag flip fully restores the prior path with **no deploy**; (2) `user_id` semantics and DB schema are untouched, so there is no data migration to reverse; (3) both paths write the same rows, so no reconciliation is required on rollback.

**Requirement before canary:** the feature flag must be a **runtime** toggle (env/remote config), not a build-time constant — otherwise "flag off" needs a deploy and the seconds-level rollback guarantee is lost.

---

## STEP 8 — Collection Domain Review (the blueprint)

| Dimension | Assessment | Action before freeze |
|-----------|------------|----------------------|
| Folder structure | `controllers/` (thin) · `services/collectionService.js` · `repositories/collectionRepository.js` — clean | ✅ keep as the template |
| Service boundaries | rules-only; no `req`/`res`; DI for repo/logger/slug | ✅ exemplary |
| Repository abstraction | sole DB access; no rules; non-throwing best-effort methods where the live path was best-effort | ✅ |
| Dependency direction | controller→service→repo→DB; no back-edges | ✅ |
| Test coverage | 20 unit/characterization tests, mocked repo | ⬆ add integration test vs real Supabase (see §9) |
| Naming consistency | `collection.create.*` events, clear method names | ✅ |
| Extensibility | factory + DI makes it trivial to add `update`/`setStatus`/`archive` next | ✅ ready for the rest of the domain |
| Gaps | service currently exposes only `create`; `editCollection`/`updateCollectionStatus` still live in the controller | plan to migrate them into the service in a later Collection sub-wave (not now) |

**Recommendation:** freeze this shape as the canonical domain blueprint. One addition before treating it as final: extract a tiny shared `httpError`/`AppError` helper (currently local to the service) into `utils/` so every future service throws the same typed error — this pays off immediately in Payments.

---

## STEP 9 — Test Review

**Present (20 tests, all green):** auth (401), validation (400, empty payload), KYC gate (both branches, verified short-circuit), `legacyType` mapping (all types), status/currency/slug, wallet zeros + `fee_breakdown` parity, wallet-error non-fatal, insert-failure→400, fundraising campaign/docs/images, non-fundraising no-campaign, correlation-id tagging, structured-log emission (succeeded/rejected/failed levels), legacy string uploads, campaign-error best-effort.

**Recommended additions before/at cutover (financial-correctness focus):**
| Priority | Test | Why |
|----------|------|-----|
| P0 | **Integration** against a Supabase **test** project: real insert → real `collections` + `wallets` rows; assert `type` satisfies the `validate_collection_amount()` trigger for each of the 5 types | the DB trigger contract is the highest-risk unverified assumption |
| P0 | Fundraising end-to-end integration: `campaigns` + `verification_documents` + `campaign_images` rows created with correct FKs | multi-table side-effects unproven against real schema |
| P1 | Idempotency/duplicate submit: same wizard payload twice → two collections (expected) but wallet upsert never errors; define desired behavior for rapid double-submit | prevent accidental duplicate collections |
| P1 | Authorization: forged/expired token rejected by `verifyToken` before the service runs | the #18 intentional divergence |
| P1 | Partial-failure: collection inserts, wallet fails → confirm chosen semantics (live = keep collection, warn) and that it is intentional (differs from the dead Express path's rollback) | data-integrity decision must be explicit |
| P2 | Concurrency: two creates for the same near-unique slug base → both succeed (random suffix) | slug collision resistance |
| P2 | Oversized/invalid uploads: malformed `verification_documents` entries (missing `url`) → no crash | resilience |

Note: the partial-failure semantics (#P1) are a genuine product decision — the live Edge path keeps the collection and warns; the removed Express path deleted the collection on wallet failure. We preserved the **live** behavior. Confirm this is desired before freeze.

---

## STEP 10 — Final Readiness Summary

### Production-Readiness Score: 7.5 / 10
- **+** Complete behavioral parity; every divergence intentional & documented.
- **+** Clean layering, DI, 20 green tests, correlated structured logging, correlation IDs end-to-end.
- **+** Trivial, deploy-free rollback (Edge retained; flag flip).
- **−** **No execution against real Supabase** — the DB-trigger `type` contract and multi-table fundraising side-effects are unverified end-to-end (biggest risk).
- **−** Feature flag + canary harness **not yet built**.
- **−** One auth-model divergence (#18) needs a shadow run to confirm no valid-token regressions.

### Remaining Risks
1. **DB trigger mismatch (Med/High):** if `validate_collection_amount()` rejects any `type` value the service sends, creation fails for that type. *Mitigation:* P0 integration test / shadow run before canary.
2. **Fundraising multi-table integrity (Med):* campaign/docs/images FKs unproven against real schema. *Mitigation:* P0 integration test.
3. **Flag must be runtime, not build-time (Med):** otherwise rollback needs a deploy. *Mitigation:* implement as remote/env flag.
4. **Partial-failure semantics (Low/Med):** confirm "keep collection on wallet failure" is desired.

### Go / No-Go
- **GO** — deploy the dormant Express service (done), build the runtime feature flag, and run a **shadow/canary** validation against a non-prod Supabase project.
- **NO-GO** — a blind 100% frontend cutover before: (a) at least the two P0 integration tests pass against real Supabase, and (b) a canary window shows zero correctness diffs and error-rate ≤ Edge baseline.

**Do not proceed to Payments/Wallets.** Per instruction, this phase stops here and awaits approval. The Payments domain carries materially higher financial risk and must not begin until the Collection cutover is validated in production.

---

*Prepared Phase 1.2. No production behavior changed; the Edge function remains the live authority and is retained as fallback.*
