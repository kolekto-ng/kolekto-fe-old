# Kolekto Engineering Standards & Ownership Boundaries

**Status:** Adopted at Phase 1, Wave 0 (Engineering Foundation).
**Applies to:** `kolekto-fe-old`, `kolekto-be-old`, `kolekto-admin-control-panel-1`, Supabase Edge Functions.
**Companion docs:** `KOLEKTO_PHASE1_ENGINEERING_AUDIT.md` (what/where), `KOLEKTO_4.0_ARCHITECTURE_AUDIT.md` (why/vision).

These standards are the contract every refactor in Phase 1 (and every new change) must satisfy. Per-repo `CLAUDE.md` files carry the enforced summary; this file is the full reference.

---

## 1. The one rule that matters most: single write authority

> **Every critical financial write has exactly one authoritative implementation, and that implementation lives in the Express API (`kolekto-be-old`).**

- **Express (`kolekto-be-old`) = sole write authority** for: collections, contributions, payments, wallet/balances, withdrawals, profile, KYC decisions, notifications (server-sent).
- **Supabase Edge Functions = edge-read + scheduled only.** They may serve public reads (e.g. fundraising catalog) and run scheduled jobs, but must not be an *independent* source of financial writes. Where an Edge write exists today, it is migrated to call/mirror the Express service or is retired (see audit §3).
- **React clients (customer + admin) = read-only for financial tables.** The client never calls `insert/update/delete/upsert/rpc` on a financial table. The single documented exception is a user marking *their own* notification read (own-row, RLS-safe).
- **Crons = one scheduler** invoking a service method — never a parallel re-implementation of settlement.

**Financial tables** (writes forbidden outside Express services): `collections`, `contributions`, `transactions`, `withdrawals`, wallet/balance columns, `payment_config`, `kyc_*`, `campaigns`.

---

## 2. Layered architecture (backend)

```
HTTP Route  →  Controller  →  Service  →  Repository  →  Database
             (thin)        (rules)     (queries only)
```

| Layer | May do | Must NOT do |
|-------|--------|-------------|
| **Route** | map path+verb to a controller, attach middleware (`verifyToken`, `requireAdmin`, `requireCapability` future) | contain logic |
| **Controller** | validate request *shape*, call one service method, shape the HTTP response, `next(err)` | business rules, DB calls, fee/KYC/status logic |
| **Service** | own business rules, validation of *meaning*, coordinate repositories, wrap money moves in a transaction, emit domain events | touch `req`/`res`, run raw SQL/`supabase.from()` |
| **Repository** | CRUD, queries, transactions for one aggregate | business rules, cross-aggregate logic |

- A controller calls **exactly one** service method for its primary action.
- A service may call **other services** (service→service) but never another domain's repository directly.
- Repositories are the **only** place `supabase.from()` / Sequelize runs on the write side.
- Wrap multi-row money moves (verify → wallet credit → contribution status) in a single transaction/RPC so partial settlement cannot occur.

---

## 3. Domain ownership boundaries

Each domain owns its tables. Cross-domain access goes through the owning **service**, never by reaching into another domain's tables/repository.

| Domain | Owns (tables) | Service | Primary writes |
|--------|---------------|---------|----------------|
| Collections | `collections`, access grants, transfers | `CollectionService` | create, update, setStatus, archive, delete |
| Contributions | `contributions` | `ContributionService` | initiate, recordStatus |
| Payments | `transactions`, verification/idempotency | `PaymentService` | verify, handleWebhook, settlePending |
| Wallets | balance columns / (future ledger) | `WalletService` | applyCredit, applyDebit, recompute — **sole balance mutator** |
| Withdrawals | `withdrawals` | `WithdrawalService` | request, approve, reject |
| Users/Profiles | `profiles` | `ProfileService` | update |
| KYC | `kyc_*` | `KycService` | submit, decide |
| Notifications | `notifications`, `push_*` | `NotificationService` | notify, markRead |
| Pricing (cross-cut) | — | `PricingService` | `feeFor()` — single fee source of truth |

**Rule:** if code in domain A needs to change a row in domain B, it calls `BService.method()`. No exceptions for "just a quick update."

---

## 4. Frontend data-access standard

- **Writes** to financial data → call the Express API (via the axios client / typed API module). Never `supabase.from().insert/update/...` for financial tables.
- **Reads** → prefer the API or an RLS-guarded `supabase.from().select()`. Keep reads consistent per feature (do not mix three idioms in one feature).
- One data-access idiom per feature (standardize on TanStack Query for server state; Zustand for cross-cutting client state only).
- Errors surface through the existing `toFriendlyErrorMessage` / `extractFunctionError` helpers and the single Sonner toast system.

---

## 5. Domain events

- Services emit **past-tense fact events** *after* the repository write commits (`CollectionCreated`, `PaymentVerified`, …).
- Emission is non-blocking and best-effort: a failing subscriber must never fail the financial write.
- Subscribers (activity log, notifications, analytics, future ledger) are decoupled — they never call back into the emitting service synchronously.

---

## 6. Coding principles

- Single Responsibility; small, named, testable functions.
- Explicit business rules — no hidden side effects; no rule that exists in only one of two duplicate paths.
- Strong typing; consistent naming; files named for their domain (no `deposit.js` owning payments; no `.jsx` backend controllers).
- Backwards compatibility is mandatory in Phase 1: no breaking API changes, `user_id` semantics unchanged, no `workspace_id` yet.
- Dead code is deleted, not commented out. Diagnostics live in `/scripts`; historical incident write-ups live in `/docs`.

---

## 7. Change checklist (every PR in Phase 1)

- [ ] The operation has exactly one authoritative implementation (a service method).
- [ ] Controller is thin; repository is the only DB writer; no rules leaked into controller/repository.
- [ ] No new `insert/update/delete/upsert/rpc` on financial tables from React or Edge.
- [ ] Characterization tests captured **today's** behavior before the refactor and still pass.
- [ ] Behavior diff = zero (feature flag off ⇒ identical to production).
- [ ] `user_id` semantics unchanged; no `workspace_id` introduced.
- [ ] Env cross-wiring guard green; Supabase types regenerated if schema touched; progress log updated (audit §16).
