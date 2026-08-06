# WAVE1_IMPLEMENTATION_REPORT (Phase 2.2 — Node Financial Delegation)

**Scope:** Node (Express backend `kolekto-be-old`) only. Edge and SQL untouched.
**Nature:** architectural delegation — *where* financial computation lives moved;
**no financial behaviour changed**. Wave 2 is not started.

---

## 1. What changed and why

The backend stopped owning financial math. Every financial computation now
resolves to the Wave 0 Financial Projection Engine (FPE). The duplicated Node
implementation is gone; `utils/financial.js` is now a thin adapter.

| # | Change | File(s) | Why |
|---|--------|---------|-----|
| 1 | **Engine build** — compile canonical TS → plain ESM JS | `kolekto-shared-financial/tsconfig.build.json`, `package.json` (`build` script) | Backend is plain-JS ESM with no build step and no experimental flags in prod; it needs runnable `.js`. |
| 2 | **Vendor** the built engine into the backend | `kolekto-be-old/utils/fpe/**` (+ `scripts/vendor-backend.mjs`, `vendor:backend` script) | Backend deploys independently; the sibling repo is absent at deploy time, so the engine is vendored as a committed build artifact. |
| 3 | **`financial.js` → adapter** delegating to the engine | `kolekto-be-old/utils/financial.js` | Business math must exist once. Adapter preserves the exact public API. |
| 4 | **Withdrawal cap math delegated** | `kolekto-be-old/controllers/withdrawal.js` | Removed the inline `getEligibleCollections` cap derivation + hardcoded pending-status list → `computeWithdrawalEligibility` / `computePendingWithdrawals`. |
| 5 | **Dashboard cutoff delegated** | `kolekto-be-old/controllers/dashboard.js` | Removed the inline `getSettlementCutoffUtc` duplicate → engine `getSettlementCutoff` (proven byte-identical). |

Everything else that imports `utils/financial.js` (contribution, deposit,
collectionAccess, admin/wallet, financialReconcile, …) **delegates transitively
with zero code change** — their imports now resolve to the engine.

---

## 2. Consumption mechanism (the key decision)

**Chosen: compile-and-vendor.** The canonical engine remains the TypeScript
package `kolekto-shared-financial`. `npm run build` (`tsc -p tsconfig.build.json`,
using `rewriteRelativeImportExtensions` so `.ts` specifiers emit as `.js`)
produces `dist/` plain ESM. `npm run vendor:backend` copies `dist/` into
`kolekto-be-old/utils/fpe/`, banners each file as generated, and drops a README.

**Why not the alternatives:**
- *Runtime `--experimental-strip-types`* — requires an experimental flag on the
  production start command (`node app.js`); not production-safe.
- *Cross-repo `file:`/relative import* — the `kolekto-fe-old` repo is not present
  in the backend's independent deploy; the path would not resolve in prod.
- *npm registry package* — no private registry infra exists; out of scope.

Compile-and-vendor keeps **one canonical source** (TS), needs **no new runtime
tooling** in the backend, runs under **plain `node`**, and is guarded against
drift by the parity suite (which diffs the vendored adapter against the engine
source). Trade-off: the vendored `.js` is a committed build artifact — mitigated
by the generated-banner + reproducible `build && vendor:backend` + README.

---

## 3. The adapter (`utils/financial.js`)

Re-exports the **exact original public surface**, unchanged names/signatures/
return shapes, all delegating to `./fpe/index.js`:

`roundCurrency` · `calculateFees` · `deriveNetContribution` ·
`getSettlementCutoff` · `isPaymentSettled` · `normalizeContributions` ·
`computeWalletBalances`

Plus **additive** exports (do not affect existing callers) so controllers can
delegate withdrawal math through the adapter rather than re-deriving it:

`computeWithdrawalEligibility` · `computePendingWithdrawals` ·
`PENDING_WITHDRAWAL_STATUSES` (array) · `COMPLETED_WITHDRAWAL_STATUSES` (array)

The engine's injectable `now` defaults to the real clock, so the previous no-arg
signatures (`getSettlementCutoff()`, `computeWalletBalances(c, w)`, …) behave
identically.

---

## 4. Duplication eliminated (backend)

| Concern | Before (Node) | After |
|---------|---------------|-------|
| roundCurrency / calculateFees / deriveNet / normalize / cutoff / isSettled / computeWalletBalances | implemented in `financial.js` | **engine**, re-exported by the adapter |
| withdrawal cap (`getEligibleCollections` inline) | inline filter+reduce+cap | `computeWithdrawalEligibility` + `computePendingWithdrawals` |
| hardcoded `["pending","processing"]` | local const in `withdrawal.js` | engine `PENDING_WITHDRAWAL_STATUSES` |
| settlement cutoff (`getSettlementCutoffUtc`) | inline in `dashboard.js` | engine `getSettlementCutoff` |

**Deliberately NOT changed** (would alter output — out of Wave 1 scope):
- `dashboard.js` `successfulWithdrawals` breakdown uses
  `["success","successful","completed"]` (a reporting sub-category shown
  alongside a separate `approvedWithdrawals` field) — not a balance. The headline
  `withdrawn` already uses the engine's canonical set. See Wave 2 readiness R-D.

---

## 5. Files touched

**`kolekto-be-old` (production backend):**
- `utils/financial.js` — rewritten as adapter.
- `utils/fpe/**` — **new**, vendored engine (generated).
- `controllers/withdrawal.js` — imports + cap-math delegation.
- `controllers/dashboard.js` — cutoff delegation.

**`kolekto-fe-old/kolekto-shared-financial` (canonical package, additive):**
- `tsconfig.build.json` — **new** build config.
- `scripts/vendor-backend.mjs` — **new** vendor script.
- `package.json` — `build` + `vendor:backend` scripts.
- `dist/**` — **new** build output.

No payment/verify/webhook/settlement-SQL/edge file was modified.

---

## 6. Rollback strategy

- **Whole wave:** `git revert` the backend commit. `utils/financial.js` returns to
  its self-contained implementation; delete `utils/fpe/`. The engine package is
  additive and untouched by callers.
- **Per file:** each of `withdrawal.js` / `dashboard.js` is an independent,
  small, revertible edit; reverting one does not affect the others (the adapter
  keeps working).
- The vendored engine is regenerable at any time via `npm run build &&
  npm run vendor:backend`.

Validation results: **`WAVE1_VALIDATION_REPORT.md`**. Edge readiness:
**`WAVE2_READINESS_REPORT.md`**.
