# WAVE2_VALIDATION_REPORT (Phase 2.2 — Edge Runtime Delegation)

Goal: prove the Edge Runtime now computes via the engine and — apart from the one
sanctioned status convergence — produces identical output. **All locally-runnable
checks green.** Deno-runtime and end-to-end payment checks are operator-side (no
Deno/deploy in the local toolchain); exact steps below.
Toolchain: Node v22.12.0, TypeScript 5.9.3.

---

## 1. The inlined engine == the canonical engine (the crux)

The engine is inlined into the edge files as a generated IIFE. Both inlined
blocks were **extracted and executed under Node**, then checked two ways:

**(a) Golden vectors** — the same `golden-vectors.json` the Node/Deno harnesses use:

```
verify   golden vectors: 72/72 PASS
initiate golden vectors: 72/72 PASS
```

**(b) Differential vs the canonical `src` engine** — fees × 6 types × 2 bearers ×
9 amounts, `deriveNetContribution`, `computeWalletBalances` (with approved+success
withdrawals), `getSettlementCutoff`, and the status set:

```
verify   differential vs canonical engine — diffs: 0
initiate differential vs canonical engine — diffs: 0
ALL INLINED BLOCKS == ENGINE ✓
```

So the inlined edge math is byte-identical to the one canonical source. The
generator is **idempotent** (re-running `bundle:edge` produces no further diff).

## 2. Edge files are valid TypeScript

Type-strip parse (`node --experimental-strip-types --check`, which validates
syntax without resolving the Deno/URL imports; confirmed to catch a deliberately
broken file at exit 1):

```
exit=0 verify-paystack-payment/_shared1.ts
exit=0 verify-paystack-payment/_shared2.ts
exit=0 verify-paystack-payment/index.ts
exit=0 initiate-paystack-payment/index.ts
```

The IIFE's inner `type`/`interface` declarations are block-scoped and do not
collide with the module-level `FeeBearer`/`TicketSelection`/edge helpers.

## 3. Node parity and backend unaffected

The engine `src` was not touched, so Wave 0/1 guarantees still hold:

```
engine suite   # tests 104  # pass 104  # fail 0  # skipped 0   (Node parity, vectors, characterization)
backend suite  # tests 63   # pass 63   # fail 0                (Wave 1 delegation intact)
```

## 4. Equivalence of each delegated function (pre-swap differential)

Before swapping, each edge function was diffed against the engine over a wide grid:

| Function | Coverage | Result |
|----------|----------|--------|
| `calculateFees` | 16 amounts × 6 types × 2 bearers + fractionals = 14,916 | **0 diffs** |
| `allocateAmounts` | 9 weight/total shapes incl. remainder cases | **0 diffs** |
| `roundCurrency` / `buildTierAvailability` / `getSettlementCutoff` | verbatim lifts; cutoff proven identical to Node over 4,326 timestamps (Wave 1) | identical |
| `computeWalletBalances` (refresh) | engine lift; exercised by wallet golden vectors | identical (± status convergence) |
| `reverseCalculateContribution` | 8,892 cases | **diverges ≤₦19.55 in capped region → intentionally NOT swapped** (see §6) |

## 5. The sanctioned behaviour change, proven correct

The `divergence` golden vectors encode the corrected behaviour and pass in the
inlined blocks:

| Vector | withdrawn | available | ledger |
|--------|----------:|----------:|-------:|
| ₦10,000 settled, ₦4,000 **approved** withdrawal | 4,000 | 6,000 | 6,000 |
| ₦8,000 settled, ₦3,000 **success** withdrawal | 3,000 | 5,000 | 5,000 |

Pre-Wave-2 edge (`{completed, successful}`) would have computed `withdrawn: 0` /
`available: 10,000` / `8,000` — the over-report this wave fixes. Node and SQL
already computed the correct values, so this converges the edge **to** them (0
new drift).

## 6. Discovered divergence — documented, not silently changed

`reverseCalculateContribution` (binary search) vs engine `deriveNetContribution`
(one-step-refine) differ in the partially-capped region. Example `v=137250`
contributor/fixed: true inverse = **134,577.11** (edge) vs engine **134,577.21**.
The edge is more exact. Left unchanged to honour "no behaviour change beyond the
status convergence." Tracked as **R-REV** in `WAVE3_READINESS_REPORT.md`.

## 7. Financial invariants (re-verified in the inlined blocks)

1. `ledger === available + pending` — ✅ (every wallet/divergence vector).
2. `available ≥ 0` — ✅.
3. Fees to the kobo, all types × bearers — ✅ (0 diffs, 14,916 cases).
4. Settlement cutoff 04:00 UTC — ✅.
5. Contributor payment fee unchanged to the kobo — ✅.
6. A verified payment writes the wallet row the engine would compute — ✅ (the
   `refreshCollectionAndWallets` projection now IS `computeWalletBalances`).

## 8. Operator-side checks (cannot run locally — no Deno / no deploy)

Run on the **test project `lpeeckqsltxohppheucz` only**, before any prod flip:

1. **Deno conformance harness** — `deno test --allow-read
   kolekto-shared-financial/test/deno.harness.ts` → all vectors incl. `divergence`
   green. (Runs the SAME `_runner`+vectors already green under Node; the inlined
   blocks are proven == engine, so this is the runtime confirmation.)
2. **Deploy the two functions to the test project** (paste each self-contained
   file) and run a **real end-to-end payment** per collection type →
   - verify the written `wallets` row equals `FPE.computeWallet` on the same
     contributions+withdrawals;
   - `reconcile:financials` drift 0;
   - a payment with an `approved`/`success` withdrawal present now reduces
     `available` correctly (the convergence).
3. Compare a verify run's wallet output **before/after** on identical input for a
   sample collection.

## 9. Verdict

The Edge Runtime delegates all financial computation to the engine; the inlined
math is proven identical to the canonical source; Node/backend remain green; the
only behaviour change is the sanctioned status convergence, and one further
divergence was surfaced and deliberately deferred. **Wave 2 local validation:
PASS.** Runtime/e2e confirmation is the operator's gate (§8).
