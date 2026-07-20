# WAVE4_VALIDATION_REPORT (Phase 2.2 — Cleanup & Enforcement)

## 1. Guardrail — works both ways
Clean codebase (delegated):
```
✓ Financial-duplication guardrail PASSED — scanned 6 roots; no local financial math
  outside the engine + SQL mirror.   (exit 0)
```
Negative test (injected `function calculateFees(){ Math.min(a*0.005,2000) }` into a
scanned controller):
```
✗ FAILED — kolekto-be-old/controllers/__guard_probe__.js:1 [calculateFees redefinition]
                                                            [inline fee-rate math]
2 violation(s).   (exit 1)   ← probe then removed
```

## 2. Dead-code removal did not break anything
- `_shared/payment.ts` deleted — repo-wide importer scan = 0 (confirmed Wave 2).
- `_shared1.ts` dead helpers removed — edge files still type-strip clean:
```
exit=0 _shared1.ts   exit=0 _shared2.ts   exit=0 initiate/index.ts
```
- `bundle:edge` idempotent after removal (snapshot → re-bundle → diff):
```
_shared1: IDENTICAL   initiate: IDENTICAL
```

## 3. All runtimes green (regression sweep)
```
engine    # tests 104  # pass 104  # fail 0  # skipped 0
backend   # tests 63   # pass 63   # fail 0
guardrail PASS
SQL (Wave 3)  16/16 conformance vectors + 57/57 live wallets, 0 drift
```

## 4. End-state architecture — matrix scorecard (achieved)
| Concern | Phase 2.2 start | Now |
|---------|----------------:|-----|
| roundCurrency | 4 copies | **1 TS engine** (+ SQL mirror) |
| calculateFees | 4 | **1 TS** (+ SQL mirror) |
| normalization | ~5 | **1 TS** (+ SQL mirror) |
| settlement cutoff | 3 | **1 TS** (+ SQL mirror) |
| wallet balances | 3 | **1 TS** (+ SQL mirror) |
| withdrawal eligibility | 2 | **1 TS** |
| fee constants / status sets | 3–4 hardcoded | **1** canonical (+ generated/mirror copies) |

**Consumption:** Node imports the compiled engine (`utils/fpe/`, vendored); Edge
inlines it (generated IIFE via `bundle:edge`); SQL is a golden-vector-proven
mirror. One logical implementation; physical copies are all generated-from or
proven-equivalent-to the one canonical source.

## 5. Financial invariants — hold in all three runtimes
`ledger = available + pending`; `available ≥ 0`; fees to the kobo (incl. ₦2,000
caps); cutoff 04:00 UTC T+1; withdrawal cap = `available − Σ pending`; withdrawn =
Σ canonical-superset statuses. Verified: engine (104 tests) + backend (63) + SQL
(16 vectors + 57 live wallets, 0 drift).

## 6. Enforcement now active
- `npm run guard` (and CI) blocks any new local financial math in Node/Edge.
- CI blocks a stale inlined edge block (re-bundle-and-diff).
- Golden-vector suite is the permanent equivalence contract for all three runtimes.

## Verdict
Phase 2.2 objective met: **every monetary computation has exactly one
authoritative implementation**, reproduced identically across Node, Edge, and SQL,
and guarded against regression. **Wave 4: PASS.** Phase 2.2 build complete.
