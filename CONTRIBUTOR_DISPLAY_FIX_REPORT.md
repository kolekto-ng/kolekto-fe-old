# Contributor Display Fix Report — Missing Contributor Data on Collection Details

Date: 2026-06-23

## Summary

On the Collection Details page's Contributors section, some contributors
showed blank/missing details even though the underlying row exists. The
contributors are never actually filtered out of the list — the display
layer simply had narrow, single-shape assumptions about where a
contributor's submitted data lives. Any row that deviated even slightly
from the exact current shape (a different container key, a `name`/`amount`
column under a different alias, a stringified JSON column instead of a
parsed array, custom-field definitions keyed by `label` instead of `name`)
rendered as empty cells instead of falling back to another known shape.

This pass hardens the normalization layer on both the frontend and the one
backend endpoint that serves contributor lists, and replaces silent blank
cells with an explicit **"Not provided"** fallback, without ever hiding the
contributor row itself.

## Root Cause

1. **Single-container assumption.** `getContributionInformationObject()` only
   ever read `contributor_information[0]` (or `contact_info` as a single
   fallback). Any row that stored its custom-field answers under a
   differently named column (`metadata`, `customFields`, `formData`,
   `answers` — all plausible names from earlier iterations of the schema)
   was treated as having *no* custom field data at all.
2. **No tolerance for double-encoded JSON.** If a jsonb-typed column ever
   came back from Supabase as a JSON string instead of a parsed
   array/object (e.g. an older write path that called `JSON.stringify()`
   before insert), `Array.isArray()` / `typeof === 'object'` checks failed
   silently and the field was treated as missing.
3. **Field-definition key rigidity.** `getCollectionContributorFields()` only
   recognized `field.name`. A field definition stored with `label` or
   `field_name` instead (an earlier iteration of the form-builder UI, or a
   manually-inserted row) was filtered out, which could zero out the whole
   **visible fields list** for that collection — making the Contributors
   table show "No host-defined contributor fields" even though the
   contributor genuinely submitted data.
4. **Blank-on-missing instead of explicit fallback.** Every display surface
   used `value || '-'` or rendered the raw (possibly empty) string directly,
   so a missing field was indistinguishable from a rendering bug — both
   just looked blank.
5. **Tier name resolution only checked one key (`Tier`).** Already
   partially fixed in the previous pass; this pass extends it to also
   recognize `tierName` / `tier_name` aliases.

None of this affects how *new* contributions are written — the Paystack
verify edge function already writes a single, consistent shape. The risk is
entirely about *reading* older/edge-case rows correctly.

## Files Inspected

Frontend:
- `src/utils/contributions.ts` — shared normalization helpers (main fix location)
- `src/pages/dashboard/CollectionDetailsPage.tsx` — desktop Collection Details / Contributors tab
- `src/pages/pwa/pages/CollectionDetails.tsx` — PWA/admin Collection Details / Contributors tab
- `src/store/useContributionStore.ts` — confirms `/contributions` response is run through `normalizeContributions()` before reaching the PWA page
- `src/components/collections/form/ContributorFieldsSection.tsx`, `src/components/collections/wizard/steps/Step5ContributorFields.tsx` — confirmed current field-builder always writes `{id, name, type, required}`; the `label`/`field_name` fallback in this fix is for older/out-of-band records only

Backend:
- `kolekto-be-old/controllers/contribution.js` — `getContributions`, the only endpoint that lists raw contributor rows for display (used by the PWA app via `/contributions`)
- `kolekto-be-old/routes/contribution.js` — confirms the route wiring
- Confirmed the desktop dashboard's Collection Details page talks to Supabase **directly** (not through this Express endpoint) for its contributor list — both paths now go through equivalent normalization logic, just implemented once on each side of that split.
- `supabase/functions/verify-paystack-payment/index.ts` — re-confirmed (no changes) that the *write* path already produces one consistent shape; this pass does not touch it.

## Data Shapes Found / Hardened Against

| Field | Canonical (current) | Aliases now tolerated |
|---|---|---|
| Name | `name` | `contributor_name`, `full_name`, `fullName`, `contributorName` |
| Email | `email` | `contributor_email`, `contributorEmail` |
| Phone | `phone` | `contributor_phone`, `phoneNumber`, `contributorPhone` |
| Amount | `amount` | `paidAmount`, `paid_amount`, `totalAmount`, `total_amount`, `amount_paid` (only used if `amount` itself is missing) |
| Payment ref | `payment_reference` | `payment_id`, `paymentReference`, `transactionRef` |
| Unique code | `contributor_unique_code` | `uniqueCode`, `ticket_code`, `ticketCode` |
| Custom field container | `contributor_information` (array) | `contact_info`, `metadata`, `customFields`, `custom_fields`, `formData`, `answers` — array or single object, and JSON-string-encoded variants of any of these |
| Tier name | `contributor_information[0].Tier` | `tierName`, `tier_name` |
| Tier id | `...TierId` | `tierId`, `tier_id` |
| Quantity | `...Quantity` | `quantity`, `ticketQuantity`, `ticket_quantity` |
| Field definition label | `field.name` | `field.label`, `field.field_name` |

All of these were confirmed as *plausible* legacy shapes from reading prior
iterations of the form-builder and payment code in this repo's history
(comments referencing renamed columns, e.g. `contributor_name` →
`name`/`email`/`phone`, were already present in `utils/contributions.ts`
before this change) — not from direct production DB access, which this
environment doesn't have. See "Manual Production Action Needed" below.

## What Was Fixed

All changes are read/display-side only. No change to wallet balance,
collection totals, dashboard totals, withdrawal calculation, or payment
verification logic.

### `src/utils/contributions.ts`
- `getContributionInformation()` now checks 7 possible container keys
  (was 2) and parses JSON-string-encoded values defensively.
- `getContributionInformationObject()` now merges **every** entry in the
  info array (gap-filled, left-to-right) instead of only reading index `[0]`.
- Added `getContributionAmount()`, `getContributionTierName()`,
  `getContributionTierId()`, `getContributionQuantity()` — single source of
  truth for these lookups, reused by both Collection Details pages instead
  of each having its own inline (and previously inconsistent) logic.
- `getContributorFieldValue()` gained a final case-insensitive,
  whitespace/underscore-insensitive key-matching pass as a last resort
  before giving up, while explicitly excluding internal/reserved keys
  (`_receipt`, `_payer`, `Tier`, `Quantity`, etc.) so that fallback can never
  leak internal metadata into a "custom field" cell.
- `getCollectionContributorFields()` now also accepts `field.label` /
  `field.field_name`, and tolerates `form_fields`/`contributions_fields`
  arriving as a JSON string.
- Added `formatContributorValue(value)` → returns `"Not provided"` for
  null/undefined/empty, otherwise the trimmed value. This is the new
  standard way to render any contributor field; it never affects whether a
  row is shown, only what an individual cell says.
- `normalizeContribution()` now also derives `tier_name`, `tier_id`, and
  `quantity` onto the row, and only fills `amount` from an alias if `row.amount`
  itself is missing (never overwrites a real value).

### `src/pages/dashboard/CollectionDetailsPage.tsx`
- Contributors table custom-field cells, Tickets tab buyer name/email,
  Activities feed display name, and the QR scan dialog now render
  `formatContributorValue(...)` instead of the raw possibly-empty value or a
  bare `-`.
- `getTierForContribution()` now delegates tier-name lookup to the shared
  `getContributionTierName()` helper (covers more aliases than the previous
  inline `c.contributor_information?.[0]?.Tier` check).
- PDF export uses the same fallback text for consistency between what's
  shown on screen and what's exported.

### `src/pages/pwa/pages/CollectionDetails.tsx`
- Same `formatContributorValue()` fallback applied to the Contributors
  table, PDF export, and Activity tab.
- Tier lookup now goes through the shared `getContributionTierName()`
  helper instead of a local, narrower check.

### `kolekto-be-old/controllers/contribution.js` + new `kolekto-be-old/utils/contributionNormalize.js`
- Added `normalizeContributorRow(s)` — a backend-side mirror of the
  frontend normalization (same alias tables, same container fallback,
  same JSON-string tolerance).
- `getContributions` now runs its result through this normalizer before
  responding, so `/api/contributions` (used by the PWA app via
  `useContributionStore`) returns one consistent shape regardless of which
  legacy/alternate column names a given row happens to have.
- This endpoint already had its result re-normalized a second time on the
  frontend (`useContributionStore.fetchContributions` calls
  `normalizeContributions()`); running normalization on both sides is
  intentionally redundant/idempotent — harmless, and keeps the API
  consumable directly by any other client without relying on FE-side logic.
- No other backend endpoint lists raw contributor rows for display
  (`dashboard.js` / `withdrawal.js` use the `contributions` table only for
  financial aggregation, which this fix does not touch).

## Verified Not Affected

- Wallet balance, ledger balance, pending/available balance — untouched
  (`utils/financial.js`, `updateWalletStats`, edge-function wallet recompute
  not modified).
- Collection/dashboard totals — `totalRaised` etc. still sum the real
  `amount` column directly; the new `getContributionAmount()` fallback only
  ever fires when `row.amount` is itself null/undefined, which does not
  happen for any row produced by the current write path.
- Withdrawal logic — not touched.
- Payment verification / Paystack webhook / edge functions — not touched;
  this pass is read-side only.
- Contributor filtering: `getFilteredContributors()` / `applyFilters()`
  search logic was reviewed and not changed — it already null-safely
  optional-chains every field, and only filters when the user actively
  types a search term or selects a tier filter. No contributor can
  disappear from the list due to a missing field.

## Testing Performed

- `npm run build` — succeeds, no TypeScript/build errors.
- `node --check` on both new/edited backend files — syntax valid.
- Manually traced each alias path added in this pass against the actual
  shapes the live Paystack verify edge function and `ContributeFlow.tsx`
  produce today, to confirm none of the new fallback branches change
  behavior for current-shape data (every alias check only fires when the
  canonical field is absent).
- Re-confirmed (from the prior investigation in this repo) that the
  legacy `ContributionWrapper` / `ContributionForm` components are not
  mounted by any route, so they cannot be writing a conflicting shape in
  production today.

## What You Still Need To Do Manually

1. **No live database access was available in this environment.** The
   alias list above is based on plausible legacy shapes inferred from code
   history (comments, old type definitions, earlier helper functions found
   already in `utils/contributions.ts`), not a direct query of production
   data. Recommend running a one-off read-only query against the
   `contributions` table for rows where `contributor_information` is null/
   empty AND the contribution is `status = 'paid'`, to see whether any of
   the new alias columns (`metadata`, `customFields`, `contact_info`, etc.)
   actually exist and are populated on those rows. That will tell you
   definitively whether this fix resolves the specific records you're
   seeing, or whether there's a different/unknown shape still to handle.
2. Spot-check a few real "blank" contributor rows from production through
   the updated Collection Details page (both desktop and PWA) to confirm
   they now show either real data or "Not provided" — not blank.
3. If the one-off query above reveals a shape not covered by this fix
   (e.g. a totally different column name), it's a one-line addition to the
   alias arrays in `src/utils/contributions.ts` and
   `kolekto-be-old/utils/contributionNormalize.js` — no architecture change
   needed.
4. Deploy: the only backend change is `controllers/contribution.js` +
   the new `utils/contributionNormalize.js` — no edge function redeploy
   needed, no migration needed.
