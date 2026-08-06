# ACTIVE_FINANCIAL_WRITERS

Every remaining writer of `wallets`, post-repair. Confirms all **active** writers derive balances from `contributions` and produce identical (canonical) results.

| Writer | Runtime | Trigger | Source | Canonical? | Duplicated impl? | Active? | Safe / identical balances? |
|--------|---------|---------|--------|-----------|------------------|---------|----------------------------|
| Edge `verify-paystack-payment` · `refreshCollectionAndWallets` | Edge (Deno) | per payment | **contributions**+withdrawals | matches canonical (verified drift 0) | Deno copy of `computeWalletBalances` | **ACTIVE (primary)** | ✅ live-verified identical |
| Express `withdrawal.js` · `refreshWallet` | Express (Node) | per withdrawal request/approve | **contributions**+withdrawals | canonical (`computeWalletBalances`) | — (imports the one Node copy) | **ACTIVE** | ✅ |
| Express `deposit.js` · `updateWalletStats` | Express (Node) | Express verify/webhook | **contributions**+withdrawals | canonical | — | Code active; **path dormant** (deposits=0) | ✅ (would be correct if invoked) |
| Node cron `paymentSettlement.js` · `runDailySettlement` | Node cron | daily (iff `RUN_SETTLEMENT_CRON=true`) | **contributions**+withdrawals | canonical | — | Env-gated (**status unverified**) | ✅ (contributions-based) |
| Wallet creation — Edge `create-collection` / `CollectionService` | Edge/Express | collection create / first payment | zeros | n/a | — | ACTIVE | ✅ zeros |
| SQL `settle_pending_balances()` | SQL cron 4 | daily 04:00 | **deposits (empty)** | **NO — corrupting** | SQL copy | **DISABLED** ✅ | was the bug; now inert |
| SQL `process_deposit_settlements()` | SQL cron 5 | daily 04:00 | **deposits (empty)** | NO (RMW) | SQL copy | **DISABLED** ✅ | no-op landmine; now inert |

## Findings
- **Every ACTIVE wallet writer derives from `contributions`+`withdrawals`** and produces canonical balances — proven live (a post-repair payment reconciled to 0 drift).
- **The only non-canonical writers (the two SQL functions) are disabled** — they are the sole historical corruptors.
- **Duplication remains latent:** the balance formula still exists in Deno (edge) and Node (withdrawal/deposit/cron) as separate code. They currently **agree** (drift 0), but this is hand-synced — consolidation to a single `WalletService` is Phase 2.1 (out of scope here). It is not an *active* drift source today.
- **`RUN_SETTLEMENT_CRON` status is unverified** (runtime env not visible). Whether the Node settlement cron runs affects only dormant-collection settlement (see risk/readiness).

## Verdict: ✅ PASS
All active writers are canonical and mutually consistent. All non-canonical writers are disabled.
