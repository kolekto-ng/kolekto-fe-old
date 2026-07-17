# Kolekto — Financial Drift Repair Plan (roadmap only)

**No repair is performed here.** This is the ordered, validate-between-steps roadmap for a *future* approved repair phase (Phase 2.1). It follows from `FINANCIAL_DRIFT_ROOT_CAUSE_REPORT.md`. Companion: `FINANCIAL_RISK_ASSESSMENT.md`.

**Governing principle:** because `wallets.*` is a **rebuildable projection** of intact source rows, the vast majority of the drift is fixed by **one idempotent recompute per collection** — *not* by editing balances by hand. Never hand-edit a balance; always recompute from source.

---

## Pre-repair gates (must pass before touching anything)

1. **Run the detectors** (`§A1–A6`) and populate `FINANCIAL_DRIFT_CLASSIFICATION.csv`. Confirm the 48 collapse to the expected ~4 causes.
2. **§A6 must return zero rows** (no withdrawn-exceeds-raised, no worrying orphans). If it returns rows → **STOP**, escalate: that is the only signature of *real* loss and must be investigated individually before any bulk recompute.
3. **Decide the canonical `net_payment` semantics for organizer-borne (R1)** — this is a *policy* decision, not a bug-fix: is `net_payment` "gross raised" (Edge, 5000) or "organizer take-home after fees" (Node, 4900)? The withdrawal gate already uses the Node figure, so **Node is recommended as canonical**; the Edge writer becomes the thing to align. **Recompute must not run until this is decided**, or you will "fix" wallets to a number you later change.
4. **Snapshot** every wallet row (id, all balances, updated_at) to an audit table/export before any write, so any recompute is fully reversible.
5. Apply the Phase-2.0 guardrails first (`G1` idempotency, `G2` withdrawal race) in staging — repairing before the race is closed risks re-introducing R3-style artifacts.

---

## Repair order (validate after every step)

```
R0 Decide canonical net formula (policy)  ──►  validate on 3 sample collections
        │
R1 Align the Edge writer to normalizeContributions (or vice-versa)  ──►  parity test edge==node
        │      (code change — Phase 2.1, behind the PaymentService consolidation; NOT a data fix)
        ▼
R4 Backfill missing / dedup duplicate wallet rows  ──►  §A5 returns zero
        │      (create the row with zeros; dedup keeps newest AFTER verifying balances)
        ▼
BULK Idempotent recompute: run refreshWallet for EVERY collection  ──►  reconcile drift == 0
        │      (fixes R1-stored, R2, R3 in one pass — rewrites cache from source)
        ▼
R3 Verify no negatives remain (§A4 empty); investigate any that survive recompute individually
        │
VALIDATE  reconcile:financials → 0 drift, 0 impossible states  ──►  proceed to Phase 2.1
```

**Why this order:**
- **R0/R1 before the bulk recompute** — recomputing to a formula you haven't ratified just moves the drift. Fix the formula question first.
- **R4 before recompute** — recompute early-returns on a missing wallet, so backfill the row first or those collections stay unfixed.
- **The bulk recompute is the single lever** — one `refreshWallet` per collection rewrites `net/pending/available/ledger/withdrawn` from source, simultaneously clearing R2 staleness and R3 negatives and applying the ratified R1 formula. It is idempotent and reversible (snapshot).
- **Validate = re-run reconciliation** after each step; drift count is the objective success metric.

---

## What each repair actually is

| Cause | Repair | Type | Automatable | Migration? | Backfill? | Before PaymentService? |
|-------|--------|------|-------------|-----------|-----------|------------------------|
| R1 fee divergence | align Edge writer to the ratified formula | **code** (Phase 2.1) | n/a | no | via bulk recompute | **do the alignment as part of** PaymentService/WalletService consolidation |
| R2 settlement staleness | bulk recompute + ensure ONE settlement executor runs daily | data + ops | yes | no (ops: set `RUN_SETTLEMENT_CRON` / verify `pg_cron`) | recompute | recompute can be done now; executor fix now |
| R3 legacy negatives | bulk recompute (floors at 0) | data | yes | no | recompute | can be done now |
| R4 missing/dup wallet | create row / dedup then recompute | data | yes (careful for dup) | no | yes | **yes, do first** |
| R5 historical fee policy | decide whether to normalize historical rows to old rates | policy | partial | no | maybe | tie to R0 decision |

---

## Explicitly out of scope here
- No balances edited, no rows deleted, no migrations applied, no `refreshWallet` executed.
- The R1 code alignment is deferred to Phase 2.1 (PaymentService/WalletService consolidation) so the Edge and Node writers converge to **one** implementation — repairing the data and then leaving two divergent writers would let R1 drift immediately reappear.

**Success criterion for the repair phase:** `npm run reconcile:financials` reports **0 drift and 0 impossible states**, achieved by recompute-from-source (reversible), with a single canonical wallet writer afterwards.
