# Kolekto Customer PWA (`kolekto-fe-old`) — Engineering Rules

Vite + React 18 + TS PWA. Talks to the Express API (`kolekto-be-old`), Supabase (RLS reads), and Supabase Edge Functions. Full reference: `KOLEKTO_ENGINEERING_STANDARDS.md`. Program docs: `KOLEKTO_PHASE1_ENGINEERING_AUDIT.md`, `KOLEKTO_4.0_ARCHITECTURE_AUDIT.md`.

## Data-access rule (enforced)

- **The client is read-only for financial data.** Never call `supabase.from(...).insert/update/delete/upsert/rpc` on a financial table (`collections`, `contributions`, `transactions`, `withdrawals`, wallet columns, `kyc_*`, `campaigns`).
- **Financial writes go to the Express API.** Create a collection, create/verify a contribution, request a withdrawal, etc. via the API client — the backend is the single write authority.
- **Only documented client write:** a user marking *their own* notification read (own-row, RLS-safe).
- **Reads** use the API or an RLS-guarded `supabase.from().select()`. One data-access idiom per feature — prefer TanStack Query for server state; Zustand for cross-cutting client state only.

## Phase 1 constraints

- No unrelated behavior changes. `user_id` ownership semantics unchanged — Workspace membership is additive, not a replacement (see Workspace status below).
- Errors go through `toFriendlyErrorMessage` / `extractFunctionError` and the single Sonner toast system (`src/lib/toast.ts`).
- Never cache financial API responses in the service worker (PWA keeps `api-no-cache`).
- Historical incident write-ups live in `docs/`. The old `CreateCollectionForm.tsx` was dead and has been removed — the live path is the wizard (`src/components/collections/wizard/`).

## Workspace status (as of 2026-08-13)

- **IMPLEMENTED, verified on TEST Supabase only** — personal workspaces, `workspace_members` (OWNER role only today), `collections.workspace_id`, `GET/POST/PATCH /api/workspaces`, `WorkspaceSwitcher`, `WorkspacePage`, `useWorkspaceStore`, `useWorkspaceBootstrap`.
- **NOT in production.** This code exists only on `ghazali/fix-with-claude` (~126 commits ahead of `staging`) — absent from `main`, `staging`, and prod Supabase. Do not assume it is live for any user.
- `collections.workspace_id` is written on create but is **additive/inert** — it is not yet load-bearing for authorization anywhere outside workspace resolution itself. `user_id` remains the authoritative ownership column.
- **PLANNED / NOT YET IMPLEMENTED:** invitations, member management, role management beyond OWNER, capability administration UI, ownership transfer, workspace-scoped financial authorization, audit logs for workspace administration.
- Do not build against "no workspace_id" as an assumption — check current code, this doc goes stale fast.

## Notes

- Collection creation currently goes through the `create-collection` **Edge** function (`useCollectionStore`); Phase 1 Wave 1 consolidates creation onto one authoritative Express service — do not add new create/verify paths meanwhile.
