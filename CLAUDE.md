# Kolekto Customer PWA (`kolekto-fe-old`) — Engineering Rules

Vite + React 18 + TS PWA. Talks to the Express API (`kolekto-be-old`), Supabase (RLS reads), and Supabase Edge Functions. Full reference: `KOLEKTO_ENGINEERING_STANDARDS.md`. Program docs: `KOLEKTO_PHASE1_ENGINEERING_AUDIT.md`, `KOLEKTO_4.0_ARCHITECTURE_AUDIT.md`.

## Data-access rule (enforced)

- **The client is read-only for financial data.** Never call `supabase.from(...).insert/update/delete/upsert/rpc` on a financial table (`collections`, `contributions`, `transactions`, `withdrawals`, wallet columns, `kyc_*`, `campaigns`).
- **Financial writes go to the Express API.** Create a collection, create/verify a contribution, request a withdrawal, etc. via the API client — the backend is the single write authority.
- **Only documented client write:** a user marking *their own* notification read (own-row, RLS-safe).
- **Reads** use the API or an RLS-guarded `supabase.from().select()`. One data-access idiom per feature — prefer TanStack Query for server state; Zustand for cross-cutting client state only.

## Phase 1 constraints

- No behavior changes; no `workspace_id`/roles/permissions (that is Phase 2). `user_id` semantics unchanged.
- Errors go through `toFriendlyErrorMessage` / `extractFunctionError` and the single Sonner toast system (`src/lib/toast.ts`).
- Never cache financial API responses in the service worker (PWA keeps `api-no-cache`).
- Historical incident write-ups live in `docs/`. The old `CreateCollectionForm.tsx` was dead and has been removed — the live path is the wizard (`src/components/collections/wizard/`).

## Notes

- Collection creation currently goes through the `create-collection` **Edge** function (`useCollectionStore`); Phase 1 Wave 1 consolidates creation onto one authoritative Express service — do not add new create/verify paths meanwhile.
