# WAVE2_IMPLEMENTATION_REPORT (Phase 2.2 — Edge Runtime Delegation)

**Scope:** Supabase Edge Functions (Deno) only. Node and SQL unchanged.
**Nature:** the Edge Runtime becomes a thin adapter around the Financial
Projection Engine — same as Node did in Wave 1. **One sanctioned behaviour
change** (the completed-withdrawal status convergence); everything else is
byte-identical. Not deployed by this work. Wave 3 not started.

---

## 1. Consumption mechanism — inline-bundle (console-paste-safe)

The edge functions are deployed by **pasting a single self-contained file into
the Supabase console** (confirmed with the maintainer). They cannot import a
shared package or a sibling directory. To give them the ONE canonical engine
without hand-copied duplication, the engine is **inlined as a generated block**:

- New generator `kolekto-shared-financial/scripts/bundle-edge.mjs` (`npm run
  bundle:edge`) flattens the engine source (`src/types|constants|primitives|
  projections.ts`) into a single isolated **IIFE** — `const FPE = (() => { … })()`
  — and injects it between `>>> FPE-ENGINE-INLINE >>>` markers in each edge file.
- The IIFE **isolates the engine's scope**, so each edge file keeps its own
  helpers (`asNumber`, tier matching, `normalizePaymentRequest`, DB recovery)
  with zero name collisions.
- After the block, each file **binds its local names to `FPE.*`**
  (`const calculateFees = FPE.calculateFees`, …) so every existing call site is
  untouched. The engine stays pure (no I/O); it's a generated artifact, canonical
  source stays in `src/`, and equivalence is proven by the vector + differential
  suites.

This mirrors Wave 1's "one canonical source, generated artifact per runtime"
posture — Node got a compiled `dist` vendor; Edge gets an inlined IIFE.

---

## 2. Files changed

| File | Change |
|------|--------|
| `supabase/functions/verify-paystack-payment/_shared1.ts` | Inlined FPE block; `roundCurrency`/`calculateFees`/`allocateAmounts`/`buildTierAvailability`/`getSettlementCutoff`/`COMPLETED_WITHDRAWAL_STATUSES`/`computeWalletBalances` now bound to the engine; hand-written copies removed. Edge-specific helpers + `normalizePaymentRequest` + `reverseCalculateContribution` kept. |
| `supabase/functions/verify-paystack-payment/_shared2.ts` | `refreshCollectionAndWallets` now projects balances via `computeWalletBalances`; the inline net/gross/pending/settled/available/ledger math is gone. **All DB reads/writes and the tier-sold side-effect stay in the adapter.** |
| `supabase/functions/verify-paystack-payment/index.ts` | No change — orchestrator with no inline math; consumes the (now engine-bound) helpers transitively. |
| `supabase/functions/initiate-paystack-payment/index.ts` | Inlined FPE block; `roundCurrency`/`calculateFees`/`buildTierAvailability` bound to the engine; hand-written copies + the now-dead `getInfoRows`/`getTierLabel`/`getTierMatchKey` removed. |
| `supabase/functions/_shared/payment.ts` | **Orphan** (imported by nothing, repo-wide). Marked DEPRECATED/UNUSED with a banner; kept (not deleted) since nothing depends on it. |
| `kolekto-shared-financial/scripts/bundle-edge.mjs` + `package.json` | New `bundle:edge` generator + script. |

Node's `utils/financial.js` adapter, `utils/fpe/` vendor, and the SQL settlement
function are **untouched**.

---

## 3. The one sanctioned behaviour change (status convergence)

`COMPLETED_WITHDRAWAL_STATUSES` on the edge was `{completed, successful}`. It is
now the canonical superset **`{completed, successful, success, approved}`** (what
Node and SQL already use). Effect: `refreshCollectionAndWallets` now counts
`approved` (the admin manual-payout terminal state) and `success` withdrawals as
`withdrawn`, so `available`/`ledger` are correct where the edge previously
**over-reported** available. This is the documented Node/Edge divergence
(FINANCIAL_COMPUTATION_MATRIX row 15) — resolving it is the point of the wave.
No production data has exercised the divergent path, so live drift stays 0; the
`divergence` golden vectors lock the corrected behaviour.

---

## 4. Discovered divergence — `reverseCalculateContribution` (NOT changed)

While verifying, the edge's binary-search `reverseCalculateContribution` was
found to **disagree** with the engine's `deriveNetContribution` by up to **₦19.55**
in the partially-fee-capped region (very large contributor-borne payments;
814/8892 sampled cases). The binary search is actually the *more exact* inverse
there; the engine's one-step-refine (lifted from Node) evaluates fees at the
estimate, not the true value.

Because this is a **second, unsanctioned** divergence (Wave 2 permits only the
status convergence), `reverseCalculateContribution` was **left as an edge-local
function** — behaviour preserved. It is a rare metadata-loss fallback. Flagged
for an explicit canonical-algorithm decision in `WAVE3_READINESS_REPORT.md`
(finding **R-REV**). This is exactly the kind of latent difference the
differential validation exists to surface.

---

## 5. Responsibility split (honoured)

- **Engine (inlined):** roundCurrency, fees, settlement cutoff, wallet
  projection, normalization, allocation, tier availability, constants/status sets.
- **Edge adapter (kept):** Supabase reads/writes, wallet UPSERT, the collection
  `total_contributions` + `price_tiers` (tier-sold) write, receipt rendering +
  email, Paystack calls, retries, logging, `normalizePaymentRequest` validation,
  collectionId/contributor recovery strategies, `reverseCalculateContribution`.

The engine remains pure — no I/O, no Supabase, no `Deno`, no `fetch`, no logging.

---

## 6. Rollback

- Per file: `git revert` the edge file(s); each is independent. Redeploy the
  previous console-paste version (Supabase keeps function versions).
- The inlined block is regenerable at any time: `npm run bundle:edge`.
- No SQL, no Node, no DB change to roll back.

Validation: **`WAVE2_VALIDATION_REPORT.md`**. Next wave: **`WAVE3_READINESS_REPORT.md`**.
