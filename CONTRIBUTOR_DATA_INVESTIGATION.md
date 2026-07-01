# Contributor / Collection Data Display — Investigation Report

Date: 2026-06-23

## Summary

The public Contributors flow (`ContributeFlow.tsx` → `initiate-paystack-payment` →
Paystack → `verify-paystack-payment`) writes contributor data correctly and
consistently into `contributions.contributor_information`, including the
selected pricing tier (`Tier` / `TierId`), custom form-field values, and
receipt metadata. **The bug is not in how data is collected or saved — it is
in how two of the display surfaces re-derive the tier for an existing
contribution.**

Two screens matched a contribution to its pricing tier by comparing
`tier.price` against `contribution.amount` using exact/near equality. That
match silently breaks whenever the collection's fee settings cause
`contribution.amount` to differ from the tier's listed price — which is the
common case, not an edge case (see Root Cause below). When the match fails,
the UI either showed a blank tier, the wrong tier, or fell back to printing
the raw amount instead of the tier name.

## Root Cause

`contributions.amount` is the **net** amount credited to the organizer, not
the tier's list price. Per `supabase/functions/verify-paystack-payment/index.ts`:

- `feeBearer = "organizer"` (the system default, see `Step4Charges.tsx` and
  every edge-function fallback `... || "organizer"`) → fees are deducted from
  the tier price before being stored: `amount = tierPrice - platformFee - gatewayFee`.
- `feeBearer = "contributor"` → `amount = tierPrice` exactly (fees are added
  on top and paid separately by the contributor).

So for any tiered or ticketed collection where the organizer absorbs fees
(the default), `contribution.amount` is always a few percent **less** than
`tier.price`. Code that tries to re-identify the tier by comparing
`tier.price` to `contribution.amount` will not find a match.

The verify edge function already solves this correctly at write time — it
stores the resolved tier name directly on the row:
`contributor_information[0].Tier` (and `.TierId`). That field is the
authoritative source for "which tier did this contribution belong to," and
should always be preferred over reverse-deriving it from the amount.

One existing helper, `getTierForContribution()` in
`CollectionDetailsPage.tsx`, already did this correctly (check
`contributor_information[0].Tier` first, fall back to amount-tolerance
matching only as a legacy fallback). But three other call sites in the same
file, plus the organizer-facing PWA admin page, used a second,
amount-only helper instead — so the **same dataset showed correct tier names
in the Contributors tab/export, and wrong or blank tier names in the
Tickets tab, Activities feed, QR scan dialog, and the PWA app's Contributors
table**, depending purely on which helper happened to be wired up.

## Files Inspected

Frontend:
- `src/components/contribute/ContributeFlow.tsx` — public contribution form, payload construction
- `src/store/useContributionStore.ts`, `src/store/useCollectionStore.ts`
- `src/pages/contribute/ContributePage.tsx`, `src/components/contribute/ContributionWrapper.tsx` / `ContributionForm.tsx` (confirmed legacy/unrouted — not part of the live flow)
- `src/utils/contributions.ts` — shared field/name/tier normalization helpers
- `src/pages/dashboard/CollectionDetailsPage.tsx` — organizer dashboard (desktop)
- `src/pages/pwa/pages/CollectionDetails.tsx` — organizer PWA app ("admin" mobile view)
- `src/components/collections/form/ContributorFieldsSection.tsx`, `src/components/collections/wizard/steps/Step5ContributorFields.tsx` — confirmed field `id`/`name` generation matches what the display helpers expect
- `src/components/collections/ContributionPreview.tsx` — confirmed preview-only, no live data involved

Backend / Edge Functions:
- `supabase/functions/initiate-paystack-payment/index.ts`
- `supabase/functions/verify-paystack-payment/index.ts` (writes `contributions` rows, wallet recompute)
- `kolekto-be-old/controllers/deposit.js`, `kolekto-be-old/controllers/contribution.js`, `kolekto-be-old/controllers/payment.js` (legacy Express path — confirmed it mirrors the same column names; not the active path for the current FE, which calls the Supabase edge functions directly)

## What Was Fixed

All fixes are display-only — no changes to fee calculation, wallet balances,
withdrawal logic, or how contributions are written to the database.

1. **`src/pages/dashboard/CollectionDetailsPage.tsx`**
   - Removed the amount-only `getTierForAmount()` helper.
   - Switched its 3 remaining call sites — the **Tickets tab**, the
     **Activities feed**, and the **QR ticket-scan dialog** — to use the
     existing, correct `getTierForContribution()` helper (prefers the stored
     `Tier` name, falls back to amount-tolerance matching only for legacy
     rows that predate the field).
   - The Contributors tab and PDF export already used the correct helper and
     were not changed.

2. **`src/pages/pwa/pages/CollectionDetails.tsx`** (organizer PWA app)
   - `getTierNameFromAmount()` previously did a strict `tier.price === amount`
     match with no fallback to the stored tier name at all — the most severe
     instance of this bug. Replaced it with the same "stored Tier name first,
     tolerant amount match as fallback" logic, exposed via a new
     `getTierForContribution()` helper plus a thin `getTierNameFromAmount()`
     wrapper (kept for minimal diff at the 3 call sites: tier filter, PDF
     export, and the Contributors table's Tier column).

No backend or edge-function changes were made — the data being written was
already correct; only the read-side tier lookup was fixed.

## Payload / Schema Mismatches Found

None that affect the live path. Specifically checked and confirmed
consistent end-to-end:
- Custom field keys: `ContributorFieldsSection.tsx` assigns `field.id` (timestamp-based) and `field.name` (display label) when an organizer builds a form. `ContributeFlow.tsx` stores submitted values keyed by `field.id` under `contributor_information[0].__fieldValues`, plus display-name keys at the top level. `getContributorFieldValue()` in `utils/contributions.ts` looks up by `field.id`, `field.name`, and aliases against both `__fieldValues` and the top-level object — all three layers agree on key shape.
- Contributor identity columns: `name` / `email` / `phone` (not `contributor_name` / `contributor_email` / `contributor_phone` — those are legacy aliases normalized for backward compatibility in `normalizeContribution()`, never the source of truth on the live write path).
- Tier identity: `contributor_information[0].Tier` / `.TierId`, written by the verify edge function, read by `getTierForContribution()`.

One latent risk noted but **not changed** (out of scope / not the reported
symptom, and changing it touches the Paystack metadata contract rather than
display logic): `initiate-paystack-payment/index.ts` truncates
`formDataJson` to 1800 characters before sending it to Paystack as
transaction metadata. Collections with many custom fields and long answers
could have their `formData` silently truncated mid-JSON, which `verify-paystack-payment`'s
`safeJsonParse` would then fail to parse, resulting in an empty
`contributor_information` for that single contribution. This would look like
"submitted details didn't save" rather than "wrong details displayed," and
only affects unusually large forms. Flagging for awareness; recommend a
follow-up if organizers report missing (not wrong) custom field data on
forms with many fields.

## Testing Performed

- `npm run build` — succeeds, no TypeScript/build errors introduced.
- Static trace of the full data path for all 5 collection types (fixed,
  tiered, open_pool, ticket, fundraising) from `ContributeFlow.tsx` →
  `initiate-paystack-payment` → Paystack → `verify-paystack-payment` →
  `contributions` row → each display surface, confirming the stored `Tier`
  field is now read consistently everywhere it's shown.
- Confirmed `ContributionWrapper`/`ContributionForm` (the older payload
  shape that uses `contributor_name`/`contributor_email`) is not mounted by
  any route — `App.tsx` only routes `/contribute/:collectionId` to
  `ContributePage` → `ContributeFlow`, so it cannot be the source of
  production data inconsistency.
- Did not have access to a live Paystack test key / Supabase project in this
  environment, so could not run a real end-to-end payment for each
  collection type.

## What You Still Need To Do Manually

1. Run one real (test-mode) payment through each collection type — fixed,
   tiered, open_pool, ticket, fundraising — with `fee_bearer = organizer`
   (the default) and confirm the Tickets tab, Activities feed, QR scan
   dialog, and the PWA app's Contributors tab all now show the correct tier
   name instead of a blank value or the raw amount.
2. Spot-check a handful of **existing/historical** paid contributions for
   tiered or ticket collections that predate this fix — the fallback
   amount-tolerance match (`< ₦1`) is still used for any old row that has no
   `Tier` value stored in `contributor_information`, and will still show "—"
   for those if the organizer absorbed fees. If you have many such rows and
   want their tier re-attributed, that would need a one-off backfill script,
   not a code change (out of scope here since it touches historical data).
3. If you've seen contributors with completely **missing** custom-field
   answers (not just a missing tier label) on forms with several fields,
   check `formDataJson` truncation per the "latent risk" note above — that
   would need a separate, small fix to the Paystack metadata payload size,
   not the tier display fix.
4. Deploy the updated `verify-paystack-payment` / `initiate-paystack-payment`
   edge functions are **unchanged** in this pass — no redeploy needed for
   them. Only the two frontend files listed under "What Was Fixed" need to
   ship.
