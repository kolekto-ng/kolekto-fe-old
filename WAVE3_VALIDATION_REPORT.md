# WAVE3_VALIDATION_REPORT (Phase 2.2 — SQL Mirror Lockstep)

All SQL validation ran **read-only** against test project
`lpeeckqsltxohppheucz` via the Supabase MCP. **0 drift.** PROD (`busfgcmbndleljklrcbd`)
was not touched.

## 1. Deployed SQL == version-controlled source
`pg_get_functiondef` for `settlement_cutoff()` and `settlement_recompute_wallets()`
matches `database/settlement_recompute.sql` byte-for-byte, and uses the canonical
completed-withdrawal superset `('approved','completed','successful','success')`.

## 2. Synthetic conformance — 16/16, engine-authored expectations
A read-only query reproduced the **deployed function's exact per-collection
arithmetic** (gross→node_net normalization + net/gross/pending/available/ledger/
withdrawn projection + `settlement_cutoff()`) over 16 golden vectors whose
expected values were computed by the engine (`normalizeContributions →
computeWallet`):

```
total: 16   passed: 16   failures: []
```

Coverage: organizer & contributor bearers × fixed/fundraising/tiered/ticket/
open_pool; settled/pending/at-cutoff/just-before-cutoff timestamps; capped-fee
large amounts (contributor 504000→500000, organizer 500000→496000); all four
completed-status synonyms + excluded pending/rejected; over-withdrawn floor;
fractional fundraising (net 15024.39); and the **divergence** cases (approved,
success) — SQL counts them, matching the engine.

## 3. Live-data reconcile — 57/57 wallets, 0 drift
A read-only recompute of **every wallet** from the live `contributions` +
`withdrawals` (engine-mirror logic) compared against the stored `wallets` rows:

```
wallets_total: 57   paid_contribs: 185   withdrawals_total: 24
compared: 57   engine_conformant: 57      → drift = 0
```

Every stored wallet's `net_payment / available_balance / pending_balance /
withdrawn` (and thus `ledger`) equals the engine recompute. Matches the Phase 2.1
baseline (57 wallets, 185 paid, 24 withdrawals).

## 4. R-COALESCE — proven unreachable
```
explicit_zero_gross_with_amount: 0   null_gross: 0   zero_gross_any: 0   total_paid: 185
```
No contribution can trigger the `coalesce`-vs-`||` gross-fallback difference; all
gross amounts are positive. Latent, not verified drift → not fixed.

## 5. Regression guard — other runtimes still green
```
engine   # tests 104  # pass 104  # fail 0   (Node parity/vectors/characterization)
backend  # tests 63   # pass 63   # fail 0
```
Engine `src` untouched in Wave 3; Node/Edge unaffected.

## 6. Financial invariants (SQL, on all 16 vectors + 57 live wallets)
1. `ledger === available + pending` — ✅
2. `available ≥ 0` — ✅ (over-withdrawn floors at 0)
3. Fees to the kobo (incl. ₦2,000 caps) — ✅
4. Cutoff 04:00 UTC T+1 — ✅ (incl. at-cutoff = pending, −1ms = settled)
5. Withdrawn = Σ superset statuses — ✅
6. Σ available unchanged vs engine recompute — ✅ (0 drift)

## Verdict
The SQL settlement function is a **golden-vector-proven mirror** of the engine on
both synthetic and live data. There is now **one logical financial implementation
across all three runtimes** (Node import + Edge inline + SQL mirror). **Wave 3:
PASS.** Remaining operator gate: a PROD conformance run before any production flip.
