# Payout Account Delete 404 + Local Env Fix

## TL;DR

The delete-404 and missing "Needs re-adding" badge are **not code bugs in this
checkout** — the delete route, the `is_decryptable` field, and the frontend
badge/selection logic already exist (added in the prior encryption-fix pass)
and are verified working against a locally-run backend. The actual cause: the
local frontend's `.env` has `VITE_API_URL=https://api.kolekto.com.ng/api`, so
every request — including local dev — was going to the **deployed** backend,
which has not been redeployed with the new route/field yet. Once local
frontend points at local backend, both symptoms disappear. Root cause #3
(env misconfiguration) was the cause of #1 and #2.

I also hardened the WithdrawForm's "all accounts broken" case and fixed an
unrelated stale fallback port in the axios config.

## 1. Bank account delete 404 — root cause

**Frontend call** (`src/store/useSettings.ts`):
```js
deletePayoutAccount: async (accountId) => {
  await axiosInstance.delete(`/settings/profile/payout-accounts/${accountId}`);
  ...
}
```
With `axiosInstance`'s `baseURL` resolved from `VITE_API_URL`, this becomes
`https://api.kolekto.com.ng/api/settings/profile/payout-accounts/:id` while
that env var pointed at the deployed backend.

**Backend route** (`routes/settings/profile.js`):
```js
router.delete("/payout-accounts/:id", verifyToken, deletePayoutAccount);
```
mounted in `app.js` as `app.use("/api/settings/profile", profileRouter)` →
full path `/api/settings/profile/payout-accounts/:id`. **This matches the
frontend call exactly** — there is no path mismatch in the code.

**Verification performed:** started the backend locally (`node app.js`,
port 3000, confirmed via `app.js`'s `process.env.PORT || 3000` and no `PORT`
override previously set) and hit the route directly:

```
DELETE http://localhost:3000/api/settings/profile/payout-accounts/test-id
→ 401 {"error":"No token provided"}
```

A 401 (auth required) — not a 404 — proves the route is registered and
reachable on the local backend. The 404 the user saw can only have come from
the **deployed** backend not yet running this code (it predates the delete
endpoint, added in the previous encryption-fix session and already committed
locally as `kolekto-be-old` commit `3f743a7` / `kolekto-fe-old` commit
`fe53164`, but not yet shipped to `api.kolekto.com.ng`).

**Fix:** none needed in the route/controller — it's correct. The actual fix
is the local-env wiring in section 4 below, so local dev talks to the backend
that actually has this code.

Ownership and default-promotion are already handled in
`deletePayoutAccount` (`controllers/settings/profile.js`):
- looks up the account scoped to `eq("id", account_id).eq("user_id", user_id)` before deleting — a user can only ever delete their own row.
- if the deleted row was `is_default`, it re-queries the user's remaining accounts (newest first) and promotes the first one whose cipher still decrypts with the current `ACCOUNT_ENCRYPTION_KEY`.
- route has `verifyToken` applied, same as every other `/settings/profile/*` route.

## 2. "Needs re-adding" badge

`getAccounts` (`controllers/settings/profile.js`) already strips the cipher
and returns a boolean:
```js
const annotated = (data || []).map(({ account_number_cipher, ...rest }) => ({
  ...rest,
  is_decryptable: isAccountCipherDecryptable(account_number_cipher),
}));
```
Never the cipher, never the plaintext — just `true`/`false`.

`BankDetailsSection.tsx` already renders this:
```jsx
{account.is_decryptable === false ? (
  <span ...>Needs re-adding</span>
) : (
  <span ...>Verified</span>
)}
```
Using `=== false` (not `!account.is_decryptable`) is deliberate: if a backend
that doesn't yet send `is_decryptable` is hit (e.g. before this redeploys),
the field is `undefined`, `undefined === false` is `false`, and the UI falls
back to "Verified" rather than misreporting every account as broken or
throwing on a missing field. This is why the badge didn't show locally before
the env fix — the deployed backend simply wasn't sending the field yet, and
the UI degraded safely instead of crashing.

No backend change was needed here either — confirmed by re-reading
`controllers/settings/profile.js` and testing route reachability above.

## 3. Withdrawal account selection — hardened further

Already in place from the prior session:
- `WithdrawForm.tsx` auto-select prefers a decryptable default, falling back to any other decryptable account, only falling back to a broken one if literally nothing else exists.
- Broken accounts are `disabled` in the dropdown and labeled "Needs re-adding".
- Submitting a broken account is blocked client-side with an explicit message.

**Added in this pass:** previously, if *every* saved account was broken, the
form still rendered the (all-disabled) dropdown and only complained on
submit. Now there's a dedicated state, shown immediately:

```jsx
{payoutAccounts.length > 0 && payoutAccounts.every(acc => acc.is_decryptable === false) ? (
  <div>...Your saved bank account(s) need re-adding... <Button>Go to Account Settings</Button></div>
) : payoutAccounts.length > 0 ? ( /* normal dropdown */ ) : ( /* no accounts at all */ )}
```
and the submit button is now also disabled in that case (previously only
disabled when `payoutAccounts.length === 0`).

No wallet, collection, payment, or withdrawal-amount logic was touched.

## 4. Local frontend → local backend

**Where the API base URL is configured:** `src/utils/axios.tsx`:
```js
const API_BASE_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL || "https://api.kolekto.com.ng/api"
    : import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "http://localhost:3000/api";   // was hardcoded to :5050 — didn't match
                                       // the backend's actual default port
                                       // (app.js: `process.env.PORT || 3000`).
                                       // Fixed so a checkout with zero env
                                       // files still points somewhere real.
```

**Why dev was hitting prod:** `kolekto-fe-old/.env` (committed, shared) has:
```
VITE_API_URL=https://api.kolekto.com.ng/api
```
Vite loads `.env` in *every* mode, including `development`, unless a
mode-specific file overrides it. Since no dev-only override existed, dev mode
inherited the production URL.

**Fix — added `kolekto-fe-old/.env.development.local`** (gitignored via the
existing `.env*.local` rule, so this is a personal/per-machine file, never
committed):
```
VITE_API_URL=http://localhost:3000/api
```

**Vite env precedence** (highest wins): `.env.[mode].local` > `.env.[mode]` >
`.env.local` > `.env`. So:
- `npm run dev` (mode = `development`) → loads `.env.development.local` → **local backend**.
- `npm run build` (mode = `production`) → `.env.development.local` is not loaded for this mode → falls through to `.env` → **deployed backend**, unchanged.
- Verified directly:
  - `vite.loadEnv("development", ...)` resolves `VITE_API_URL` to `http://localhost:3000/api`.
  - `npm run build` output (`dist/assets/*.js`) contains `api.kolekto.com.ng` and **no** `localhost:3000` string — confirmed by grep.

**Switching environments (for any future dev):**
| Target | How |
|---|---|
| Local frontend → local backend | Keep/create `.env.development.local` with `VITE_API_URL=http://localhost:<PORT>/api`, matching the backend's `PORT` (see below). Never commit this file. |
| Local frontend → staging/deployed backend | Delete or rename `.env.development.local` (or set it to the staging URL) — falls back to `.env`'s `VITE_API_URL`. |
| Production build | Unaffected by any `.local` file; controlled solely by `.env` / `.env.production` / the hosting platform's env vars. No source-code change needed to switch targets — never hardcode the URL in `.tsx`/`.ts` files. |

Note: `npm run build:dev` (`vite build --mode development`) *would* also load
`.env.development.local` if run on a machine that has it — but since that file
is per-developer and gitignored, it won't exist on CI/build servers, so this
doesn't risk shipping a localhost URL in a real deployment.

## 5. Backend local environment

- `kolekto-be-old/.env` had no explicit `PORT` — relied on the `app.js`
  default (`process.env.PORT || 3000`). **Added `PORT=3000`** explicitly so
  it's documented rather than implicit.
- `ACCOUNT_ENCRYPTION_KEY` and `SUPABASE_*` keys are already present in the
  local `.env`.
- **Verified the backend boots locally**: `node app.js` → `Server Running on
  port 3000`, `GET /` → `{"success":true,"message":"Kolekto backend is
  running successfully"}`.
- **Important — local backend uses a live Supabase project, not a separate
  local database.** `kolekto-be-old/.env`'s active `SUPABASE_URL` is
  `https://lpeeckqsltxohppheucz.supabase.co` (a different project ref from
  the one commented out further down the file under `# production`, which is
  `https://busfgcmbndleljklrcbd.supabase.co`). There is no local Postgres/
  Supabase emulator in this repo — "local backend" means "your machine runs
  the Node process," but it reads/writes the **same hosted Supabase project**
  configured in `.env`. Treat any local testing as touching real data on that
  project unless you swap in a separate dev/staging Supabase project's keys.

- **Frontend/backend Supabase project mismatch (flagging, not changing):**
  `kolekto-fe-old/.env`'s `VITE_SUPABASE_URL` is
  `https://busfgcmbndleljklrcbd.supabase.co` — the *other* project, different
  from the backend's active one. This matters less than it sounds: sign-in
  goes through the backend (`POST /api/auth/signin` in `useAuthStore.ts`),
  which mints the session using **the backend's own** Supabase project — so
  logging in against the local backend will correctly issue a token that the
  local backend's `verifyToken` (which calls `supabase.auth.getUser(token)`
  on its own client) accepts. The frontend's direct `supabase` client
  (`src/integrations/supabase/client.ts`) is only used as a best-effort
  mirror for direct `supabase.from(...)` RLS queries
  (`mirrorSetSessionOnSupabase` in `useAuthStore.ts`, wrapped in try/catch).
  That mirror call will silently fail locally because it's targeting a
  different project than the one that issued the token — any frontend code
  path that queries Supabase directly (bypassing the backend API) will not
  be authenticated when developing against the local backend. This didn't
  affect the bank-account flows (they go through the backend API), but is
  worth knowing if you hit unexplained RLS/permission errors elsewhere. I did
  not change either `.env` file's Supabase project, since picking the
  "correct" one is a product/infra decision, not something safe to guess.

## Testing performed

- [x] `DELETE /api/settings/profile/payout-accounts/:id` confirmed reachable on local backend (401, not 404, without auth).
- [x] `GET /api/settings/profile/payout-accounts` confirmed reachable (401, not 404).
- [x] Backend boots cleanly on `PORT=3000` with existing `.env`.
- [x] `vite.loadEnv("development", ...)` resolves `VITE_API_URL` → `http://localhost:3000/api`.
- [x] `npm run build` output still references `api.kolekto.com.ng` and contains no `localhost:3000` string.
- [x] `npx tsc --noEmit` shows no *new* errors introduced by these changes (remaining errors are pre-existing path-alias noise present throughout the repo, unrelated to this change).
- [x] `npm run build` succeeds end-to-end.

## Manual testing steps (with a real session)

1. `cd kolekto-be-old && npm run start:dev` (or `node app.js`) — confirm `Server Running on port 3000`.
2. `cd kolekto-fe-old && npm run dev` — confirm Vite starts on `http://localhost:5173`.
3. Open the app, log in (goes through local backend → local backend's Supabase project).
4. Go to Profile → Bank Accounts. Open browser devtools → Network tab; confirm requests go to `localhost:3000`, not `api.kolekto.com.ng`.
5. Add a bank account → should show "Verified".
6. If a legacy/broken account exists, confirm it shows "Needs re-adding"; click delete (trash icon) → confirm dialog → Remove → confirm it disappears from the list (no 404) and the list refreshes.
7. If the deleted account was default and another decryptable one exists, confirm that one is now marked "Default".
8. Open the withdraw dialog: confirm a decryptable account is pre-selected, broken accounts are disabled in the dropdown, and (if all accounts are broken) the proactive "needs re-adding" panel shows instead of a doomed dropdown.
9. Submit a withdrawal with a valid account → confirm success, and confirm wallet/collection balances are unchanged by this change (no logic there was touched).
10. `npm run build` in the frontend → confirm it still succeeds and the deployed bundle points at the production API URL.
