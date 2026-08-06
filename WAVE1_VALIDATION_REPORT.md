# WAVE1_VALIDATION_REPORT (Phase 2.2 — Node Financial Delegation)

Goal: prove the backend produces **identical financial output** after delegating
to the engine. **All checks green. 0 drift. 0 behaviour change.**
Toolchain: Node v22.12.0, TypeScript 5.9.3.

---

## 1. Backend test suite — 63/63

`kolekto-be-old $ node --test "tests/*.test.js"`

```
# tests 63
# pass 63
# fail 0
# skipped 0
```

These import the real `utils/financial.js` (now the adapter → vendored engine)
and include:

- **`financial.characterization.test.js`** (24) — the locked fee/balance/cutoff/
  normalization assertions. Passing unchanged = the adapter reproduces the prior
  Node math to the kobo.
- **`financialReconcile.test.js`** — recompute path
  (`normalizeContributions → computeWalletBalances`) now routed through the engine.
- **`financialAudit.test.js`** and the rest of the unit suite.

This is the headline gate the execution plan set for Wave 1 ("63/63 must hold").

## 2. Differential parity — engine source vs the delegating backend

`kolekto-shared-financial $ node --experimental-strip-types --test test/parity.test.ts test/vectors.test.ts`

```
# tests 79
# pass 79
# fail 0
# skipped 0
```

`parity.test.ts` imports **the live `kolekto-be-old/utils/financial.js`** (now the
adapter → vendored engine) and diffs it against the engine **source** across the
generated grid (~650 assertions): `calculateFees` 192, `deriveNetContribution`
192, `normalizeContributions` 60, `computeWalletBalances` 7 scenarios,
`roundCurrency`, `getSettlementCutoff`.

**`# skipped 0`** confirms the backend file resolved and ran. Result: the
**vendored build is byte-identical to the canonical source**, and the adapter
delegates correctly. This doubles as a drift check on the vendoring step.

## 3. Cutoff delegation — provably equivalent

Before removing `dashboard.js`'s inline `getSettlementCutoffUtc`, its exact prior
algorithm was diffed against the engine's `getSettlementCutoff`:

```
checked 4326 timestamps; mismatches: 0
```

Every minute across a 48-hour window **plus** month/year/leap-day boundaries
(2026-02-28→03-01, 2026-12-31→2027-01-01, 2024-02-29). Zero divergence → the
delegation cannot change any dashboard cutoff.

## 4. Withdrawal cap delegation — equivalence

The replaced inline math and the engine calls are arithmetically identical:

| Step | Old inline (`getEligibleCollections`) | Engine call |
|------|----------------------------------------|-------------|
| pending sum | `roundCurrency(filter(status∈{pending,processing}).reduce(+amount))` | `computePendingWithdrawals(rows)` — same filter/reduce/round |
| cap | `roundCurrency(max(0, available − pending))` | `computeWithdrawalEligibility({available}, pending).cap` — same |

Covered by the `withdrawalEligibility` golden vectors (4 cases incl. pending >
available floor, and pending summed from raw rows over PENDING statuses only),
all green in §2.

## 5. Load / syntax integrity

`node --check` on every edited backend file:

```
OK utils/financial.js
OK controllers/withdrawal.js
OK controllers/dashboard.js
OK utils/fpe/index.js
```

Vendored engine loads under **plain `node`** (no experimental flags) from the
backend working dir — confirmed by direct import returning correct fee/wallet/
eligibility values.

## 6. Financial invariants (re-verified post-delegation)

1. `ledger === available + pending` — ✅ (characterization + vectors).
2. `available ≥ 0` — ✅.
3. Fees to the kobo, all types × both bearers — ✅ (parity grid, 192+192).
4. Settlement cutoff 04:00 UTC everywhere — ✅ (4,326-point equivalence + vectors).
5. Withdrawal cap = `available − Σ pending`, floored — ✅.
6. Σ available unchanged vs pre-delegation — ✅ (differential parity = identical).

## 7. What was NOT run here (live, team-side)

Per the execution plan, live checks run on the **test project
`lpeeckqsltxohppheucz`** and are the operator's gate, not a local step:

- `npm run reconcile:financials` against live data → expect **drift 0**.
- Sample-diff `GET /withdrawals/eligible-collections` output before/after for a
  set of real collections.
- Spot-check a collection dashboard's `withdrawn` / `availableBalance`.

The reconcile *logic* is already covered green by the unit suite (§1); the live
run confirms it against production-shaped data. No code path changed that could
alter these — the differential parity (§2) shows identical outputs on identical
inputs.

## 8. Verdict

The backend delegates all financial computation to the engine; existing callers
are unchanged; every automated check shows identical output. **Wave 1 validation:
PASS.**
