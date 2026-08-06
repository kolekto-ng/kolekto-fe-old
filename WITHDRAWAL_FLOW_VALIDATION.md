# WITHDRAWAL_FLOW_VALIDATION

Verifies the withdrawal lifecycle has no dependency on the disabled SQL settlement functions. Code + live evidence.

## Lifecycle (verified — all from `contributions`, none from `deposits`/SQL crons)

| Stage | File · function | Source | Depends on cron 4/5? |
|-------|-----------------|--------|----------------------|
| Request | `controllers/withdrawal.js` · `requestWithdrawal` | — | No |
| Eligibility (picker) | `getEligibleCollections` — bulk recompute `computeWalletBalances` from contributions, minus pending requests | contributions+withdrawals | **No** |
| Cap check | `getWithdrawableSnapshot` → `refreshWallet` (recompute) → `available − pending requests` | contributions+withdrawals | **No** |
| Wallet refresh on request/approve | `refreshWallet` writes `wallets` from `computeWalletBalances` | contributions+withdrawals | **No** |
| Approval | `approveWithdrawal` → `refreshWallet` again | contributions+withdrawals | No |
| Updated balances | `wallets.*` rewritten (Node, canonical) | contributions | No |
| Ledger identity | `available + pending = ledger` maintained by `computeWalletBalances` | — | No |

## Key safety property
The withdrawal **cap is always recomputed** at request and approval time (`refreshWallet` / `getEligibleCollections`) — it **never trusts the stored `available_balance` column**. This is why the pre-repair corruption could never cause an incorrect payout, and why the withdrawal path is fully independent of the disabled settlement crons.

## Additional benefit post-repair
Because `refreshWallet` writes the wallet with the canonical (contributions-based) balances, **any withdrawal request also refreshes that collection's wallet correctly** — a second self-healing path alongside the edge verify writer.

## Live state
- 24 withdrawals unchanged through the repair; 0 collections over-withdrawn (withdrawn ₦294,300 ≤ raised ₦50.06M).
- `withdrawn` column across wallets = ₦294,300 (matches source).

## Verdict: ✅ PASS
Withdrawals function correctly and safely with cron 4/5 disabled. No dependency on `settle_pending_balances()`, `process_deposit_settlements()`, or `deposits`.
