# WALLET_READ_MATRIX (TASK 2)

Every place that **reads** wallet balance columns. Read-only analysis. Evidence: code search across `kolekto-fe-old/src`, `kolekto-admin-control-panel-1/src`, `kolekto-be-old`, edge functions, and live view introspection.

**Columns:** `net_payment`, `gross_payment`, `pending_balance`, `available_balance`, `ledger_balance`, `withdrawn`. (Brief's `withdrawn_balance` does not exist → real column is `withdrawn`.)

**The critical distinction:** readers split into **DISPLAY** (read the cached column — currently show corrupted values) and **AUTHORITATIVE** (recompute from `contributions` — always correct).

## Backend (Express / SQL)

| Reader | File · function | Columns | Type | Corrupted today? |
|--------|-----------------|---------|------|------------------|
| User wallet endpoint | `controllers/wallet.js` · `getCollectionWallet` | all 6 | **DISPLAY** (SELECT cached) | **Yes** |
| Organizer dashboard | `controllers/collection.js` · `getUserCollections` / `getSingleCollection` (nested `wallets(...)`) | all 6 + fee_breakdown | **DISPLAY** | **Yes** |
| Admin wallet view | `controllers/admin/wallet.js` | recomputes | **AUTHORITATIVE** (live recompute from `contributions`) | No |
| Withdrawal eligibility | `controllers/withdrawal.js` · `getEligibleCollections` | available (recomputed) − pending requests | **AUTHORITATIVE** | No |
| Withdrawal request | `controllers/withdrawal.js` · `requestWithdrawal` → `getWithdrawableSnapshot` → `refreshWallet` | recomputes then reads | **AUTHORITATIVE** | No |
| Email/marketing | SQL view `email_recipient_directory` (`JOIN wallets w ON w.collection_id=c.id`) | net/available (earnings agg) | **DISPLAY** | **Yes** |
| Merge-tag/email fields | `database/email_merge_tag_fields.sql` | wallet-derived | **DISPLAY** | Possibly |

## Frontend — customer PWA (`kolekto-fe-old/src`)

| Reader | Purpose | Type |
|--------|---------|------|
| `pages/dashboard/CollectionDetailsPage.tsx` | organizer sees balances | DISPLAY (corrupted) |
| `pages/dashboard/SharedCollectionDetailPage.tsx` | shared/collaborator view | DISPLAY (corrupted) |
| `pages/dashboard/TransactionHistoryPage.tsx` | wallet/transaction history | DISPLAY |
| `components/withdrawals/WithdrawFundsDialog.tsx` | shows withdrawable | DISPLAY of the API value (API recomputes → correct) |
| `pages/contribute/ContributePage.tsx`, `components/contribute/ContributionForm.tsx` | contribute UI (raised totals) | DISPLAY |
| `utils/fundraisingCampaigns.ts` | campaign progress | DISPLAY |

## Frontend — admin (`kolekto-admin-control-panel-1/src`)

| Reader | Purpose | Type |
|--------|---------|------|
| `stores/dashboardStore.ts` | admin platform totals | DISPLAY (corrupted) |
| `stores/usersStore.ts`, `pages/UserDetailPage.tsx` | per-user balances | DISPLAY |
| `stores/collectionsStore.ts`, `pages/CollectionDetailPage.tsx` | per-collection balances | DISPLAY |
| `integrations/supabase/types.ts` | type defs only | n/a |

## Summary
- **The withdrawal money path is AUTHORITATIVE** (recomputes from `contributions`) → the corruption **cannot** cause an incorrect payout cap. This is the key safety fact.
- **Everything user-facing is DISPLAY** and currently shows the corrupted cache (available=0 / negative). Organizer dashboards, admin dashboards, the wallet endpoint, and the marketing earnings view all read stale/corrupt values.
- **Impact of the repair:** once wallets are recomputed (Phase 2.1B-B) and the corruptor stopped, every DISPLAY reader instantly shows correct values with **no reader code change** — they read the same columns, now correct.
- **No reader depends on `settle_pending_balances()` having run** — they read whatever is in the column; the withdrawal path ignores the column entirely.
