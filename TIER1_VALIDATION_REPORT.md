# TIER1_VALIDATION_REPORT (Phase 2.1C-2 — Tier 1)

## Static / correctness validation (executed here)

| Check | Result |
|-------|--------|
| `deposit.js` syntax (`node --check`) | **PASS** |
| `deposit.js` runtime `deposits` refs | **0** |
| Repo-wide runtime `deposits`-table refs (code, excl. docs/SQL/types) | **0** |
| `_shared1.ts` dangling refs to removed vars (`pendingDeposits`/`depositRow`) | **0** |
| `_shared1.ts` recovery logic intact (`pendingContributions`, `candidateCollectionIds`) | preserved |
| BE unit tests (`npm test`) | **63/63 pass** |

## Financial reconciliation (live test project)

| Invariant | Before Tier 1 | After Tier 1 | Pass |
|-----------|---------------|--------------|------|
| Wallets | 57 | 57 | ✅ |
| Projection drift | 0 | **0** | ✅ |
| Negative wallets | 0 | **0** | ✅ |
| Ledger identity (`available+pending=ledger`) | holds | **holds** | ✅ |
| Σ available_balance | 49,777,348.09 | **49,777,348.09** | ✅ unchanged |
| Σ pending_balance | 0.00 | **0.00** | ✅ unchanged |
| Paid contributions | 185 | 185 | ✅ unchanged |
| `deposits` rows | 0 | **0** (untouched) | ✅ |

Settlement/wallets/withdrawals were not touched, so balances are provably unchanged.

## Behavioral-equivalence argument (why payment behavior is unchanged)
Every removed `deposits` branch was **unreachable**: `deposits` is empty and its only writer (`deposit.initializePayment`) is dead (proof in `TIER1_IMPLEMENTATION_REPORT.md`). Therefore `existingDeposit`/`deposit` were always null and the code always executed the fallback/recovery path. I removed the dead branches and made the always-executing path unconditional; the retained bodies do not reference the removed variables. HMAC signature verification, F1 already-paid check, edge-verify recovery, retry (500→Paystack retries), admin reconcile (`invokeVerifyEdgeFunction`), and receipts are byte-for-byte unchanged.

## Runtime "never queries deposits" proof
- During **payment/verify/webhook**: the code paths contain **no** `deposits` query (grep = 0).
- During **settlement**: `settlement_recompute_wallets()` reads `contributions`+`withdrawals` only.
- During **withdrawal**: `withdrawal.js` recomputes from `contributions`+`withdrawals`.
⇒ `deposits` is never queried in any financial flow.

## What could NOT be validated here (deferred to soak — per the task)
The live **webhook**, **payment verification**, **retry**, and **admin reconciliation** cannot be exercised from this environment (no running Express/Paystack). Per the task's own guidance, these must be confirmed in a **soak window** (staging/production) before Tier 2 drops the table. The static + reconciliation evidence above establishes correctness up to that live confirmation.

## Verdict: **TIER 1 PASS (static + financial)**; **live soak pending** before Tier 2.
Runtime dependency on `deposits` is eliminated with a rigorous behavioral-equivalence argument; financial reconciliation remains at **0 drift**; nothing outside the `deposits` coupling was changed.
