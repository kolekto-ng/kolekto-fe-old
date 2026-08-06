# FINANCIAL_COMPUTATION_MATRIX (Phase 2.2 — Deliverable 2)

> ✅ **ACHIEVED (Phase 2.2 complete, all 4 waves).** The canonical targets below
> are now live: one TypeScript engine (`kolekto-shared-financial`) imported by
> Node (vendored `utils/fpe/`) and Edge (inlined via `bundle:edge`), plus one SQL
> mirror proven equivalent by golden vectors (16/16 + 57/57 live wallets, 0
> drift). A CI guardrail forbids new local financial math. See
> `WAVE1_…`/`WAVE2_…`/`WAVE3_…`/`WAVE4_IMPLEMENTATION_REPORT.md` +
> `…VALIDATION_REPORT.md`. Open items: R-REV (edge reverse-calc), R-COALESCE
> (unreachable). Row 15/17 divergences are resolved to the canonical superset.

One row per financial rule; one column per runtime. Cell = the concrete implementation there today. **Canonical?** names the single implementation everything should converge on (target state — not yet built).

Legend: ✅ present · ✅✅ present twice (duplicated within that runtime) · — absent.

| # | Rule | Node (Express) | Edge (Deno) | SQL (Postgres) | Canonical target |
|---|------|----------------|-------------|----------------|------------------|
| 1 | `roundCurrency` | ✅ `financial.js:50` | ✅✅ `payment.ts:58` + `_shared1.ts:56` | ✅ inline `round(x,2)` | `FPE.roundCurrency` (TS, shared Node+Edge) + SQL mirror |
| 2 | `calculateFees` | ✅ `financial.js:72` | ✅✅ `payment.ts:107` + `_shared1.ts:128` | ✅ inline in `settlement_recompute_wallets` | `FPE.calculateFees` + SQL mirror; constants defined once |
| 3 | normalization / net derivation | ✅ `normalizeContributions:254`, `deriveNetContribution:100` | ✅✅ `normalizePaymentRequest` (payment.ts:266 + _shared1:250), `reverseCalculateContribution:147` | ✅ inline | `FPE.normalizeContribution` / `FPE.deriveNet` + SQL mirror |
| 4 | settlement cutoff (T+1 04:00 UTC) | ✅ `getSettlementCutoff:141` | ✅ `_shared1.ts:517` | ✅ `settlement_cutoff()` | `FPE.getSettlementCutoff` + SQL `settlement_cutoff()` mirror |
| 5 | `isPaymentSettled` | ✅ `financial.js:165` | — (inlined in cutoff compare) | — (inlined) | `FPE.isPaymentSettled` |
| 6 | wallet balances (net/gross/pending/available/ledger/withdrawn) | ✅ `computeWalletBalances:188` | ✅ `refreshCollectionAndWallets` (`_shared2.ts:40`) | ✅ `settlement_recompute_wallets()` | `FPE.computeWallet` + SQL mirror (golden-vector proven) |
| 7 | `available` (settledNet − completedWithdrawals) | ✅ (inside #6) | ✅ (inside #6) | ✅ (inside #6) | `FPE.computeAvailableBalance` |
| 8 | `pending` (Σ net, created_at ≥ cutoff) | ✅ (inside #6) | ✅ (inside #6) | ✅ (inside #6) | `FPE.computePendingBalance` |
| 9 | `ledger` (available + pending) | ✅ (inside #6) | ✅ (inside #6) | ✅ (inside #6) | `FPE.computeLedgerBalance` |
| 10 | organizer balance (per-wallet aggregate) | ✅ (inside #6) | ✅ (inside #6) | ✅ (inside #6) | `FPE.computeOrganizerBalance` |
| 11 | withdrawal eligibility / withdrawable cap | ✅✅ `getWithdrawableSnapshot:111` + `getEligibleCollections:143` (inline) | — | — | `FPE.computeWithdrawalEligibility` |
| 12 | pending-withdrawal sum | ✅ `sumPendingWithdrawals:86` | — | — | `FPE.computeWithdrawalEligibility` (input) |
| 13 | collection totals / tier availability | ✅ count (`updateWalletStats`) | ✅✅ `buildTierAvailability` (payment.ts:154 + _shared1:180); sold-write in `refreshCollectionAndWallets` | — | `FPE.computeCollectionTotals` + `FPE.buildTierAvailability` |
| 14 | fee allocation across line items | — | ✅✅ `allocateAmounts` (payment.ts:130 + _shared1:166) | — | `FPE.allocateAmounts` |
| 15 | completed-withdrawal status set | `{completed, successful, success, approved}` (`financial.js:225`) | `{completed, successful}` (`_shared1.ts:514`) | (matches Node) | `FPE.COMPLETED_WITHDRAWAL_STATUSES` (one set) — ⚠️ **currently divergent** |
| 16 | pending-withdrawal status set | `{pending, processing}` (`withdrawal.js:84`) | — | — | `FPE.PENDING_WITHDRAWAL_STATUSES` |
| 17 | fee constants (rates/cap/gateway) | `PLATFORM_FEE_RATES`, `GATEWAY_FEE_RATE`, `MAX_FEE_AMOUNT` (`financial.js`) | hardcoded ×2 | hardcoded | `FPE.CONSTANTS` (one source) — ⚠️ **3–4× hardcoded** |
| 18 | settlement hour | `SETTLEMENT_HOUR_UTC=4` | `4` inline | `4` inline | `FPE.CONSTANTS.SETTLEMENT_HOUR_UTC` |

## Reading the matrix
- **Rows 1–4, 6:** the core triplication (Node/Edge/SQL) — the headline Phase 2.2 problem.
- **Rows 1–3, 13–14:** additionally duplicated *within* the edge (`payment.ts` vs `_shared1.ts`) — the edge has two independent copies.
- **Rows 15, 17:** the duplicates are **not byte-identical** — the withdrawn-status set and the fee constants differ between runtimes. Today they don't diverge in output only because live data hasn't exercised the divergent path.
- **Row 11:** single runtime (Node) but two code paths re-deriving the same cap.

## Canonical-count scorecard (target)
| Concern | Today | Target |
|---------|------:|-------:|
| roundCurrency | 4 | 1 TS + 1 SQL mirror |
| calculateFees | 4 | 1 TS + 1 SQL mirror |
| normalization | ~5 | 1 TS + 1 SQL mirror |
| cutoff | 3 | 1 TS + 1 SQL mirror |
| wallet balances | 3 | 1 TS + 1 SQL mirror |
| withdrawal eligibility | 2 | 1 TS |
| fee constants | 3–4 | 1 |
