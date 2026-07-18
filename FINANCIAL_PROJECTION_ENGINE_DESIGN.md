# FINANCIAL_PROJECTION_ENGINE_DESIGN (Phase 2.2 — Deliverable 3)

The canonical financial computation engine every runtime delegates to or proves equivalent. **Design only — nothing built yet.**

## The core constraint (why "one function" isn't literally possible)
Kolekto runs financial math in **three languages** that cannot share one binary:
- **Node** (Express, ESM) — `utils/financial.js`
- **Deno** (Supabase Edge, TS) — `_shared/*.ts`
- **Postgres** (plpgsql) — `settlement_recompute_wallets()`

Node and Deno *can* share source (both run TypeScript/ESM with no Node-only built-ins in the math). Postgres cannot. So "single authoritative implementation" resolves to a **hybrid canonical**:

> **One TypeScript engine, imported by both Node and Deno + one SQL mirror held in lockstep by a golden-vector conformance suite.** The suite is what upgrades the SQL copy from "a duplicate" to "a proven-equivalent projection."

This is the architecture the prior phases already pointed at: `contributions + withdrawals` is the source of truth; `wallets` is a projection; the engine is the *only* thing allowed to compute that projection.

## Layer model
```
┌─────────────────────────────────────────────────────────────┐
│  L0  CONSTANTS + TYPES  (one file)                            │
│   PLATFORM_FEE_RATES, GATEWAY_FEE_RATE, MAX_FEE_AMOUNT,       │
│   SETTLEMENT_HOUR_UTC, COMPLETED_WITHDRAWAL_STATUSES,         │
│   PENDING_WITHDRAWAL_STATUSES, FeeBearer, CollectionType      │
├─────────────────────────────────────────────────────────────┤
│  L1  PURE PRIMITIVES  (no I/O, deterministic)                 │
│   roundCurrency · calculateFees · deriveNet ·                 │
│   normalizeContribution · getSettlementCutoff ·               │
│   isPaymentSettled · allocateAmounts                          │
├─────────────────────────────────────────────────────────────┤
│  L2  PROJECTIONS  (pure; take arrays, return numbers)         │
│   computeWallet → {gross,net,pending,available,ledger,        │
│                    withdrawn}                                 │
│   computeAvailableBalance · computePendingBalance ·           │
│   computeLedgerBalance · computeOrganizerBalance ·            │
│   computeCollectionTotals · buildTierAvailability ·           │
│   computeWithdrawalEligibility                                │
├─────────────────────────────────────────────────────────────┤
│  L3  ADAPTERS  (per-runtime I/O; NOT part of the engine)      │
│   Node: fetch contributions/withdrawals → computeWallet → write│
│   Edge: same, Deno import of L0–L2                            │
│   SQL:  settlement_recompute_wallets = the SQL mirror         │
└─────────────────────────────────────────────────────────────┘
```
The engine is **L0–L2 only**: pure, dependency-free, no Supabase client, no `fetch`, no `Date.now()` hidden inside math (cutoff takes an explicit `now` param). I/O stays in L3 adapters that each runtime owns.

## Proposed API (names are intentions — kept from the task where they fit)
```ts
// L0
export const CONSTANTS = {
  PLATFORM_FEE_RATES: { fundraising: 0.01, default: 0.005 },
  GATEWAY_FEE_RATE: 0.015,
  MAX_FEE_AMOUNT: 2000,
  SETTLEMENT_HOUR_UTC: 4,
  COMPLETED_WITHDRAWAL_STATUSES: new Set(["completed","successful","success","approved"]),
  PENDING_WITHDRAWAL_STATUSES:   new Set(["pending","processing"]),
};

// L1 primitives
roundCurrency(value): number
calculateFees(amount, collectionType, feeBearer): { platformFee, gatewayFee, totalFees, payable }
deriveNetContribution(gross, collectionType, feeBearer): number
normalizeContribution(raw, feeBearer, collectionType): NormalizedContribution
getSettlementCutoff(now = new Date()): Date          // now injected → testable, deterministic
isPaymentSettled(paymentDate, now = new Date()): boolean
allocateAmounts(total, weights): number[]

// L2 projections
computeWallet(paidContributions, withdrawals, now): WalletProjection
computeAvailableBalance(...), computePendingBalance(...), computeLedgerBalance(...)
computeOrganizerBalance(walletsForOrganizer): number
computeCollectionTotals(contributions): { totalContributions, count }
buildTierAvailability(collection, contributions): TierAvailability[]
computeWithdrawalEligibility(walletProjection, pendingWithdrawalRequests): { withdrawable, cap }
```
Renames vs the task's suggested names:
- `computeFinancialProjection` → **`computeWallet`** returning the full `WalletProjection` object; the per-field `computeAvailable/Pending/Ledger` become selectors over it (avoids recomputing).
- `computeSettlement` is **not** a separate engine function — settlement *is* `computeWallet` applied over all wallets at cutoff. The SQL mirror `settlement_recompute_wallets()` remains the scheduled adapter; no new "settlement math."
- `normalizeTransaction` dropped — post-`deposits` there is no transaction entity distinct from a contribution; `normalizeContribution` covers it.

## `WalletProjection` (the one shape)
```ts
type WalletProjection = {
  gross: number;        // Σ gross paid
  net: number;          // Σ net (organizer: gross−fees; contributor: gross)
  withdrawn: number;    // Σ withdrawals in COMPLETED set
  pending: number;      // Σ net where created_at ≥ cutoff (not yet settled)
  available: number;    // max(0, settledNet − withdrawn)
  ledger: number;       // available + pending
};
```
Invariant, enforced by the engine and asserted in tests: `ledger === available + pending` and `available ≥ 0`.

## Placement
```
kolekto-shared-financial/            (new pure-TS package — no runtime deps)
  constants.ts                       L0
  primitives.ts                      L1
  projections.ts                     L2
  index.ts
```
- **Node** imports it (`utils/financial.js` becomes a thin re-export/adapter, preserving current export names so callers don't churn).
- **Edge** imports it (`_shared/payment.ts`, `_shared1.ts`, `_shared2.ts` replace their local copies with imports). Deno imports the same source (vendored or via import map) — resolves the edge's *internal* duplication for free.
- **SQL** keeps `settlement_recompute_wallets()` as the **mirror**, annotated `-- MIRRORS kolekto-shared-financial@<hash>`.

## Golden-vector conformance suite (the equivalence proof)
A single fixture file `golden-vectors.json` — an input matrix (collection types × fee bearers × contribution/withdrawal mixes × cutoff-boundary timestamps) with expected `WalletProjection` outputs. Three harnesses feed it:
1. **Node** — call `computeWallet`, assert equality.
2. **Deno** — same import, assert equality.
3. **SQL** — load vectors into a temp schema, run `settlement_recompute_wallets`, assert equality.
If all three match the vectors, the SQL mirror is *proven equivalent*; any future edit that breaks parity fails CI. This is what makes three physical copies acceptable: they're one logical function.

## Non-goals (explicitly out of the engine)
- No I/O, no Supabase client, no `fetch`, no logging inside L0–L2.
- No settlement scheduling (stays pg_cron), no withdrawal state machine (stays `withdrawal.js` adapter), no payment verification/webhook logic.
- No behavior change: the engine reproduces today's outputs exactly (the divergences in rows 15/17 resolve **to the Node values**, which the live reconciliation already validates at 0 drift).
