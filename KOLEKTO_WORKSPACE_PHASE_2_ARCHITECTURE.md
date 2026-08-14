# KOLEKTO WORKSPACE — PHASE 2 ARCHITECTURE

> **SUPERSEDED (2026-08-13):** current state and the endorsed forward plan are tracked in `KOLEKTO_WORKSPACE_2.0_ARCHITECTURE_AUDIT.md` (see its §12–19), which carries forward this document's core design — including the equivalence-verification requirement in §1 below — largely unchanged. This document is retained for its detailed rationale.

**Status:** DESIGN ONLY — no Phase 2 code exists. Companion to `KOLEKTO_WORKSPACE_PHASE_1_5_AUDIT.md`.
**Objective:** make Workspace the real ownership and authorization boundary, without a flag-day and without touching money.

---

## 1. The governing insight

While every workspace has exactly one member, these two predicates are **provably identical**:

```
collection.user_id = auth.uid()
collection.workspace_id ∈ (workspaces where auth.uid() is an active member)
```

Because W5/W6 guarantee `workspace.owner_id = collection.user_id` for every row, and each personal workspace has exactly one OWNER.

That equivalence is the entire safety mechanism of Phase 2. It means every read, policy, and authorization check can be rewritten to the workspace form and **verified to return byte-identical results** before anything depends on it.

**It stops being true the instant a workspace gains a second member.** Therefore:

> **Multi-member workspaces are the LAST thing Phase 2 ships, not the first.**

Inverting that order — adding members before the ownership switch is complete and verified — is the single most dangerous move available, because it removes the oracle that proves the switch was correct.

---

## 2. State progression

| State | Ownership | Authorization | Status |
|---|---|---|---|
| **Current** | `user_id` | `user_id` | shipped (test) |
| **Transitional** | `user_id` authoritative, `workspace_id` populated | `user_id` | ← we are here |
| **Dual-verified** | both, proven equivalent | `user_id`, workspace checked in parallel | Phase 2A–2B |
| **Target** | `workspace_id` authoritative | membership + capability | Phase 2D+ |
| **Final** | `workspace_id`; `user_id` → `created_by` | capability | Phase 3 |

---

## 3. Database model

### Phase 2 additions

```sql
-- Capability storage replacing the hardcoded role→capability map.
workspace_role_capabilities (
  role        text not null,      -- OWNER | ADMIN | MEMBER | <custom>
  capability  text not null,
  workspace_id uuid null references workspaces(id) on delete cascade,
                                  -- null = system default; set = per-workspace override
  primary key (coalesce(workspace_id,'00000000-...'::uuid), role, capability)
);

workspace_invites (
  id, workspace_id, email citext, role, token_hash,
  invited_by, expires_at, accepted_at, revoked_at
);

workspace_activity (            -- append-only audit
  id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata jsonb, created_at
);
```

### Existing tables — what changes, what must not

| Table | Phase 2 change | Rationale |
|---|---|---|
| `collections` | `workspace_id` → `NOT NULL` (2C); `user_id` retained as creator | Ownership moves |
| `contributions` | **no column added** | Scope is derivable via `collection_id`; a denormalized `workspace_id` would be a second source of truth that can disagree |
| `wallets` | **stays collection-scoped** | A wallet belongs to a collection's money, not to a tenant. Re-keying it to workspace would be a financial redesign — explicitly out of scope |
| `withdrawals` | **no ownership change in Phase 2** | See §6 |
| `transactions` | **nothing — the table does not exist** (audit §6) | Do not create it |
| `collection_access_grants` | migrate → `workspace_members` (2E), then retire | It is a proto-membership system |

**Rule:** a table gets `workspace_id` only if it can exist *without* a collection. `contributions`, `wallets`, and `withdrawals` all hang off a collection, so they inherit scope through the join. Only add the column where a join genuinely cannot express it.

---

## 4. Authorization model

```
User → WorkspaceMember(role) → capabilities → Resource
```

Phase 1 already routes every question through `hasCapability()`; Phase 2 swaps the internal map for `workspace_role_capabilities` and **no call site changes**. That was the point of the seam.

### Target capability set

```
workspace:read | workspace:update | workspace:delete
workspace:members.read | .invite | .remove | .manage
collection:create | :read | :update | :delete
contributors:read | contributors:export
transactions:read | reports:read
withdrawal:create | withdrawal:view | withdrawal:approve
```

### Default matrix

| Capability | OWNER | ADMIN | MEMBER | VIEWER |
|---|:--:|:--:|:--:|:--:|
| `workspace:read` | ✅ | ✅ | ✅ | ✅ |
| `workspace:update` | ✅ | ✅ | ❌ | ❌ |
| `workspace:delete` | ✅ | ❌ | ❌ | ❌ |
| `workspace:members.read` | ✅ | ✅ | ✅ | ❌ |
| `workspace:members.manage` | ✅ | ✅ | ❌ | ❌ |
| `collection:create` | ✅ | ✅ | ❌ | ❌ |
| `collection:read` | ✅ | ✅ | ✅ | ✅ |
| `collection:update` | ✅ | ✅ | ❌ | ❌ |
| `collection:delete` | ✅ | ❌ | ❌ | ❌ |
| `contributors:read` | ✅ | ✅ | ✅ | ✅ |
| `contributors:export` | ✅ | ✅ | ❌ | ❌ |
| `reports:read` | ✅ | ✅ | ✅ | ✅ |
| `withdrawal:view` | ✅ | ✅ | ❌ | ❌ |
| **`withdrawal:create`** | ✅ | ❌ | ❌ | ❌ |
| **`withdrawal:approve`** | ❌ | ❌ | ❌ | ❌ |

`VIEWER` is where the two `collection_access_grants` booleans land (`can_view_earnings` → `withdrawal:view`-adjacent read, `can_view_contributors` → `contributors:read`).

**Non-negotiable:** `withdrawal:approve` belongs to no workspace role in any phase. Approval is a platform-admin function. Membership must never confer money-movement authority.

---

## 5. RLS model

Today's policies are hand-written per table and have drifted (audit OBS-2). Phase 2 centralises on **one helper**, so isolation has a single definition:

```sql
create or replace function public.user_has_workspace_capability(ws uuid, cap text)
returns boolean language sql stable security definer set search_path='public','pg_temp' as $$
  select exists (
    select 1 from workspace_members m
    join workspace_role_capabilities c
      on c.role = m.role
     and (c.workspace_id is null or c.workspace_id = m.workspace_id)
    where m.workspace_id = ws and m.user_id = auth.uid()
      and m.status = 'active' and c.capability = cap
  );
$$;
```

Every workspace-scoped policy becomes one line:

```sql
create policy collections_member_read on collections for select to authenticated
  using (user_has_workspace_capability(workspace_id, 'collection:read'));

create policy contributions_member_read on contributions for select to authenticated
  using (exists (select 1 from collections c
                 where c.id = contributions.collection_id
                   and user_has_workspace_capability(c.workspace_id, 'contributors:read')));
```

**Index requirement:** `workspace_members(user_id, workspace_id, status)` — this function runs on every row-visibility check.

**Migration discipline:** add the new policy *alongside* the existing `user_id` one (they OR together, so nothing breaks), verify identical result sets, then drop the old one. Never swap in place.

---

## 6. Financial model — what must NOT change

| Concern | Phase 2 decision |
|---|---|
| Wallet keying | **Unchanged** — `wallets.collection_id` |
| Balance math | **Unchanged** — no workspace input |
| Fees / `PricingService` | **Unchanged** |
| Settlement | **Unchanged** |
| Paystack init/verify/webhook | **Unchanged** — no workspace awareness |
| Contribution amounts | **Unchanged** |
| Withdrawal **authorization** | Add capability check **in addition to** the existing `user_id` check |
| Withdrawal **destination** | **Unchanged** — payout account stays bound to the human, not the workspace |

**The withdrawal rule, stated precisely:** Phase 2 may make authorization *stricter* (both `user_id` AND `withdrawal:create` must pass). It may **never** make it *looser* — a workspace capability must not become a way to withdraw money the `user_id` check would have refused. Any change must fail closed.

Money must never leave through a path that only workspace membership authorised. Until an explicit product decision says otherwise, payouts remain tied to the KYC-verified individual.

---

## 7. Public collection model

`collections_public_read` currently exposes the **entire row** to `anon` — including `support_phone_number`, `user_id`, `code_prefix`, and internal counters — when a payment page needs perhaps eight fields (audit §7).

**Target: split the surface.**

```sql
create view public.public_collection_view as
select id, slug, title, description, amount, currency, currency_symbol,
       collection_type, type, status, deadline, banner_url,
       price_tiers, target_amount, min_contribution,
       allow_multiple_quantity, is_open_ended, event_date
from public.collections
where status <> 'deleted';
```

Then: grant `anon` SELECT on the **view only**, and drop `collections_public_read` from the base table. Public pages read the view; workspace members read the table through the capability policy.

```
Anon visitor  → public_collection_view      (curated columns, no PII, no internals)
Member        → collections + contributions + wallets (capability-gated)
Platform admin→ everything (is_current_user_admin())
```

This is also the correct moment to fix **BUG-2** (`profiles` readable by anon): public pages need an organizer *display name*, not an email and phone number — so the same view technique applies, exposing only the fields a payment page actually renders.

---

## 8. API changes

| Endpoint | Phase | Note |
|---|---|---|
| `GET /workspaces` · `GET /workspaces/:id` | ✅ shipped | |
| `POST /workspaces` | 2E | create non-personal workspace |
| `PATCH /workspaces/:id` | 2E | `workspace:update` |
| `GET /workspaces/:id/members` | 2F | `workspace:members.read` |
| `POST /workspaces/:id/members/invite` | 2F | `workspace:members.invite` |
| `PATCH/DELETE /workspaces/:id/members/:memberId` | 2F | `workspace:members.manage` |
| `GET /workspaces/:id/collections` | 2D | workspace-scoped list |
| `GET /workspaces/:id/reports` | 2G | `reports:read` |

Existing endpoints keep their paths and response shapes; they gain workspace scoping internally. `X-Workspace-Id` remains a *request*, re-verified server-side, never an authorization.

---

## 9. Frontend

| Surface | Phase |
|---|---|
| Switcher (built, unmounted) → mount in dashboard nav | 2D |
| Workspace dashboard (scoped collections/analytics) | 2D |
| Workspace settings (name, type, branding) | 2E |
| Members & roles UI | 2F |
| Create-workspace + invite-accept flows | 2E–2F |
| Onboarding intent capture | 2H |

**Rule:** the client filters for *presentation only*. Every scoped view must be correct even if the client sends no header at all.

---

## 10. Implementation sequence

| Phase | Objective | Depends on | Completion criteria |
|---|---|---|---|
| **2A** | Prod rollout of W1–W6 + soak | Phase 1.5 conditions | 606 workspaces, 262 collections assigned, financial sums identical |
| **2B** | Equivalence proof harness | 2A | Automated job asserts the two predicates return identical row sets for every user, daily, zero drift |
| **2C** | `workspace_id` → `NOT NULL`; `workspace_role_capabilities` table | 2B green ≥1 week | Constraint applied; capability map served from DB; all tests pass |
| **2D** | Reads + RLS switch to workspace (dual policy → verify → drop old) | 2C | Every scoped query workspace-based; result sets unchanged |
| **2E** | Non-personal workspace creation + settings | 2D | User can create an Association workspace |
| **2F** | **Members & invitations (equivalence ends here)** | 2E | Second member can be added; capability enforcement verified |
| **2G** | Migrate `collection_access_grants` → memberships; retire | 2F | No grant-based code paths remain |
| **2H** | Public view split + `profiles` exposure fix | independent | Anon sees curated columns only |

**2B is the phase people will want to skip. Don't.** It is the only thing that converts "we believe the backfill was correct" into "we have measured that it is correct, repeatedly, on production data" — and it must run *before* 2F removes the equivalence that makes measurement possible.

---

## 11. Rollback strategy

| Phase | Rollback | Notes |
|---|---|---|
| 2A | W6→W1 rollback files | Total; `user_id` untouched |
| 2B | Delete the harness | Read-only |
| 2C | `DROP NOT NULL` | Instant, non-destructive |
| 2D | Re-add `user_id` policy, drop workspace policy | Keep old policies for one release before dropping |
| 2E | Soft-delete created workspaces | Personal workspaces unaffected |
| 2F | Suspend memberships (`status='suspended'`) | ⚠️ **Last reversible point** — once real multi-member data exists, the equivalence is permanently gone |
| 2G | Restore grant reads | Keep the table until 2F has soaked |
| 2H | Re-grant base-table read | View is additive |

---

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Multi-member ships before the ownership switch is verified | 🔴 **Critical** | Enforce 2F-last ordering; 2B must be green first |
| RLS policy swap silently changes visibility | 🔴 Critical | Dual policies + equivalence assertion before dropping the old one |
| Workspace capability becomes a money path | 🔴 Critical | `withdrawal:create` OWNER-only; `withdrawal:approve` no role; authorization may only get stricter |
| `NOT NULL` applied before 100% backfill | 🟠 High | Gate on 2B; W6 dry-run must read 0 unassigned |
| Anon PII exposure persists (BUG-2) | 🟠 High | 2H — or sooner, independently |
| `user_has_workspace_capability` per-row cost | 🟡 Medium | Index `workspace_members(user_id, workspace_id, status)`; `STABLE` function |
| Denormalizing `workspace_id` onto contributions | 🟡 Medium | Don't — derive via `collection_id` |
| Policy sprawl regrows | 🟢 Low | One helper function; consolidate duplicates (OBS-2) |
