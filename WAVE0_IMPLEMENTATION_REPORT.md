# WAVE0_IMPLEMENTATION_REPORT (Phase 2.2 — Financial Projection Engine)

**Scope:** Wave 0 only — scaffold the engine + golden-vector infrastructure, lift
the Node reference logic verbatim, prove Node parity. **No production caller was
touched. Nothing was deployed. No runtime uses the engine yet.**

---

## 1. What was built

A new, dependency-free, pure-TypeScript package: **`kolekto-shared-financial`**.

```
kolekto-fe-old/kolekto-shared-financial/
├── package.json            # type:module, no runtime deps, node --test scripts
├── tsconfig.json           # strict + erasableSyntaxOnly (valid for Node strip-types AND Deno)
├── README.md               # package overview → points at FINANCIAL_ENGINE_API.md
├── src/
│   ├── constants.ts        # L0 — canonical rates, caps, hour, status sets, enums
│   ├── types.ts            # L0 — type contracts (WalletProjection, rows, etc.)
│   ├── primitives.ts       # L1 — pure primitives (fees, cutoff, allocate, …)
│   ├── projections.ts      # L2 — projections (computeWallet, balances, tiers, eligibility)
│   └── index.ts            # public barrel export
└── test/
    ├── golden-vectors.json # 1 language-agnostic fixture, all 3 harnesses share it
    ├── _runner.ts          # shared runtime-agnostic vector runner (Node + Deno)
    ├── node.harness.ts     # Node harness — RUNS in Wave 0 (scorecard + exit code)
    ├── vectors.test.ts     # node:test wrapper (one assertion per vector)
    ├── characterization.test.ts  # the backend's locked 63-assertion math, vs the engine
    ├── parity.test.ts      # differential parity: engine vs LIVE kolekto-be-old/utils/financial.js
    ├── deno.harness.ts     # Deno harness — READY (runs in Wave 2)
    └── sql.harness.sql     # Postgres harness — READY (runs in Wave 3)
```

### Placement decision
The package lives **inside `kolekto-fe-old/`**, on the current branch, so it is
version-controlled and reverts as a single unit (matching the plan's rollback
posture: *"delete the package; nothing depended on it"*). It touches **zero**
production code. Cross-repo consumption (Node in `kolekto-be-old`, Edge Deno) is
a Wave 1/2 wiring concern — Wave 0 only requires the engine to exist, be pure,
and prove parity. When Node adoption begins, the directory can be promoted to a
true sibling/workspace package with no code change (it is already self-contained
and dependency-free).

---

## 2. Engine architecture (the layer model, as designed)

```
L0  constants.ts / types.ts   pure data + type contracts, zero logic
L1  primitives.ts             deterministic scalar math, no arrays, no I/O
L2  projections.ts            array → number projections over the 2 event streams
────────────────────────────────────────────────────────────────────────────
L3  ADAPTERS (NOT in this package) — each runtime owns its own I/O:
     Node fetch→computeWallet→write · Edge same via Deno import · SQL mirror
```

**Hard boundaries honoured:** no database, no Supabase client, no `fetch`, no
network, no logging, no environment variables, **no hidden time dependency**.
Time enters exclusively through an injected `now` parameter (defaulting to
`new Date()` so existing call signatures are preserved). Every exported function
is a pure, deterministic function of its arguments.

---

## 3. Functions implemented

**L1 primitives** — `roundCurrency`, `platformFeeRate`, `calculateFees`,
`deriveNetContribution`, `normalizeContribution`, `normalizeContributions`,
`getSettlementCutoff(now)`, `isPaymentSettled(date, now)`, `allocateAmounts`.

**L2 projections** — `computeWallet` (→ `WalletProjection`),
`computeWalletBalances` (legacy Node field names, for byte-parity),
`computeAvailableBalance`, `computePendingBalance`, `computeLedgerBalance`,
`computeOrganizerBalance`, `computeCollectionTotals`, `computePendingWithdrawals`,
`computeWithdrawalEligibility`, `buildTierAvailability`.

**L0 constants** — `PLATFORM_FEE_RATES`, `PLATFORM_FEE_RATE_DEFAULT`,
`GATEWAY_FEE_RATE`, `MAX_FEE_AMOUNT`, `SETTLEMENT_HOUR_UTC`, `ONE_DAY_MS`,
`COMPLETED_WITHDRAWAL_STATUSES`, `PENDING_WITHDRAWAL_STATUSES`,
`COLLECTION_TYPES`, `FEE_BEARERS`, plus the aggregate `CONSTANTS` bag.

Full signatures, contracts, and types: **`FINANCIAL_ENGINE_API.md`**.

---

## 4. Provenance — this was a *lift*, not a rewrite

| Engine function | Lifted verbatim from |
|---|---|
| `roundCurrency`, `calculateFees`, `deriveNetContribution` | `kolekto-be-old/utils/financial.js` (the reference; 0-drift) |
| `normalizeContribution(s)`, `computeWalletBalances` | same |
| `getSettlementCutoff`, `isPaymentSettled` | same, with `now` made injectable |
| `allocateAmounts`, `buildTierAvailability` | `supabase/functions/_shared/payment.ts` |
| `computeWithdrawalEligibility` | Node `controllers/withdrawal.js` (`getWithdrawableSnapshot` cap math) |
| Constants | `financial.js` constants |

The Node implementation is the reference because live reconciliation validates
it at **0 drift**. The only *behavioural* change anywhere in the engine is a
**convergence, not a change to Node**: `COMPLETED_WITHDRAWAL_STATUSES` adopts the
Node superset `{completed, successful, success, approved}`. This resolves the
latent Node/Edge divergence (matrix row 15) in Edge's favour-of-Node direction —
Edge previously used only `{completed, successful}`. SQL already used the Node
superset, so SQL and Node are unchanged.

---

## 5. Key design decisions

1. **`computeWallet` vs `computeWalletBalances`.** The canonical output is
   `computeWallet` → `WalletProjection {gross,net,withdrawn,pending,available,
   ledger}`. `computeWalletBalances` returns the *legacy* Node field names and is
   kept deliberately so the differential parity suite can diff the engine against
   today's backend with zero mapping ambiguity. They are the same numbers.

2. **Injected `now`.** The reference used a hidden `new Date()`. The engine makes
   `now` an explicit parameter so cutoff math is deterministic and testable, while
   defaulting to the real clock so drop-in delegation in Wave 1 needs no call-site
   changes.

3. **`deriveNetContribution` uses Node's one-step-refine algorithm**, not the
   edge's binary search. The plan mandates lifting *Node* (the 0-drift reference);
   both produce identical results on the vectors, but Node is authoritative.

4. **`erasableSyntaxOnly` TypeScript.** The engine uses only type-erasable syntax
   (no enums/namespaces/param-properties) and explicit `.ts` import extensions, so
   the identical source runs under Node's `--experimental-strip-types` **and**
   natively under Deno — one source, two runtimes, no build step.

5. **One fixture, three harnesses.** `golden-vectors.json` is fully deterministic
   (absolute ISO timestamps + explicit `now` per wallet vector). Node and Deno
   share `_runner.ts`; the SQL harness mirrors the same vectors. Equivalence is
   therefore checked against one authored source of expected values.

---

## 6. What was explicitly NOT done (Wave 0 boundary)

No production caller modified · payment init / verify / webhook / settlement /
withdrawals / reconciliation / dashboard untouched · nothing deployed · Node not
switched to the engine · Edge not switched · SQL not modified · no existing
implementation deleted · Wave 1 not started.
