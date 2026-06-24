# Contributor Unique ID/Code Generation — Regression Fix Report

Date: 2026-06-24 (Round 1 + Round 2 + Round 3 + Round 4)

## Round 4 — the REAL production project, and the actual root cause for old collections

Round 3 ran a backfill and declared success — but against
`lpeeckqsltxohppheucz`, which turns out NOT to be the project the user
identified as production (`https://busfgcmbndleljklrcbd.supabase.co`).
`kolekto-be-old/.env`'s active (uncommented) config points to
`lpeeckqsltxohppheucz` with a `sk_test_` Paystack key, while
`busfgcmbndleljklrcbd` — with a real `sk_live_` key — sits commented out
in the same file, labeled `# production`. Both admin panel repos
(`kelekto-admin`, `kolekto-admin-control-panel-1`) are also currently
configured to `lpeeckqsltxohppheucz`. Whether that reflects what's
actually deployed (vs. just this local `.env`) is unconfirmed — flagged
to the user as a separate, serious finding, independent of unique codes.

No service-role key for `busfgcmbndleljklrcbd` exists anywhere in this
workspace — only the public anon/publishable key (safe to use; it's
meant to be public, already shipped in the browser bundle). Used it
read-only to investigate production directly:

**The real root cause for old collections, confirmed with production data:**
A schema migration added `unique_id_enabled` as `NOT NULL DEFAULT false`,
which backfilled **every** pre-existing collection to `false` —
regardless of whether it already had a working `code_prefix`. In
`busfgcmbndleljklrcbd`: **89 collections** have `unique_id_enabled=false`
with a real `code_prefix` still set; only **12** have it genuinely
`true`; **0** have it `null` (so Round 2's assumption — that legacy rows
would show up as `null` rather than `false` — was wrong; corrected here).

Round 2/3's fix made `unique_id_enabled` a hard gate (`false` always
blocks, `true` always allows, `null` falls back to prefix presence).
That was *correct* for the 12 genuinely-`true` collections and for any
new collection (where the current UI invariant means toggle-off always
implies `code_prefix=null` anyway) — but it **actively broke** all 89
legacy collections, because their `false` is migration noise, not a
real choice, and the gate doesn't fall back to `code_prefix` for `false`.

**The fix:** drop `unique_id_enabled` as a gate entirely. A configured
prefix — the collection's `code_prefix`, or a `price_tiers[].prefix` on
the specific tier/ticket being purchased — is now the sole trigger for
generation, exactly matching the original pre-regression logic and the
UI's own long-standing copy ("IDs are only generated when you add a
prefix"). `unique_id_enabled` is still saved by the UI and still read,
but only for display (e.g., whether a receipt shows a "your code"
section) — never as a block.

**Verified this is correct, not just convenient:** of the 89 "false but
has a prefix" collections, 2071 paid contributions exist across them,
and **1986 already have a code** — direct proof these collections were
genuinely working under prefix-only logic before any of this column
existed. Only **85 contributions are actually missing a code**,
concentrated in just 4 collections:
- `Y2K PARTY TICKETS PAYMENTS` — 73 missing (out of 110 paid)
- `QUANTUMITES NACOS FYB CONTRIBUTION 26'` — 8 missing (out of 211 paid)
- `200 LEVEL ENGINEERING CLASS` — 3 missing (out of 20 paid)
- `Formula 1` — 1 missing (out of 1 paid)

These 85 are the actual regression scars — contributions that came in
during the window when generation was fully broken (the missing
`uniqueIdEnabled` field from Round 1) or partially broken (Round 2/3's
overly strict gate, for these specific legacy collections).

### Files changed (Round 4)
- `supabase/functions/verify-paystack-payment/index.ts` — replaced
  `shouldGenerateUniqueCode()` with `hasAnyConfiguredPrefix()` (display
  only); the per-unit generation loop now resolves the prefix directly
  with no `unique_id_enabled` check at all.
- `kolekto-be-old/utils/contributionCodeService.js` — same:
  `resolveContributionUniqueCode()` no longer gates on
  `shouldGenerateUniqueCode()`; that function is kept only as a
  display-only export (used by `deposit.js`'s three receipt fields).
- `kolekto-be-old/scripts/backfillUniqueContributionCodes.js` —
  `fetchEligibleCollections()` now fetches all collections (paginated)
  and filters in JS by `hasAnyConfiguredPrefix()`, instead of querying by
  `unique_id_enabled` at the database level.

### Verified against `busfgcmbndleljklrcbd` (read-only, anon key)
- `contribution_code_counters` table and `next_contribution_code_number`
  RPC both exist (the C-1 migration has been applied here too) — table
  is currently empty, meaning no payment has yet completed through a
  deployed edge function version that calls this RPC. This suggests the
  version currently live on this project predates Round 2/3 (it's
  probably still using in-memory counting, not the atomic RPC) —
  redeploying the current file is needed regardless of the
  `unique_id_enabled` fix.
- Calling the RPC with the anon key correctly fails with `42501` (RLS
  blocks anon writes to the counters table) — expected; `service_role`
  bypasses RLS, so this doesn't indicate a problem for the real write path.

### Still needed to finish this (blocked on access)
1. **Deploy the corrected `verify-paystack-payment/index.ts`** to
   `busfgcmbndleljklrcbd` specifically (CLI or dashboard paste — same as
   before, just confirm the project ref this time).
2. **A service-role key for `busfgcmbndleljklrcbd`** to run
   `backfillUniqueContributionCodes.js` for the 85 missing codes there.
   None exists in this workspace; needs to come from that project's
   Settings → API page.
3. Clarify what `lpeeckqsltxohppheucz` actually is — still real data,
   not invented, but if it's not receiving live traffic, the Round 3
   backfill run against it (29 codes assigned, additive/safe either way)
   was directionally pointless for the user's actual production system.

---

## Round 3 Addendum — production backfill executed + tiered verification

Round 2 deployed the fix and confirmed new collections work. This round
ran the actual backfill against production (project `lpeeckqsltxohppheucz`,
the project configured in `kolekto-be-old/.env`, confirmed live by the
`contribution_code_counters` table already containing a real row from
genuine traffic before this script touched anything) and specifically
verified tiered-collection behavior end-to-end with real data.

**One more bug found and fixed first:** a real collection
("OMEGA CONFERENCE 2026", tiered) had tier prefixes typed as `VIP`,
`VIP 1`, `VIP 2` — i.e. with an embedded space, label-style rather than
code-style. Left as-is, this would have produced codes like `VIP 1-001`
(a unique code with a space in it). Added whitespace-stripping wherever a
prefix is resolved into a code — `verify-paystack-payment/index.ts`,
`contributionCodeService.js`, the backfill script's `getUnitPrefix`, and
the UI input handlers (`Step6UniqueId.tsx`'s tier-prefix and top-level
prefix inputs, `CreateCollectionForm.tsx`'s submit-time sanitization) —
so `VIP 1` now correctly produces `VIP1-001`. This never touches the
stored `tier.prefix` value, only the code built from it, and organizers
typing a prefix from now on can't introduce a space in the first place.

**Production backfill results:**
- Dry-run found 29 paid contributions across 8 collections missing a
  code (out of 22 collections eligible for codes; the other 14 had none
  missing).
- Re-ran dry-run after the whitespace fix — same 29 rows, but with clean
  codes (`VIP-001`...`VIP-006`, `VIP1-001`, `VIP2-001`...`VIP2-003`
  instead of the space-containing versions).
- Ran live (no `--dry-run`): all 29 assigned successfully, exactly
  matching the dry-run preview.
- Re-ran dry-run immediately after: **0 missing** — confirms idempotency,
  nothing left to backfill, nothing was double-assigned.
- Direct duplicate check across the whole `contributions` table
  (`(collection_id, contributor_unique_code)` pairs, 121 total codes after
  the backfill): **0 duplicates**.

**Tiered verification, using "OMEGA CONFERENCE 2026" as the real example:**
its three tiers — "Early Bird Attendee" (prefix `VIP`, `sold_quantity: 6`),
"Premium Attendee" (prefix `VIP 1`→`VIP1`, `sold_quantity: 1`), "Gold
Sponsor" (prefix `VIP 2`→`VIP2`, `sold_quantity: 3`) — got exactly 6, 1,
and 3 backfilled codes respectively (`VIP-001..006`, `VIP1-001`,
`VIP2-001..003`), matching each tier's `sold_quantity` precisely. This
confirms `getUnitPrefix()` (backfill) and the live edge function's tier
matching both correctly attribute each contribution to its actual
purchased tier and give each tier prefix its own independent,
zero-gap sequence — which is the "each tier's codes are independent and
make sense" behavior that was asked for.

### Files changed (Round 3)
- `supabase/functions/verify-paystack-payment/index.ts` — strip whitespace
  from the resolved prefix before building a code.
- `kolekto-be-old/utils/contributionCodeService.js` — same.
- `kolekto-be-old/scripts/backfillUniqueContributionCodes.js` — same.
- `src/components/collections/wizard/steps/Step6UniqueId.tsx` — strip
  whitespace as the organizer types a tier prefix or the top-level prefix.
- `src/components/collections/CreateCollectionForm.tsx` — strip whitespace
  in addition to the existing trailing-hyphen strip at submit time.

### Recommended follow-up (not applied — a schema/DDL change, holding for a separate explicit decision)
With the duplicate check above confirming zero existing duplicates, it's
now safe to uncomment the partial unique index in
`database/c1_per_prefix_code_counters.sql` (`uq_contributions_unique_code`
on `(collection_id, contributor_unique_code) WHERE ... IS NOT NULL`) for a
hard database-level guarantee on top of the atomic-RPC guarantee. Did not
apply this myself since it's a schema change beyond what was asked this
round — say the word and I'll run it.

---

## Round 2 Addendum

Round 1 (below) fixed the missing `uniqueIdEnabled` field that disabled
generation entirely. This pass tightened the spec and fixed a real,
separate concurrency bug found while re-auditing the live path:

1. **Format changed to `PREFIX-001`** (hyphenated, 3-digit, zero-padded),
   per the explicit spec: prefix `FASSA` → `FASSA-001`, `FASSA-002`, ...
   Changed in the edge function, the backend helper, the backfill script,
   and every UI preview string. Existing codes already stored without a
   hyphen are left exactly as they are (never rewritten) — all
   prefix-counting logic now tolerates both `PREFIX001` (legacy) and
   `PREFIX-001` (current) when computing "what's the next number".

2. **Toggle + prefix is now strictly AND, with one legacy fallback.**
   Generation requires `unique_id_enabled === true` **and** a resolved
   prefix. The one exception: rows where `unique_id_enabled` is `NULL`
   (collections created before that column existed) fall back to "is
   `code_prefix` set" — the only signal that existed back then — so
   collections that have been correctly generating codes for a long time
   don't suddenly stop. `unique_id_enabled === false` always wins and
   blocks generation, even if a stale `code_prefix` is still on the row.
   Implemented once as `shouldGenerateUniqueCode()` in both
   `verify-paystack-payment/index.ts` and
   `kolekto-be-old/utils/contributionCodeService.js`.

3. **Real concurrency bug found and fixed in the live path.** The
   edge function computed each unique code's sequence number from an
   in-memory `COUNT` of existing paid rows taken once at the start of the
   request (`existingCountByPrefix`/`batchCountByPrefix`), not from any
   atomic database operation. Two payments to the **same collection and
   prefix** arriving close together could both read the same count and
   mint the **identical code** (e.g. two different contributors both
   getting `REG-005`). The backend's existing atomic RPC
   (`next_contributor_code_number`, from the B-3 migration) was never
   even called from this path — and it wouldn't have been correct anyway,
   since it counts per-*collection*, not per-*prefix*, and a collection
   can have several independent tier prefixes.
   - Added `database/c1_per_prefix_code_counters.sql`: a new
     `contribution_code_counters (collection_id, prefix, next_number)`
     table plus an atomic `next_contribution_code_number(collection_id,
     prefix)` Postgres function (single `INSERT ... ON CONFLICT DO UPDATE
     ... RETURNING`, race-free by construction), seeded from the highest
     existing code per prefix so it never overlaps history.
   - The edge function and `contributionCodeService.js` now call this RPC
     per unit instead of counting in memory. Both keep the old in-memory
     approach as a fallback **only** if the RPC/migration isn't deployed
     yet (logged with a warning), so nothing regresses before the
     migration is applied — but the race only goes away once it is.
   - The backfill script was switched to mint through the same RPC in
     live mode (so it can never drift from what a real payment would get
     next) and to a read-only preview of the counter table in `--dry-run`
     (so dry-run truly never mutates anything, including the counter).

4. **Added "must have a prefix" validation** at the point an organizer
   enables the toggle, instead of letting them save a configuration that
   silently never generates anything:
   - `CreateCollectionWizard.tsx`: the `unique-id` step now blocks
     "Next" with a clear message if the toggle is on but no prefix is
     set (or, for tiered/ticket-tiered, no tier has a prefix).
   - `CreateCollectionForm.tsx` (PWA): `handleSubmit` now blocks
     submission with a toast under the same condition.
   - UI copy updated everywhere ("Optional" → "Required") and prefix
     preview text updated to the new `PREFIX-001` format.

5. **Fixed a format collision in the PWA form.** `UniqueCodesSection.tsx`
   previously suggested prefixes with a trailing hyphen baked in (e.g.
   placeholder `"BIO301-"`). Since the backend always joins prefix and
   number with its own `-`, a stored prefix like `"BIO301-"` would have
   produced `"BIO301--001"` (double hyphen). The placeholder/preview was
   fixed, and `CreateCollectionForm.tsx` now strips any trailing hyphen
   from the prefix before saving, defensively, in case an existing draft
   or old habit still includes one.

6. **Checked the admin panels** (`kelekto-admin`,
   `kolekto-admin-control-panel-1` in the workspace) — their
   `CollectionDetailPage.tsx` only types `unique_id_enabled` for
   collection settings display; neither renders a per-contributor code
   list, so there's nothing to fix there. `kolekto-africa-pay` has its
   own, separate `CreateCollectionForm.tsx` but appears to be an
   unrelated/older app, not part of the live Kolekto product surface
   reachable from `kolekto-fe-old`/`kolekto-be-old` — not modified.

### Found but NOT fixed in this pass (flagged for a decision)

- **Fundraising collections cannot enable unique IDs at all today.**
  `wizardTypes.ts`'s `STEP_FLOWS.fundraising` does not include the
  `unique-id` step, so the toggle is never shown to the organizer for
  that collection type — `unique_id_enabled` stays at its default
  (`false`). The original ask listed fundraising as a type that should
  support this "if unique ID is enabled," but enabling it requires adding
  a new step to that flow (a small UX change, not a bug fix to existing
  behavior) — held for an explicit decision rather than inserted
  unilaterally.

### Files Changed (Round 2)

**kolekto-fe-old:**
- `supabase/functions/verify-paystack-payment/index.ts` — added
  `shouldGenerateUniqueCode()` (legacy-null fallback), switched the
  sequence-number source from in-memory counting to the new atomic RPC
  (with the old counting kept only as a fallback), changed code format to
  `PREFIX-001`.
- `src/components/collections/wizard/CreateCollectionWizard.tsx` — added
  `unique-id` step validation (prefix required when enabled).
- `src/components/collections/wizard/steps/Step6UniqueId.tsx` — copy and
  preview format updated ("Required", `PREFIX-001`).
- `src/components/collections/CreateCollectionForm.tsx` — added
  submit-time validation, prefix sanitization (strip trailing hyphen,
  uppercase).
- `src/components/collections/form/UniqueCodesSection.tsx` — copy,
  placeholder, and preview format updated; removed the trailing-hyphen
  placeholder that could double up with the backend's separator.

**kolekto-be-old:**
- `database/c1_per_prefix_code_counters.sql` (new) — atomic per-prefix
  counter table + function + backfill-seed, fixing the concurrency gap.
- `utils/contributionCodeService.js` — added `shouldGenerateUniqueCode()`
  export; `nextContributorCodeNumber()` now calls the new per-prefix RPC;
  format changed to `PREFIX-001`; MAX-fallback parsing fixed to tolerate
  the new separator.
- `controllers/deposit.js` — three `uniqueIdEnabled` receipt-display
  fields switched to `shouldGenerateUniqueCode()` for consistency.
- `scripts/backfillUniqueContributionCodes.js` — eligibility query now
  includes the legacy-null fallback case; numbering now goes through the
  same atomic RPC in live mode (read-only preview in dry-run, so dry-run
  has zero side effects including on the counter); format changed to
  `PREFIX-001`.

### Why this may still not have worked in your testing

`supabase/functions/verify-paystack-payment/index.ts` is a Supabase Edge
Function. Editing the file in this repo does **not** update the deployed
function — its own header comment says it's "safe to paste directly into
the Supabase web console editor," meaning deploys here are manual (CLI
`supabase functions deploy` or a console paste), and there's no CI step
in this repo that does it automatically. The two new SQL files
(`database/c1_per_prefix_code_counters.sql`, and `b3_...sql` from Round 1
if not already applied) also need to be run in the Supabase SQL editor.
None of that happens by editing the repo file. **If Round 1's fix didn't
show up in testing, this is almost certainly why** — please confirm
whether the function has been redeployed and the SQL migrations applied
since.

---

# Round 1 — Original Fix Report

## Summary

Collections with "Generate unique ID/code for each contributor" enabled
stopped receiving unique codes on new payments, across every collection
type (fixed, tiered, open pool, fundraising, ticketing), for both brand
new collections and pre-existing active ones. Historical contributions
kept their previously-assigned codes (a read-side concern, already fixed
in a prior pass — see `CONTRIBUTOR_DISPLAY_FIX_REPORT.md`). This pass is
about the *write* side only.

## Root Cause (primary, production-affecting)

`supabase/functions/verify-paystack-payment/index.ts` is the live payment
confirmation path — the frontend calls it directly via
`supabase.functions.invoke('verify-paystack-payment', ...)` from
`paymentCallback.tsx` right after a Paystack redirect, and it's also what
the backend's webhook safety net (`invokeVerifyEdgeFunction` in
`kolekto-be-old/controllers/deposit.js`) delegates to for payments it
can't otherwise reconcile. This is where `contributions` rows are actually
inserted with `contributor_unique_code`.

A prior change added a gate so codes are only minted when the organizer
explicitly enabled the feature:

```ts
const prefix = normalizedPayment.uniqueIdEnabled
  ? String(unit.prefix || normalizedPayment.codePrefix || "").trim().toUpperCase()
  : "";
```

`normalizedPayment` comes from `normalizePaymentRequest()`. That function's
return object was never updated to actually include a `uniqueIdEnabled`
field. So `normalizedPayment.uniqueIdEnabled` was **always `undefined`**,
the ternary always took the falsy branch, `prefix` was always `""`, and
`contributor_unique_code` was inserted as `null` on every single
contribution — regardless of what the collection's `unique_id_enabled` /
`code_prefix` columns actually held. This explains every symptom in the
bug report identically: new collections, pre-existing collections, all
types, only the write side, with zero effect on already-stored codes.

Confirmed via `git log -p` on the file: the gate and the missing field
were introduced in the same commit (`8cb02b6`); the field was never added
in any later commit either.

## Root Cause (contributing, would have re-broken the fix)

Even with the edge function fixed, two collection-creation paths were
saving the organizer's toggle incorrectly, so `unique_id_enabled` often
never reached the database as `true` in the first place:

1. **`src/components/collections/wizard/CreateCollectionWizard.tsx`**
   (`buildPayload`) — computed `shouldAssignUniqueIds = unique_id_enabled
   && hasConfiguredUniquePrefix` and saved *that* as `unique_id_enabled`,
   instead of saving the organizer's actual toggle state. An organizer who
   turned the toggle on but hadn't typed a prefix yet (or was using a
   tiered collection, where the single prefix field is hidden in favor of
   per-tier prefixes) had their selection silently downgraded to `false`.

2. **`src/components/collections/CreateCollectionForm.tsx`** (the PWA
   creation form, mounted at `/create-collection` under `pwa-main.tsx`) —
   collected a `generateUniqueCodes` toggle in component state but never
   included it in the payload sent to `createCollection`; only
   `code_prefix` was sent. `unique_id_enabled` was never set by this form
   at all.

## Files Changed

**kolekto-fe-old:**
- `supabase/functions/verify-paystack-payment/index.ts` — added the
  missing `uniqueIdEnabled: Boolean(collection.unique_id_enabled)` to
  `normalizePaymentRequest()`'s return value. This is the fix that matters
  for production.
- `src/components/collections/wizard/CreateCollectionWizard.tsx` — save
  `unique_id_enabled` as the organizer's raw toggle value; `code_prefix`
  is still only populated when a prefix was actually typed.
- `src/components/collections/CreateCollectionForm.tsx` — now sends
  `unique_id_enabled: generateUniqueCodes` alongside `code_prefix`.

**kolekto-be-old:**
- `utils/contributionCodeService.js` (new) — single shared helper
  (`resolveContributionUniqueCode`, `nextContributorCodeNumber`) so the
  unique-code gate and the atomic numbering RPC call exist in exactly one
  place instead of being copy-pasted per call site.
- `controllers/deposit.js` — `verifyPayment` and `handleWebhook` both now
  call `resolveContributionUniqueCode()`, which checks
  `collection.unique_id_enabled` as the authoritative switch (previously
  they checked `collection.code_prefix` alone and never looked at
  `unique_id_enabled`). The duplicated local `nextContributorCodeNumber`
  was removed in favor of the shared helper.
  - Note: this file's contribution-update logic only runs for payments
    that have a legacy `deposits` row (the old
    `initializePayment`-based flow). Current payments go straight through
    the edge function above; `deposits`/`ContributionForm.tsx`/
    `usePaystackStore` are not reachable from any mounted route in this
    repo today. This fix is defense-in-depth / consistency, not the
    production fix — kept because Paystack's webhook can still hit this
    code path for older in-flight payment links, and because the gate was
    simply wrong (checking the wrong field) regardless of traffic volume.
- `controllers/collection.js` — `createCollection` now reads and saves
  `unique_id_enabled` from the request body (it only saved `code_prefix`
  before). This endpoint isn't on the live web/PWA creation path either
  (both go through the `create-collection` Supabase edge function, which
  already handled both fields correctly), but is fixed for any other
  caller (e.g. an admin panel) hitting it directly.
- `scripts/backfillUniqueContributionCodes.js` (new) — backfill script,
  see below.
- `package.json` — added `backfill:unique-codes` script.

## Unique ID Generation Flow (after this fix)

1. Organizer enables the toggle in `Step6UniqueId.tsx` (wizard) or
   `UniqueCodesSection.tsx` (PWA form), optionally setting a prefix
   (collection-level or per pricing tier).
2. `unique_id_enabled` and `code_prefix` are saved on the `collections`
   row by the `create-collection` / `update-collection` edge functions
   (these already round-tripped both fields correctly; only the
   FE-side payload builders were buggy).
3. On successful payment, `verify-paystack-payment` builds one
   `contributions` row per unit (1 per ticket, 1 per fixed/tiered/open
   pool/fundraising payment). For each unit it now correctly evaluates
   `normalizedPayment.uniqueIdEnabled` (`= collection.unique_id_enabled`)
   and, if true, resolves a prefix from the unit's tier/ticket prefix or
   the collection's `code_prefix`. If a prefix is present, it assigns
   `contributor_unique_code = "<PREFIX><sequence>"`, numbered
   per-prefix per-collection from existing paid rows + the current batch.
   If unique IDs are disabled, or no prefix is configured anywhere, the
   column is left `null` — same "no prefix = no ID" behavior the UI has
   always communicated.
4. The legacy backend webhook path (`deposit.js`, only reachable for
   old `deposits`-table-based payments) now uses the same authoritative
   `unique_id_enabled` check via the shared
   `utils/contributionCodeService.js` helper.
5. Display surfaces (`src/utils/contributions.ts`'s
   `getContributionUniqueCode`, collection details contributor tables,
   receipt page, CSV/PDF export) already read `contributor_unique_code`
   (with legacy aliases) — untouched by this pass, since they were never
   the problem.

## Backfill

```bash
cd kolekto-be-old
npm run backfill:unique-codes -- --dry-run   # report only, no writes
npm run backfill:unique-codes                # apply
npm run backfill:unique-codes -- --collection-id=<uuid>  # scope to one collection
```

The script (`scripts/backfillUniqueContributionCodes.js`):
- Selects collections with `unique_id_enabled = true`.
- For each, finds `status = 'paid'` contributions with
  `contributor_unique_code IS NULL`.
- Seeds each prefix's counter from the highest existing numeric suffix
  already used for that prefix in that collection (so it never collides
  with codes minted before/after the regression window).
- Re-checks each row immediately before writing, and writes with
  `.is("contributor_unique_code", null)` as a guard — running it twice
  back to back assigns nothing the second time and never overwrites an
  existing code.
- Skips (and logs) any contribution where neither the matched tier nor
  the collection has a `code_prefix` to build a code from.
- Logs every assignment (or would-assign, in `--dry-run`) plus a summary.

## Verification Performed

- `git log -p` on the edge function confirmed the exact commit that
  introduced the unused `uniqueIdEnabled` reference without ever setting
  it, and that no later commit fixed it.
- Traced every live collection-creation/edit code path
  (`CreateCollectionWizard` → `create-collection` edge function;
  `CreateCollectionForm`/PWA → same edge function; `EditCollectionDialog`
  → `update-collection` edge function) to confirm `unique_id_enabled` and
  `code_prefix` now round-trip consistently everywhere a collection can
  actually be created or edited from this app.
- Confirmed `EditCollectionDialog.tsx`'s update payload never touches
  `unique_id_enabled`/`code_prefix`, so editing other collection fields
  cannot reset an existing collection's unique-ID configuration (task D).
- Confirmed the display/read path (`getContributionUniqueCode` and its
  aliases in `src/utils/contributions.ts`, the receipt page's
  `participant.uniqueCode`, contributor tables, CSV/PDF export) all read
  `contributor_unique_code` off the row the backend returns — no FE
  change needed there; they will reflect correctly-generated codes
  automatically once the write path is fixed.
- `node --check` passed on every edited/new backend file
  (`controllers/deposit.js`, `controllers/collection.js`,
  `utils/contributionCodeService.js`,
  `scripts/backfillUniqueContributionCodes.js`).
- Targeted `tsc --noEmit` against the two edited frontend files showed no
  errors introduced by this change (one pre-existing, unrelated
  `ImportMeta.env` typing note when type-checking the file in isolation).
- **Could not run the full `kolekto-fe-old` `npm run build` or a
  whole-project `tsc` in this environment** — both reproducibly hit
  out-of-memory failures (esbuild service crash / V8 OOM) regardless of
  heap size flags, independent of this change. Recommend running
  `npm run build` in CI/locally before merging to get a full-project
  guarantee.
- **No live database access was available** (the connected Supabase MCP
  account only has an unrelated, inactive project — not
  `busfgcmbndleljklrcbd` / `lpeeckqsltxohppheucz`, the refs in this
  repo's `.env` files). The root cause above is established with very
  high confidence purely from code + git history (the missing field is
  unambiguous), but the backfill script has not been run against
  production. **Run `--dry-run` first and inspect the output before
  applying.**

## What Was Intentionally Not Touched

- Wallet balance, ledger balance, pending/available balance computation
  (`refreshCollectionAndWallets` in the edge function, `updateWalletStats`
  in the backend) — untouched.
- Collection/dashboard totals (`total_contributions`, `net_payment`,
  `gross_payment`) — untouched.
- Withdrawal amount calculation, settlement/payout logic — untouched.
- Payment amount verification (`normalizePaymentRequest`'s amount/fee
  math, the Paystack amount-mismatch check) — untouched; only the
  `uniqueIdEnabled` field was added to that function's return value.
- Ticket/QR check-in logic (`check_in_status`) — untouched; it was never
  gated by `unique_id_enabled` and still isn't.
- Contribution display normalization (`src/utils/contributions.ts` and
  the two Collection Details pages) — already correct from the previous
  fix pass; not modified here.
