# KOLEKTO 4.0 — Architecture & Product Audit

**Prepared as:** Lead Software Architect / Principal Product Engineer / Staff UX / PWA / DB / Supabase Architect
**Scope:** `kolekto-fe-old` (customer PWA), `kolekto-be-old` (Express API), `kolekto-admin-control-panel-1` (admin), and the shared Supabase project(s).
**Mandate:** Analysis and recommendations only. No code, no migrations, no implementation in this document.
**Goal:** Evolve Kolekto from an individual payment-collection tool into a **Workspace-based collaborative financial operating system** — without breaking the personal experience that exists today.

> Legend for complexity/risk: **S** (small, <1 wk), **M** (medium, 1–3 wk), **L** (large, 1–2 mo), **XL** (multi-month / cross-team).

---

## 1. Executive Summary

Kolekto is a functional, revenue-bearing fintech product with a **single-tenant, user-owned data model**: a user owns collections, collections own contributions, money settles into per-collection wallet balances, and the user withdraws. The product works, but three structural realities will block the Workspace vision if not addressed first:

1. **Business logic is split across three runtimes with no single source of truth.** The same operations exist in Express controllers (`kolekto-be-old`), in Supabase Edge Functions (`create-collection`, `update-collection`, `verify-paystack-payment`, …), *and* in direct `supabase.from()` calls from the React client. `create-collection` literally exists twice. This is the #1 architectural risk for any migration, because "add `workspace_id`" must be applied in three places consistently or money/authorization bugs appear.

2. **There is no tenancy primitive.** Everything is keyed to `user_id`. "Collaboration" today is two bolt-on flows: `collection_access_grants` (read-only visibility toggles — view earnings / view contributors) and `collection_transfer_requests` (move `user_id` via OTP). Neither is a real membership/role system. There is no object that can own branding, a catalog, members, analytics, or a public page. The Workspace **is** that missing primitive.

3. **The schema and its type contract have drifted.** The generated `src/integrations/supabase/types.ts` knows only 6 tables (`collections`, `contributions`, `transactions`, `withdrawals`, `profiles`, `payment_config`) while the database actually has ~25+ (access grants, transfers, notifications, push, five email tables, admin_users, KYC, ambassador program, payment recovery, code sequences…). Types are hand-maintained and stale, so the client has no compile-time protection against RLS/shape changes.

**The good news:** the domain is clean enough to extend. Money is stored as `DECIMAL`, payments are idempotent (webhook + callback both settle, memory: `payment_push_trigger`), the withdrawal model is a documented strict-cap invariant, auth is standard Supabase GoTrue JWT, and the PWA already treats financial API paths as never-cached. A Workspace layer can be introduced **additively** (new tables + nullable `workspace_id`, backfill a "Personal Workspace" per existing user, dual-read during cutover) with **zero downtime and full backwards compatibility**. That migration is the spine of this report.

**Top 7 priorities (detail in §26 Roadmap):**

| # | Initiative | Why it's first | Cx |
|---|-----------|----------------|----|
| 1 | Consolidate write-path to ONE runtime | Every later change costs 3× until fixed | L |
| 2 | Regenerate & CI-check Supabase types | Removes silent drift before schema churn | S |
| 3 | Introduce `workspaces` + `workspace_members` (additive) | The core primitive | L |
| 4 | Backfill Personal Workspace per user; add nullable `workspace_id` | Backwards-compatible tenancy | M |
| 5 | Capability-based permission model (replace boolean toggles) | Unblocks real collaboration | L |
| 6 | Workspace switcher + onboarding intent capture | The visible product unlock | M |
| 7 | Public Workspace catalog page (`/w/:slug`) | The growth/virality lever | M |

---

## 2. Product Architecture Review

**Current shape.** Kolekto is three deployed apps over one Supabase backend:

- **Customer app** (`kolekto-fe-old`): Vite + React 18 + TypeScript, shadcn/Radix UI, Zustand (14+ stores), TanStack Query, `react-router-dom` v6, Tailwind, `vite-plugin-pwa`. Served at `kolekto.com.ng`. Talks to the Express API (`api.kolekto.com.ng`) **and** directly to Supabase **and** to Supabase Edge Functions.
- **Express API** (`kolekto-be-old`): Node 22 ESM, Express, Sequelize models *and* direct Supabase SDK, Paystack, PM2, four cron jobs (settlement, push, two email-campaign workers), three independent mailers (transactional / ambassador / marketing).
- **Admin** (`kolekto-admin-control-panel-1`): separate Vite/React app; reads Supabase directly and calls obscured admin API routes (`/api/adminurlabdkole/*`).

**Product surfaces today:** create/manage collections (5 types via a wizard — memory: `project_collection_wizard`), public contribute flow, wallet + strict-cap withdrawals, transactions, activities, KYC, limited collection sharing, ownership transfer, notifications (in-app + push), an ambassador program (parallel identity), email marketing, and a marketing/landing site all bundled into the same app.

**Weaknesses.**
- **No tenancy / no group identity.** The product's own examples (associations, churches, class reps, NGOs) are inherently multi-person, but the model can only express "one human owns this."
- **The marketing site, the authed app, the ambassador portal, and the PWA are one bundle** — heavy first load, mixed concerns, and a single blast radius.
- **Collaboration is read-only.** A treasurer cannot be given "create collection" or "approve withdrawal" rights; they can only *view*. The only way to hand over control is to transfer ownership outright.
- **Ambassador is a second identity system** (`localStorage kolekto-ambassador-token`, separate auth endpoints) rather than a role within the main identity.

**Risks.** Product positioning ("for associations and organizations") is already ahead of the data model. Every org onboarded today is a workaround (one person holds everything), which produces support load (transfer requests, "my treasurer left with the account") and churn.

**Recommended direction.** Insert the **Workspace** as the unit of ownership and collaboration (§7 domain model, §17 workspace architecture). Personal use becomes "a workspace with one member." This is the smallest change that makes every requested org use-case first-class.

---

## 3. Engineering Review

**Frontend.**
- Sound stack. Zustand-per-domain is pragmatic but there are overlapping stores (`useDashboard`, `useDashboardStore`, `useDashboardHomeStore`; `useTransactions` vs `useTransactionStore`) — duplication that signals organic growth without consolidation.
- Data fetching is split between TanStack Query, Zustand stores calling axios, and direct `supabase.from()`. Three data-access idioms for one app makes caching, error handling, and (critically) the future workspace-scoping filter hard to apply uniformly.
- Error handling is centralized well in places (memory: `edge_function_errors` extractor, `toFriendlyErrorMessage`, single Sonner toast system) — good patterns that should become the standard everywhere.

**Backend.**
- Express is organized by resource (routes → controllers), which is healthy. But **Sequelize models coexist with direct Supabase SDK calls** — two ORMs/data layers for one DB. Sequelize models (`collections.js`) appear to define schema that Supabase migrations also define; drift is inevitable.
- `middleware/authMiddleware.js` is **dead/deprecated code that references an undefined `supabase`** (its own header says so). The real path is `utils/verifyToken.js` (local HS256 verify + remote fallback + cookie refresh) — a genuinely good implementation. Delete the dead one.
- The repo root is littered with incident post-mortems (`CONTRIBUTOR_UNIQUE_ID_FIX_REPORT.md`, `PAYOUT_ENCRYPTION_*`, `PUSH_NOTIFICATION_INVESTIGATION.md`, …) and one-off diagnostic scripts (`find-file.js`, `global-find.js`, `diag-pdf.js`). This is a **reactive firefighting signature** — valuable knowledge, but it belongs in `/docs` or a wiki, not the deployable root.

**The core problem: three write paths.** `create-collection` exists as a Supabase Edge Function *and* an Express controller (`controllers/collection/createCollection.jsx` + `controllers/collection.js`). Payment verification lives in an Edge Function *and* is echoed in backend settlement. This means:
- No canonical validation, authorization, or audit point.
- Adding `workspace_id` (or any invariant) requires editing and re-testing 2–3 implementations.
- Bugs like the documented orphaned-payment incident (memory: `orphaned_payment_recovery`) are *structurally* likely when responsibility is split.

**Recommendation (P1, Cx L):** Pick **one** runtime for each write. Given the Express API already owns auth, crons, Paystack secrets, and encryption, make **Express the single write authority** for collections/payments/withdrawals; demote Edge Functions to (a) things that must run at the edge (public read of a campaign) or (b) scheduled jobs. Keep direct `supabase.from()` on the client **read-only and RLS-guarded**. Document the rule explicitly in `CLAUDE.md`.

**DX.** Good: structured request logging with correlation IDs (`requestContext`), process crash guards, env cross-wiring guard (the `KNOWN_PROJECT_ENVIRONMENTS` startup check is excellent defensive engineering). Missing: generated types in CI, a single API client contract, and a monorepo/shared-types package so FE, BE, admin, and edge share one schema definition.

---

## 4. Database Review

**Observed tables (union across SQL files + types):** `profiles`, `collections`, `contributions`, `transactions`, `withdrawals`, `payment_config`, `collection_access_invites`, `collection_access_invite_items`, `collection_access_grants`, `collection_transfer_requests`, `email_change_requests`, `password_change_otps`, `notifications`, `push_notifications`, `admin_users`, KYC tables, `ambassador_program` (+ email logs, interview fields), `email_campaigns`, `email_campaign_system_templates`, `email_recipient_directory`, `email_unsubscribes`, email queue, `payment_recovery_log`, contributor code sequences (`b3_*`, `c1_*`), `d1_pending_payment_context`, `f3_*` line-index columns.

**Strengths.**
- Money is `DECIMAL(12–14,2)` — correct (no floats).
- Idempotent, defensively-designed payment pipeline (recovery log, per-prefix contributor code counters to avoid collisions, atomic email-queue claim).
- Thoughtful invariants documented in memory: strict-cap withdrawals (`withdrawable = available − pending`), live wallet recompute for admin.

**Weaknesses / risks.**
- **Denormalized money on `collections`.** The collections table carries multiple balance columns (`DECIMAL(14,2)` ×4 + `DECIMAL(12,2)` ×4). Memory notes admin already had to add a *live recompute* endpoint because cached columns go stale. **Storing derived balances on the owning row is the classic fintech footgun.** Balances should be derived from an append-only ledger (see below), with cached columns treated as a fast-read projection that is rebuildable.
- **No double-entry ledger.** `transactions` + per-collection balance columns is a single-entry model. For a financial OS spanning many workspaces, you want an **append-only, double-entry ledger** (every money movement = balanced debit/credit rows) as the source of truth; wallet balance = `SUM(ledger)`. This is the single most important database recommendation for fintech reliability.
- **Type contract drift** (see §1). `types.ts` is hand-maintained and covers 6 of 25+ tables.
- **Sequelize vs Supabase dual definition** of the same tables.
- **Foreign keys / indexes:** access-grant tables have good partial indexes (`where revoked_at is null`) — a good pattern. But many operational tables (notifications, email queue) grew ad hoc; a full FK + index audit is needed (see §5).
- **Migration hygiene:** migrations live as loose, prefixed SQL files (`b3_`, `c1_`, `d1_`, `f3_`) applied by hand in the Supabase SQL editor. There is no single migration tool of record. This makes environments drift (the 2026-06-30 test/prod cross-wiring incident is a symptom).

**Recommendations.**
- Adopt **one migration tool** (Supabase CLI migrations) as the single source of truth; retire hand-applied SQL and Sequelize schema authority.
- Introduce a **ledger table** and make wallet balances derived. Complexity **L**, but do it *before* multi-workspace money makes it 10× harder.
- Regenerate types in CI on every migration (**S**, do immediately).

---

## 5. Supabase Review

- **Auth:** GoTrue JWT. Local HS256 verification in the backend is the fast path with remote fallback — well done. Two Supabase projects exist (prod `busfgcmbndleljklrcbd`, test `lpeeckqsltxohppheucz`); the cross-wiring guard is a good mitigation but the underlying risk (hand-managed env across FE/BE/edge) remains.
- **RLS:** This is the **highest-priority security item**. The client makes direct `supabase.from()` calls, which means RLS is the *only* thing standing between a user and other users' rows. With ~25 tables and hand-maintained policies, you must (a) enumerate every table's RLS state, (b) confirm `service_role` is never shipped to the client, and (c) add a **workspace-membership RLS predicate** before any table gains `workspace_id`. Do not add `workspace_id` to a table whose RLS you have not re-derived.
- **Edge Functions:** 11 functions in the FE repo. They duplicate backend logic (§3) and each is an independent trust boundary. Audit each for auth enforcement.
- **Storage:** buckets exist for logos/KYC/receipts (backend `test-storage.js`, uploads). Need a bucket-policy audit — workspace logos/banners (§11) will add public-read buckets that must be scoped.
- **Realtime:** `database/realtime.sql` + FE channels (memory: `project_realtime`). Requires tables be in the `supabase_realtime` publication *and* a FE channel. When workspace tables arrive, decide deliberately which are realtime (activity feed: yes; ledger: no).
- **Performance / normalization:** see §4 (denormalized balances, missing ledger, index audit).

**Duplicated data to flag:** balance columns on `collections` vs `transactions`/`withdrawals`; `email_recipient_directory` vs `profiles.email` (email identity in two places — memory notes lower-email indexes were needed); contributor identity spread across `contributions` + code-sequence tables.

---

## 6. Authentication Review

**Current.** Supabase GoTrue issues the JWT. The React client keeps the session in Zustand + `localStorage`, and **mirrors** it into the Supabase client via `supabase.auth.setSession()` (memory-safe wrappers) so direct `from()` calls are RLS-authenticated. The backend verifies locally (HS256) with a remote fallback and cookie-based refresh. A **1-hour expiry** is imposed client-side (`withOneHourExpiry`).

**Weaknesses / risks.**
- **Dual session stores** (Zustand + Supabase client) kept in sync by mirror functions — the code comments themselves record a past "SIGNED_OUT mid-session ghost-logout" from key collision. It works now but is fragile; it will get more fragile when a "current workspace" must also be tracked.
- **Ambassador auth is a separate token** in `localStorage` with its own endpoints — a parallel identity system, not a role.
- Tokens/refresh in `localStorage` are XSS-exposed; httpOnly cookies (already used for `access_token` on the backend path) are safer.

**Recommendations.**
- Keep GoTrue as the identity provider. **Unify all humans into one identity** (fold ambassador into a role/attribute, not a separate token) — this is a prerequisite for "one user, many workspaces."
- Make the Supabase client the **single** session owner; have Zustand read from it rather than maintaining a parallel copy.
- Add **`active_workspace_id`** to the session/app-state (not the JWT) so every request and every `from()` query is workspace-scoped (§17).

---

## 7. Authorization Review

**Current.** Authorization is **ownership + two booleans**:
- `collections.user_id === auth.uid()` ⇒ owner, full control.
- `collection_access_grants(can_view_earnings, can_view_contributors)` ⇒ read-only visibility.
- `admin_users` table ⇒ admin (memory: `admin_users_table`), plus an obscured route prefix.

**Weaknesses.**
- **Not role-based, not capability-based.** Two hardcoded view-booleans cannot express "finance manager can withdraw but not edit branding," which is exactly what orgs need.
- **Binary ownership.** Only the owner can act; delegation requires transferring the whole collection.
- **Security-by-obscurity** admin prefix (`/api/adminurlabdkole`) is not authorization — `admin_users` + RLS is; the obscure path adds nothing but should not be *relied on*.

**Recommendation → capability-based model (P5, Cx L).** Define **capabilities** (verbs), map them to **roles** (labels), attach roles to **members** within a **workspace**. See §23 Permission Model. This replaces the boolean toggles with a scalable matrix and lets titles be cosmetic while permissions drive enforcement — enforced identically in the backend *and* in RLS.

---

## 8. Workspace Architecture (the core design)

**Domain model (target):**

```
Identity (auth.users / profiles)
  └─ WorkspaceMember (role) ──► Workspace  (personal | collaborative)
                                   ├─ Collections ──► Contributions ──► Ledger entries
                                   ├─ Branding / Catalog / Public page
                                   ├─ Members / Invites / Roles
                                   ├─ Wallet / Payment accounts / Withdrawals
                                   ├─ Activity / Audit / Notifications
                                   └─ Settings / Verification
```

**Principles.**
1. **The Workspace is the tenant.** Everything financial, brandable, or shareable hangs off `workspace_id`.
2. **Personal = a workspace with one member** who is Owner. No separate "personal" code path — this is what guarantees "everything works exactly as today."
3. **One human → many workspaces** (Personal, KWASU FASSA, Church, Startup…), switched via a Slack/Notion-style switcher (§18).
4. **Capabilities, not titles**, drive enforcement (§23).
5. **Backwards compatibility via additive migration + backfill** (§9).

**Ownership transition.** Today `collection.user_id` = owner. Target: `collection.workspace_id` = owner tenant; `collection.created_by` = the human (kept for audit/attribution). The existing `collection_transfer_requests` flow becomes "move collection between workspaces" *or* is largely obviated (transfer a *membership* role instead of the whole collection).

---

## 9. Database Migration Strategy (backwards-compatible)

**Guiding rule: never a breaking change; always additive → backfill → dual-read → cutover → cleanup.**

**Phase A — Introduce primitives (no behavior change).**
1. Create `workspaces`, `workspace_members`, `workspace_roles`, `workspace_permissions` (or a capability enum), plus branding/settings/invites/activity tables (§22).
2. Add **nullable** `workspace_id` to `collections`, `contributions`, `transactions`, `withdrawals`, `notifications`, wallet/payment tables. Nullable = old code keeps working.

**Phase B — Backfill.**
3. For every existing `profiles` row, create **one Personal Workspace** (`type='personal'`, `owner_user_id=user.id`, name = "`<Name>`'s Workspace"), and a `workspace_members` row (role = Owner).
4. Backfill `collections.workspace_id = <that user's personal workspace>` (and cascade to contributions/transactions/withdrawals via their collection). Run in batches; verify counts.

**Phase C — Dual-read / dual-write.**
5. Reads prefer `workspace_id` but fall back to `user_id` where null. Writes set **both** `workspace_id` and `user_id` (keep `user_id` as `created_by`). This is the safety window.

**Phase D — Enforce.**
6. Make `workspace_id` `NOT NULL` once backfill is verified at 100%. Re-derive **RLS on every touched table** to "member of workspace with capability X." Only now flip the client to workspace-scoped queries.

**Phase E — Cleanup.**
7. Migrate `collection_access_grants` → `workspace_members` with a "limited viewer" role. Repoint or retire `collection_transfer_requests`. Remove Sequelize schema authority; Supabase migrations become canonical.

**Guardrails:** do each table behind a feature flag; keep the 2026-06-30-style env guard; snapshot row counts before/after each backfill batch; never run backfill against the wrong project (the cross-wiring guard must be green).

---

## 10. UI/UX Audit

**Strengths.** Consistent shadcn/Radix component base, a real design language, a purpose-built collection wizard, unified toasts (Sonner), friendly error mapping, QR + share canvas for virality.

**Gaps.**
- **No workspace context in the UI** — nowhere to see "which org am I acting as."
- **Onboarding drops users straight into an empty dashboard** with no intent capture (§11 onboarding).
- **Empty/loading/success states are uneven** — some flows have skeletons, others spin. Standardize (§15).
- **Marketing + app + ambassador in one shell** dilutes the authed experience.
- **Discoverability:** advanced features (transfer, manage access, wizard types) are buried; a command palette / search would help power users (associations have many collections).

---

## 11. Onboarding Redesign

**Current.** Register (email/password) → dashboard. No OTP-first, no intent, no workspace, no first-collection guidance. `profiles.is_organizer` exists but isn't used to branch the experience.

**Recommended flow (mobile-first, progressive).**
1. **Account** — email or phone → OTP → minimal profile (name, avatar). Defer everything else.
2. **Intent** — "What brings you to Kolekto?" (Collect for myself / Manage for a group / Event payments / Association dues / Donations / Business / Other). This single answer seeds workspace type, catalog templates, and copy.
3. **First workspace:**
   - *Personal* → prefilled name ("`<Name>`'s Workspace") → **Done** (identical to today's experience).
   - *Collaborative* → name → type (Class/Association/Church/Mosque/NGO/Community/Committee/Club/Business/Family/Other) → optional logo → description → **invite members + assign roles** → create → **first collection** guided.
4. **Activation nudge** — land on a dashboard with a clear "Create your first collection" CTA and a sample.

**UX principles:** one decision per screen, OTP over passwords on mobile, skip-friendly (logo/invites optional), and **never block** the personal user with org steps. Complexity **M**; depends on §8 workspaces existing.

---

## 12. Workspace Switcher

**Design (Slack/Notion/Linear pattern).**
- Persistent switcher in the top-left (desktop) / an avatar-stack sheet (mobile). Shows current workspace logo + name; click reveals the list with role badges, unread/activity dots, and "+ Create workspace" / "Join with invite."
- **`active_workspace_id`** persisted in app state + `localStorage`, injected into every API call header and every RLS-scoped query. Switching = swap the id, refetch scoped data, no reload.
- Personal workspace pinned to top. Keyboard shortcut (⌘K → "Switch workspace").
- Deep links carry workspace context (`/w/:slug/collections/:id`) so shared links resolve to the right tenant.

Complexity **M**; hard dependency on §8 + §6 (session must carry active workspace).

---

## 13. Role System

**Evolve from** "owner + 2 booleans" **to a two-level, capability-driven model:**
- **Workspace roles** (Owner, Administrator, Finance Manager, Collection Manager, Member, Viewer, + Custom) — govern branding, members, payouts, settings.
- **Collection roles** (optional finer grain per collection) — inherit from workspace role unless overridden.
- **Inherited permissions:** workspace role sets the floor; collection grants can add (never silently exceed workspace caps).
- **Custom roles:** a workspace admin composes a role from the capability list.

**Titles are labels; capabilities drive authorization** (§23). Assignment happens in Members; invitation carries a proposed role; ownership "transfer" becomes "grant Owner + optionally step down" rather than moving `user_id`.

---

## 14. Workspace Features Integration (without breaking collections)

Each feature maps to a table + a capability, and every one is introduced additively:

| Feature | Backing | Capability gate |
|---|---|---|
| Dashboard / Analytics | derived from ledger + collections scoped by `workspace_id` | `analytics.view` |
| Branding (logo/theme/banner) | `workspace_branding` | `branding.manage` |
| Catalog / Public page | `workspace_catalog`, `workspace_public_pages` | `catalog.manage` |
| Members / Invites / Roles | `workspace_members`, `workspace_invites`, `workspace_roles` | `members.manage` |
| Activity / Audit | `workspace_activity`, `workspace_audit_logs` | `activity.view` |
| Wallet / Payment accounts | `workspace_payment_accounts` (+ ledger) | `finance.manage` |
| Verification | `workspace_verification` | admin-reviewed |
| Notifications / Preferences | `workspace_notifications`, `workspace_preferences` | member-scoped |

Existing collections keep working because they read through the same scoped queries once backfilled; nothing is removed until Phase E.

---

## 15. Collection Catalog (public page)

**Target:** `kolekto.com.ng/w/:slug` (e.g. `/w/fassa`) — a public, branded storefront owned by the workspace.
- Renders workspace logo, description, brand colors (from `workspace_branding`), and the **published** collections grouped by kind: Donate, Event Tickets, Membership Dues, Fundraising, Products.
- Inherits branding automatically; each collection card deep-links into the existing contribute flow.
- Served fast at the edge (this is a legitimate Edge Function / SSR use, unlike the write duplication in §3). Cache the public read; never cache the payment step.
- **Reserved-slug + verification** guardrails (§17) so `/w/paystack` can't be squatted.

Complexity **M**; depends on branding (§18) + workspace public-read RLS.

---

## 16. Collection Ownership Migration

Covered mechanically in §9. Product-level notes:
- **Transfer strategy:** prefer transferring *membership/role* over transferring the collection. Keep `collection_transfer_requests` only for the genuine "move a collection to a different workspace" case.
- **Sharing:** replaced by workspace membership + optional per-collection grants.
- **Analytics/audit:** attach to `workspace_id`; keep `created_by` for human attribution.
- **Backwards compatibility:** dual-write `user_id`+`workspace_id` through the transition; personal users never notice.

---

## 17. Recommended Workspace Model (canonical definition)

```
workspace
  id, slug (unique, reserved-list checked), type: 'personal'|'collaborative',
  category (class|association|church|mosque|ngo|community|committee|club|business|family|other),
  name, description, owner_user_id, verification_status, created_by, created_at

workspace_member
  id, workspace_id, user_id, role_id, status: 'invited'|'active'|'suspended',
  invited_by, joined_at

workspace_role
  id, workspace_id (null = system role), key, label, is_custom
workspace_role_capability
  role_id, capability (enum)   -- e.g. collection.create, finance.withdraw, branding.manage
```

Session carries `active_workspace_id`. Every RLS policy on a workspace-scoped table becomes: *"row.workspace_id ∈ (workspaces where a `workspace_member` row exists for `auth.uid()` with the required capability)."* Encapsulate this in a single SQL helper function so all policies share one definition.

---

## 18. Branding System

`workspace_branding`: logo_url, banner_url, primary/secondary/accent color, typography choice, welcome_message, contact info, website, social links, (future) custom_domain + verification.
- Store assets in a **public-read, workspace-scoped storage bucket**; validate/transform on upload (size, type, dimensions).
- Expose brand tokens as CSS variables at the public page / catalog boundary so the contribute flow themes itself.
- Custom domains are a **long-term** item (DNS + TLS + verification); ship subdomain/slug first (`/w/:slug`).

Complexity **M** (branding CRUD) → **XL** (custom domains).

---

## 19. Mobile UX Audit

**Strengths.** PWA-installable, `standalone` display, brand theme color `#1B5E20`, Android PWA fixes already invested (multiple `PWA_*` and `ANDROID_PWA_FIX` docs), bottom-nav pattern already used in the ambassador portal (memory: `ambassador_rewards`).

**Gaps to address per screen.**
- **Touch targets & safe areas:** audit for ≥44px targets and `env(safe-area-inset-*)` on notched devices (payment CTAs especially).
- **Bottom navigation:** promote to the primary app nav (Home / Collections / Create / Wallet / Profile) — associations manage on phones.
- **Forms:** the collection wizard and contribute forms need mobile keyboard types (numeric for amounts), sticky primary actions, and inline validation.
- **Loading:** replace spinners with skeletons on list/detail screens.
- **Gestures/animations:** framer-motion is available; use it sparingly for sheet transitions and the workspace switcher, not decoration.
- **Performance:** split the marketing bundle from the app bundle; lazy-load wizard, charts (recharts), and PDF/canvas libs (`html2pdf`, `html2canvas`) which are heavy.

Complexity: per-item **S–M**; bundle-split **M**.

---

## 20. PWA Audit

**Current (`vite.config.ts`).** `VitePWA` with `registerType: autoUpdate`; manifest complete (name, short_name, standalone, theme_color); Workbox `runtimeCaching` with versioned caches: pages network-first (`kolekto-pages-v4`), google-fonts, images, and **API explicitly `api-no-cache`** — correct and important for a fintech app (never serve stale balances).

**Gaps.**
- **No offline collections view** (read-only cache of the user's collections would be safe and useful).
- **No queued/offline payment** — correctly avoided today; keep it that way (payments must be online + idempotent). Do *not* add offline payments.
- **Update strategy:** `autoUpdate` can swap the SW mid-session; add a "new version available — reload" prompt for financial screens so users aren't surprised mid-flow (past `PWA_REFRESH_FIX`/`PWA_RERENDER_FIX` docs suggest this bit already).
- **Push:** infrastructure exists and is mature (memory: `stale_notification_fix`, `push_diagnostics`) — extend it to be **workspace-scoped** (notify the right members).
- **Splash/background sync:** add proper splash assets; consider background sync only for non-financial actions (e.g. read-receipts), never money.

Complexity **M**.

---

## 21. Design System Audit

**Current.** shadcn/ui + Radix + Tailwind + `tailwindcss-animate`, `class-variance-authority`. A real component library exists (`components/ui`).

**Recommendations.**
- **Formalize design tokens** (color, spacing, radius, typography) as Tailwind theme + CSS variables — required anyway for workspace theming (§18).
- **Dark-mode readiness:** `next-themes` is installed; audit components for dark variants before shipping (many custom screens likely light-only).
- **Consistency:** consolidate duplicated card/table/dialog patterns; document usage in a living component gallery (Storybook or an `/design` route).
- **Accessibility:** Radix gives keyboard/focus for free — but custom screens (wizard, contribute, share canvas) need an a11y pass (labels, focus order, color contrast on the green brand, aria-live on toasts).
- **Icons:** standardize on `lucide-react` (present) and drop `react-icons` where possible to cut bundle weight.

---

## 22. Recommended Database Schema (new tables)

Additive (all with `created_at`, `created_by`, RLS on):

```
workspaces, workspace_members, workspace_roles, workspace_role_capability,
workspace_branding, workspace_settings, workspace_preferences,
workspace_invites, workspace_activity, workspace_audit_logs,
workspace_catalog, workspace_categories, workspace_tags,
workspace_public_pages, workspace_verification,
workspace_payment_accounts, workspace_payment_settings,
workspace_notifications, workspace_member_history, workspace_custom_fields,
ledger_entries (append-only, double-entry — see §4),
workspace_domains (future), workspace_transfer_history (future)
```

**Existing tables that gain `workspace_id`:** `collections`, `contributions`, `transactions`, `withdrawals`, `notifications`, `push_notifications` (target audience), payment/wallet tables. Keep `user_id`/`created_by` for attribution.

---

## 23. Recommended Permission Model

**Capabilities (verbs)** — the enforcement primitive:
```
workspace.manage, members.invite, members.manage, roles.manage,
branding.manage, catalog.manage, settings.manage,
collection.create, collection.edit, collection.delete, collection.publish,
finance.view, finance.withdraw, payout_account.manage,
analytics.view, activity.view, contributors.view, earnings.view
```

**Default roles → capability sets:**
| Role | Capabilities (illustrative) |
|---|---|
| Owner | all |
| Administrator | all except `workspace.manage`(delete) / ownership |
| Finance Manager | `finance.*`, `payout_account.manage`, `analytics.view`, `earnings.view` |
| Collection Manager | `collection.*`, `contributors.view`, `analytics.view` |
| Member | `collection.create` (own), `activity.view` |
| Viewer | `earnings.view` and/or `contributors.view` (maps the old two booleans) |

Enforced in **both** the Express layer (middleware `requireCapability(cap)`) **and** RLS (one shared SQL helper). Titles are cosmetic; the capability set is the contract. Old `collection_access_grants` boolean pairs migrate cleanly into Viewer sub-variants.

---

## 24. Recommended Information Architecture & Navigation

```
[Workspace Switcher]  ── top-left / mobile sheet
Home (workspace dashboard)
Collections
  ├─ All / Active / Drafts
  └─ Collection detail (contributions, analytics, share, access)
Catalog (public page editor)          [collaborative only]
Wallet / Finance (balances, withdrawals, payout accounts)
Members & Roles                       [collaborative only]
Activity / Audit
Settings (workspace: branding, verification, preferences)
Personal (account, security, KYC, notifications)
```

Personal workspaces hide the collaborative-only sections, so the personal user sees essentially today's app.

---

## 25. Recommended Folder Structure & API

**Frontend** — move from type-based to **feature-based** modules:
```
src/features/{workspaces,collections,contributions,wallet,members,branding,catalog,auth,notifications}/
  {components, hooks, api, store, types}
src/shared/{ui, lib, hooks}
src/app/ (router, providers)
```
Split marketing site out of the app bundle. One data-access layer per feature (choose TanStack Query as the standard; Zustand only for cross-cutting client state like `activeWorkspace`).

**Backend / API** — RESTful, workspace-scoped:
```
/api/workspaces
/api/workspaces/:wid/collections
/api/workspaces/:wid/collections/:id/contributions
/api/workspaces/:wid/members            (+ /invites, /roles)
/api/workspaces/:wid/wallet             (+ /withdrawals, /payout-accounts)
/api/workspaces/:wid/branding | /catalog | /activity | /settings
/api/public/w/:slug                      (public catalog, edge-cached)
```
`:wid` in the path makes scoping explicit and auditable; `requireCapability` middleware guards each. **One runtime owns writes** (§3).

---

## 26. Product & Engineering Roadmap

| Phase | Item | Cx | Risk | Depends on |
|---|---|---|---|---|
| **Immediate wins** | Regenerate + CI-check Supabase types | S | Low | — |
| | Delete dead `authMiddleware.js`; move incident `.md` + diag scripts to `/docs` | S | Low | — |
| | Full RLS enumeration/audit of existing tables | M | **High if skipped** | — |
| | Bundle-split marketing from app; lazy-load heavy libs | M | Low | — |
| | Standardize empty/skeleton/success states | S–M | Low | — |
| **Short-term** | Choose ONE write runtime; de-duplicate `create-collection` etc. | L | High | RLS audit |
| | Introduce ledger table; derive wallet balances | L | High | write runtime |
| | `workspaces` + `workspace_members` + roles/capabilities (additive) | L | Med | — |
| | Backfill Personal Workspace per user; nullable `workspace_id` | M | Med | workspaces |
| **Medium-term** | Capability-based authz in API + RLS | L | Med | members, backfill |
| | Workspace switcher + onboarding intent capture | M | Low | workspaces, session |
| | Members/invites/roles UI; migrate access-grants → memberships | M | Med | authz |
| | Branding system + public catalog `/w/:slug` | M | Low | branding, RLS |
| | Enforce `NOT NULL workspace_id`; cutover reads | M | High | 100% backfill |
| **Long-term** | Unify ambassador into main identity/roles | M | Med | identity work |
| | Workspace verification + custom domains | XL | Med | branding |
| | Offline read-only collections; SW update prompt | M | Low | PWA |
| | Design tokens + dark mode + a11y pass | M | Low | — |
| | Multi-currency / additional payout rails on the ledger | XL | High | ledger |

**Suggested implementation order:** Immediate wins (safety + de-risking) → consolidate write path + ledger (fix the foundation) → workspaces additive + backfill (introduce tenancy invisibly) → capabilities + members UI (unlock collaboration) → switcher + onboarding (make it visible) → catalog + branding (growth) → enforce NOT NULL (finalize) → long-term platform bets.

---

## 27. Technical Debt Report

1. **Three write runtimes; duplicated logic** (`create-collection` ×2, payment verify split). *Highest structural debt.*
2. **Stale hand-maintained types** (6/25+ tables).
3. **Sequelize + Supabase dual data layer.**
4. **Hand-applied prefixed SQL migrations**, no single migration tool of record; two projects prone to drift.
5. **Denormalized wallet balances** on `collections` requiring live-recompute workarounds; no ledger.
6. **Dead code** (`authMiddleware.js`) and **incident docs/diag scripts in deployable roots.**
7. **Overlapping Zustand stores** (dashboard/transactions duplicates).
8. **Parallel ambassador identity system.**
9. **Marketing + app + portal in one bundle.**
10. **Security-by-obscurity admin prefix** treated as if it were authorization.

---

## 28. Security Review

- **RLS is the load-bearing control** for all direct client reads — must be audited table-by-table *before* schema churn (P0).
- **Multiple trust boundaries** (Express, 11 Edge Functions, client) — each must independently enforce auth; today they don't uniformly.
- **Secrets:** `service_role` must never reach the client; `ACCOUNT_ENCRYPTION_KEY`, `SUPABASE_JWT_SECRET`, Paystack keys are env-managed with good startup guards — keep the cross-wiring guard.
- **Tokens in `localStorage`** are XSS-exposed; prefer httpOnly cookies for refresh tokens.
- **Webhook HMAC over raw body** is correctly implemented (`express.raw` before JSON parser) — a genuine strength; preserve it.
- **Obscured admin path** ≠ security; rely on `admin_users` + RLS + capability checks.
- **Storage buckets** (KYC, logos) need explicit per-object policies before public branding assets land.

---

## 29. Performance & Scalability Assessment

- **DB:** derived-balance columns and per-request live recompute won't scale across many workspaces; a ledger + materialized/cached projections will. Add the FK/index audit (notifications, email queue, contributions by workspace).
- **API:** local JWT verification already removed the per-request GoTrue call (good). Workspace scoping adds a membership lookup per request — cache it (short TTL) keyed on `(user, workspace)`.
- **Frontend:** split bundles, lazy-load charts/PDF/canvas, adopt skeletons; the marketing/app split alone should materially cut first load.
- **Realtime:** be selective about which workspace tables publish; a busy org's activity feed shouldn't push ledger churn to every client.
- **Scale ceiling:** the current single-tenant model tops out at "power user with many collections." The Workspace model + ledger is what takes Kolekto to "thousands of orgs, each with many members and collections."

---

## 30. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RLS gap exposed during schema churn | Med | **Critical** | Full RLS audit before any `workspace_id` (P0); shared policy helper |
| Money bug from denormalized balances / no ledger | Med | **Critical** | Ledger first; derive balances; reconcile job |
| Migration data loss during backfill | Low | Critical | Additive→dual-write→verify counts→enforce; batched, reversible |
| Env cross-wiring (test/prod) repeats | Med | High | Keep startup guard; single migration tool; STRICT_ENV_CHECK in prod |
| Logic drift across 3 runtimes during migration | **High** | High | Consolidate write path *before* migrating |
| Ambassador identity fork complicates auth | Med | Med | Unify identity early |
| Scope creep (workspaces + rewrite at once) | High | Med | Additive phases; feature flags; ship personal-unchanged first |

---

## 31. Future Platform Vision (3–5 years)

Kolekto as a **collaborative financial operating system**:
- **Year 1:** Workspaces, roles, catalog, branding, verified public pages — orgs run dues, events, fundraisers, and donations with real teams and audit trails.
- **Year 2:** Ledger-native finance — budgets, sub-accounts, reconciliation, exportable statements, approvals/limits per role; API + webhooks for orgs.
- **Year 3:** Marketplace of workspace types (church, cooperative, school) with templates, custom fields, and integrations; verified badges; custom domains.
- **Years 4–5:** Multi-currency and additional payout rails on the double-entry core; developer platform (apps on top of workspaces); Kolekto becomes the "GitHub/Notion for group money" — the default place any Nigerian (then African) group collects, holds, governs, and disburses funds together.

**The through-line:** every step in this document is additive and backwards-compatible. The personal user keeps today's experience; the organization finally gets a home. The Workspace primitive, a real ledger, capability-based authz, and one consolidated write path are the four foundations everything else stands on — build them first, in that order.

---

*End of audit. No code, migrations, or schema changes were made in producing this document.*
