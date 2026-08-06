# KOLEKTO 4.0 — Phase 1 Engineering Audit (Business Logic Consolidation)

**Prepared as:** Principal Software Architect / Senior Backend / Staff Full-Stack / Fintech Infrastructure Engineer
**Scope:** `kolekto-fe-old` (customer PWA + Supabase Edge Functions), `kolekto-be-old` (Express API + crons), `kolekto-admin-control-panel-1` (admin), shared Supabase project(s).
**Mandate of this document:** **Audit, inventory, and design only.** No code, migrations, or behavior changes were made in producing it. It is the concrete, file-and-function-level companion to the strategic `KOLEKTO_4.0_ARCHITECTURE_AUDIT.md` — that document sets the *why* (Workspaces, ledger, capabilities); this one sets the *what and where* for Phase 1: **consolidate business logic so every critical financial operation has exactly one authoritative implementation.**

> **Phase 1 is not feature work.** No Workspaces, roles, permissions, onboarding, or DB tables are introduced. Every existing feature must keep behaving exactly as today. This audit is Step 1 of that program.

---

## 0. How to read this document

| § | Deliverable (per Phase 1 brief) |
|---|---|
| 1 | Executive summary of structural findings |
| 2 | **Write-operation inventory** (every DB mutation, its file/function/runtime) |
| 3 | **Duplicate-logic report** (with canonical recommendation per duplicate) |
| 4 | **Runtime map** (React / Express / Edge / Cron / Realtime / DB) |
| 5 | **Business-logic map** (where rules live today → where they belong) |
| 6 | Business domains |
| 7 | Service layer design |
| 8 | Repository layer design |
| 9 | Controller refactoring plan |
| 10 | Direct-DB-write elimination plan |
| 11 | Domain events + activity-log foundation |
| 12 | Technical debt report |
| 13 | Risk assessment |
| 14 | Migration strategy + incremental implementation plan |
| 15 | Testing plan |
| 16 | Refactoring progress log (living) |

---

## 1. Executive Summary

Kolekto's critical financial operations do **not** have single authoritative implementations. Each of the four money-touching actions is spread across two or three runtimes, and in the worst case the copies enforce **different business rules**:

1. **Create Collection has two implementations that diverge in behavior (not just rules).**
   > **Correction (post-deep-read, 2026-07-16):** both the Edge and Express paths enforce the KYC gate — the earlier claim that Express lacked it was wrong (Express: [collection.js:105-129](../kolekto-be-old/controllers/collection.js#L105)). The real divergences are structural:
   - **Edge `create-collection`** ([supabase/functions/create-collection/index.ts](supabase/functions/create-collection/index.ts)) is the **LIVE** path (the wizard calls it via `useCollectionStore`). It supports **all 5 collection types** (fixed/tiered/fundraising/ticket/open_pool), creates the `wallets` row, and for fundraising creates `campaigns` + `verification_documents` + `campaign_images`. It sets `type = legacyType` (`flat`/`open_pool`/…) to satisfy the DB trigger `validate_collection_amount()`. It **does not** store a fee breakdown, and it decodes the JWT **unverified** using `SERVICE_ROLE`.
   - **Express `createCollection`** ([collection.js:37](../kolekto-be-old/controllers/collection.js#L37)) supports only **3 types**, stores a fee `amountBreakdown` in `wallets.fee_breakdown`, **rolls back** the collection if wallet creation fails, and uses **real `verifyToken` auth** — but sets `type = collectionType` (`fixed`), which **mismatches** the DB trigger the Edge path deliberately feeds. Its only FE consumer was `CreateCollectionForm.tsx`, now deleted in Wave 0 → **the Express create path is currently dead on the FE.**
   - A third copy, [../kolekto-be-old/controllers/collection/createCollection.jsx](../kolekto-be-old/controllers/collection/createCollection.jsx) (225 LOC), was **dead** and has been deleted (Wave 0).
   - **Net:** the *live behavior* to preserve is the Edge function's (5 types + wallet + campaign). Consolidation = build ONE authoritative Express `CollectionService.create` as a **superset** of the Edge behavior with real auth, then flip the live path to it. Open behavioral question to resolve during Wave 1: whether `wallets.fee_breakdown` (written only by the dead Express path) is consumed anywhere — if it is, wizard-created collections currently lack it (latent bug); if not, it is legacy to drop.

2. **Payment verification straddles Edge and Express by design.** The canonical verify logic lives in Edge `verify-paystack-payment` (899 LOC), but Express `deposit.js` **calls that Edge function** (`invokeVerifyEdgeFunction`, [../kolekto-be-old/controllers/deposit.js:55](../kolekto-be-old/controllers/deposit.js#L55)) *and* re-implements settlement/wallet math (`updateWalletStats`, `handleWebhook`) locally. Settlement additionally exists as a cron ([../kolekto-be-old/jobs/paymentSettlement.js](../kolekto-be-old/jobs/paymentSettlement.js)) **and** two Edge functions (`settle-pending-deposits`, `scheduled-payment-recovery`). Money settlement has **five** entry points.

3. **The client writes financial rows directly.** `useContributionStore.createContribution` inserts into `contributions` straight from the browser ([src/store/useContributionStore.ts:72](src/store/useContributionStore.ts#L72)); `updateContributionStatus` updates payment status/reference client-side ([src/store/useContributionStore.ts:123](src/store/useContributionStore.ts#L123)). The admin app writes `kyc_*`, `collections.status`, `campaigns.status`, and `profiles` directly from the browser ([../kolekto-admin-control-panel-1/src/stores/kycStore.ts](../kolekto-admin-control-panel-1/src/stores/kycStore.ts), [fundraisingStore.ts:326](../kolekto-admin-control-panel-1/src/stores/fundraisingStore.ts#L326)). These bypass any service, validation, or audit point — RLS is the *only* guard.

4. **Contribution creation has three paths** (Edge `initiate-paystack-payment`, Express `POST /contributions/:id`, and the direct client insert above), so there is no single place that defines "a contribution exists."

**Consequence for Phase 2+:** every one of these must gain `workspace_id`, capability checks, and ledger entries. With logic duplicated 2–5×, each future invariant costs 2–5× to apply and is 2–5× as likely to drift into a money bug. **Consolidation is the prerequisite, not a nice-to-have.**

**Good news (unchanged from strategic audit):** money is `DECIMAL`, the payment pipeline is idempotent, withdrawal is a documented strict-cap invariant, and — critically for Phase 1 — **one runtime already exists that owns auth, Paystack secrets, encryption, crons, and webhooks: the Express API.** The consolidation target is therefore clear and low-risk to state: **Express becomes the single write authority; Edge functions are demoted to edge-read/scheduled roles; the client goes read-only for financial tables.**

### Top Phase-1 moves (detail in §14)

| # | Move | Why first | Cx |
|---|------|-----------|----|
| 1 | Freeze the write surface: inventory + `CLAUDE.md` rule "one runtime owns each write" | Stops new duplication mid-refactor | S |
| 2 | Delete confirmed dead write-paths (`createCollection.jsx`, `CreateCollectionForm.tsx`, `authMiddleware.js`) | Shrinks surface before moving it | S |
| 3 | Consolidate **Create Collection** → one `CollectionService.create` (union of KYC + fee rules) | Highest-divergence duplicate | M |
| 4 | Consolidate **Contribution create** → server-only; remove client `contributions` writes | Removes client financial write | M |
| 5 | Consolidate **Payment verify + settlement** → one `PaymentService` orchestrating one verify impl | Five settlement entry points → one | L |
| 6 | Introduce Service + Repository layers behind the consolidated paths | The structural target | L |
| 7 | Move admin financial writes behind admin API endpoints | Removes client financial write | M |

---

## 2. Write-Operation Inventory

Legend — **Runtime:** `RX` React client · `EX` Express · `ED` Supabase Edge · `CR` Cron · `DB` trigger. **Auth:** who is trusted to authorize. Every row is a place the app mutates persistent state.

### 2.1 Collections domain

| # | Operation | File · function | Runtime | Duplicated? | Key business rules | Notes |
|---|-----------|-----------------|---------|-------------|--------------------|-------|
| C1 | Create collection (LIVE) | [supabase/functions/create-collection/index.ts](supabase/functions/create-collection/index.ts) | ED | **Yes → C2, C3** | KYC gate (≤1 collection if unverified), slug gen, tiers | Uses `SERVICE_ROLE`; decodes JWT unverified |
| C2 | Create collection (LIVE, orphaned FE) | [../kolekto-be-old/controllers/collection.js:37](../kolekto-be-old/controllers/collection.js#L37) `createCollection` | EX | **Yes → C1, C3** | fundraising fee `amountBreakdown`, `platformFee`, type validation | Reached via `POST /api/create-collection`; FE caller is dead |
| C3 | Create collection (DEAD) | [../kolekto-be-old/controllers/collection/createCollection.jsx](../kolekto-be-old/controllers/collection/createCollection.jsx) | EX | **Yes (dead)** | — | Imported nowhere → delete |
| C4 | Edit collection | [../kolekto-be-old/controllers/collection.js](../kolekto-be-old/controllers/collection.js) `editCollection` + [supabase/functions/update-collection/index.ts](supabase/functions/update-collection/index.ts) | EX + ED | **Yes** | field whitelist, ownership | Two update paths |
| C5 | Update collection status | [../kolekto-be-old/controllers/collection.js](../kolekto-be-old/controllers/collection.js) `updateCollectionStatus` | EX | with C6 | status transitions | |
| C6 | Update collection status (admin) | [../kolekto-admin-control-panel-1/src/stores/fundraisingStore.ts:326](../kolekto-admin-control-panel-1/src/stores/fundraisingStore.ts#L326) | RX (admin) | **Yes → C5** | active/rejected/paused/closed + `campaigns` mirror | **Direct client write** |
| C7 | Delete collection | [supabase/functions/delete-collection/index.ts](supabase/functions/delete-collection/index.ts) | ED | — | soft delete | |
| C8 | Collection access grants | [../kolekto-be-old/controllers/collectionAccess.js](../kolekto-be-old/controllers/collectionAccess.js) | EX | — | invite/grant view booleans | |
| C9 | Collection transfer | [../kolekto-be-old/controllers/collectionTransfer.js](../kolekto-be-old/controllers/collectionTransfer.js) | EX | — | OTP, moves `user_id` | |

### 2.2 Contributions & Payments domain

| # | Operation | File · function | Runtime | Duplicated? | Key business rules |
|---|-----------|-----------------|---------|-------------|--------------------|
| P1 | Create contribution (public, LIVE) | [supabase/functions/initiate-paystack-payment/index.ts](supabase/functions/initiate-paystack-payment/index.ts) | ED | **Yes → P2, P3** | amount/fee calc, tier resolve, unique code, Paystack init |
| P2 | Create contribution (Express) | [../kolekto-be-old/controllers/contribution.js](../kolekto-be-old/controllers/contribution.js) `createContribution` via `POST /contributions/:id` | EX | **Yes → P1, P3** | called by [src/components/contribute/ContributionForm.tsx:242](src/components/contribute/ContributionForm.tsx#L242) |
| P3 | Create contribution (client insert) | [src/store/useContributionStore.ts:72](src/store/useContributionStore.ts#L72) | RX | **Yes → P1, P2** | none — raw insert, `status:'pending'` |
| P4 | Update contribution status | [src/store/useContributionStore.ts:123](src/store/useContributionStore.ts#L123) | RX | with P5 | sets `status`, `payment_reference` |
| P5 | Verify payment (canonical core) | [supabase/functions/verify-paystack-payment/index.ts](supabase/functions/verify-paystack-payment/index.ts) | ED | **Yes → P6** | Paystack verify, mark paid, wallet, receipt, push |
| P6 | Verify payment (Express wrapper) | [../kolekto-be-old/controllers/deposit.js:616](../kolekto-be-old/controllers/deposit.js#L616) `verifyPayment` → `invokeVerifyEdgeFunction` ([:55](../kolekto-be-old/controllers/deposit.js#L55)) | EX→ED | **Yes → P5** | orchestrates edge + local fallback |
| P7 | Paystack webhook (deposits) | [../kolekto-be-old/controllers/deposit.js:1253](../kolekto-be-old/controllers/deposit.js#L1253) `handleWebhook` (mounted raw in [../kolekto-be-old/app.js:102](../kolekto-be-old/app.js#L102)) | EX | with P5/P6 | HMAC verify, idempotent settle |
| P8 | Wallet stat update | [../kolekto-be-old/controllers/deposit.js:242](../kolekto-be-old/controllers/deposit.js#L242) `updateWalletStats` | EX | **Yes** (edge verify also writes wallet) | increments balance columns on `collections` |
| P9 | Settlement cron (T+1) | [../kolekto-be-old/jobs/paymentSettlement.js](../kolekto-be-old/jobs/paymentSettlement.js) | CR | **Yes → P10, P11** | 5am WAT sweep |
| P10 | Settle pending deposits (edge) | [supabase/functions/settle-pending-deposits/index.ts](supabase/functions/settle-pending-deposits/index.ts) | ED | **Yes → P9** | |
| P11 | Scheduled payment recovery (edge) | [supabase/functions/scheduled-payment-recovery/index.ts](supabase/functions/scheduled-payment-recovery/index.ts) | ED | **Yes → P9** | orphan recovery (memory: `orphaned_payment_recovery`) |
| P12 | Send receipt notification | [../kolekto-be-old/controllers/deposit.js:1592](../kolekto-be-old/controllers/deposit.js#L1592) | EX | — | triggers push (memory: `payment_push_trigger`) |

### 2.3 Withdrawals, Wallet, Users, Notifications, KYC, Ambassador, Email

| # | Operation | File · function | Runtime | Duplicated? | Notes |
|---|-----------|-----------------|---------|-------------|-------|
| W1 | Request withdrawal | [../kolekto-be-old/controllers/withdrawal.js](../kolekto-be-old/controllers/withdrawal.js) `requestWithdrawal` | EX | No (good) | strict-cap (memory: `withdrawal_strict_cap`) |
| W2 | Approve / reject withdrawal | same, `approveWithdrawal`/`rejectWithdrawal` | EX | No | admin-gated (`requireAdmin`) |
| W3 | Withdrawal webhook | `handlePaystackWebhook` (route commented out) | EX | dormant | verify route disabled |
| U1 | Profile update | [../kolekto-be-old/controllers/settings/profile.js](../kolekto-be-old/controllers/settings/profile.js) + [supabase/functions/profile-update/index.ts](supabase/functions/profile-update/index.ts) | EX + ED | **Yes** | two update paths |
| U2 | Security (email/password OTP) | [../kolekto-be-old/controllers/settings/security.js](../kolekto-be-old/controllers/settings/security.js) | EX | No | |
| N1 | Mark notification read | [src/store/useNotifications.ts:121](src/store/useNotifications.ts#L121) | RX | — | client write, RLS-guarded (own rows) |
| N2 | Send push / write notification | [../kolekto-be-old/utils/pushNotifications.js](../kolekto-be-old/utils/pushNotifications.js) + [src/utils/pushNotifications.ts](src/utils/pushNotifications.ts) | EX + RX | subscribe vs send | memory: `in_app_notifications` |
| K1 | KYC decisions (approve/reject/verify NIN) | [../kolekto-admin-control-panel-1/src/stores/kycStore.ts:320](../kolekto-admin-control-panel-1/src/stores/kycStore.ts#L320)+ | RX (admin) | — | **Direct client writes** to `kyc_documents`, `kyc_verifications`, `kyc_verification_history`, `profiles` |
| K2 | KYC submit (user) | [../kolekto-be-old/controllers/settings/kyc.js](../kolekto-be-old/controllers/settings/kyc.js) | EX | with K1 | |
| A1 | Ambassador program writes | [../kolekto-be-old/services/ambassadorProgram.js](../kolekto-be-old/services/ambassadorProgram.js), [controllers/ambassador.js](../kolekto-be-old/controllers/ambassador.js) | EX | — | parallel identity (strategic §6) |
| E1 | Email campaigns / queue | [../kolekto-be-old/jobs/emailCampaignQueue.js](../kolekto-be-old/jobs/emailCampaignQueue.js), [emailCampaignScheduler.js](../kolekto-be-old/jobs/emailCampaignScheduler.js), [controllers/admin/emailCampaigns.js](../kolekto-be-old/controllers/admin/emailCampaigns.js) | EX+CR | — | memory: `email_send_silent_fail` |

> **Client-side financial/privileged writes to eliminate (P0 for Phase 1):** C6, P3, P4, K1. `N1` (mark-own-notification-read) is acceptable to keep as a client write under RLS.

---

## 3. Duplicate-Logic Report (with canonical recommendation)

| Duplicate | Copies | **Recommended canonical** | Rationale |
|-----------|--------|---------------------------|-----------|
| **Create Collection** | C1 (edge), C2 (express), C3 (dead) | **New `CollectionService.create` in Express** carrying the **union** of rules (KYC gate *and* fundraising fee). Edge `create-collection` becomes a thin proxy or is retired. Delete C3. | Express owns auth/secrets/crons; edge currently has KYC rule, express has fee rule — neither is complete. Union in one service. |
| **Edit Collection** | C4 (express + edge) | **Express `CollectionService.update`**; retire edge `update-collection` | Same as above |
| **Update collection status** | C5 (express), C6 (admin client) | **Express `CollectionService.setStatus`**, admin calls it via admin API | Removes client write; single transition table |
| **Contribution create** | P1 (edge), P2 (express), P3 (client) | **Express `ContributionService.initiate`** (owns fee/tier/code + Paystack init). Delete P3; retire P2 or fold into service; edge `initiate-paystack-payment` proxies or retires | One place defines "a contribution exists" and its fees |
| **Payment verify** | P5 (edge core), P6 (express wrapper) | **Express `PaymentService.verify`** as the single entry; keep exactly **one** verify implementation (move edge logic into service, or keep edge as the impl and make Express the only caller — pick one, document it) | Today Express calls Edge which is defensible, but wallet/settle math is *also* re-done in Express → drift |
| **Settlement** | P9 (cron), P10 (edge), P11 (edge) | **One `PaymentService.settlePending` + one scheduler** (Express cron). Edge settle/recovery retired or reduced to triggering the service | Five settlement entry points is the top money-bug risk |
| **Wallet update** | P8 (express) + edge verify writes wallet + admin wallet-live recompute | **One `WalletService`** owns all balance mutation; admin reads via live-recompute endpoint only | memory: `admin_wallet_live` already recomputes because cached columns drift |
| **Profile update** | U1 (express + edge) | **Express `ProfileService.update`**; retire edge `profile-update` | |
| **KYC decision** | K1 (admin client), K2 (user express) | **Express `KycService`** with `submit` + `decide`; admin calls `decide` via admin API | Removes 4-table client write |
| **Dashboard/transaction stores** | `useDashboard`/`useDashboardStore`/`useDashboardHomeStore`; `useTransactions`/`useTransactionStore` (strategic §3) | **One store per concern** | Read-side dedupe |

**Dead code to delete outright:** C3 (`createCollection.jsx`), `CreateCollectionForm.tsx` (dead FE consumer of C2), `middleware/authMiddleware.js` (references undefined `supabase`; real path is `utils/verifyToken.js`), root diag scripts (`find-file.js`, `global-find.js`, `list-all.js`, `list-deep.js`, `diag-pdf.js`).

---

## 4. Runtime Map

```
                         ┌────────────────────────────────────────────────┐
                         │                 Supabase (DB + RLS)             │
                         └────────────────────────────────────────────────┘
       writes ▲   ▲            ▲                    ▲                ▲
  ┌───────────┘   │            │                    │                │
  │  RX (client)  │  EX (Express API)   ED (11 Edge fns)   CR (crons)   RX-admin
  │  ───────────  │  ────────────────   ───────────────    ─────────    ────────
  │  contributions│  collection CRUD    create/update/     T+1 settle   kyc_* ,
  │  .insert (P3) │  contribution (P2)  delete-collection  (P9), push,  collections
  │  .update (P4) │  deposit/verify(P6) initiate-pay (P1)  email x2     .status(C6)
  │  notif read   │  webhook (P7)       verify-pay (P5)                 campaigns
  │  (N1 ok)      │  wallet (P8)        settle/recovery                 profiles
  │               │  withdrawal (W1-3)  profile-update     ── overlaps ─┘
  │               │  push send (N2)     get-fundraising*
  └── overlaps ───┴──── overlaps ───────┴─── overlaps ─────┘
```

**Responsibility overlaps (the problem):**
- **Create/update collection:** EX **and** ED.
- **Contribution create:** RX **and** EX **and** ED.
- **Verify/settle:** ED **and** EX **and** CR (five entry points).
- **Wallet mutation:** EX (`updateWalletStats`) **and** ED (verify) — plus admin live-recompute reading around stale columns.
- **Profile update:** EX **and** ED.
- **Financial writes from RX:** contributions (customer app) and kyc/collections/campaigns (admin app).

**Target runtime ownership:**
- **EX = sole write authority** for collections, contributions, payments, wallet, withdrawals, profile, KYC decisions.
- **ED = edge-read + scheduled only** (public fundraising reads, optionally a proxy to EX). No independent financial writes.
- **CR = one scheduler** invoking `PaymentService` — no parallel edge settlement.
- **RX = read-only** for financial tables (own-notification-read excepted). Reads stay RLS-guarded.
- **DB triggers/Realtime:** unchanged; realtime remains read-projection only.

---

## 5. Business-Logic Map (where rules live → where they belong)

| Rule | Lives today | Belongs |
|------|-------------|---------|
| KYC-gate on collection count | Edge `create-collection` only | `CollectionService.create` (all callers) |
| Fundraising fee / `amountBreakdown` / platform fee | Express `collection.js` only | `PricingService`/`CollectionService` (all callers) |
| Contribution fee + tier resolution + unique code | Edge `initiate-paystack-payment` | `ContributionService` / `PricingService` |
| "Contribution exists" + status transitions | split RX/EX/ED | `ContributionService` |
| Payment verify + idempotency | Edge verify + Express wrapper | `PaymentService` (one impl) |
| Wallet balance math | `deposit.js updateWalletStats` + edge | `WalletService` (sole mutator) |
| Withdrawal strict-cap | `withdrawal.js` (already centralized) | keep; move into `WithdrawalService` |
| Collection status transitions | Express + admin client | `CollectionService.setStatus` |
| KYC decision transitions | admin client (kycStore) | `KycService.decide` |
| Validation (request shape) | scattered in controllers | thin controller + service guard |

**Principle:** business rules live **only** in services; controllers validate shape and call a service; repositories only run queries.

---

## 6. Business Domains

`Collections` · `Contributions` · `Payments` · `Wallets` · `Withdrawals` · `Users/Profiles` · `KYC` · `Notifications` · `Analytics/Dashboard` · `Email` · `Ambassador` · `Storage` · `Auth`. Each becomes a self-contained module (service + repository + types); cross-domain calls go service→service, never controller→repository-of-another-domain.

## 7. Service Layer Design (Express, `kolekto-be-old/services/`)

Each service owns rules, validation, coordinates repositories, and **emits domain events** (§11). None touch `req`/`res`.

```
CollectionService   create · update · setStatus · archive · delete   (KYC gate + fee rules unified)
ContributionService initiate · recordStatus · get                    (fee/tier/code/Paystack-init)
PaymentService      verify · handleWebhook · settlePending           (ONE verify impl; idempotent)
WalletService       applyCredit · applyDebit · recompute             (sole balance mutator)
WithdrawalService   request · approve · reject · eligibleCollections (strict-cap invariant)
ProfileService      update
KycService          submit · decide
NotificationService notify · markRead
PricingService      feeFor(collection, amount, bearer)               (single fee source of truth)
EmailService        (exists — keep, ensure .success checked)
StorageService      upload/scope
```

Signature example (rule-bearing, runtime-free):
```
CollectionService.create({ actorUserId, input }) ->
  guardKyc(actorUserId)            // C1's rule
  const pricing = PricingService.feeFor(input)   // C2's rule
  const row = CollectionRepository.insert(...)
  events.emit('CollectionCreated', { id: row.id, actorUserId })
  return row
```

## 8. Repository Layer Design (`kolekto-be-old/repositories/`)

Pure data access — **no rules**. One repository per aggregate; the **only** place `supabase.from()` / Sequelize runs on the write side.

```
CollectionRepository   insert · update · setStatus · findById · findByOwner
ContributionRepository insert · updateStatus · findByCollection
PaymentRepository      recordVerification · findByReference (idempotency key lookups)
WalletRepository       getBalances · applyDelta · recompute
WithdrawalRepository   insert · setDecision · pendingForCollection
ProfileRepository / KycRepository / NotificationRepository / ...
WorkspaceRepository    (placeholder only — no table yet; Phase 2)
```

Wrap multi-row money moves (verify → wallet → contribution status) in a **single transaction / RPC** so partial settlement can't occur.

## 9. Controller Refactoring Plan (thin controllers)

Target shape for every controller:
```js
export const createCollection = async (req, res, next) => {
  try {
    const input = validateCreateCollection(req.body);      // shape only
    const row = await CollectionService.create({ actorUserId: req.user.id, input });
    res.status(201).json({ data: row });
  } catch (e) { next(e); }
};
```
Move all branching/fee/KYC/status logic out of `collection.js` (549 LOC) and `deposit.js` (1748 LOC) into services. `deposit.js` is the biggest offender — it mixes init, verify, webhook, wallet, receipt, and edge-invocation in one file and must be split across `ContributionService` / `PaymentService` / `WalletService`.

## 10. Direct-DB-Write Elimination Plan

| Write | Action |
|-------|--------|
| P3 `contributions.insert` (client) | Delete; contribution creation only via `ContributionService` (server). FE calls the API. |
| P4 `contributions.update` status (client) | Delete; status set only by `PaymentService.verify`/webhook. |
| C6 `collections.status`/`campaigns` (admin client) | Replace with admin API `PATCH /adminurlabdkole/collections/:id/status` → `CollectionService.setStatus`. |
| K1 `kyc_*` + `profiles` (admin client) | Replace with admin API `POST /adminurlabdkole/kyc/:id/decision` → `KycService.decide`. |
| N1 `notifications.read_at` (client) | **Keep** (own-row, RLS-safe) — or route through `NotificationService.markRead` for consistency (low priority). |
| Edge financial writes (C1,C4,C7,P1,P5,P10,P11,U1) | Reduce to proxy/scheduled triggers of Express services, or retire, per §3. |

**Rule to codify in `CLAUDE.md`:** *No `insert/update/delete/upsert/rpc` against financial tables from React or Edge. Financial writes go through an Express service → repository. Client `supabase.from()` is read-only + RLS-guarded (own-notification-read excepted).*

## 11. Domain Events + Activity-Log Foundation

Introduce a lightweight, in-process event emitter now (no external broker) so services can announce facts without coupling. Events are **named after facts, past tense**:

```
CollectionCreated · CollectionUpdated · CollectionArchived · CollectionStatusChanged
ContributionInitiated · PaymentVerified · PaymentSettled
WalletCredited · WalletDebited
WithdrawalRequested · WithdrawalApproved · WithdrawalRejected
ProfileUpdated · KycSubmitted · KycDecided · CollectionTransferred
```
- Emit from **services only**, after the repository write commits.
- **Activity-log foundation:** a single `ActivityRecorder` subscriber appends each event to an append-only `activity_log` table (design only in Phase 1 — do not build Workspace activity). This becomes the seam for notifications, analytics, audit, and (Phase 2) the ledger, **without** those systems coupling to each other.
- Keep emit non-blocking and best-effort; a failed subscriber must never fail the financial write.

## 12. Technical Debt Report (engineering, concrete)

1. **`deposit.js` 1748 LOC / `collection.js` 549 LOC / `withdrawal.js` 1007 LOC** — god-files mixing controller + rules + data.
2. **Dead code:** C3, `CreateCollectionForm.tsx`, `authMiddleware.js`.
3. **Diag scripts in deployable root** (`find-file.js`, `global-find.js`, `list-all.js`, `list-deep.js`, `diag-pdf.js`) → `/scripts` or delete.
4. **Incident `.md` post-mortems in both repo roots** → `/docs`.
5. **Sequelize models (`models/collections.js`) coexisting with Supabase SDK** — two write layers, schema drift.
6. **Overlapping Zustand stores** (`useDashboard*` ×3, `useTransaction*` ×2).
7. **Empty `payment.js` controller** (0 LOC) — routes point at `deposit.js`; misleading.
8. **`empty payment.js` vs `deposit.js`** naming — domain names don't match files.
9. **`.jsx` extension on a backend controller** (`createCollection.jsx`) — inconsistent.
10. **Hand-maintained `types.ts`** covers 6/25+ tables (strategic §4) — no compile-time guard while refactoring.

## 13. Risk Assessment (Phase 1 execution)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Consolidating create-collection drops a rule (KYC or fee) | Med | High | Write characterization tests capturing **both** current behaviors *before* merging; union rules; diff outputs |
| Removing client `contributions.insert` breaks a live contribute path | Med | **Critical** (revenue) | Confirm which FE flow is live (ContributeFlow uses edge P1; direct P3 may already be dead) before deleting; feature-flag; keep API path 1:1 |
| Collapsing 5 settlement entry points misses an orphan case | Med | **Critical** | Keep recovery logic (memory: `orphaned_payment_recovery`) as a service method; reconcile job; shadow-run before disabling edge crons |
| Moving admin KYC/status writes to API changes timing/side-effects | Low | Med | Port exact multi-table sequence into `KycService.decide` transaction; parity test |
| Refactor drifts prod during long migration | High | High | One domain at a time (§14); each domain: characterize → extract service → repoint callers → verify → next |
| Env cross-wiring during testing | Med | High | Keep startup `KNOWN_PROJECT_ENVIRONMENTS` guard green |

## 14. Migration Strategy & Incremental Implementation Plan

**Guiding rule (from the brief):** never break production; one domain at a time; *Audit → Understand → Document → Design → Refactor → Test → Verify → next.* Order chosen to remove the riskiest client writes early and the highest-divergence duplicate first, without touching product behavior.

| Wave | Domain | Concrete steps | Depends on | Cx |
|------|--------|----------------|-----------|----|
| **0** | Guardrails | Add `CLAUDE.md` write-ownership rule; delete confirmed dead code (§3); move diag scripts + incident docs to `/docs`,`/scripts`; regenerate Supabase types + CI check | — | S |
| **1** | Collections | Extract `CollectionService`+`CollectionRepository`; unify C1/C2 rules (KYC+fee); repoint wizard(edge) & any live express caller to one path; retire edge create/update to proxy; delete C3 | Wave 0 | M |
| **2** | Contributions | Extract `ContributionService`+`PricingService`; make creation server-only; **remove P3/P4 client writes**; keep public contribute API 1:1 | Wave 1 | M |
| **3** | Payments + Wallet | Split `deposit.js` into `PaymentService`+`WalletService`; **one** verify impl; collapse P9/P10/P11 into one scheduler+service; shadow-run recovery | Wave 2 | L |
| **4** | Withdrawals | Wrap existing strict-cap logic in `WithdrawalService`+repo (already single-path — low risk) | Wave 3 | S–M |
| **5** | Admin writes | Add admin API endpoints; move C6 + K1 off the client into `CollectionService`/`KycService` | Waves 1,3 | M |
| **6** | Users/Profile/KYC/Notif | Extract remaining services; retire edge `profile-update`; consolidate stores | — | M |
| **7** | Events + Activity foundation | Introduce emitter; emit from services; `ActivityRecorder` + `activity_log` (design→build) | Waves 1–4 | M |

Each wave ships behind a flag where behavior could shift, keeps `user_id` semantics untouched (no `workspace_id` yet), and ends with the verification checklist below.

## 15. Testing Plan

**Current state:** `vitest.config.ts` exists in FE; backend has ad-hoc `test-*.js` scripts, no integration suite. This is the biggest safety gap for a refactor of financial code.

**Before touching a domain, write characterization tests** that lock in *today's* behavior (including quirks), then refactor to keep them green.

| Priority | Test | Asserts |
|----------|------|---------|
| P0 | Create collection — KYC-unverified 2nd collection | rejected (C1 rule preserved) |
| P0 | Create collection — fundraising fee breakdown | fee math preserved (C2 rule) |
| P0 | Contribution initiate → verify → wallet credit | contribution paid, wallet == sum, idempotent on double-verify |
| P0 | Webhook + callback both fire | settles once (memory: `payment_push_trigger`) |
| P0 | Withdrawal strict-cap | `withdrawable == available − pending`; over-cap rejected |
| P1 | Orphaned-payment recovery | recovers post-success (memory: `orphaned_payment_recovery`) |
| P1 | Admin KYC decision | multi-table sequence parity after moving off client |
| P1 | Collection status transitions | admin path == service path |

Add an integration harness against a Supabase **test** project (never prod; cross-wiring guard green). Wire `vitest` + a backend test runner into CI alongside type regeneration.

## 16. Refactoring Progress Log (living)

| Date | Wave | Change | Behavior verified | By |
|------|------|--------|-------------------|----|
| 2026-07-16 | — | Phase 1 engineering audit produced (this doc). No code changed. | n/a | audit |
| 2026-07-16 | 0 | Engineering Foundation: deleted dead code (`createCollection.jsx`, `CreateCollectionForm.tsx`, `authMiddleware.js`); relocated diag scripts→`/scripts` and incident docs→`/docs` (both repos); added `KOLEKTO_ENGINEERING_STANDARDS.md`, `KOLEKTO_DOMAIN_DEPENDENCY_GRAPH.md`, and per-repo `CLAUDE.md` write-authority rules. | Non-behavioral: `app.js` parses; no dangling refs (grep); renames preserved history | eng |
| 2026-07-16 | 1.1 | Built authoritative `services/collectionService.js` (faithful superset of LIVE Edge `create-collection`; DI repo) + `repositories/collectionRepository.js`; rewrote `controllers/collection.js` `createCollection` to a thin delegator returning `{ data: collection }` (Edge parity). **Not yet called by the wizard — no prod flip.** | 13 characterization tests pass (`npm test`); all files parse | eng |
| 2026-07-16 | 1.2 | Added Node built-in test runner (`npm test` → `node --test`) + `tests/collectionService.test.js` (KYC gate, legacyType/trigger mapping, status/currency, wallet fee_breakdown parity, fundraising campaign/docs/images, error mapping). | 13/13 pass | eng |
| 2026-07-16 | 1.2 | Production-validation prep. Threaded correlation id (`req.id`) controller→service; structured, correlated, timed logging (`collection.create.*`) on the existing `utils/logger.js`; errors tagged `err.requestId`; response echoes `requestId`. Added 7 correctness/correlation tests (**20/20 pass**). Produced `KOLEKTO_COLLECTION_MIGRATION_READINESS.md` (parity checklist, shadow-migration plan, rollback, observability, logging std, frontend caller audit, domain review, test review, readiness 7.5/10, **GO for shadow/canary, NO-GO for blind cutover**). Committed Wave 0 + Wave 1 separately. **Edge function retained as fallback; no prod flip.** | 20/20 tests pass; files parse; single live FE caller confirmed | eng |
| 2026-07-16 | 1.3-prep | Built the validation harness (no prod behavior change; default path stays Edge). FE: runtime feature flag `@/lib/featureFlags` (`localStorage kolekto-ff-create-path` override + `VITE_CREATE_COLLECTION_PATH` default, default `edge`) + dual create path in `useCollectionStore` (Edge default, Express canary). BE: P0 integration suite `tests/integration/` vs a Supabase TEST project (dedicated `SUPABASE_TEST_*` vars, prod-ref guard, skips w/o creds) + `npm run test:integration`. Runbook `KOLEKTO_COLLECTION_CANARY_RUNBOOK.md` (Gates A–D, monitoring, rollback). | Unit 20/20; integration 5/5 skip cleanly (no creds); changed FE files type-check clean | eng |
| | 1.3 | _awaiting execution by operator_ — run Gate A integration vs staging, Gate B parity, Gate C canary soak; then ramp to prod. Edge retained as fallback. **Cannot be run from the dev sandbox (no staging creds/deploy).** | | |

---

## Appendix A — Verification checklist per wave
- [ ] Characterization tests written & green **before** refactor
- [ ] Single service owns the operation; controller is thin; repository is the only DB writer
- [ ] No new `insert/update/delete/upsert/rpc` on financial tables from RX or ED
- [ ] Behavior diff = zero (feature flag off == today)
- [ ] `user_id` semantics unchanged (no `workspace_id` introduced)
- [ ] Env guard green; types regenerated; progress log updated

## Appendix B — Files confirmed dead / to relocate
- **Delete:** `kolekto-be-old/controllers/collection/createCollection.jsx`; `kolekto-fe-old/src/components/collections/CreateCollectionForm.tsx`; `kolekto-be-old/middleware/authMiddleware.js`.
- **Relocate to `/scripts` or delete:** `kolekto-be-old/{find-file,global-find,list-all,list-deep,diag-pdf}.js`.
- **Relocate to `/docs`:** all root-level `*_INVESTIGATION.md`, `*_FIX*.md`, `PWA_*.md`, `PAYOUT_*.md` in both repo roots.

*End of Phase 1 engineering audit. Analysis and design only — no code, migrations, or behavior changes were made.*
