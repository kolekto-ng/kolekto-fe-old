# WAVE0_VALIDATION_REPORT (Phase 2.2 — Financial Projection Engine)

All Wave 0 validation ran on the local toolchain (Node v22.12.0, TypeScript
5.9.3). **0 drift. 0 failures. 0 skipped.**

---

## 1. Golden-vector results (Node harness)

`node --experimental-strip-types test/node.harness.ts`

```
── kolekto-shared-financial · Node golden-vector harness ──
  ✓ fees                       13/13
  ✓ deriveNet                  7/7
  ✓ cutoff                     6/6
  ✓ isSettled                  4/4
  ✓ allocate                   6/6
  ✓ wallet                     13/13
  ✓ wallet:invariant           13/13
  ✓ divergence                 2/2
  ✓ divergence:invariant       2/2
  ✓ withdrawalEligibility      4/4
  ✓ tiers                      2/2
                               ─────
  ✓ PASS  total 72/72
```

## 2. Full test suite (`node --test`)

`node --experimental-strip-types --test test/*.test.ts`

```
# tests 104
# pass 104
# fail 0
# skipped 0
```

The 104 comprise: the per-vector wrapper (`vectors.test.ts`), the engine
**characterization** suite (`characterization.test.ts`, mirroring the backend's
locked assertions), and the **differential parity** suite (`parity.test.ts`).
**`# skipped 0` is significant:** the parity suite is `skip`-guarded on the
backend file being resolvable — 0 skipped means it *found and ran against the
live `kolekto-be-old/utils/financial.js`* and matched.

## 3. Node-parity results (the headline)

`parity.test.ts` imports the engine **and the live backend reference**, then
asserts byte-identical output across a generated grid:

| Function | Inputs compared | Result |
|---|---|---|
| `roundCurrency` | 12 numeric + non-numeric coercion cases | ✅ identical |
| `calculateFees` | 16 amounts × 6 types × 2 bearers = **192** | ✅ identical |
| `deriveNetContribution` | 16 grosses × 6 types × 2 bearers = **192** | ✅ identical |
| `getSettlementCutoff` | wall-clock instant | ✅ identical |
| `computeWalletBalances` | 7 wallet scenarios (settled/pending/withdrawn/floor/fallback) | ✅ identical |
| `normalizeContributions` | 5 rows × 6 types × 2 bearers = **60** | ✅ identical |

> **~650 differential assertions**, all equal to the implementation that live
> reconciliation validates at 0 drift. No financial output changed.

## 4. Coverage summary

Vectors exercise every dimension the handover required:

- **All collection types** — fixed, fundraising, tiered, ticket, open_pool, +
  unknown-type fallback.
- **Both fee bearers** — organizer (fees from net) and contributor (fees added to
  payable), including the fundraising-forces-contributor rule at the edge layer.
- **Settlement boundaries** — one ms before cutoff (settled), exactly at cutoff
  (pending), after cutoff (pending); `now`-before-04:00-UTC window shift; month
  boundary.
- **Withdrawals** — completed / successful / success / approved all reduce
  available; pending / processing / rejected do **not**; over-withdrawal floors
  available at 0.
- **Fee caps** — both fees independently capped at ₦2,000 (platform & gateway),
  organizer- and contributor-borne.
- **Rounding edges** — fractional amounts (999.99, 1234.56, 250.5) round to the
  kobo; `allocateAmounts` remainders sum back exactly.
- **Tiered** — sold-by-TierId and sold-by-name, remaining capacity, unlimited
  (null-quantity) tiers.
- **Withdrawal eligibility** — cap = available − pending, floored at 0; pending
  summed from raw rows over PENDING statuses only.
- **Divergence scenarios** — the `approved` and `success` withdrawal vectors that
  the edge's legacy `{completed, successful}` set computes **wrong**.

## 5. The latent-bug (divergence) evidence

Per the Wave 0 objective, the divergent case is captured explicitly. The two
`divergence` vectors carry both the correct `expected` (Node/engine superset) and
the `edgeLegacyWouldCompute` values the edge's smaller set produces:

| Vector | Engine `available` | Edge-legacy `available` | Δ |
|---|---:|---:|---:|
| ₦10,000 settled, ₦4,000 **approved** withdrawal | 6,000 | 10,000 | 4,000 |
| ₦8,000 settled, ₦3,000 **success** withdrawal | 5,000 | 8,000 | 3,000 |

The engine (and SQL, which already uses the superset) passes these. Running the
Deno harness against the **pre-migration** edge code in Wave 2 will reproduce the
`edgeLegacyWouldCompute` failure — documenting the latent bug the engine fixes.
No production data has exercised this path, which is why live drift is currently
0 despite the divergence.

## 6. Financial invariants verified

Asserted on **every** wallet/divergence vector (13 + 2), and in the
characterization suite:

1. `ledger === available + pending` — ✅ all vectors.
2. `available ≥ 0` (floors, never negative) — ✅ all vectors.
3. Fees to the kobo unchanged for both bearers and all types — ✅ (parity grid).
4. Settlement cutoff = 04:00 UTC (T+1) everywhere — ✅ (cutoff vectors + parity).
5. Withdrawal cap = `available − Σ pending requests`, floored — ✅ (eligibility).
6. Σ available unchanged vs the reference (no repricing) — ✅ (differential parity).

## 7. TypeScript soundness

`tsc --noEmit --strict --erasableSyntaxOnly` over `src/*.ts` → **exit 0**. The
engine is valid strict TypeScript and valid type-erasable source (runs under both
Node strip-types and Deno).

## 8. Harness readiness (Waves 2/3)

- **Deno harness** — authored, imports the same engine + `_runner` + vectors;
  runs in Wave 2 (`deno test`). Deno is not in the Wave 0 local toolchain.
- **SQL harness** — authored, self-contained (`BEGIN … ROLLBACK`, temp functions,
  mutates nothing), mirrors `settlement_recompute.sql` arithmetic; runs in Wave 3
  (`psql -f`). psql is not in the Wave 0 local toolchain.

Both are wired to the identical `golden-vectors.json`, so passing them in later
waves proves the same equivalence Node already demonstrates.
