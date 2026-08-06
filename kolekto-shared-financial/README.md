# kolekto-shared-financial

The **Financial Projection Engine (FPE)** — Kolekto's single, dependency-free,
pure-TypeScript source of truth for every monetary computation.

> Source of truth = paid `contributions` + `withdrawals`. Everything here is a
> **projection** of those two immutable streams. Wallets are outputs, never
> inputs.

## Layers

| Layer | File | Contents |
|------|------|----------|
| L0 | `src/constants.ts`, `src/types.ts` | rates, caps, cutoff hour, status sets, type contracts |
| L1 | `src/primitives.ts` | `roundCurrency`, `calculateFees`, `deriveNetContribution`, `normalizeContribution(s)`, `getSettlementCutoff`, `isPaymentSettled`, `allocateAmounts` |
| L2 | `src/projections.ts` | `computeWallet`, balances, `computeOrganizerBalance`, `computeCollectionTotals`, `buildTierAvailability`, `computeWithdrawalEligibility` |

The engine is **L0–L2 only**: pure, deterministic, no I/O, no network, no
Supabase, no logging, no env, no hidden time (time is an injected `now`). Per-
runtime I/O lives in L3 adapters that each runtime owns.

Full contract: **[`../FINANCIAL_ENGINE_API.md`](../FINANCIAL_ENGINE_API.md)**.

## Runtimes

Written in type-erasable TypeScript with explicit `.ts` import extensions, so the
**same source** runs under:

- **Node** — `node --experimental-strip-types` (≥ 22.6) or after `tsc`.
- **Deno** — natively.
- **Postgres** — as a golden-vector-proven **mirror** (`settlement_recompute.sql`).

## Test / prove

```bash
# Golden-vector scorecard (Node)
node --experimental-strip-types test/node.harness.ts

# Full suite: vectors + characterization + differential parity vs live backend
node --experimental-strip-types --test test/*.test.ts

# Type soundness
npx tsc --noEmit
```

- `test/golden-vectors.json` — one language-agnostic fixture, shared by all three
  harnesses.
- `test/node.harness.ts` — runs now (Wave 0).
- `test/deno.harness.ts` — ready; runs in Wave 2 (`deno test`).
- `test/sql.harness.sql` — ready; runs in Wave 3 (`psql -f`).
- `test/parity.test.ts` — diffs the engine against
  `../../kolekto-be-old/utils/financial.js` (the 0-drift reference).

## Status

Wave 0 complete. **Not yet imported by any runtime** — adoption is Wave 1+ (see
`../FPE_EXECUTION_PLAN.md`). Rollback = delete this directory.
