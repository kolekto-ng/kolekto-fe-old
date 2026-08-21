/**
 * constants.ts — L0 canonical financial constants.
 *
 * THE single source for every rate, cap, hour, and status set in Kolekto's
 * money math. Node and Deno import these; the SQL mirror hard-codes the same
 * literals under `-- MIRRORS kolekto-shared-financial` annotation.
 *
 * Lifted verbatim from the reference implementation (kolekto-be-old
 * utils/financial.js), which reconciliation validates at 0 drift. The ONE
 * deliberate convergence: COMPLETED_WITHDRAWAL_STATUSES adopts the Node set
 * (the superset), resolving the latent Node/Edge divergence documented in
 * FINANCIAL_COMPUTATION_MATRIX.md row 15.
 */

import type { CollectionType, FeeBearer } from "./types.ts";

/**
 * Platform fee rate per collection type.
 *   fundraising → 1%; everything else → 0.5%.
 * Unknown types fall back to PLATFORM_FEE_RATE_DEFAULT (see calculateFees).
 */
export const PLATFORM_FEE_RATES: Readonly<Record<CollectionType, number>> = {
  fundraising: 0.01, // 1%
  fixed: 0.005, // 0.5%
  tiered: 0.005, // 0.5%
  ticket: 0.005, // 0.5%
  open_pool: 0.005, // 0.5%
};

/** Fallback platform rate for any collection type not in PLATFORM_FEE_RATES. */
export const PLATFORM_FEE_RATE_DEFAULT = 0.005; // 0.5%

/** Paystack gateway fee rate — 1.5% for all collection types. */
export const GATEWAY_FEE_RATE = 0.015;

/** Per-fee cap: each of platform and gateway fee is capped at ₦2,000. */
export const MAX_FEE_AMOUNT = 2000;

/**
 * T+1 settlement hour, in UTC. Settlement runs at 5:00 AM WAT (UTC+1) = 4:00
 * AM UTC. A payment made before the most recent 04:00 UTC cutoff is settled
 * (available); at/after is pending until the next cutoff.
 */
export const SETTLEMENT_HOUR_UTC = 4;

/** Milliseconds in one day — the cutoff step. */
export const ONE_DAY_MS = 86_400_000;

/**
 * Withdrawal statuses that count as money that has LEFT the wallet.
 *
 * CANONICAL (superset). Node accepted all four; Edge accepted only
 * {completed, successful}. The engine adopts Node's set — the value
 * reconciliation already validates at 0 drift. Edge conformance to this set is
 * proven by the "approved"/"success" divergence golden vectors.
 *
 *   completed / successful / success → legacy Paystack-transfer terminal states
 *   approved                         → the state the admin panel writes on a
 *                                      manual payout ("mark as paid")
 */
export const COMPLETED_WITHDRAWAL_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "successful",
  "success",
  "approved",
]);

/**
 * Withdrawal statuses that are in-flight: they reserve against the withdrawable
 * cap but are NOT yet deducted from `available` (only completed withdrawals
 * reduce available). See computeWithdrawalEligibility.
 *
 * `pending_owner_approval` (Wave 6.7F.4): an ADMIN-initiated withdrawal
 * awaiting its Workspace OWNER's approval, before it is even eligible to
 * enter the existing Kolekto Super Admin approval flow. It reserves funds
 * identically to `pending`/`processing` — the money is spoken for the moment
 * the request is created, not only once an OWNER has approved it — so it
 * must count here or a collection could be over-committed by requests that
 * simply haven't reached OWNER approval yet. request_withdrawal_atomic's own
 * SQL-side reservation query mirrors this exact three-value set.
 */
export const PENDING_WITHDRAWAL_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "processing",
  "pending_owner_approval",
]);

/** All recognised collection types (for validation / iteration). */
export const COLLECTION_TYPES: readonly CollectionType[] = [
  "fixed",
  "fundraising",
  "tiered",
  "ticket",
  "open_pool",
];

/** The two fee bearers. */
export const FEE_BEARERS: readonly FeeBearer[] = ["contributor", "organizer"];

/**
 * Aggregate constant bag — the shape design docs refer to as `FPE.CONSTANTS`.
 * Prefer the named exports above in new code; this is a convenience view.
 */
export const CONSTANTS = {
  PLATFORM_FEE_RATES,
  PLATFORM_FEE_RATE_DEFAULT,
  GATEWAY_FEE_RATE,
  MAX_FEE_AMOUNT,
  SETTLEMENT_HOUR_UTC,
  ONE_DAY_MS,
  COMPLETED_WITHDRAWAL_STATUSES,
  PENDING_WITHDRAWAL_STATUSES,
  COLLECTION_TYPES,
  FEE_BEARERS,
} as const;
