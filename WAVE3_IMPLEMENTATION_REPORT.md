# WAVE3_IMPLEMENTATION_REPORT (Phase 2.2 — SQL Mirror Lockstep)

## Executive Summary
SQL is now the third runtime formally bound to the Financial Projection Engine —
as a **proven mirror**, not an independent implementation. The deployed
`settlement_recompute_wallets()` / `settlement_cutoff()` already computed
identically to the engine; Wave 3 **proved** it (16/16 conformance vectors +
57/57 live wallets, 0 drift on the test project) and **annotated** the mirror.
**No SQL math was changed** — there was no verified drift to fix. One latent,
unreachable difference was documented (R-COALESCE).

## Files Modified
- `kolekto-be-old/database/settlement_recompute.sql` — **annotation only**
  (comments): a `MIRRORS kolekto-shared-financial@0.1.0` header + per-function
  `-- MIRRORS …` notes on `settlement_cutoff()` and
  `settlement_recompute_wallets()`. No executable SQL changed.

Nothing else touched. The deployed DB function was **not** redeployed (it already
matches the engine; annotation lives in the version-controlled source).

## Decisions Made
1. **Prove, don't change.** The deployed SQL matched the engine on every vector
   and all live wallets → per the roadmap, proved equivalence instead of editing.
2. **Annotate source, not the live function.** The MIRRORS annotation is a
   comment; redeploying the function just to add a comment is an unnecessary
   write to the test DB. The version-controlled file is the record of truth.
3. **R-COALESCE latent difference — documented, NOT fixed.** The SQL gross
   fallback `coalesce(gross_amount, amount, 0)` treats an *explicit* `0`
   gross_amount as `0`, whereas the engine's `gross_amount || amount` (JS falsy)
   would fall back to `amount`. This only diverges for a row with
   `gross_amount = 0` AND `amount > 0` — **which does not exist**: all 185 paid
   contributions have a positive `gross_amount` (0 null, 0 zero). `verify` always
   writes a positive `gross_amount`. Unreachable → not verified drift → left
   unchanged. Tracked for a future canonical-behaviour decision.
4. **`reverseCalculateContribution` (R-REV from Wave 2)** is a payment-path
   estimator, not part of settlement; SQL settlement uses the engine's
   `deriveNetContribution` one-step-refine (same `est→refine` capped inverse),
   so SQL and engine agree there. R-REV remains an edge-only open item.

## Validation Results
See `WAVE3_VALIDATION_REPORT.md`. Headline: **16/16 synthetic conformance
vectors pass; 57/57 live wallets engine-conformant; 0 drift** on test project
`lpeeckqsltxohppheucz`. Engine (104/104) and backend (63/63) remain green.

## Risks
- **R-COALESCE** (low, unreachable): explicit-zero gross fallback differs; no such
  data exists. Revisit only if a write path could ever emit `gross_amount = 0`.
- **R-REV** (medium, rare): edge reverse-calc vs engine deriveNet divergence in
  the capped region — unchanged, edge-only. Decision still pending.
- Conformance was proven against the **test project only**; a PROD flip remains a
  separate, approved step.

## Rollback Strategy
Annotation is comment-only: `git revert` the `settlement_recompute.sql` change.
No migration, no deployed-function change, nothing to un-apply on the database.

## Next Recommended Action
Proceed to **Wave 4** (cleanup + guardrail) — done in this same milestone: remove
dead code and add a CI grep-gate so no runtime can reintroduce local financial
math. A PROD conformance run + the R-REV/R-COALESCE decisions remain for an
explicitly-approved production step.
