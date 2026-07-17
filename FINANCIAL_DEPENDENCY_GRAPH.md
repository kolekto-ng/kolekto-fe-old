# FINANCIAL_DEPENDENCY_GRAPH (master)

Read-only synthesis of writers (`WALLET_WRITE_MATRIX.md`), readers (`WALLET_READ_MATRIX.md`), and the `deposits`/settlement subsystem. Grounded in code + live DB introspection.

```mermaid
flowchart TD
  subgraph SOURCE["SOURCE OF TRUTH"]
    C[("contributions (paid)")]
    W[("withdrawals")]
  end
  subgraph PROJ["PROJECTION (cache)"]
    WAL[("wallets.*")]
  end
  subgraph DEAD["LEGACY / DEAD"]
    D[("deposits (0 rows)")]
  end

  %% WRITERS
  EV["Edge verify-paystack-payment<br/>refreshCollectionAndWallets (Deno math)"] -->|writes| WAL
  EV -->|reads| C
  UWS["Express deposit.js updateWalletStats"] -->|writes| WAL
  UWS -->|reads| C
  RW["Express withdrawal.js refreshWallet"] -->|writes| WAL
  RW -->|reads| C
  RW -->|reads| W
  NC["Node cron paymentSettlement (env-gated)"] -->|writes| WAL
  NC -->|reads| C
  WC["Wallet creation (edge/CollectionService)"] -->|insert zeros| WAL

  SPB["SQL settle_pending_balances() (cron4)"] ==>|CORRUPTS: avail=-withdrawn| WAL
  SPB -->|reads| D
  PDS["SQL process_deposit_settlements() (cron5)"] -->|no-op RMW| WAL
  PDS -->|reads| D

  %% READERS
  WAL --> RWEB["withdrawal cap (AUTHORITATIVE: recomputes, ignores cache)"]
  WAL --> DASH["organizer dashboard (collection.js getUserCollections) — DISPLAY"]
  WAL --> WEP["controllers/wallet.js getCollectionWallet — DISPLAY"]
  WAL --> ADMIN["admin dashboards / stores — DISPLAY"]
  WAL --> VIEW["email_recipient_directory VIEW — DISPLAY"]
  WAL --> FE["FE dashboard/withdraw/contribute pages — DISPLAY"]

  classDef bad fill:#ffd5d5,stroke:#c00;
  class SPB,PDS,D bad;
```

## Edge legend
- **Bold red (`==>`):** `settle_pending_balances()` — the only edge that corrupts. Reads empty `deposits`, overwrites `wallets.available/pending` nightly.
- **`deposits` (red):** empty, unreferenced by any view/trigger/FK; only the two SQL functions and the dormant Express init path read/write it.
- **Every correct wallet value** flows from `contributions` (+`withdrawals`) via a Node or Deno writer.
- **The withdrawal cap** is the only money-critical *reader*, and it **recomputes** rather than trusting the cache → corruption cannot cause an over-payout.

## What to cut (Phase 2.1B)
Sever the two red edges (`settle_pending_balances`, `process_deposit_settlements`) → corruption stops, **no other edge is touched**. Then recompute `wallets` from `contributions` (any canonical writer) → all DISPLAY readers correct instantly. See `EXECUTION_ORDER.md`.

## One-line dependency truth
> `wallets` depends entirely on `contributions`+`withdrawals`. `deposits` depends on nothing and nothing depends on it. The corruptor depends on `deposits`. Therefore removing the corruptor and the `deposits` subsystem is safe.
