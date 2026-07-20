# WAVE2_READINESS_REPORT (Phase 2.2 — Edge Delegation next)

Gate between Wave 1 (Node delegation, **complete**) and Wave 2 (Edge/Deno
delegation). **Do not start Wave 2 without explicit approval.**

---

## 1. State after Wave 1

- **Node backend** delegates all financial math to the engine; `financial.js` is
  an adapter; 63/63 backend tests green; differential parity identical; 0 drift.
- **Engine** now ships in two forms from one source: canonical TS
  (`kolekto-shared-financial/src`) and a compiled ESM build (`dist/`, vendored to
  `kolekto-be-old/utils/fpe/`). A `build` + `vendor:backend` pipeline exists.
- **Edge (Deno)** and **SQL** are **unchanged** — they still run their own local
  math. That is Wave 2 / Wave 3.

## 2. Is Wave 2 ready to begin?

**Yes, once approved.** The prerequisites are in place:

- The engine is proven equivalent to the reference and is Deno-consumable (pure,
  type-erasable TS, `.ts` import specifiers → native Deno import).
- The Deno conformance harness (`test/deno.harness.ts`) already imports the engine
  + the shared `golden-vectors.json`; running it in Deno is the Wave 2 proof.
- The divergence the edge must resolve is captured in the `divergence` golden
  vectors and documented.

## 3. Wave 2 scope (from FPE_EXECUTION_PLAN)

Replace edge-local math with engine imports in:
`supabase/functions/_shared/payment.ts`, `verify-paystack-payment/_shared1.ts`,
`_shared2.ts`, `initiate-paystack-payment/index.ts`. Replace
`roundCurrency / calculateFees / allocateAmounts / buildTierAvailability /
normalizePaymentRequest / getSettlementCutoff / reverseCalculateContribution` and
the wallet recompute in `refreshCollectionAndWallets` with engine calls. Deploy
to the **test project only**.

## 4. Risks / discoveries

| # | Risk / discovery | Severity | Handling in Wave 2 |
|---|------------------|----------|--------------------|
| R1 | **Edge completed-withdrawal set diverges** — edge `_shared1.ts` uses `{completed, successful}`; engine/Node/SQL use the superset `{…, success, approved}`. | High (latent) | Adopting the engine *resolves* it. The `divergence` vectors (approved/success) fail the old edge set and pass the engine — that is the intended, documented fix. **This is a behaviour change on the edge write path** and must ship to the test project first with an explicit before/after wallet compare. |
| R2 | **Deno consumption mechanism** — import map vs vendored copy for the edge functions. | Medium | Decide at Wave 2 start. The engine needs no transpceli; a Deno import map entry or a vendored `.ts` copy both work. Keep one canonical source. |
| R3 | **`reverseCalculateContribution` algorithm differs** — edge uses binary search; engine (lifted from Node) uses one-step-refine. Outputs match on vectors. | Low | Replace edge binary search with engine `deriveNetContribution`; vectors confirm parity. |
| R4 | **`refreshCollectionAndWallets` side-effect** — writes tier-sold counts as well as balances. | Medium | Keep the side-effect in the edge adapter (L3); source *balances* from `FPE.computeWallet` only. Do not move I/O into the engine. |
| R-D | **Dashboard reporting sub-category** (`successfulWithdrawals` uses `{success,successful,completed}`, excludes `approved`). Discovered in Wave 1; **left unchanged** (it is a display breakdown, not a balance; the headline `withdrawn` is canonical). | Low | Not an edge concern. Revisit only if a later wave unifies reporting categories — under explicit approval, since it would change a displayed number. |
| R5 | **Vendored-build drift** (Node) — someone edits `utils/fpe/` by hand. | Low | Generated banner + README warn against it; the differential parity suite catches drift. Wave 4 grep-gate will enforce it. |

## 5. Checklist to begin Wave 2

- [ ] Approval to modify Edge functions (this report's gate).
- [ ] Choose the Deno consumption path (import map vs vendored `.ts`) — R2.
- [ ] Import the engine into `_shared/payment.ts`, `_shared1.ts`, `_shared2.ts`,
      `initiate-paystack-payment/index.ts`; delete the edge-local duplicates.
- [ ] Point `refreshCollectionAndWallets` balances at `FPE.computeWallet`; keep
      the tier-sold write as an adapter side-effect — R4.
- [ ] Run `test/deno.harness.ts` under Deno → all vectors green, **including the
      `divergence` vectors** (proves R1 resolved).
- [ ] Deploy to test project `lpeeckqsltxohppheucz` **only**; run a real
      end-to-end payment → verify the `wallets` row equals `FPE.computeWallet`;
      reconcile drift 0; before/after wallet compare on identical input.
- [ ] Do **not** touch SQL (Wave 3) or flip production.

## 6. Entry gate

Wave 1 reconcile shows drift 0 and the conformance suite is green (Node side
done; §1). **Wave 2 begins only on explicit approval**, on the test project only,
with the edge divergence resolution verified before any wider rollout.
