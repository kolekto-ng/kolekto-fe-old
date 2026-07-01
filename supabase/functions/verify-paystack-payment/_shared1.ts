/**
 * verify-paystack-payment — self-contained single-file edge function.
 * Safe to paste directly into the Supabase web console editor.
 * All shared utilities are inlined — no external local imports needed.
 *
 * Fee handling rules (applied to ALL collection types):
 *   - contributionAmount  = base amount (fixed price / selected tier / entered amount)
 *   - totalPayable        = what Paystack charges (contributionAmount + fees if contributor-borne)
 *   - contributions.amount = NET to host:
 *       • feeBearer=contributor → contributionAmount (fees paid on top by contributor)
 *       • feeBearer=organizer   → contributionAmount − fees (fees deducted from payment)
 *   - contributions.gross_amount = what Paystack actually charged the contributor
 *   - fundraising: fees always contributor-borne (override fee_bearer)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ─────────────────────────────────────────────────────────────────────
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── SHARED TYPES ─────────────────────────────────────────────────────────────
export type FeeBearer = "contributor" | "organizer";

export interface TicketSelection {
  tierId: string | null;
  tierName: string;
  pricePerUnit: number;
  quantity: number;
  subtotal: number;
  description?: string | null;
  prefix?: string | null;
  remainingCapacity?: number | null;
}

export class PaymentValidationError extends Error {
  status: number;
  code: string;
  logContext?: Record<string, unknown>;
  constructor(
    message: string,
    status = 400,
    code = "payment_validation_error",
    logContext?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PaymentValidationError";
    this.status = status;
    this.code = code;
    this.logContext = logContext;
  }
}

// ─── SHARED UTILITIES ────────────────────────────────────────────────────────
export function roundCurrency(value: number): number {
  return Number((Number(value) || 0).toFixed(2));
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number((value as string).replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function asPositiveInt(value: unknown): number {
  const parsed = Math.floor(asNumber(value));
  return parsed > 0 ? parsed : 0;
}

export function getCollectionType(collection: Record<string, unknown>) {
  return String(collection.collection_type || collection.type || "fixed").trim();
}

/**
 * Round 4 correction (verified against real production data): a schema
 * migration added `unique_id_enabled` with `NOT NULL DEFAULT false`, which
 * backfilled EVERY pre-existing collection to `false` — including ones
 * that already had a real `code_prefix` configured and had been
 * generating codes successfully for months under the old (prefix-only)
 * logic. In Kolekto's actual production database this affects 89
 * collections (vs. only 12 with the column genuinely `true`) — treating
 * `false` as a hard block, as an earlier pass here did, silently broke
 * code generation for the large majority of collections that had it
 * working before this column existed, with zero ill effect on the small
 * number of new ones (because the current collection-creation UI always
 * clears `code_prefix` whenever the toggle is off, so for any collection
 * saved through it, "a prefix is configured" and "the toggle is on" are
 * the same fact). So: a configured prefix — collection-level OR on the
 * specific tier/ticket type being purchased — is what actually drives
 * generation; `unique_id_enabled` is read for display only (e.g. whether
 * a receipt shows a "your code" section), never as a gate.
 */
export function hasAnyConfiguredPrefix(collection: Record<string, unknown>): boolean {
  if (collection.code_prefix) return true;
  const tiers = getPriceTiers(collection);
  return tiers.some((t) => Boolean((t as Record<string, unknown>)?.prefix));
}

export function getPriceTiers(collection: Record<string, unknown>) {
  const tiers = collection.price_tiers || collection.pricing_tiers;
  return Array.isArray(tiers) ? tiers : [];
}

export function getTierLabel(tier: Record<string, unknown>, index: number) {
  return String(tier.name || `Tier ${index + 1}`);
}

export function getTierMatchKey(tier: Record<string, unknown>, index: number) {
  return String(tier.id || tier.name || `tier-${index}`);
}

export function getInfoRows(row: Record<string, unknown>) {
  if (Array.isArray(row.contributor_information)) {
    return row.contributor_information.filter(
      (e: unknown) => e && typeof e === "object"
    ) as Array<Record<string, unknown>>;
  }
  if (row.contact_info && typeof row.contact_info === "object") {
    return [row.contact_info as Record<string, unknown>];
  }
  return [];
}

export function calculateFees(amount: number, collectionType: string, feeBearer: FeeBearer) {
  const sanitizedAmount = roundCurrency(amount);
  const platformRate = collectionType === "fundraising" ? 0.01 : 0.005;
  const platformFee = roundCurrency(Math.min(sanitizedAmount * platformRate, 2000));
  const gatewayFee = roundCurrency(Math.min(sanitizedAmount * 0.015, 2000));
  const totalFees = roundCurrency(platformFee + gatewayFee);
  const totalPayable =
    feeBearer === "contributor"
      ? roundCurrency(sanitizedAmount + totalFees)
      : sanitizedAmount;
  return { platformFee, gatewayFee, totalFees, totalPayable };
}

/**
 * Given the total a contributor actually paid (Paystack amount / 100),
 * reverse-calculate the base contribution amount. Used as a fallback when
 * metadata.contributionAmount is missing (e.g. due to Paystack metadata
 * truncation on redirect).
 */
export function reverseCalculateContribution(
  totalPayable: number,
  collectionType: string,
  feeBearer: FeeBearer
): number {
  if (feeBearer === "organizer") return roundCurrency(totalPayable);
  // Binary search: find C such that calculateFees(C, ...).totalPayable ≈ totalPayable
  let lo = 0;
  let hi = totalPayable;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { totalPayable: tp } = calculateFees(mid, collectionType, feeBearer);
    if (Math.abs(tp - totalPayable) < 0.005) return roundCurrency(mid);
    if (tp < totalPayable) lo = mid;
    else hi = mid;
  }
  return roundCurrency((lo + hi) / 2);
}

export function allocateAmounts(total: number, weights: number[]) {
  const normalized = weights.map((w) => roundCurrency(Math.max(0, w)));
  const sum = normalized.reduce((a, w) => a + w, 0);
  if (normalized.length === 0) return [];
  if (roundCurrency(total) === 0 || sum === 0) return normalized.map(() => 0);
  let remaining = roundCurrency(total);
  return normalized.map((w, i) => {
    if (i === normalized.length - 1) return remaining;
    const share = roundCurrency((total * w) / sum);
    remaining = roundCurrency(remaining - share);
    return share;
  });
}

export function buildTierAvailability(
  tiers: Array<Record<string, unknown>>,
  paidRows: Array<Record<string, unknown>>
) {
  const soldByTier = new Map<string, number>();
  for (const row of paidRows) {
    const infoRows = getInfoRows(row);
    for (const info of infoRows) {
      const tierId = info.TierId ? String(info.TierId) : "";
      const tierName = info.Tier ? String(info.Tier) : "";
      const quantity = asPositiveInt(info.Quantity) || 1;
      if (tierId) soldByTier.set(tierId, (soldByTier.get(tierId) || 0) + quantity);
      else if (tierName) soldByTier.set(tierName, (soldByTier.get(tierName) || 0) + quantity);
    }
  }
  return tiers.map((tier, index) => {
    const tierId = tier.id ? String(tier.id) : null;
    const tierName = getTierLabel(tier, index);
    const sold =
      (tierId ? soldByTier.get(tierId) : undefined) ||
      soldByTier.get(tierName) ||
      0;
    const totalCapacity = tier.quantity == null ? null : asPositiveInt(tier.quantity);
    const remainingCapacity = totalCapacity == null ? null : Math.max(0, totalCapacity - sold);
    return { ...tier, tierId, tierName, tierKey: getTierMatchKey(tier, index), sold, totalCapacity, remainingCapacity };
  });
}

export function matchTier(
  tiers: Array<Record<string, unknown>>,
  selection: Record<string, unknown>
) {
  const requestedTierId = selection.tierId ? String(selection.tierId) : selection.id ? String(selection.id) : null;
  const requestedTierName = selection.tierName ? String(selection.tierName) : selection.name ? String(selection.name) : null;
  return tiers.find((tier) => {
    if (requestedTierId && tier.tierId === requestedTierId) return true;
    if (requestedTierName && tier.tierName === requestedTierName) return true;
    return false;
  }) || null;
}

/**
 * Root-cause fix: this function only ever runs from the `transaction.status
 * === "success"` branch — i.e. AFTER Paystack has already captured the
 * contributor's money. It used to also reject paused/closed/completed/
 * pending_review collections here, which made sense for `initiate-paystack-
 * payment` (blocking a NEW charge attempt) but is wrong here: a collection's
 * CURRENT lifecycle status (which can change between charge-time and
 * verify-time — e.g. an auto-close cron firing on `deadline`, or an admin
 * pausing/closing it) must not retroactively un-confirm a payment Paystack
 * already settled. Doing so silently dropped the contribution (no row, no
 * wallet update, no notification) and was UNRECOVERABLE via Admin Reconcile,
 * because reconcile calls this exact same function/code path and hit the
 * identical rejection every time.
 *
 * Only `deleted_at` remains a hard block — a hard-deleted collection has no
 * wallet/host to credit, so there's nothing safe to do with the money here
 * (requires manual support intervention, not auto-recovery).
 */
export function ensureCollectionIsPayable(collection: Record<string, unknown>, collectionId: string) {
  const status = String(collection.status || "active");
  if (collection.deleted_at) throw new PaymentValidationError("This collection is no longer available.", 404, "collection_deleted", { collectionId, status });
  if (status === "paused" || status === "closed" || status === "completed" || status === "pending_review" || status === "pending_verification") {
    console.warn(
      `[verify] LEGACY_PAYABLE_GATE_BYPASSED collectionId=${collectionId} status=${status} — ` +
      `recording an already-captured Paystack payment despite non-active collection status.`
    );
  }
}

export function normalizePaymentRequest(input: {
  collection: Record<string, unknown>;
  metadata: Record<string, unknown>;
  paidRows?: Array<Record<string, unknown>>;
  paystackVerifiedTotal?: number;
}) {
  const collection = input.collection;
  const metadata = input.metadata || {};
  const paidRows = input.paidRows || [];
  const paystackVerifiedTotal = input.paystackVerifiedTotal ?? 0;

  const collectionId = String(metadata.collectionId || metadata.collection_id || collection.id || "").trim();
  if (!collectionId) throw new PaymentValidationError("A valid collection ID is required.", 400, "missing_collection_id");

  ensureCollectionIsPayable(collection, collectionId);
  const collectionType = getCollectionType(collection);

  // CRITICAL: fundraising fees are ALWAYS contributor-borne.
  // This keeps Total Raised = pure contribution amount across all collection types.
  const feeBearer: FeeBearer =
    collectionType === "fundraising"
      ? "contributor"
      : String(collection.fee_bearer || metadata.feeBearer || "organizer") === "contributor"
      ? "contributor"
      : "organizer";

  // Read both metadata shapes:
  //   NEW (flat): contactName/contactEmail/contactPhone, formDataJson, ticketSelectionsJson
  //   OLD (nested): metadata.contact, metadata.formData, metadata.ticketSelections
  // The new shape was introduced because Paystack rejects deeply-nested
  // metadata with a generic 400 "An error occurred".
  const safeJsonParse = (input: unknown): any => {
    if (input == null) return null;
    if (typeof input === "object") return input;
    if (typeof input === "string") {
      try { return JSON.parse(input); } catch { return null; }
    }
    return null;
  };

  const contactSource = (metadata.contact && typeof metadata.contact === "object")
    ? (metadata.contact as Record<string, unknown>)
    : {
        name: metadata.contactName,
        email: metadata.contactEmail,
        phone: metadata.contactPhone,
      };

  const parsedFormData = safeJsonParse(metadata.formDataJson);
  const formData: Record<string, unknown> =
    (metadata.formData && typeof metadata.formData === "object")
      ? (metadata.formData as Record<string, unknown>)
      : (parsedFormData && typeof parsedFormData === "object")
        ? parsedFormData
        : {};

  const contact = {
    name: String(contactSource.name || "").trim(),
    email: String(contactSource.email || "").trim(),
    phone: String(contactSource.phone || "").trim(),
  };

  const allTiers = buildTierAvailability(getPriceTiers(collection), paidRows);
  const maxContributions = asPositiveInt(collection.max_contributions || collection.max_participants);
  const paidCount = paidRows.length;
  const remainingContributionCapacity = maxContributions > 0 ? Math.max(0, maxContributions - paidCount) : null;

  let contributionAmount = 0;
  let quantity = 1;
  let selectedTier: string | null = null;
  let selectedTierId: string | null = null;
  let selectedTierPrefix: string | null = null;
  let ticketSelections: TicketSelection[] = [];

  if (collectionType === "fundraising" || collectionType === "open_pool") {
    const requestedAmount = roundCurrency(asNumber(metadata.contributionAmount || metadata.amount));
    const minimumAmount = roundCurrency(asNumber(collection.min_contribution || collection.amount));
    // Fallback: if metadata.contributionAmount was lost (e.g. Paystack metadata truncation
    // on redirect), reverse-calculate the base contribution from the verified Paystack total.
    const derivedAmount =
      (!requestedAmount || requestedAmount <= 0) && paystackVerifiedTotal > 0
        ? reverseCalculateContribution(paystackVerifiedTotal, collectionType, feeBearer)
        : 0;
    const effectiveAmount = requestedAmount > 0 ? requestedAmount : derivedAmount;
    if (!effectiveAmount || effectiveAmount <= 0) {
      throw new PaymentValidationError(
        collectionType === "fundraising" ? "Enter a valid donation amount." : "Enter a valid contribution amount.",
        400, "invalid_amount", { collectionId, collectionType, requestedAmount }
      );
    }
    if (minimumAmount > 0 && effectiveAmount < minimumAmount) {
      throw new PaymentValidationError(
        `${collectionType === "fundraising" ? "Minimum donation" : "Minimum contribution"} is NGN ${minimumAmount.toLocaleString("en-NG")}.`,
        400, "amount_below_minimum", { collectionId, effectiveAmount, minimumAmount }
      );
    }
    if (remainingContributionCapacity !== null && remainingContributionCapacity < 1) {
      throw new PaymentValidationError("This collection has reached its contribution limit.", 400, "collection_full", { collectionId, paidCount, maxContributions });
    }
    contributionAmount = effectiveAmount;

  } else if (collectionType === "ticket") {
    if (String(collection.ticket_mode || "") === "tiered") {
      // Accept both nested ticketSelections (legacy) and ticketSelectionsJson (flat).
      const parsedTicketSelections = Array.isArray(metadata.ticketSelections)
        ? (metadata.ticketSelections as Array<Record<string, unknown>>)
        : (() => {
            const parsed = safeJsonParse(metadata.ticketSelectionsJson);
            return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
          })();
      const rawSelections = parsedTicketSelections;
      const legacyQuantity = asPositiveInt(metadata.quantity) || 1;
      const legacySelection =
        rawSelections.length === 0 && (metadata.selectedTier || metadata.selectedTierId)
          ? [{ tierId: metadata.selectedTierId, tierName: metadata.selectedTier, quantity: legacyQuantity }]
          : rawSelections;

      if (legacySelection.length === 0) {
        throw new PaymentValidationError("Select at least one ticket tier before checkout.", 400, "missing_ticket_selection", { collectionId });
      }

      ticketSelections = legacySelection.map((selection) => {
        const tier = matchTier(allTiers, selection);
        const requestedQuantity = asPositiveInt(selection.quantity);
        if (!tier) throw new PaymentValidationError("One of the selected ticket tiers is no longer available.", 404, "ticket_tier_not_found", { collectionId, selection });
        if (requestedQuantity < 1) return null;
        if (tier.remainingCapacity !== null && requestedQuantity > Number(tier.remainingCapacity)) {
          throw new PaymentValidationError(
            `${tier.tierName} does not have enough tickets left.`,
            400, "insufficient_ticket_capacity",
            { collectionId, tierId: tier.tierId, tierName: tier.tierName, requestedQuantity, remainingCapacity: tier.remainingCapacity }
          );
        }
        return {
          tierId: tier.tierId,
          tierName: String(tier.tierName),
          pricePerUnit: roundCurrency(asNumber(tier.price)),
          quantity: requestedQuantity,
          subtotal: roundCurrency(asNumber(tier.price) * requestedQuantity),
          description: tier.description ? String(tier.description) : null,
          prefix: tier.prefix ? String(tier.prefix) : null,
          remainingCapacity: tier.remainingCapacity as number | null,
        } as TicketSelection;
      }).filter(Boolean) as TicketSelection[];

      quantity = ticketSelections.reduce((t, s) => t + s.quantity, 0);
      if (quantity < 1) throw new PaymentValidationError("Select at least one ticket before checkout.", 400, "missing_ticket_quantity", { collectionId });
      contributionAmount = roundCurrency(ticketSelections.reduce((s, sel) => s + sel.subtotal, 0));

    } else {
      quantity = asPositiveInt(metadata.quantity) || 1;
      if (remainingContributionCapacity !== null && quantity > remainingContributionCapacity) {
        throw new PaymentValidationError("Not enough tickets remain for this order.", 400, "insufficient_ticket_capacity", { collectionId, quantity, remainingContributionCapacity });
      }
      if (String(collection.allow_multiple_quantity) === "false" && quantity > 1) {
        throw new PaymentValidationError("This ticket only allows one purchase per checkout.", 400, "multiple_quantity_disabled", { collectionId, quantity });
      }
      const unitPrice = roundCurrency(asNumber(collection.amount));
      contributionAmount = roundCurrency(unitPrice * quantity);
      ticketSelections = [{
        tierId: null,
        tierName: String(collection.title || "Ticket"),
        pricePerUnit: unitPrice,
        quantity,
        subtotal: contributionAmount,
        prefix: collection.code_prefix ? String(collection.code_prefix) : null,
        remainingCapacity: remainingContributionCapacity,
      }];
    }

  } else if (collectionType === "tiered") {
    let tier = matchTier(allTiers, {
      tierId: metadata.selectedTierId,
      tierName: metadata.selectedTier,
      name: metadata.selectedTier,
    });
    // Recovery fallback: metadata didn't carry an exact tier (e.g. an Admin
    // Reconcile manual override only ever supplies collectionId, never the
    // contributor's original tier choice — that field simply doesn't exist
    // once both pending_payment_context and Paystack's own metadata echo
    // have failed). Infer deterministically from the amount Paystack
    // actually verified: compute every tier's totalPayable the same way
    // initiate did, and auto-select ONLY if exactly one tier matches within
    // a rounding tolerance. Never guess on a tie — same philosophy as
    // attemptDeterministicCollectionRecovery's Strategy E below.
    let tierInferenceAmbiguous = false;
    if (!tier && paystackVerifiedTotal > 0) {
      const amountMatches = allTiers.filter((t) => {
        const tierTotalPayable = calculateFees(asNumber(t.price), collectionType, feeBearer).totalPayable;
        return Math.abs(tierTotalPayable - paystackVerifiedTotal) < 0.5;
      });
      if (amountMatches.length === 1) {
        tier = amountMatches[0];
        console.warn(
          `[verify] TIER_INFERRED_FROM_AMOUNT collectionId=${collectionId} tierId=${tier.tierId} verifiedTotal=${paystackVerifiedTotal}`
        );
      } else if (amountMatches.length > 1) {
        tierInferenceAmbiguous = true;
        console.warn(
          `[verify] TIER_INFERENCE_AMBIGUOUS collectionId=${collectionId} candidates=${amountMatches.length} verifiedTotal=${paystackVerifiedTotal} — refusing to guess`
        );
      }
    }
    if (!tier) {
      throw new PaymentValidationError(
        tierInferenceAmbiguous
          ? "More than one pricing tier matches this payment's amount — supply the tier ID via Admin Reconcile's \"Pricing tier ID\" field."
          : "Select a valid pricing tier before checkout.",
        400, "invalid_selected_tier", { collectionId, selectedTier: metadata.selectedTier }
      );
    }
    if (tier.remainingCapacity !== null && Number(tier.remainingCapacity) < 1) {
      throw new PaymentValidationError(`${tier.tierName} is sold out.`, 400, "tier_sold_out", { collectionId, tierId: tier.tierId, tierName: tier.tierName });
    }
    contributionAmount = roundCurrency(asNumber(tier.price));
    selectedTier = tier.tierName != null ? String(tier.tierName) : null;
    selectedTierId = tier.tierId != null ? String(tier.tierId) : null;
    selectedTierPrefix = tier.prefix ? String(tier.prefix) : null;

  } else {
    // fixed (default)
    if (remainingContributionCapacity !== null && remainingContributionCapacity < 1) {
      throw new PaymentValidationError("This collection has reached its contribution limit.", 400, "collection_full", { collectionId, paidCount, maxContributions });
    }
    contributionAmount = roundCurrency(asNumber(collection.amount));
  }

  if (!contributionAmount || contributionAmount <= 0) {
    throw new PaymentValidationError(
      "Unable to determine a valid payment amount for this checkout.",
      400, "invalid_contribution_amount", { collectionId, collectionType, contributionAmount }
    );
  }

  const feeBreakdown = calculateFees(contributionAmount, collectionType, feeBearer);

  return {
    collectionId,
    collectionType,
    collectionTitle: String(collection.title || "Collection"),
    feeBearer,
    contributionAmount,       // ← stored in contributions.amount → drives Total Raised
    platformFee: feeBreakdown.platformFee,
    gatewayFee: feeBreakdown.gatewayFee,
    totalFees: feeBreakdown.totalFees,
    totalPayable: feeBreakdown.totalPayable,  // ← what Paystack charged
    quantity,
    selectedTier,
    selectedTierId,
    selectedTierPrefix,
    ticketSelections,
    formData,
    contact,
    isAnonymous: metadata.isAnonymous === true || metadata.isAnonymous === 1 || metadata.isAnonymous === "1" || metadata.isAnonymous === "true",
    // Display-only flag now (see hasAnyConfiguredPrefix above) — the
    // actual generation decision is made per-unit, purely from whether a
    // prefix resolves to something non-empty. See CONTRIBUTOR_UNIQUE_ID_FIX_REPORT.md.
    uniqueIdEnabled: hasAnyConfiguredPrefix(collection),
    codePrefix: String(metadata.codePrefix || collection.code_prefix || "").trim(),
    providedAmount: roundCurrency(asNumber(metadata.totalPayable || metadata.amount || 0)),
  };
}

// ─── SETTLEMENT HELPERS ──────────────────────────────────────────────────────
export const COMPLETED_WITHDRAWAL_STATUSES = new Set(["completed", "successful"]);

/** Returns the most recent T+1 settlement cutoff (5am WAT = 4am UTC). */
export function getSettlementCutoff(): Date {
  const now = new Date();
  const todayCutoff = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0, 0
  ));
  return now >= todayCutoff ? todayCutoff : new Date(todayCutoff.getTime() - 86_400_000);
}

/**
 * Last-resort collectionId recovery when BOTH `pending_payment_context` AND
 * Paystack's own returned metadata come back empty for a reference (seen in
 * production for payments where neither safety net fired — our own insert
 * failed for an unknown transient reason AND Paystack's metadata echo was
 * also empty for the same transaction).
 *
 * Strategy C: another flow may already have tagged this exact
 * payment_reference with a collection_id (e.g. the legacy backend
 * `/payments/initialize-payment` path writes `deposits` rows with
 * collection_id before ever touching Paystack). Reading the SAME reference
 * back is exact-match, zero ambiguity — always safe to trust.
 *
 * Strategy E: ONLY if Strategy C also finds nothing, look for an
 * UNAMBIGUOUS pending checkout — by contributor email + amount + recency —
 * that nothing else has since claimed. This never guesses: any ambiguity
 * (zero or more than one distinct collection) means we return null and the
 * caller falls through to the normal missing-collection-id failure. Wrongly
 * attributing a payment to the wrong organizer's wallet is worse than
 * leaving it for manual admin reconciliation.
 */
export async function attemptDeterministicCollectionRecovery(
  supabase: ReturnType<typeof createClient>,
  params: { reference: string; customerEmail: string; grossAmountPaid: number }
): Promise<{ collectionId: string; strategy: string } | null> {
  const { reference, customerEmail, grossAmountPaid } = params;

  // ── Strategy C: exact payment_reference match in a sibling table ──────────
  const [{ data: depositRow }, { data: contributionRow }] = await Promise.all([
    supabase
      .from("deposits")
      .select("collection_id")
      .eq("payment_reference", reference)
      .not("collection_id", "is", null)
      .maybeSingle(),
    supabase
      .from("contributions")
      .select("collection_id")
      .eq("payment_reference", reference)
      .not("collection_id", "is", null)
      .limit(1)
      .maybeSingle(),
  ]);
  const strategyCMatch =
    (depositRow as Record<string, unknown> | null)?.collection_id ||
    (contributionRow as Record<string, unknown> | null)?.collection_id;
  if (strategyCMatch) {
    return { collectionId: String(strategyCMatch), strategy: "strategy_c_reference_match" };
  }

  // ── Strategy E: unambiguous pending-checkout inference ─────────────────────
  if (!customerEmail) return null;
  const cutoffIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const amountTolerance = Math.max(1, grossAmountPaid * 0.02); // ±2%, min ₦1

  const [{ data: pendingDeposits }, { data: pendingContributions }] = await Promise.all([
    supabase
      .from("deposits")
      .select("collection_id, amount, created_at")
      .ilike("email", customerEmail)
      .eq("status", "pending")
      .gte("created_at", cutoffIso),
    supabase
      .from("contributions")
      .select("collection_id, amount, gross_amount, created_at")
      .ilike("email", customerEmail)
      .eq("status", "pending")
      .is("payment_reference", null)
      .gte("created_at", cutoffIso),
  ]);

  const candidateCollectionIds = new Set<string>();
  for (const row of (pendingDeposits || []) as Array<Record<string, unknown>>) {
    if (Math.abs(Number(row.amount || 0) - grossAmountPaid) <= amountTolerance && row.collection_id) {
      candidateCollectionIds.add(String(row.collection_id));
    }
  }
  for (const row of (pendingContributions || []) as Array<Record<string, unknown>>) {
    const rowAmount = Number(row.gross_amount || row.amount || 0);
    if (Math.abs(rowAmount - grossAmountPaid) <= amountTolerance && row.collection_id) {
      candidateCollectionIds.add(String(row.collection_id));
    }
  }

  if (candidateCollectionIds.size === 1) {
    return { collectionId: [...candidateCollectionIds][0], strategy: "strategy_e_inferred" };
  }
  if (candidateCollectionIds.size > 1) {
    console.warn(
      `[verify ref=${reference}] STRATEGY_E_AMBIGUOUS candidates=${candidateCollectionIds.size} — refusing to guess`
    );
  }
  return null;
}

// Keys that exist on every contribution regardless of what the host's form
// actually asked — present even when no real answers were ever submitted.
export const STANDARD_INFO_KEYS = new Set([
  "Tier", "TierId", "TierAmount", "Quantity", "_receipt",
  "collectionType", "channel", "paidAt",
]);

export function hasRealAnswers(info: Record<string, unknown> | undefined): boolean {
  if (!info) return false;
  return Object.keys(info).some((k) => !STANDARD_INFO_KEYS.has(k));
}

/**
 * Contributor-info backfill: runs only when a recovered payment's metadata
 * carried NO submitted answers at all (pending_payment_context had no row AND
 * Paystack's own metadata echo was empty) — the exact gap that, in a real
 * incident, left a contribution with only {Tier, TierId, Quantity} on file
 * even though the same contributor's host-form answers (name, phone, custom
 * fields) existed elsewhere in our own database.
 *
 * Looks for an unambiguous prior PAID contribution by the same email in the
 * SAME collection that does carry real answers, and reuses them. Same
 * "never guess" discipline as attemptDeterministicCollectionRecovery's
 * Strategy E: zero or multiple qualifying candidates ⇒ do nothing. Same
 * collection + same email keeps this far less ambiguous than Strategy E's
 * cross-collection amount inference.
 */
export async function attemptContributorInfoBackfill(
  supabase: ReturnType<typeof createClient>,
  params: { reference: string; collectionId: string; email: string }
): Promise<{ contributionId: string; fields: Record<string, unknown>; name: string | null; phone: string | null } | null> {
  const { reference, collectionId, email } = params;
  if (!email) return null;

  const { data: rows, error } = await supabase
    .from("contributions")
    .select("id, name, phone, contributor_information, payment_reference, created_at")
    .eq("collection_id", collectionId)
    .eq("status", "paid")
    .ilike("email", email)
    .neq("payment_reference", reference)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !rows) return null;

  const candidates = (rows as Array<Record<string, unknown>>).filter((row) => {
    const infoRows = Array.isArray(row.contributor_information)
      ? (row.contributor_information as Array<Record<string, unknown>>)
      : [];
    return hasRealAnswers(infoRows[0]);
  });

  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      console.warn(
        `[verify ref=${reference}] CONTRIBUTOR_BACKFILL_AMBIGUOUS candidates=${candidates.length} — refusing to guess`
      );
    }
    return null;
  }

  const match = candidates[0];
  const infoRows = Array.isArray(match.contributor_information)
    ? (match.contributor_information as Array<Record<string, unknown>>)
    : [];
  const sourceInfo = infoRows[0] || {};
  const fields = Object.keys(sourceInfo).reduce<Record<string, unknown>>((acc, k) => {
    if (!STANDARD_INFO_KEYS.has(k)) acc[k] = sourceInfo[k];
    return acc;
  }, {});

  if (Object.keys(fields).length === 0) return null;

  return {
    contributionId: String(match.id),
    fields,
    name: match.name ? String(match.name) : null,
    phone: match.phone ? String(match.phone) : null,
  };
}

/**
 * Best-effort, never-throwing diagnostic log into `payment_recovery_log`.
 * Durable visibility into every post-success verify/admin-reconcile outcome
 * — ephemeral console logs vanish once the edge function instance recycles.
 */
export async function logRecoveryAttempt(
  supabase: ReturnType<typeof createClient>,
  entry: {
    reference: string;
    collectionId: string | null;
    success: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadataSource?: string | null;
    note?: string | null;
    context?: Record<string, unknown> | null;
    // Additive (nullable columns) — populated by the wrapper closure each
    // handler invocation creates (see `logAttempt` near VERIFY_CALLED).
    // Lets the admin dashboard distinguish a frontend-callback verify from
    // a webhook-triggered one from a scheduled-recovery one from a manual
    // admin reconcile, and measure recovery latency, without changing any
    // matching/recovery logic here.
    invocationSource?: string | null;
    attemptNumber?: number | null;
    durationMs?: number | null;
    selectedTierId?: string | null;
  }
) {
  try {
    await supabase.from("payment_recovery_log").insert({
      reference: entry.reference,
      collection_id: entry.collectionId,
      success: entry.success,
      error_code: entry.errorCode ?? null,
      error_message: entry.errorMessage ?? null,
      metadata_source: entry.metadataSource ?? null,
      note: entry.note ?? null,
      context: entry.context ?? null,
      invocation_source: entry.invocationSource ?? null,
      attempt_number: entry.attemptNumber ?? null,
      duration_ms: entry.durationMs ?? null,
      selected_tier_id: entry.selectedTierId ?? null,
    });
  } catch (logErr) {
    console.warn(
      `[verify ref=${entry.reference}] RECOVERY_LOG_WRITE_FAILED (non-fatal):`,
      (logErr as Error)?.message
    );
  }
}

