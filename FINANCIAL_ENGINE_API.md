# FINANCIAL_ENGINE_API — `kolekto-shared-financial`

The public contract of the Financial Projection Engine (FPE). This is the single
authoritative surface for Kolekto money math. Every runtime either **imports**
this engine (Node, Deno) or is a **proven mirror** of it (SQL, via the
golden-vector suite).

> **Source of truth = paid `contributions` + `withdrawals`.** Everything the
> engine returns is a *projection* of those two immutable event streams. Wallets
> are outputs, never inputs.

---

## Import

```ts
import * as FPE from "kolekto-shared-financial";
// or named:
import { calculateFees, computeWallet, CONSTANTS } from "kolekto-shared-financial";
```

The engine is pure ESM TypeScript with **no dependencies**. It runs under Node
(`--experimental-strip-types`, or after `tsc`) and natively under Deno. Relative
imports inside the engine use explicit `.ts` extensions for that dual support.

---

## L0 — Constants

```ts
PLATFORM_FEE_RATES: Record<CollectionType, number>  // fundraising 0.01, else 0.005
PLATFORM_FEE_RATE_DEFAULT = 0.005                    // fallback for unknown types
GATEWAY_FEE_RATE = 0.015                             // 1.5%, all types
MAX_FEE_AMOUNT = 2000                                // ₦2,000 cap, per fee, independently
SETTLEMENT_HOUR_UTC = 4                              // 04:00 UTC = 05:00 WAT (T+1)
ONE_DAY_MS = 86_400_000

COMPLETED_WITHDRAWAL_STATUSES: ReadonlySet<string>   // {completed, successful, success, approved}
PENDING_WITHDRAWAL_STATUSES:   ReadonlySet<string>   // {pending, processing}

COLLECTION_TYPES: readonly CollectionType[]          // fixed | fundraising | tiered | ticket | open_pool
FEE_BEARERS:      readonly FeeBearer[]               // contributor | organizer

CONSTANTS = { …all of the above… }                   // aggregate bag (FPE.CONSTANTS)
```

`COMPLETED_WITHDRAWAL_STATUSES` is the **canonical superset**. It resolves the
historical Node/Edge divergence (Edge used only `{completed, successful}`). SQL
already used the superset.

---

## L0 — Types

```ts
type FeeBearer = "contributor" | "organizer";
type CollectionType = "fixed" | "fundraising" | "tiered" | "ticket" | "open_pool";

interface ContributionRow { amount: number; gross_amount?: number|null; created_at?: string|null; … }
interface WithdrawalRow   { amount: number; status?: string|null; … }

interface FeeBreakdown { platformFee: number; gatewayFee: number; totalFees: number; totalPayable: number; }

interface WalletProjection {   // the ONE wallet shape
  gross: number;      // Σ gross paid
  net: number;        // Σ net (Total Raised), fees excluded
  withdrawn: number;  // Σ completed/approved withdrawals
  pending: number;    // Σ net where created_at >= cutoff
  available: number;  // max(0, settledNet − withdrawn)
  ledger: number;     // available + pending
}

interface WalletBalancesLegacy { netPayment; grossPayment; pendingBalance; availableBalance; ledgerBalance; completedWithdrawals; }
interface CollectionTotals     { totalContributions: number; count: number; }
interface WithdrawalEligibility{ withdrawable: number; cap: number; }
interface TierInput { id?; name?; price?; quantity?; prefix?; description?; … }
interface TierAvailability extends TierInput { tierId; tierName; tierKey; sold; totalCapacity; remainingCapacity; }
```

**Invariants** (asserted by the conformance suite): `ledger === available +
pending`; `available ≥ 0`; `withdrawn ≤ net`.

---

## L1 — Primitives

```ts
roundCurrency(value: unknown): number
```
2-dp rounding; coerces non-numeric → 0. The universal money-rounding primitive.

```ts
platformFeeRate(collectionType: string): number
```
Platform rate for a type, falling back to `PLATFORM_FEE_RATE_DEFAULT`.

```ts
calculateFees(amount, collectionType="fixed", feeBearer="organizer"): FeeBreakdown
```
Fees are computed on the **contribution amount**, never on payable; each capped
at ₦2,000 independently. `contributor` → `totalPayable = amount + totalFees`;
`organizer` → `totalPayable = amount` (fees come from the net share). Fees are
never folded into net.

```ts
deriveNetContribution(grossAmount, collectionType="fixed", feeBearer="organizer"): number
```
Inverse of contributor-borne fees. `organizer` → returns gross. `contributor` →
`gross / (1 + platformRate + gatewayRate)`, refined once through `calculateFees`
to absorb caps; floored at 0.

```ts
normalizeContribution(row, feeBearer="organizer", collectionType="fixed"): row
normalizeContributions(rows, feeBearer="organizer", collectionType="fixed"): rows
```
Correct legacy rows: if `gross === 0` pass through untouched; otherwise set
`amount := net(gross)` and `gross_amount := gross`.

```ts
getSettlementCutoff(now = new Date()): Date
isPaymentSettled(paymentDate: Date|string, now = new Date()): boolean
```
Most recent 04:00-UTC cutoff at/before `now` (or the prior day's if `now` is
earlier). `isPaymentSettled` is `paymentDate < cutoff` (at/after = pending).
**`now` is injectable → deterministic.**

```ts
allocateAmounts(total: number, weights: number[]): number[]
```
Split `total` across `weights` at 2-dp, remainder to the last item so parts sum
**exactly** back to `total`. Empty weights → `[]`; total 0 or Σweight 0 → zeros.

---

## L2 — Projections

```ts
computeWallet(paidContributions, withdrawals, now = new Date()): WalletProjection
computeWalletBalances(paidContributions, withdrawals, now = new Date()): WalletBalancesLegacy
```
The core projection. `computeWallet` is the canonical shape; `computeWalletBalances`
returns the legacy Node field names (same numbers) for byte-for-byte backend
parity. Both take the two source-of-truth streams and an injected clock.

```ts
computeAvailableBalance(contribs, withdrawals, now?): number
computePendingBalance(contribs, now?): number
computeLedgerBalance(contribs, withdrawals, now?): number
```
Single-field selectors over the projection.

```ts
computeOrganizerBalance(wallets: Array<{available?}|{available_balance?}>): number
```
Σ `available` across an organizer's wallets (accepts projections or persisted
rows).

```ts
computeCollectionTotals(contributions): { totalContributions, count }
```
Total Raised (Σ net `amount`) and paid-row count.

```ts
computePendingWithdrawals(withdrawals, { excludeId? } = {}): number
computeWithdrawalEligibility(wallet: {available}, pendingWithdrawals: number | WithdrawalRow[]): WithdrawalEligibility
```
The **strict withdrawable cap**: `available − Σ pending withdrawal requests`,
floored at 0. Pending requests reserve against the cap but do **not** reduce
`available` (only completed withdrawals do). `pendingWithdrawals` may be a
pre-summed number or raw rows (summed over PENDING statuses).

```ts
buildTierAvailability(tiers: TierInput[], paidRows): TierAvailability[]
```
Sold / remaining capacity per price tier; matches by `TierId` then `Tier` name,
sums `Quantity` (default 1). Null tier quantity → unlimited (null capacity).

---

## Extension guidelines

1. **Never** add a fee rate, cap, cutoff hour, or status set anywhere but
   `constants.ts`. If a caller needs a new constant, it goes here and only here.
2. **Never** reintroduce local financial math in a caller. Callers are L3
   adapters: fetch rows → call the engine → write. (Wave 4 adds a CI grep-gate
   forbidding `calculateFees`/`roundCurrency`/cutoff redefinition outside the
   engine + SQL mirror.)
3. **Keep functions pure.** No I/O, no `fetch`, no Supabase, no logging, no env,
   no hidden `Date.now()` — time is always an injected `now`.
4. **Every new function needs a golden vector** before it ships, added to
   `golden-vectors.json` and exercised by all applicable harnesses.
5. **The SQL mirror follows the engine.** If a vector reveals a SQL/engine gap,
   fix the SQL to match the engine and ship it as its own reversible migration —
   never silently diverge.
6. **Preserve `computeWalletBalances`' legacy shape** until Node delegation
   (Wave 1) is complete and the differential parity suite is retired.
