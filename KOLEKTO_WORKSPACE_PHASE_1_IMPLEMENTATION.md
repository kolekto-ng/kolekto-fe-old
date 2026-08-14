# KOLEKTO WORKSPACE — PHASE 1 IMPLEMENTATION CONTRACT

> **SUPERSEDED (2026-08-13):** current state is tracked in `KOLEKTO_WORKSPACE_2.0_ARCHITECTURE_AUDIT.md`. This document is retained for its implementation rationale and is historically accurate as of 2026-08-12, but should not be read as current status.

**Status:** ✅ **IMPLEMENTED & VERIFIED ON TEST** (2026-08-12) · ⛔ **NOT DEPLOYED TO PROD**
**Target Supabase project:** `lpeeckqsltxohppheucz` (Kolekto **test**)
**Prod project (`busfgcmbndleljklrcbd`) is READ-ONLY for the whole of Phase 1.**
**Scope:** establish the Workspace foundation additively. No financial logic is created, moved, or altered.

> This document is the implementation contract. Code that contradicts this document is a bug in one of the two.

---

## 1. Current architecture (verified, not assumed)

Ownership today is a single column:

```
auth.users ──1:1── profiles
     │
     └── collections.user_id (uuid, NOT NULL)
              ├── wallets (per-collection balances)
              ├── contributions
              ├── transactions
              └── withdrawals
```

**Verified facts (read-only inspection, 2026-08-12):**

| Fact | Evidence |
|---|---|
| No Workspace anything exists | `existing_workspace_tables = 0` on test; zero code matches in `kolekto-be-old` on all branches |
| User provisioning is a **DB trigger** | `on_auth_user_created` AFTER INSERT ON `auth.users` → `handle_new_user()` (SECURITY DEFINER) inserts the `profiles` row |
| Collection creation is **already consolidated** | `getCreateCollectionPath()` hard-defaults to `"express"`; no `VITE_CREATE_COLLECTION_PATH` override exists in any env file or config |
| Express path is authoritative | `controllers/collection.js::createCollection` → `services/collectionService.js::create()` → `repositories/collectionRepository.js` |
| Edge Function is a **backstop, not a duplicate** | `supabase/functions/create-collection/index.ts` — retained deliberately after an incident where it had drifted 3.5 weeks behind source; now hardened, non-default |
| Schema conventions | `uuid` PK `gen_random_uuid()`; `timestamptz` `created_at`/`updated_at` default `now()`; status/type as `text`/`varchar` + default; RLS helper `is_current_user_admin()` |
| Layering is enforced | Route → Controller (thin) → Service (rules) → Repository (only place `supabase.from()` runs) |

**Ownership-integrity dry run (§11/§13 pre-check):**

| Metric | Test | Prod |
|---|---|---|
| auth.users | 69 | 607 |
| profiles | 69 | 606 |
| auth users without profile | 0 | **1** |
| profiles without auth user | 0 | 0 |
| collections (total / deleted) | 72 / 0 | 262 / 8 |
| distinct collection owners | 20 | 108 |
| **collections whose owner is missing from auth.users** | **0** | **0** |
| **collections whose owner is missing from profiles** | **0** | **0** |

**No §24 stop condition is triggered.** Every collection has a resolvable, valid owner. Backfill is unambiguous.
The single prod `auth.users` row without a profile is a pre-existing anomaly unrelated to Workspace; the backfill is keyed on `profiles`, so it is skipped rather than guessed at. It is logged, not repaired, by this phase.

---

## 2. Target architecture (end of Phase 1)

```
auth.users ──1:1── profiles
     │
     ├── workspace_members (role: OWNER | ADMIN | MEMBER)
     │         │
     │         └── workspaces (type: personal | association | organization | community | event | group)
     │                   │
     │                   └── collections.workspace_id  (NULLABLE in Phase 1)
     │                             └── wallets / contributions / transactions / withdrawals
     │                                 ▲
     └── collections.user_id ──────────┘  RETAINED, unchanged, still authoritative for money
```

**The defining constraint of Phase 1:** `collections.user_id` remains the operative ownership column for every existing read, write, RLS policy, and financial calculation. `workspace_id` is added, backfilled, and written on create — but **nothing reads it for authorization or money yet**. It is inert metadata until Phase 2 flips reads over. This is what makes the phase reversible.

---

## 3. Database changes

Six small, independently reversible migrations. Repo convention followed: `w<N>_<name>_<date>.sql` plus matching `_ROLLBACK.sql` and `_VERIFY.sql`, living in `kolekto-be-old/database/`.

### W1 — `workspaces`

```sql
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  type        text not null default 'personal'
              check (type in ('personal','association','organization','community','event','group')),
  status      text not null default 'active'
              check (status in ('active','suspended','archived')),
  owner_id    uuid not null references auth.users(id) on delete restrict,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- THE idempotency guarantee for §10: at most one personal workspace per human,
-- enforced by the database, so no code path can ever create a duplicate.
create unique index workspaces_one_personal_per_owner
  on public.workspaces (owner_id) where type = 'personal';

create index workspaces_owner_id_idx on public.workspaces (owner_id);
```

`on delete restrict` on `owner_id` is deliberate: a workspace may own collections that own money. Deleting a user must not silently cascade into financial rows. Deletion becomes an explicit, later, human decision.

### W2 — `workspace_members`

```sql
create table public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'MEMBER' check (role in ('OWNER','ADMIN','MEMBER')),
  status       text not null default 'active' check (status in ('active','invited','suspended')),
  invited_by   uuid references auth.users(id) on delete set null,
  joined_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
```

`role` is `text` + CHECK, not a Postgres enum — matching `profiles.role`. Enums require `ALTER TYPE` migrations to extend; text+CHECK lets Phase 3 introduce capabilities and custom roles without a destructive type migration. **The membership model is capability-ready because nothing outside one resolver function ever reads `role` directly** (§6).

### W3 — `collections.workspace_id` (nullable)

```sql
alter table public.collections
  add column workspace_id uuid null references public.workspaces(id) on delete restrict;

create index collections_workspace_id_idx on public.collections (workspace_id);
```

Nullable and unconstrained by design (Rule 4). No NOT NULL in Phase 1, in this phase or the next migration.

### W4 — personal-workspace provisioning trigger

```sql
create or replace function public.ensure_personal_workspace()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  ws_id uuid;
  ws_name text;
  ws_slug text;
begin
  ws_name := coalesce(nullif(trim(new.first_name), ''),
                      nullif(trim(new.full_name), ''),
                      split_part(coalesce(new.email,'user'), '@', 1)) || '''s Workspace';
  ws_slug := lower(regexp_replace(coalesce(nullif(trim(new.first_name),''),'user'), '[^a-zA-Z0-9]+', '-', 'g'))
             || '-' || substr(replace(new.id::text,'-',''), 1, 8);

  insert into public.workspaces (name, slug, type, owner_id, created_by)
  values (ws_name, ws_slug, 'personal', new.id, new.id)
  on conflict do nothing              -- partial unique index makes this idempotent
  returning id into ws_id;

  if ws_id is null then
    select id into ws_id from public.workspaces
     where owner_id = new.id and type = 'personal';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (ws_id, new.id, 'OWNER', 'active', now())
  on conflict (workspace_id, user_id) do nothing;

  return new;
exception when others then
  -- Provisioning a workspace must NEVER be able to fail a signup. The backfill
  -- (W5) and the backend self-heal (§5) both reconcile anything missed here.
  raise warning 'ensure_personal_workspace failed for %: %', new.id, sqlerrm;
  return new;
end $$;

create trigger trg_profiles_ensure_personal_workspace
  after insert on public.profiles
  for each row execute function public.ensure_personal_workspace();
```

**Why a DB trigger on `profiles` and not backend code (§10 decision):** Supabase signup goes to GoTrue directly from the client — it never passes through Express. A backend hook would therefore miss every organic signup. `profiles` insertion is the one chokepoint every user provably passes through (it is itself a trigger off `auth.users`). This is the single authoritative mechanism.

**Why it is also exception-safe:** a raised exception inside an AFTER INSERT trigger would abort the transaction and break signup entirely. Swallowing to a warning means the worst case is a user without a workspace — self-healed by §5 — rather than a user who cannot register.

### W5 — personal workspace backfill (existing users)

Idempotent; re-runnable; touches only `workspaces` and `workspace_members`. **Executed only after its dry-run report is reviewed.**

### W6 — collection ownership backfill

```
collections.user_id → that user's personal workspace → collections.workspace_id
```
`UPDATE ... WHERE workspace_id IS NULL` only. Touches exactly one column on `collections`. **No financial column is in the UPDATE statement's SET clause.**

---

## 4. API changes

| Endpoint | Change | Behavior |
|---|---|---|
| `POST /create-collection` | Resolves and stamps `workspace_id` | Additive. Response shape unchanged. |
| `GET /workspaces` | **New** | Workspaces the caller is a member of |
| `GET /workspaces/:id` | **New** | Membership-gated |

Everything else is untouched in Phase 1. No existing response shape changes, so the frontend cannot break (CLAUDE.md: "No breaking API changes").

**Workspace resolution on create (§14) — never trust the client:**

```
req.user.id (from verified JWT)
   → X-Workspace-Id header, if present
        → assert active membership + capability  → use it
        → no membership                          → 403, no fallback
   → header absent
        → resolve caller's personal workspace    → use it
```

A client-supplied workspace id is treated as a *request*, never as an authorization. Absence of the header degrades to the personal workspace, which is exactly today's behavior — this is what keeps existing clients working unchanged.

---

## 5. Personal Workspace strategy

Three mechanisms, one invariant, zero possibility of duplicates:

| Mechanism | Role | Idempotency source |
|---|---|---|
| `trg_profiles_ensure_personal_workspace` | **Authoritative** — new users | partial unique index |
| W5 backfill | One-time — existing users | partial unique index |
| `ensurePersonalWorkspace(userId)` service | Self-heal — repairs trigger failures on read | partial unique index |

This does not violate "choose ONE authoritative mechanism": there is one *authoritative* path (the trigger); the other two are reconciliation. All three funnel through `workspaces_one_personal_per_owner`, so the database — not the code — is what actually guarantees uniqueness. Correctness does not depend on any caller behaving.

---

## 6. Authorization design

New: `kolekto-be-old/services/workspaceAuthorizationService.js`

```js
isWorkspaceMember(userId, workspaceId)        // → membership row | null
hasCapability(userId, workspaceId, capability) // → boolean
requireCapability(capability)                  // → Express middleware
```

Capabilities exist as **strings from day one**, resolved from role by a single map. No capability tables, no UI, no framework — but every call site already asks the capability question, so Phase 3 replaces the map's internals and touches nothing else.

| Capability | OWNER | ADMIN | MEMBER |
|---|:--:|:--:|:--:|
| `workspace:read` | ✅ | ✅ | ✅ |
| `workspace:update` | ✅ | ✅ | ❌ |
| `workspace:members.manage` | ✅ | ✅ | ❌ |
| `collection:create` | ✅ | ✅ | ❌ |
| `collection:read` | ✅ | ✅ | ✅ |
| `collection:update` | ✅ | ✅ | ❌ |
| `collection:delete` | ✅ | ❌ | ❌ |
| `transaction:read` | ✅ | ✅ | ❌ |
| **`withdrawal:create`** | ✅ | ❌ | ❌ |
| **`withdrawal:approve`** | ❌ | ❌ | ❌ |

**Financial capabilities are deliberately restrictive (§16).** `withdrawal:create` is OWNER-only — an ADMIN cannot move money. `withdrawal:approve` is granted to **no workspace role at all**; approval remains a platform-admin function outside the workspace role system entirely. Membership never implies withdrawal authority.

**Not wired to withdrawals in Phase 1.** The withdrawal path continues to authorize on `user_id` exactly as today. These entries define the contract Phase 2 will enforce; declaring them now prevents a future implementer from casually granting `MEMBER` a money capability.

---

## 7. Collection ownership strategy

`user_id` and `workspace_id` coexist for all of Phase 1, with `user_id` authoritative:

- **Reads** — unchanged, all still `user_id`.
- **RLS** — unchanged, still `auth.uid() = user_id`. No RLS policy is rewritten in Phase 1.
- **Writes** — dual-write: `user_id` (as today) **and** `workspace_id` (new).
- **Money** — untouched. Wallets remain keyed to `collection_id`.

For personal workspaces the two columns are provably equivalent (`workspace.owner_id = collection.user_id`), so no authorization decision changes meaning. Divergence only becomes possible when a workspace has a second member — which Phase 1 does not ship.

---

## 8. Frontend strategy

Minimum viable context only (§17, §19):

- `src/store/useWorkspaceStore.ts` — `currentWorkspace`, list, `switchWorkspace()`, persisted to `localStorage`.
- `axiosInstance` interceptor — attach `X-Workspace-Id` when a workspace is selected.
- A workspace-name display + a switcher component.

Not in this phase: workspace creation UI, invitations, member management, branding, catalog, onboarding redesign. The switcher lists what exists (for nearly all users: one personal workspace) and is the seam Phase 2 builds on.

---

## 9. Testing strategy (§20)

| Area | Test |
|---|---|
| Workspace | create; personal workspace created on signup; **duplicate personal workspace rejected by the unique index** |
| Membership | OWNER membership created with workspace; lookup by user |
| Authorization | member can read own workspace; **non-member gets 403**; **client-supplied foreign `X-Workspace-Id` is rejected, not honored**; `MEMBER` denied `collection:create`; **no role grants `withdrawal:approve`** |
| Collections | existing collections still create/read/update; new collections receive `workspace_id`; backfilled collections resolve to the right workspace |
| Financial | **characterization: contribution/transaction/withdrawal totals byte-identical before and after** the whole phase |

The financial characterization test is the one that matters most: it is the evidence for the §25 success criterion "no financial records or calculations altered."

---

## 10. Migration & rollout strategy

Test project first, in strict order, each verified before the next:

```
W1 workspaces          → W1_VERIFY
W2 workspace_members   → W2_VERIFY
W3 collections.workspace_id (nullable) → W3_VERIFY
W4 provisioning trigger → signup smoke test
W5 personal backfill   → DRY RUN → review → execute → verify
W6 collection backfill → DRY RUN → review → execute → verify
```

Backend and frontend deploy **after** W1–W3, and are no-ops until W5/W6 have run.

**Prod rollout is a separate, explicitly-authorized decision** taken after test soaks. Nothing in this document authorizes a prod migration.

## 11. Rollback strategy

| Migration | Rollback | Data loss |
|---|---|---|
| W6 | `UPDATE collections SET workspace_id = NULL` | none (`user_id` untouched) |
| W5 | `DELETE` from members/workspaces | none outside new tables |
| W4 | `DROP TRIGGER` | none |
| W3 | `DROP COLUMN workspace_id` | only the new column |
| W2/W1 | `DROP TABLE` | only the new tables |

Every rollback is total and touches **no pre-existing column except `collections.workspace_id`**, which did not exist before this phase. Because nothing reads `workspace_id` for authorization or money in Phase 1, rollback at any point restores exact current behavior.

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Trigger failure breaks signup | **Critical** | Exception-swallowing trigger + self-heal + backfill (§5) |
| Duplicate personal workspaces | High | DB-level partial unique index, not application logic |
| Client forges `X-Workspace-Id` | High | Membership asserted server-side on every use; no fallback on failure (§4) |
| Backfill corrupts financial data | **Critical** | Backfills write only `workspace_id` / new tables; financial columns never appear in any `SET` clause; dry-run reviewed first |
| Workspace becomes a financial layer | High | Rule 2 — no balance/fee/settlement logic in any workspace service. Reviewable as a one-line grep. |
| Test/prod cross-wiring | High | `KNOWN_PROJECT_ENVIRONMENTS` guard stays green; test project only |

## 13. Explicitly out of scope (Rule 2, §19)

Ledger · wallet redesign · withdrawal recalculation · Paystack/verification changes · settlement changes · fee changes · invitations UI · capability tables · workspace billing/analytics/public pages/verification · Aso Ebi, association, event, fundraising vertical workflows · contributor CRM · `NOT NULL` on `workspace_id`.

---

## Pre-existing findings (documented, NOT fixed in this phase)

1. **`collections_public_read` RLS policy** grants `anon` + `authenticated` SELECT on **every** non-deleted collection row. This is load-bearing for public contribute pages, but it means collection rows are globally readable today. Workspace does not worsen it — and must not be assumed to fix it. Real workspace data isolation requires revisiting this policy in Phase 2.
2. **1 prod `auth.users` row has no `profiles` row** — pre-existing; skipped by backfill, not guessed at.
3. **Duplicate/overlapping RLS policies on `profiles`** (`profiles_own_read` vs `users can view their own profile` vs `Users can view their own profile`) — historical accumulation; harmless but should be consolidated.

*Findings 1 and 3 are Phase 2 items and are recorded here so they are not silently inherited as "already safe."*
