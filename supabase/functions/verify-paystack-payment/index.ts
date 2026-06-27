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
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── SHARED TYPES ─────────────────────────────────────────────────────────────
type FeeBearer = "contributor" | "organizer";

interface TicketSelection {
  tierId: string | null;
  tierName: string;
  pricePerUnit: number;
  quantity: number;
  subtotal: number;
  description?: string | null;
  prefix?: string | null;
  remainingCapacity?: number | null;
}

class PaymentValidationError extends Error {
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
function roundCurrency(value: number): number {
  return Number((Number(value) || 0).toFixed(2));
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number((value as string).replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asPositiveInt(value: unknown): number {
  const parsed = Math.floor(asNumber(value));
  return parsed > 0 ? parsed : 0;
}

function getCollectionType(collection: Record<string, unknown>) {
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
function hasAnyConfiguredPrefix(collection: Record<string, unknown>): boolean {
  if (collection.code_prefix) return true;
  const tiers = getPriceTiers(collection);
  return tiers.some((t) => Boolean((t as Record<string, unknown>)?.prefix));
}

function getPriceTiers(collection: Record<string, unknown>) {
  const tiers = collection.price_tiers || collection.pricing_tiers;
  return Array.isArray(tiers) ? tiers : [];
}

function getTierLabel(tier: Record<string, unknown>, index: number) {
  return String(tier.name || `Tier ${index + 1}`);
}

function getTierMatchKey(tier: Record<string, unknown>, index: number) {
  return String(tier.id || tier.name || `tier-${index}`);
}

function getInfoRows(row: Record<string, unknown>) {
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

function calculateFees(amount: number, collectionType: string, feeBearer: FeeBearer) {
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
function reverseCalculateContribution(
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

function allocateAmounts(total: number, weights: number[]) {
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

function buildTierAvailability(
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

function matchTier(
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
function ensureCollectionIsPayable(collection: Record<string, unknown>, collectionId: string) {
  const status = String(collection.status || "active");
  if (collection.deleted_at) throw new PaymentValidationError("This collection is no longer available.", 404, "collection_deleted", { collectionId, status });
  if (status === "paused" || status === "closed" || status === "completed" || status === "pending_review" || status === "pending_verification") {
    console.warn(
      `[verify] LEGACY_PAYABLE_GATE_BYPASSED collectionId=${collectionId} status=${status} — ` +
      `recording an already-captured Paystack payment despite non-active collection status.`
    );
  }
}

function normalizePaymentRequest(input: {
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
    const tier = matchTier(allTiers, {
      tierId: metadata.selectedTierId,
      tierName: metadata.selectedTier,
      name: metadata.selectedTier,
    });
    if (!tier) throw new PaymentValidationError("Select a valid pricing tier before checkout.", 400, "invalid_selected_tier", { collectionId, selectedTier: metadata.selectedTier });
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
const COMPLETED_WITHDRAWAL_STATUSES = new Set(["completed", "successful"]);

/** Returns the most recent T+1 settlement cutoff (5am WAT = 4am UTC). */
function getSettlementCutoff(): Date {
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
async function attemptDeterministicCollectionRecovery(
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

/**
 * Best-effort, never-throwing diagnostic log into `payment_recovery_log`.
 * Durable visibility into every post-success verify/admin-reconcile outcome
 * — ephemeral console logs vanish once the edge function instance recycles.
 */
async function logRecoveryAttempt(
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
    });
  } catch (logErr) {
    console.warn(
      `[verify ref=${entry.reference}] RECOVERY_LOG_WRITE_FAILED (non-fatal):`,
      (logErr as Error)?.message
    );
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqData = await req.json();
    const { reference } = reqData;
    // Manual recovery hint: only used when automatic metadata resolution
    // (pending_payment_context + Paystack metadata) both fail to produce a
    // collectionId. Supplied by Admin Reconcile when a human has confirmed,
    // out-of-band (e.g. by searching Paystack dashboard for the contributor's
    // email/amount), which collection a stranded payment belongs to.
    const overrideCollectionId = String(reqData.overrideCollectionId || "").trim() || null;

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing payment reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // F4: payment-lifecycle correlation log — every line below uses this prefix.
    console.log(`[verify ref=${reference}] VERIFY_CALLED`);

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}`, "Content-Type": "application/json" } }
    );

    const data = await response.json();
    if (!response.ok || !data.status) {
      // F4: Paystack verify rejected the reference
      console.warn(
        `[verify ref=${reference}] VERIFY_PAYSTACK_FAILED status=${response.status} message=${data?.message || ""}`
      );
      return new Response(JSON.stringify({ error: data.message || "Payment verification failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transaction = data.data;
    // F4: Paystack confirmed
    console.log(
      `[verify ref=${reference}] VERIFY_PAYSTACK_OK status=${transaction?.status} amount=${transaction?.amount} channel=${transaction?.channel || ""}`
    );
    const customer =
      transaction.customer && typeof transaction.customer === "object"
        ? (transaction.customer as Record<string, unknown>)
        : {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // D-1: root-cause fix for "Missing collection ID in payment metadata".
    //
    // This used to trust `transaction.metadata` from Paystack's verify
    // response unconditionally, only guarding against it being absent
    // (`typeof transaction.metadata === "object"`). That guard silently
    // discards metadata that comes back as a JSON-ENCODED STRING instead
    // of an already-parsed object — a real Paystack API inconsistency —
    // and offered no protection against metadata being truncated by
    // Paystack for exceeding an undocumented size limit. Either failure
    // mode produces exactly this symptom: collectionId present at
    // initiate time, missing at verify time, with nothing wrong on our
    // side that the logs could show — because we never logged what
    // Paystack actually sent back.
    //
    // Fix: don't depend on Paystack to round-trip our own data at all.
    // We wrote this exact metadata into `pending_payment_context` at
    // initiate time, keyed by this same reference — read it back from
    // there FIRST. Only fall back to (defensively parsed) Paystack
    // metadata for references that predate this change.
    let metadata: Record<string, unknown> = {};
    let metadataSource = "none";

    const { data: pendingContext, error: pendingContextError } = await supabase
      .from("pending_payment_context")
      .select("collection_id, metadata")
      .eq("reference", reference)
      .maybeSingle();

    if (pendingContextError) {
      console.warn(
        `[verify ref=${reference}] PENDING_CONTEXT_LOOKUP_FAILED (falling back to Paystack metadata):`,
        pendingContextError.message
      );
    }

    if (pendingContext?.metadata && typeof pendingContext.metadata === "object") {
      metadata = pendingContext.metadata as Record<string, unknown>;
      metadataSource = "pending_payment_context";
    } else {
      // Fallback: parse whatever Paystack actually returned, tolerating
      // both an already-parsed object AND a JSON-encoded string.
      const rawMetadata = transaction.metadata;
      if (rawMetadata && typeof rawMetadata === "object") {
        metadata = rawMetadata as Record<string, unknown>;
        metadataSource = "paystack_object";
      } else if (typeof rawMetadata === "string" && rawMetadata.trim()) {
        try {
          const parsed = JSON.parse(rawMetadata);
          if (parsed && typeof parsed === "object") {
            metadata = parsed as Record<string, unknown>;
            metadataSource = "paystack_string_parsed";
          }
        } catch (parseErr) {
          console.error(
            `[verify ref=${reference}] METADATA_PARSE_FAILED raw_snippet="${rawMetadata.slice(0, 300)}"`,
            (parseErr as Error)?.message
          );
        }
      }
    }

    // F4/D-1 diagnostic: exactly what we received and decided, without
    // exposing secrets (this transaction's own metadata is not secret —
    // it's the same data the contributor's own browser sent moments ago).
    console.log(`[verify ref=${reference}] METADATA_DIAGNOSTIC`, {
      metadataSource,
      rawMetadataType: typeof transaction.metadata,
      pendingContextFound: Boolean(pendingContext),
      resolvedKeys: Object.keys(metadata),
      collectionIdFromCollectionId: metadata.collectionId ?? null,
      collectionIdFromSnakeCase: metadata.collection_id ?? null,
    });

    let collectionId = String(metadata.collectionId || metadata.collection_id || "").trim();
    if (!collectionId && overrideCollectionId) {
      // Manual recovery: automatic resolution failed, but an admin supplied
      // a collectionId via Admin Reconcile (confirmed out-of-band). Use it,
      // and log loudly since this bypasses the normal metadata trail.
      collectionId = overrideCollectionId;
      metadataSource = "manual_override";
      console.warn(
        `[verify ref=${reference}] MANUAL_OVERRIDE_COLLECTION_ID collectionId=${collectionId}`
      );
    }
    if (!collectionId) {
      // Both primary safety nets (pending_payment_context + Paystack's own
      // metadata) came back empty. Before failing, try the deterministic
      // recovery strategies — exact payment_reference match in a sibling
      // table, then (only if unambiguous) email+amount+recency inference.
      const recovered = await attemptDeterministicCollectionRecovery(supabase, {
        reference,
        customerEmail: String(customer.email || "").trim(),
        grossAmountPaid: roundCurrency(Number(transaction.amount || 0) / 100),
      });
      if (recovered) {
        collectionId = recovered.collectionId;
        metadataSource = recovered.strategy;
        console.warn(
          `[verify ref=${reference}] DETERMINISTIC_RECOVERY strategy=${recovered.strategy} collectionId=${collectionId}`
        );
        await logRecoveryAttempt(supabase, {
          reference, collectionId, success: true, metadataSource,
          note: `recovered_via_${recovered.strategy}`,
        });
      }
    }
    if (!collectionId) {
      console.error(
        `[verify ref=${reference}] MISSING_COLLECTION_ID metadataSource=${metadataSource} ` +
        `rawMetadataType=${typeof transaction.metadata} resolvedKeys=${Object.keys(metadata).join(",")}`
      );
      await logRecoveryAttempt(supabase, {
        reference, collectionId: null, success: false,
        errorCode: "missing_collection_id", errorMessage: "Missing collection ID in payment metadata",
        metadataSource, context: { resolvedKeys: Object.keys(metadata) },
      });
      return new Response(JSON.stringify({ error: "Missing collection ID in payment metadata" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Do not filter on deleted_at — column may not exist in prod schema.
    const { data: collection, error: collectionError } = await supabase
      .from("collections").select("*").eq("id", collectionId).maybeSingle();

    if (collectionError) {
      await logRecoveryAttempt(supabase, {
        reference, collectionId, success: false,
        errorCode: "collection_fetch_failed", errorMessage: collectionError.message, metadataSource,
      });
      return new Response(JSON.stringify({ error: "Error fetching collection details" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!collection) {
      await logRecoveryAttempt(supabase, {
        reference, collectionId, success: false,
        errorCode: "collection_not_found", errorMessage: "Collection not found.", metadataSource,
      });
      return new Response(JSON.stringify({ error: "Collection not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processedContributions: Record<string, unknown>[] = [];
    let normalizedPayment: ReturnType<typeof normalizePaymentRequest> | null = null;
    let isNewPayment = false; // true only when we insert new contributions (not idempotent replay)

    if (transaction.status === "success") {
      // ── Idempotency: check if we already recorded contributions for this reference ──
      // Use the new payment_reference column that was added via migration.
      const { data: existingContributions } = await supabase
        .from("contributions")
        .select("*")
        .eq("payment_reference", String(transaction.reference))
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: true });

      if ((existingContributions || []).length > 0) {
        processedContributions = existingContributions || [];
        // F4: idempotent return — already-recorded payment, no inserts needed
        console.log(
          `[verify ref=${reference}] VERIFY_IDEMPOTENT_HIT existing=${processedContributions.length}`
        );
        await logRecoveryAttempt(supabase, {
          reference, collectionId, success: true, metadataSource,
          note: `idempotent_hit existing=${processedContributions.length}`,
        });
      } else {
        const { data: paidRows, error: paidRowsError } = await supabase
          .from("contributions").select("id, amount, contributor_information, contributor_unique_code").eq("collection_id", collectionId).eq("status", "paid");

        if (paidRowsError) {
          return new Response(JSON.stringify({ error: "Unable to validate payment totals right now." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // verifiedTotal is computed right before the mismatch check below
        const verifiedTotalEarly = roundCurrency(Number(transaction.amount || 0) / 100);
        try {
          normalizedPayment = normalizePaymentRequest({
            collection,
            metadata,
            paidRows: (paidRows || []) as Array<Record<string, unknown>>,
            paystackVerifiedTotal: verifiedTotalEarly,
          });
        } catch (error: unknown) {
          if (error instanceof PaymentValidationError) {
            await logRecoveryAttempt(supabase, {
              reference, collectionId, success: false,
              errorCode: error.code, errorMessage: error.message, metadataSource,
              context: error.logContext ?? null,
            });
            return new Response(JSON.stringify({ error: error.message, code: error.code }), {
              status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw error;
        }

        // Verify amount matches: Paystack charged totalPayable, not contributionAmount.
        // For open_pool/fundraising where metadata.contributionAmount was missing and we
        // reverse-calculated the amount from verifiedTotal, allow a slightly wider tolerance
        // to absorb binary-search rounding (max ~₦0.10 off).
        const verifiedTotal = verifiedTotalEarly;
        const metadataHadAmount =
          asNumber(metadata.contributionAmount || metadata.amount) > 0;
        const isOpenAmount =
          normalizedPayment.collectionType === "open_pool" ||
          normalizedPayment.collectionType === "fundraising";
        const mismatchTolerance = isOpenAmount && !metadataHadAmount ? 1.0 : 0.01;
        if (Math.abs(verifiedTotal - normalizedPayment.totalPayable) > mismatchTolerance) {
          console.error("Amount mismatch:", { reference, collectionId, verifiedTotal, expectedTotal: normalizedPayment.totalPayable });
          await logRecoveryAttempt(supabase, {
            reference, collectionId, success: false,
            errorCode: "amount_mismatch", errorMessage: "Payment amount validation failed.", metadataSource,
            context: { verifiedTotal, expectedTotal: normalizedPayment.totalPayable },
          });
          return new Response(JSON.stringify({ error: "Payment amount validation failed. Contact support with your reference." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const contactName =
          normalizedPayment.contact.name ||
          String(customer.email || "").split("@")[0] ||
          "Anonymous";
        const payerName =
          normalizedPayment.isAnonymous && normalizedPayment.collectionType === "fundraising"
            ? "Anonymous"
            : contactName;

        // Fix #4: Only host-requested form fields go into contributorInformation.
        // Contact info (name/email/phone) is stored on top-level columns only.
        const baseFields = {
          ...(normalizedPayment.formData || {}),
        };

        const contributionUnits = buildContributionUnits(normalizedPayment, collection);
        const unitAmounts = contributionUnits.map((u) => u.amount);
        const allocatedPlatformFees = allocateAmounts(normalizedPayment.platformFee, unitAmounts);
        const allocatedGatewayFees = allocateAmounts(normalizedPayment.gatewayFee, unitAmounts);
        const allocatedTotals = allocateAmounts(normalizedPayment.totalPayable, unitAmounts);

        // Fix #7: Per-prefix sequential IDs — each tier prefix counts independently.
        // Build a map of how many paid contributions already exist for each prefix.
        const existingCountByPrefix = new Map<string, number>();
        for (const row of (paidRows || [])) {
          const code = String((row as Record<string, unknown>).contributor_unique_code || "");
          // Optional hyphen tolerates both the current "PREFIX-001" format
          // and legacy "PREFIX001" codes minted before the separator was
          // added, so counts stay accurate across the format change.
          const match = code.match(/^([A-Za-z]+)-?\d+$/);
          if (match) {
            const p = match[1].toUpperCase();
            existingCountByPrefix.set(p, (existingCountByPrefix.get(p) || 0) + 1);
          }
        }
        // Track how many units in the CURRENT batch have used each prefix
        const batchCountByPrefix = new Map<string, number>();

        // F2: bookkeeping for fail-fast + rollback semantics.
        //   insertedIds  — rows WE inserted this call. Used for rollback if a
        //                  later unit's insert hits a real error.
        //   insertErrors — non-duplicate insert errors. Presence triggers
        //                  rollback + 500 (instead of the old silent `continue`).
        const insertedIds: string[] = [];
        const insertErrors: Array<{ index: number; error: unknown }> = [];

        for (let index = 0; index < contributionUnits.length; index++) {
          const unit = contributionUnits[index];
          // A configured prefix — this unit's tier/ticket prefix, falling
          // back to the collection-level code_prefix — is what drives
          // generation; unique_id_enabled is NOT checked here (see
          // hasAnyConfiguredPrefix above for why). Internal whitespace is
          // stripped too — organizers sometimes type a tier prefix like
          // "VIP 1" (label-style) rather than a code-style "VIP1"; a unique
          // code should be a short, clean token. This never touches the
          // stored prefix value, only the code built from it.
          const prefix = String(unit.prefix || normalizedPayment.codePrefix || "")
            .trim().toUpperCase().replace(/\s+/g, "");
          let uniqueCode: string | null = null;

          if (prefix) {
            // C-1: atomic per-(collection, prefix) counter via Postgres RPC.
            // The previous approach derived the sequence number from a
            // COUNT taken once at the start of the request — two payments
            // to the same collection/prefix arriving concurrently could
            // both read the same count and mint the identical code. The
            // RPC is a single INSERT ... ON CONFLICT DO UPDATE ... RETURNING,
            // which Postgres serialises automatically per row.
            let sequenceNumber: number | null = null;
            try {
              const { data: rpcData, error: rpcError } = await supabase.rpc(
                "next_contribution_code_number",
                { p_collection_id: collectionId, p_prefix: prefix }
              );
              if (!rpcError && rpcData != null) {
                const num = typeof rpcData === "number" ? rpcData : Number(rpcData);
                if (Number.isFinite(num) && num > 0) sequenceNumber = num;
              }
              if (rpcError) {
                console.warn(
                  `[verify ref=${reference}] next_contribution_code_number RPC unavailable — ` +
                  "falling back to in-memory count (apply database/c1_per_prefix_code_counters.sql " +
                  "to remove this fallback and its race-condition risk).",
                  { code: rpcError.code, message: rpcError.message }
                );
              }
            } catch (rpcErr) {
              console.warn(
                `[verify ref=${reference}] next_contribution_code_number RPC threw — falling back:`,
                (rpcErr as Error)?.message
              );
            }

            if (sequenceNumber == null) {
              // Fallback: count existing + count in this batch so far. Still
              // racy across concurrent requests — only used if the migration
              // above hasn't been applied yet.
              const existingForPrefix = existingCountByPrefix.get(prefix) || 0;
              const batchForPrefix = batchCountByPrefix.get(prefix) || 0;
              sequenceNumber = existingForPrefix + batchForPrefix + 1;
              batchCountByPrefix.set(prefix, batchForPrefix + 1);
            }

            uniqueCode = `${prefix}-${String(sequenceNumber).padStart(3, "0")}`;
          }

          // Fix #1: When organizer absorbs fees, contributions.amount = net the host receives.
          // When contributor pays fees, contributions.amount = base contribution amount.
          const allocatedFees = roundCurrency(
            (allocatedPlatformFees[index] || 0) + (allocatedGatewayFees[index] || 0)
          );
          const netAmount =
            normalizedPayment.feeBearer === "organizer"
              ? roundCurrency(unit.amount - allocatedFees)
              : unit.amount;

          const contributorInformation = {
            ...baseFields,
            ...(unit.tierName ? { Tier: unit.tierName } : {}),
            ...(unit.tierId ? { TierId: unit.tierId } : {}),
            TierAmount: unit.amount,
            Quantity: 1,
            collectionType: normalizedPayment.collectionType,
            channel: transaction.channel,
            paidAt: transaction.paid_at,
          };

          // ── contributions table columns (actual schema): ─────────────────
          //   id, collection_id, name, email, phone, amount, gross_amount,
          //   contributor_information, contributor_unique_code, status,
          //   payment_id, payment_reference, check_in_status,
          //   created_at, updated_at
          //
          // amount      = net to host (contributionAmount minus fees if organizer-borne)
          // gross_amount= what contributor actually paid (inc. fees or same as amount)

          const lineItemGross = roundCurrency(allocatedTotals[index] || unit.amount);

          // Embed receipt data inside contributor_information so it's queryable
          // without a separate table. Standard fields are in named keys;
          // receipt metadata sits under _receipt so it doesn't pollute the UI.
          const infoWithReceipt = {
            ...stripStandardFields(contributorInformation),
            _receipt: {
              transaction_id: transaction.id,
              reference: transaction.reference,
              paid_at: transaction.paid_at,
              payment_channel: transaction.channel,
              collection_title: collection.title || null,
              unique_code: uniqueCode,
              name: payerName,
              line_item_amount: unit.amount,
              line_item_net_amount: netAmount,
              line_item_platform_fee: allocatedPlatformFees[index] || 0,
              line_item_gateway_fee: allocatedGatewayFees[index] || 0,
              line_item_total_paid: lineItemGross,
              order_contribution_amount: normalizedPayment.contributionAmount,
              order_platform_fee: normalizedPayment.platformFee,
              order_gateway_fee: normalizedPayment.gatewayFee,
              order_total_fees: normalizedPayment.totalFees,
              order_total_paid: normalizedPayment.totalPayable,
              order_quantity: normalizedPayment.quantity,
              fee_bearer: normalizedPayment.feeBearer,
              tier_id: unit.tierId,
              tier_name: unit.tierName,
              ticket_selections: normalizedPayment.ticketSelections,
              // Payer contact stored here — used in Activities tab only
              _payer: {
                name: payerName,
                email: normalizedPayment.contact.email || String(customer.email || ""),
                phone: normalizedPayment.contact.phone || null,
              },
            },
          };

          const contributorPayload: Record<string, unknown> = {
            collection_id: collectionId,
            // ─── CORRECT column names (matching actual schema) ───────────────
            name: payerName,
            email: normalizedPayment.contact.email || String(customer.email || ""),
            phone: normalizedPayment.contact.phone || null,
            // amount = net to host (deducts fees when organizer-borne)
            amount: netAmount,
            // gross_amount = what contributor actually paid
            gross_amount: lineItemGross,
            status: "paid",
            payment_reference: String(transaction.reference),
            contributor_unique_code: uniqueCode,
            contributor_information: [infoWithReceipt],
            // F3: per-unit line index. Combined with (collection_id,
            // payment_reference) this is unique (enforced by the constraint
            // added in f3_step2_line_index_constraint.sql). Without this,
            // two concurrent verify calls for the same reference could each
            // insert N rows = 2N total rows.
            line_index: index,
            ...(normalizedPayment.collectionType === "ticket"
              ? { check_in_status: "not_checked_in" }
              : {}),
          };

          const { data: contribution, error: contribError } = await supabase
            .from("contributions").insert(contributorPayload).select("*").single();

          if (contribError) {
            // F2: classify the error.
            //
            // Duplicate (23505 / "duplicate" / "unique") → a concurrent verify
            // call inserted the rows for this same payment_reference. Fetch
            // EVERY existing row for this reference (not just [0] — the old
            // code did that and ended up registering only one row for a
            // multi-ticket order during a race). Set processedContributions
            // to the full set and break out of the loop — the concurrent
            // call has already covered all units.
            //
            // Non-duplicate → a real DB / FK / RLS error. Stop the loop and
            // roll back any rows WE inserted, so the FE/webhook can retry
            // cleanly. Silently `continue`-ing on these errors is what made
            // partial-failed inserts hard to detect in production.
            const isDuplicate =
              contribError.code === "23505" || // unique_violation
              String(contribError.message).toLowerCase().includes("duplicate") ||
              String(contribError.message).toLowerCase().includes("unique");
            if (isDuplicate) {
              const { data: existing } = await supabase
                .from("contributions")
                .select("*")
                .eq("payment_reference", String(transaction.reference))
                .eq("collection_id", collectionId)
                .order("created_at", { ascending: true });
              processedContributions = existing || [];
              console.log(
                `[verify ref=${reference}] VERIFY_INSERT_RACE_RECOVERED rows=${processedContributions.length}`
              );
              // Durable record of every duplicate-insert race the DB unique
              // constraint (uq_contributions_collection_ref_line) catches —
              // console.log alone is how a prior production double-credit
              // incident went undetected until contributors/hosts reported
              // mismatched totals. This is a caught-and-handled race, not a
              // failure, so success=true; the note/context make it visible
              // in payment_recovery_log for monitoring.
              await logRecoveryAttempt(supabase, {
                reference, collectionId, success: true, metadataSource,
                note: `duplicate_insert_race_recovered index=${index} existing_rows=${processedContributions.length}`,
                context: { lineIndex: index, errorCode: contribError.code },
              });
              break;
            }

            console.error(
              `[verify ref=${reference}] VERIFY_INSERT_FAILED index=${index}`,
              {
                code: contribError.code,
                message: contribError.message,
                details: (contribError as any).details,
                hint: (contribError as any).hint,
              }
            );
            insertErrors.push({ index, error: contribError });
            break;
          }
          insertedIds.push(String((contribution as Record<string, unknown>).id));
          processedContributions.push(contribution);
        }

        // F2: if any non-duplicate insert error occurred, roll back the rows
        // we DID insert this call (don't touch rows inserted by concurrent
        // callers — they aren't in `insertedIds`). Returning 500 here makes
        // the FE's PaymentCallback render the "Try Again" screen and makes
        // the webhook retry. The verify edge function is idempotent so retry
        // is safe.
        if (insertErrors.length > 0) {
          if (insertedIds.length > 0) {
            console.warn(
              `[verify ref=${reference}] ROLLING_BACK partial_inserts=${insertedIds.length}`
            );
            const { error: rollbackErr } = await supabase
              .from("contributions")
              .delete()
              .in("id", insertedIds);
            if (rollbackErr) {
              console.error(
                `[verify ref=${reference}] ROLLBACK_FAILED — partial data may remain`,
                rollbackErr
              );
            }
          }
          const firstErr = insertErrors[0].error as Record<string, unknown>;
          console.error(
            `[verify ref=${reference}] VERIFY_FAILED_AFTER_ROLLBACK code=${String(firstErr.code || "")}`
          );
          await logRecoveryAttempt(supabase, {
            reference, collectionId, success: false,
            errorCode: String(firstErr.code || "contribution_insert_failed"),
            errorMessage: String(firstErr.message || firstErr), metadataSource,
            note: "rolled_back_partial_inserts",
          });
          return new Response(
            JSON.stringify({
              error:
                "Failed to record contribution. The payment is recorded on Paystack — please retry; this is safe.",
              code: String(firstErr.code || "contribution_insert_failed"),
              details: String(firstErr.message || firstErr),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Flag as a fresh (non-idempotent) payment so the receipt email is sent below
        isNewPayment = processedContributions.length > 0;
        // F4: fresh inserts complete
        console.log(
          `[verify ref=${reference}] VERIFY_CONTRIBS_INSERTED count=${processedContributions.length}`
        );
        await logRecoveryAttempt(supabase, {
          reference, collectionId, success: true, metadataSource,
          note: `new_contribution_recorded count=${processedContributions.length}`,
        });
      }

      await refreshCollectionAndWallets(supabase, collectionId, collection);
      // F4: wallet recompute complete (source-of-truth derivation)
      console.log(
        `[verify ref=${reference}] WALLET_UPDATED collectionId=${collectionId}`
      );

      // ── Send receipt + organizer email (best-effort, non-blocking) ──────────
      // Primary path: call the backend's /api/payments/send-receipt endpoint
      //   which uses Zoho SMTP (already configured in the backend).
      // Fallback: Resend API (if RESEND_API_KEY is set as a Supabase secret).
      // Fires only on first-time payment insertion — never on idempotent replays.
      if (isNewPayment && normalizedPayment) {
        const payerEmail = normalizedPayment.contact.email || String(customer.email || "");
        const payerName = normalizedPayment.contact.name || payerEmail.split("@")[0];

        if (payerEmail) {
          // @ts-ignore — Deno is a valid global in Supabase Edge Functions
          const backendUrl = Deno.env.get("BACKEND_URL");
          // @ts-ignore
          const notifySecret = Deno.env.get("BACKEND_NOTIFY_SECRET");

          // Build participant list for the email template
          const emailParticipants = processedContributions.map((c) => {
            const infoRows = Array.isArray((c as Record<string, unknown>).contributor_information)
              ? ((c as Record<string, unknown>).contributor_information as Array<Record<string, unknown>>)
              : [];
            const details = infoRows.flatMap((row) =>
              Object.entries(row)
                .filter(([k]) => !k.startsWith("_"))
                .map(([label, value]) => ({ label, value: String(value) }))
            );
            return {
              id: String((c as Record<string, unknown>).id || ""),
              uniqueCode: String((c as Record<string, unknown>).contributor_unique_code || ""),
              details,
            };
          });

          if (backendUrl) {
            // ── Primary: backend Zoho SMTP email ──────────────────────────────
            fetch(`${backendUrl}/api/payments/send-receipt`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(notifySecret ? { "x-internal-secret": notifySecret } : {}),
              },
              body: JSON.stringify({
                payerEmail,
                payerName,
                collectionTitle: String(collection.title || "Collection"),
                totalPaid: normalizedPayment.totalPayable,
                currency: "NGN",
                transactionRef: String(transaction.reference || ""),
                paidAt: String(transaction.paid_at || new Date().toISOString()),
                channel: String(transaction.channel || "card"),
                participants: emailParticipants,
                collectionId: collectionId,
              }),
            }).then(async (r) => {
              if (!r.ok) {
                const body = await r.text().catch(() => "");
                console.warn("[verify] backend email non-OK:", r.status, body);
                // Fallback to Resend if backend returned an error
                return sendReceiptEmail({
                  payerEmail, payerName,
                  collectionTitle: String(collection.title || "Collection"),
                  collectionType: normalizedPayment!.collectionType,
                  contributionAmount: normalizedPayment!.contributionAmount,
                  totalPaid: normalizedPayment!.totalPayable,
                  platformFee: normalizedPayment!.platformFee,
                  gatewayFee: normalizedPayment!.gatewayFee,
                  transactionRef: String(transaction.reference || ""),
                  paidAt: String(transaction.paid_at || new Date().toISOString()),
                  uniqueCodes: processedContributions
                    .map((c) => String((c as Record<string, unknown>).contributor_unique_code || ""))
                    .filter(Boolean),
                }).catch((e: unknown) =>
                  console.warn("[verify] resend fallback also failed:", (e as Error)?.message)
                );
              }
              console.log(
                `[verify ref=${reference}] RECEIPT_EMAIL_SENT channel=backend`
              );
            }).catch((err: unknown) => {
              console.warn("[verify] backend email fetch error, trying Resend:", (err as Error)?.message);
              // Fallback to Resend on network error
              sendReceiptEmail({
                payerEmail, payerName,
                collectionTitle: String(collection.title || "Collection"),
                collectionType: normalizedPayment!.collectionType,
                contributionAmount: normalizedPayment!.contributionAmount,
                totalPaid: normalizedPayment!.totalPayable,
                platformFee: normalizedPayment!.platformFee,
                gatewayFee: normalizedPayment!.gatewayFee,
                transactionRef: String(transaction.reference || ""),
                paidAt: String(transaction.paid_at || new Date().toISOString()),
                uniqueCodes: processedContributions
                  .map((c) => String((c as Record<string, unknown>).contributor_unique_code || ""))
                  .filter(Boolean),
              }).catch((e: unknown) =>
                console.warn("[verify] resend fallback also failed:", (e as Error)?.message)
              );
            });
          } else {
            // ── No BACKEND_URL configured: fall back to Resend directly ───────
            sendReceiptEmail({
              payerEmail, payerName,
              collectionTitle: String(collection.title || "Collection"),
              collectionType: normalizedPayment.collectionType,
              contributionAmount: normalizedPayment.contributionAmount,
              totalPaid: normalizedPayment.totalPayable,
              platformFee: normalizedPayment.platformFee,
              gatewayFee: normalizedPayment.gatewayFee,
              transactionRef: String(transaction.reference || ""),
              paidAt: String(transaction.paid_at || new Date().toISOString()),
              uniqueCodes: processedContributions
                .map((c) => String((c as Record<string, unknown>).contributor_unique_code || ""))
                .filter(Boolean),
            }).catch((err: unknown) =>
              console.warn("[verify] resend email failed (no backend URL set):", (err as Error)?.message)
            );
          }
        }
      }
    }

    const receiptData = buildReceiptData({
      transaction, normalizedPayment, collection, contributions: processedContributions, customer,
    });

    // F4: final lifecycle checkpoint — clean filterable end-of-flow marker
    console.log(
      `[verify ref=${reference}] PAYMENT_COMPLETED contributions=${processedContributions.length} fresh=${isNewPayment}`
    );

    return new Response(
      JSON.stringify({
        status: transaction.status,
        reference: transaction.reference,
        amount: transaction.amount / 100,
        paidAt: transaction.paid_at,
        channel: transaction.channel,
        currency: transaction.currency,
        customer: transaction.customer,
        contributions: processedContributions.map(formatContributionSummary),
        receiptData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    // F4: capture unexpected errors with whatever reference we have in scope.
    // (Best-effort — if the error fired before we parsed the body, ref is unknown.)
    console.error(`[verify ref=?] VERIFY_UNHANDLED_ERROR ${msg}`);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function buildContributionUnits(
  normalizedPayment: ReturnType<typeof normalizePaymentRequest>,
  collection: Record<string, unknown>
) {
  if (normalizedPayment.collectionType === "ticket") {
    return normalizedPayment.ticketSelections.flatMap((selection) =>
      Array.from({ length: selection.quantity }, () => ({
        amount: selection.pricePerUnit,
        tierId: selection.tierId,
        tierName: selection.tierName,
        prefix: selection.prefix || normalizedPayment.codePrefix || null,
      }))
    );
  }
  return [{
    amount: normalizedPayment.contributionAmount,
    tierId: normalizedPayment.selectedTierId,
    tierName: normalizedPayment.selectedTier,
    prefix: normalizedPayment.selectedTierPrefix || collection.code_prefix || normalizedPayment.codePrefix || null,
  }];
}

/**
 * Recomputes all wallet balances from source of truth after every payment.
 *
 * net_payment (Total Raised)  = sum of contributions.amount (no fees, ever)
 * gross_payment               = sum of what contributors actually paid (inc. fees)
 * pending_balance             = net amounts from today's payments (after 5am WAT)
 * available_balance           = settled net minus completed withdrawals
 * ledger_balance              = available + pending
 */
async function refreshCollectionAndWallets(
  supabase: ReturnType<typeof createClient>,
  collectionId: string,
  collection: Record<string, unknown>
) {
  const { data: paidRows, error: totalError } = await supabase
    .from("contributions")
    .select("amount, gross_amount, contributor_information, created_at")
    .eq("collection_id", collectionId)
    .eq("status", "paid");

  if (totalError) { console.error("Error recalculating totals:", totalError); return; }

  const paidContributions = paidRows || [];
  const settlementCutoff = getSettlementCutoff();

  // Total Raised = sum of contribution net amounts (NEVER totalPayable / gross)
  const netPayment = roundCurrency(
    paidContributions.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.amount || 0), 0)
  );

  // Gross = what contributors actually paid (gross_amount column, fallback to amount)
  const grossPayment = roundCurrency(
    paidContributions.reduce((sum: number, row: Record<string, unknown>) => {
      return sum + Number(row.gross_amount || row.amount || 0);
    }, 0)
  );

  // Pending = net from today's payments (not yet available for withdrawal)
  const pendingBalance = roundCurrency(
    paidContributions
      .filter((row: Record<string, unknown>) => {
        const ts = row.created_at ? new Date(String(row.created_at)) : null;
        return ts !== null && ts >= settlementCutoff;
      })
      .reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.amount || 0), 0)
  );

  const settledNet = roundCurrency(netPayment - pendingBalance);

  const { data: withdrawals } = await supabase
    .from("withdrawals").select("amount, status").eq("collection_id", collectionId);

  const completedWithdrawals = roundCurrency(
    (withdrawals || [])
      .filter((row: Record<string, unknown>) => COMPLETED_WITHDRAWAL_STATUSES.has(String(row.status || "")))
      .reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.amount || 0), 0)
  );

  const availableBalance = roundCurrency(Math.max(0, settledNet - completedWithdrawals));
  const ledgerBalance = roundCurrency(availableBalance + pendingBalance);

  // total_contributions = count of paid contributions (one per ticket for ticket collections)
  const totalContributions = paidContributions.length;

  console.log("[verify] Balances computed:", {
    collectionId,
    netPayment,
    grossPayment,
    pendingBalance,
    settledNet: roundCurrency(netPayment - pendingBalance),
    completedWithdrawals,
    availableBalance,
    ledgerBalance,
    totalContributions,
  });

  // Cast tiers to Record so we can access the original spread properties (id, price, etc.)
  const tierAvailability = (buildTierAvailability(
    getPriceTiers(collection),
    paidContributions as Array<Record<string, unknown>>
  ) as Array<Record<string, unknown>>).map((tier) => ({
    id: tier.id || tier.tierId || null,
    name: tier.tierName,
    price: tier.price,
    description: tier.description || null,
    quantity: tier.totalCapacity,
    prefix: tier.prefix || null,
    sold_quantity: tier.sold,
    remaining_quantity: tier.remainingCapacity,
  }));

  // NOTE: collections table does NOT have a total_amount column.
  // total_contributions tracks how many paid contribution rows exist.
  const { error: colUpdateErr } = await supabase.from("collections").update({
    total_contributions: totalContributions,
    ...(Array.isArray(getPriceTiers(collection)) ? { price_tiers: tierAvailability } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", collectionId);
  if (colUpdateErr) console.error("[verify] ❌ collections update failed:", colUpdateErr);

  // ── Wallet: SELECT-then-UPDATE or INSERT ──────────────────────────────────
  // We do NOT use upsert({ onConflict: "collection_id" }) because that requires
  // a UNIQUE constraint on wallets.collection_id. Instead we explicitly check
  // existence and branch, which works regardless of DB constraint state.
  const walletPayload = {
    collection_id: collectionId,
    gross_payment: grossPayment,
    net_payment: netPayment,         // = Total Raised (contribution amounts, no fees)
    ledger_balance: ledgerBalance,
    available_balance: availableBalance,
    pending_balance: pendingBalance,
    withdrawn: completedWithdrawals,
    currency: "NGN",
    currency_symbol: "₦",
    updated_at: new Date().toISOString(),
  };

  const { data: existingWallet, error: walletCheckErr } = await supabase
    .from("wallets")
    .select("id")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (walletCheckErr) {
    console.error("[verify] ❌ Wallet existence check failed:", walletCheckErr);
  } else if (existingWallet) {
    // Row exists: UPDATE in-place using primary key
    const { error: updateErr } = await supabase
      .from("wallets")
      .update(walletPayload)
      .eq("id", existingWallet.id);
    if (updateErr) {
      console.error("[verify] ❌ Wallet UPDATE failed:", updateErr);
    } else {
      console.log("[verify] ✅ Wallet UPDATED:", { id: existingWallet.id, collectionId, netPayment, pendingBalance, availableBalance, ledgerBalance });
    }
  } else {
    // No row yet: INSERT
    const { data: inserted, error: insertErr } = await supabase
      .from("wallets")
      .insert(walletPayload)
      .select("id")
      .single();
    if (insertErr) {
      console.error("[verify] ❌ Wallet INSERT failed:", insertErr);
    } else {
      console.log("[verify] ✅ Wallet INSERTED:", { id: inserted?.id, collectionId, netPayment, pendingBalance, availableBalance, ledgerBalance });
    }
  }
}

function getReceiptFromContribution(contribution: Record<string, unknown>): Record<string, unknown> {
  const infoRows = Array.isArray(contribution.contributor_information)
    ? (contribution.contributor_information as Array<Record<string, unknown>>)
    : [];
  // Receipt data is stored under _receipt key inside contributor_information[0]
  return (infoRows[0]?._receipt as Record<string, unknown>) || {};
}

function formatContributionSummary(contribution: Record<string, unknown>) {
  return {
    id: contribution.id,
    // Column is "name" not "contributor_name"
    name: contribution.name || "Anonymous",
    amount: Number(contribution.amount || 0),
    gross_amount: Number(contribution.gross_amount || contribution.amount || 0),
    uniqueCode: contribution.contributor_unique_code || null,
    created_at: contribution.created_at,
    // Column is "email" not "contributor_email"
    email: contribution.email || "",
    contributor_information: contribution.contributor_information || [],
  };
}

function buildReceiptData(input: {
  transaction: Record<string, unknown>;
  normalizedPayment: ReturnType<typeof normalizePaymentRequest> | null;
  collection: Record<string, unknown>;
  contributions: Array<Record<string, unknown>>;
  customer: Record<string, unknown>;
}) {
  const { transaction, normalizedPayment, collection, contributions, customer } = input;

  // Receipt metadata is stored inside contributor_information[0]._receipt
  const firstReceipt = getReceiptFromContribution(contributions[0] || {});

  const contributionAmount =
    normalizedPayment?.contributionAmount ||
    Number(firstReceipt.order_contribution_amount || 0) ||
    roundCurrency(contributions.reduce((s, r) => s + Number(r.amount || 0), 0));

  const platformFee = normalizedPayment?.platformFee || Number(firstReceipt.order_platform_fee || 0);
  const gatewayFee = normalizedPayment?.gatewayFee || Number(firstReceipt.order_gateway_fee || 0);
  const totalFees = normalizedPayment?.totalFees || Number(firstReceipt.order_total_fees || 0) || roundCurrency(platformFee + gatewayFee);
  const totalPaid = normalizedPayment?.totalPayable || Number(firstReceipt.order_total_paid || 0) || roundCurrency(Number(transaction.amount || 0) / 100);
  const ticketSelections = normalizedPayment?.ticketSelections || groupTicketSelectionsFromContributions(contributions);

  const payerName =
    normalizedPayment?.contact.name ||
    String(customer.name || "") ||
    String(customer.email || "").split("@")[0] ||
    "";

  return {
    collectionTitle: String(collection.title || "Your Collection"),
    collectionType: String(collection.collection_type || collection.type || "fixed"),
    description: collection.description ? String(collection.description) : "",
    campaignSummary: collection.campaign_summary ? String(collection.campaign_summary) : "",
    bannerUrl: String(collection.banner_url || collection.banner_image || ""),
    eventDate: collection.event_date ? String(collection.event_date) : "",
    uniqueIdEnabled: hasAnyConfiguredPrefix(collection),
    codePrefix: collection.code_prefix ? String(collection.code_prefix) : "",
    contributionAmount,  // Total Raised contribution — no fees
    platformFee,
    gatewayFee,
    totalFees,
    totalPaid,           // what contributor paid (may be higher if contributor-borne)
    participants: contributions.map((c) => ({
      id: String(c.id),
      uniqueCode: String(c.contributor_unique_code || ""),
      details: formatParticipantDetails(c),
    })),
    ticketSelections,
    transactionRef: String(transaction.reference || ""),
    status: "success",
    paidAt: String(transaction.paid_at || new Date().toISOString()),
    channel: String(transaction.channel || "card"),
    currency: String(transaction.currency || "NGN"),
    payer: {
      name: payerName,
      email: String(normalizedPayment?.contact.email || customer.email || ""),
      phone: String(normalizedPayment?.contact.phone || ""),
    },
  };
}

function formatParticipantDetails(contribution: Record<string, unknown>) {
  const infoRows = Array.isArray(contribution.contributor_information)
    ? (contribution.contributor_information as Array<Record<string, unknown>>)
    : [];
  // Skip internal keys prefixed with _ (e.g., _receipt) and technical fields
  const SKIP_KEYS = new Set(["collectionType", "paidAt", "channel", "TierAmount", "TierId", "Quantity"]);
  const details = infoRows.flatMap((row) =>
    Object.entries(row).flatMap(([label, value]) => {
      if (label.startsWith("_")) return []; // skip internal metadata
      if (value == null || value === "") return [];
      if (SKIP_KEYS.has(label)) return [];
      return [{ label, value: String(value) }];
    })
  );
  // "name" is the correct column (not "contributor_name")
  if (details.length === 0) {
    return [{ label: "Contributor", value: String(contribution.name || "Anonymous") }];
  }
  return details;
}

function groupTicketSelectionsFromContributions(contributions: Array<Record<string, unknown>>) {
  const grouped = new Map<string, { tierName: string; quantity: number; pricePerUnit: number; subtotal: number }>();
  for (const contribution of contributions) {
    const infoRows = Array.isArray(contribution.contributor_information)
      ? (contribution.contributor_information as Array<Record<string, unknown>>)
      : [];
    const info = infoRows[0] || {};
    const tierName = String(info.Tier || "Ticket");
    const pricePerUnit = Number(info.TierAmount || contribution.amount || 0);
    const existing = grouped.get(tierName) || { tierName, quantity: 0, pricePerUnit, subtotal: 0 };
    existing.quantity += 1;
    existing.subtotal = roundCurrency(existing.subtotal + Number(contribution.amount || 0));
    grouped.set(tierName, existing);
  }
  return Array.from(grouped.values());
}

function stripStandardFields(data: Record<string, unknown>) {
  const blocked = new Set(["collectionType", "channel", "paidAt"]);
  return Object.keys(data || {}).reduce<Record<string, unknown>>((acc, key) => {
    if (!blocked.has(key)) acc[key] = data[key];
    return acc;
  }, {});
}

// ─── RECEIPT EMAIL ────────────────────────────────────────────────────────────
/**
 * Sends a branded HTML receipt email to the payer via Resend.
 * Requires RESEND_API_KEY env var. Fails gracefully if not configured.
 */
async function sendReceiptEmail(params: {
  payerEmail: string;
  payerName: string;
  collectionTitle: string;
  collectionType: string;
  contributionAmount: number;
  totalPaid: number;
  platformFee: number;
  gatewayFee: number;
  transactionRef: string;
  paidAt: string;
  uniqueCodes: string[];
}): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.warn("[verify] RESEND_API_KEY not set — skipping receipt email");
    return;
  }

  const {
    payerEmail, payerName, collectionTitle, collectionType,
    contributionAmount, totalPaid, platformFee, gatewayFee,
    transactionRef, paidAt, uniqueCodes,
  } = params;

  const fmt = (n: number) =>
    `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const typeLabel: Record<string, string> = {
    fixed: "Payment", tiered: "Payment", open_pool: "Contribution",
    ticket: "Ticket Purchase", fundraising: "Donation",
  };
  const label = typeLabel[collectionType] || "Payment";

  let formattedDate = paidAt;
  try {
    formattedDate = new Date(paidAt).toLocaleString("en-NG", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos",
    });
  } catch { /* keep raw string */ }

  const uniqueCodesRow = uniqueCodes.length > 0
    ? `<tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:12px 16px;color:#6b7280;font-size:14px;">Your Code(s)</td>
        <td style="padding:12px 16px;color:#111827;font-size:14px;font-weight:600;font-family:monospace;">${uniqueCodes.join(", ")}</td>
      </tr>`
    : "";

  const feesRow = (platformFee + gatewayFee) > 0
    ? `<tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
        <td style="padding:12px 16px;color:#6b7280;font-size:14px;">Processing Fees</td>
        <td style="padding:12px 16px;color:#111827;font-size:14px;">${fmt(platformFee + gatewayFee)}</td>
      </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#1B5E20 0%,#388E3C 100%);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:50%;margin-bottom:12px;">
              <span style="color:#ffffff;font-size:22px;">✓</span>
            </div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${label} Confirmed</h1>
            <p style="margin:6px 0 0;color:#bbf7d0;font-size:14px;">${collectionTitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hi <strong>${payerName}</strong>,</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.7;">
              Your ${label.toLowerCase()} has been confirmed. Here is your receipt for your records.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">Receipt Summary</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:12px 16px;color:#6b7280;font-size:14px;width:45%;">Collection</td>
                <td style="padding:12px 16px;color:#111827;font-size:14px;font-weight:600;">${collectionTitle}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:12px 16px;color:#6b7280;font-size:14px;">Amount</td>
                <td style="padding:12px 16px;color:#111827;font-size:14px;font-weight:600;">${fmt(contributionAmount)}</td>
              </tr>
              ${feesRow}
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:12px 16px;color:#6b7280;font-size:14px;font-weight:600;">Total Paid</td>
                <td style="padding:12px 16px;color:#16a34a;font-size:16px;font-weight:700;">${fmt(totalPaid)}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:12px 16px;color:#6b7280;font-size:14px;">Reference</td>
                <td style="padding:12px 16px;color:#111827;font-size:13px;font-family:'Courier New',monospace;">${transactionRef}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:12px 16px;color:#6b7280;font-size:14px;">Date</td>
                <td style="padding:12px 16px;color:#111827;font-size:14px;">${formattedDate}</td>
              </tr>
              ${uniqueCodesRow}
            </table>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
              <p style="margin:0;color:#166534;font-size:13px;line-height:1.6;">
                <strong>Payment not loading?</strong> Your payment was successful and is recorded. If the confirmation page didn't load, use your reference number above to contact support.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#d1d5db;font-size:12px;">Powered by <strong style="color:#1B5E20;">Kolekto</strong> &nbsp;·&nbsp; Secure group payments across Nigeria</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Kolekto Payments <noreply@kolekto.io>",
      to: [payerEmail],
      subject: `${label} confirmed — ${collectionTitle}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
  console.log("[verify] ✅ Receipt email sent to", payerEmail);
}
