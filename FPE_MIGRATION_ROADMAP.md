# FPE_MIGRATION_ROADMAP (Phase 2.2 — Deliverable 4)

Per-implementation disposition: **keep · delegate · wrap · replace · remove**. Ordered so nothing changes behavior — each row lands behind the golden-vector suite.

Disposition meanings:
- **keep** — stays as-is (already canonical or a legitimate adapter).
- **delegate** — code stays but its body calls the engine.
- **wrap** — engine call wrapped by a runtime adapter that does I/O.
- **replace** — local copy deleted, import the engine instead.
- **remove** — delete outright (dead after consolidation).

## Node (`kolekto-be-old`)
| Implementation | File | Disposition | Notes |
|----------------|------|-------------|-------|
| `roundCurrency` | `financial.js:50` | **delegate → FPE** | re-export from engine |
| `calculateFees` | `financial.js:72` | **delegate → FPE** | keep export name |
| `deriveNetContribution` | `financial.js:100` | **delegate → FPE** | |
| `getSettlementCutoff` | `financial.js:141` | **delegate → FPE** | inject `now` |
| `isPaymentSettled` | `financial.js:165` | **delegate → FPE** | |
| `computeWalletBalances` | `financial.js:188` | **delegate → FPE.computeWallet** | keep name; return same shape |
| `normalizeContributions` | `financial.js:254` | **delegate → FPE.normalizeContribution** (mapped over array) | |
| fee/status constants | `financial.js` | **replace → FPE.CONSTANTS** | single source |
| `refreshWallet` | `withdrawal.js:36` | **keep (adapter)** | I/O + `FPE.computeWallet` |
| `getWithdrawableSnapshot` | `withdrawal.js:111` | **delegate → FPE.computeWithdrawalEligibility** | |
| `getEligibleCollections` (inline math) | `withdrawal.js:143` | **replace inline with FPE.computeWithdrawalEligibility** | kills the 2nd cap path |
| `sumPendingWithdrawals` | `withdrawal.js:86` | **keep (adapter)** | feeds engine |
| `updateWalletStats` | `deposit.js` | **keep (adapter)** | already calls `computeWalletBalances` → FPE |
| reconcile scripts | `scripts/reconcileFinancials.js`, `utils/financialReconcile.js` | **keep (adapter)** | already use `computeWalletBalances` |
| `financial.js` module | whole file | **wrap** | becomes thin Node adapter/re-export of engine (no caller churn) |

## Edge (`kolekto-fe-old/supabase/functions`)
| Implementation | File | Disposition | Notes |
|----------------|------|-------------|-------|
| `roundCurrency` | `_shared/payment.ts:58`, `_shared1.ts:56` | **replace → FPE** | delete both copies |
| `calculateFees` | `payment.ts:107`, `_shared1.ts:128` | **replace → FPE** | delete both; removes hardcoded constants |
| `normalizePaymentRequest` | `payment.ts:266`, `_shared1.ts:250` | **replace → FPE.normalizeContribution** (+ thin request-shaping adapter) | keep request-parsing bits in adapter, math in engine |
| `reverseCalculateContribution` | `_shared1.ts:147` | **replace → FPE.deriveNet** | |
| `allocateAmounts` | `payment.ts:130`, `_shared1.ts:166` | **replace → FPE** | delete both |
| `buildTierAvailability` | `payment.ts:154`, `_shared1.ts:180` | **replace → FPE.buildTierAvailability** | |
| `getSettlementCutoff` | `_shared1.ts:517` | **replace → FPE.getSettlementCutoff** | |
| `COMPLETED_WITHDRAWAL_STATUSES` | `_shared1.ts:514` | **replace → FPE.CONSTANTS** | ⚠️ **resolves the divergence** (adopts Node's fuller set) |
| `refreshCollectionAndWallets` | `_shared2.ts:40` | **wrap** | keep as edge adapter: I/O + tier-sold side-effect, but balances via `FPE.computeWallet` |
| `ensureCollectionIsPayable`, `matchTier`, receipt builders | `_shared1/_shared2` | **keep** | not financial math |

## SQL (Postgres)
| Implementation | Disposition | Notes |
|----------------|-------------|-------|
| `settlement_recompute_wallets()` | **keep as the SQL MIRROR** | annotate `-- MIRRORS FPE@<hash>`; guarded by golden-vector conformance |
| `settlement_cutoff()` | **keep as mirror** | matches `FPE.getSettlementCutoff` |
| inline fee/normalize/round in the above | **keep (mirror internals)** | changed only in lockstep with FPE + conformance |
| pg_cron job 7 | **keep** | scheduler unchanged |

## Divergences resolved by the migration
| Divergence | Resolution |
|------------|-----------|
| withdrawn-status set (Node fuller than Deno) | all adopt `FPE.CONSTANTS.COMPLETED_WITHDRAWAL_STATUSES` (Node's set — the one live data already validates) |
| fee constants hardcoded ×3–4 | single `FPE.CONSTANTS` |
| tier-sold side effect (Edge-only) | stays an **edge adapter** responsibility (documented), not engine math |
| edge self-duplication (`payment.ts` vs `_shared1.ts`) | both replaced by engine imports |

## What is explicitly NOT touched
Settlement scheduling, withdrawal state machine, payment verification, webhook, receipt rendering, admin monitoring flows — all keep their current control flow; only the *math* inside them is delegated. Zero behavior change is the acceptance bar.
