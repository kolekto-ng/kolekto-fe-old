# Kolekto — Collection Domain Canary Runbook (Phase 1.3 validation)

**Goal:** prove the Express `CollectionService` is a safe, authoritative replacement for the Edge `create-collection` function, in staging then a controlled canary, until we have production-level confidence — **before** any Payments/Wallet work.

**Guarantee preserved throughout:** the Edge function stays deployed as the default and the fallback. The Express path is opt-in via a **runtime** flag, so enabling it and rolling it back need **no redeploy**.

**Current safe state (shipped):**
- Express `CollectionService` is wired to `POST /api/create-collection` but is **not** the default caller.
- Frontend `createCollection` chooses the path via `@/lib/featureFlags` → `getCreateCollectionPath()`, default **`edge`** (today's behavior). No production change until someone flips the flag.

---

## 0. Preconditions

- [ ] A **non-prod** Supabase project (the test project) with the same schema as prod, including the `validate_collection_amount()` trigger and the `campaigns` / `verification_documents` / `campaign_images` tables.
- [ ] A **KYC-verified** test user in that project; note its `auth.users` id.
- [ ] The Express API deployed to a **staging** host pointed at the test project (verify the `KNOWN_PROJECT_ENVIRONMENTS` startup guard is green — never point staging at prod).
- [ ] Frontend staging build able to reach the staging API (`VITE_API_URL`).

---

## 1. Gate A — P0 integration tests (automated, must pass)

Validates the two highest-risk assumptions the unit tests can't: the DB trigger accepts the `type` per collection type, and fundraising multi-table writes succeed.

```bash
cd kolekto-be-old
export SUPABASE_TEST_URL="https://<test-ref>.supabase.co"
export SUPABASE_TEST_SERVICE_ROLE_KEY="<test service role key>"
export SUPABASE_TEST_USER_ID="<verified test user id>"
npm run test:integration
```

- The suite **refuses to run against the prod ref** and **skips** entirely if any var is missing.
- **Gate A passes when:** all 5 integration tests pass (fixed, tiered, ticket, open_pool, fundraising) and cleanup runs. It creates and then deletes its rows.

> If a `type` value is rejected by the trigger, STOP — fix `resolveLegacyType()` / the row mapping before proceeding. This is the #1 risk.

Also keep the offline unit suite green:
```bash
npm test            # 20 unit/characterization tests, no network
```

---

## 2. Gate B — Manual shadow parity (staging)

For each of the 5 collection types, create one collection via **each** path in staging and compare the resulting rows.

1. Edge path (default): create via the wizard normally.
2. Express path: in the browser console, opt this session in and create again:
   ```js
   localStorage.setItem("kolekto-ff-create-path", "express"); // opt in (deploy-free)
   // ...create via the wizard...
   localStorage.removeItem("kolekto-ff-create-path");         // opt back out
   ```
3. Compare the two `collections` rows (and `wallets`, and for fundraising the `campaigns`/docs/images). Expected differences: **only** `id`, `slug`, timestamps. Everything else — `type`, `status`, `amount`, `currency`, defaults — must match.

**Gate B passes when:** zero unexpected field differences across all 5 types.

---

## 3. Gate C — Internal canary (staging → limited prod)

Roll the Express path to a small, controlled audience first.

- **Internal testers (deploy-free):** have each tester run `localStorage.setItem("kolekto-ff-create-path","express")` and use the product normally for a soak window. Rollback for a tester is `removeItem`.
- **Optional global default in staging:** set `VITE_CREATE_COLLECTION_PATH=express` for the staging build to route 100% of staging traffic through Express.

Monitor throughout (see §5). **Gate C passes when:** over the soak window, success rate ≥ 99.5%, no correctness diffs, p95 latency within ~+50ms of the Edge baseline, zero KYC-gate regressions.

---

## 4. Gate D — Production cutover (only after A–C)

1. Ensure a **runtime** flag mechanism exists for prod (per-tester localStorage covers canary; for a global % rollout wire `getCreateCollectionPath()`'s env default to a remote config service so you can change the percentage **without a deploy**).
2. Ramp: internal → 5% → 25% → 100%, watching §5 metrics at each step.
3. Hold at 100% for a soak window.
4. **Do not retire the Edge function yet** — keep it as the instant fallback until a separate, later approval.

---

## 5. Monitoring (structured logs already emitted)

Every create emits correlated JSON events (`utils/logger.js`). Grep the backend logs:

| Watch for | Event | Action |
|-----------|-------|--------|
| Success + latency | `collection.create.succeeded` (`duration_ms`) | baseline p50/p95 |
| Business rejections | `collection.create.rejected` (`status` 400/401/403) | expected; watch 403 (KYC) rate |
| Unexpected failures | `collection.create.failed` (500, `err`) | **page** on any spike |
| Silent wallet gaps | `collection.create.wallet_warning` | investigate integrity |
| Fundraising gaps | `collection.campaign.*_failed` | investigate |

- Every response carries `X-Request-Id` and a `requestId` field; a user bug report → grep that id to see the whole request across controller/service.
- Suggested alerts at ramp: failure-rate > 1% (5m), p95 > baseline +50ms (10m), any `wallet_warning` burst.

---

## 6. Rollback

| Situation | Action | Speed | Deploy? |
|-----------|--------|-------|---------|
| A single tester hits an issue | `localStorage.removeItem("kolekto-ff-create-path")` | instant | No |
| Staging global default bad | unset `VITE_CREATE_COLLECTION_PATH` (rebuild) | minutes | staging only |
| Prod canary via remote flag | set flag → `edge` | seconds | No |
| Worst case | revert FE to prior release (Edge default) | minutes | Yes |

Because both paths write identical rows and the schema/`user_id` semantics are untouched, **rollback needs no data reconciliation**.

---

## 7. Go / No-Go summary

- **GO to next gate** only when the current gate's pass criteria are met.
- **NO-GO to production cutover** until Gate A (integration) + Gate B (parity) + Gate C (canary soak) are all green and a runtime prod flag exists.
- **Do NOT** retire the Edge function, and **do NOT** begin Payments/Wallet consolidation, until the Collection cutover has held at 100% through a production soak and is approved. Workspaces remain deferred until the entire financial core is consolidated.

---

*Phase 1.3 validation harness. The default path remains the Edge function; nothing in production changes until a flag is deliberately flipped.*
