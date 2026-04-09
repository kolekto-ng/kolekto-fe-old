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

function ensureCollectionIsPayable(collection: Record<string, unknown>, collectionId: string) {
  const status = String(collection.status || "active");
  if (collection.deleted_at) throw new PaymentValidationError("This collection is no longer available.", 404, "collection_deleted", { collectionId, status });
  if (status === "paused") throw new PaymentValidationError("This collection is currently paused and cannot accept payments.", 400, "collection_paused", { collectionId, status });
  if (status === "closed" || status === "completed") throw new PaymentValidationError("This collection is no longer accepting payments.", 400, "collection_closed", { collectionId, status });
  if (status === "pending_review" || status === "pending_verification") throw new PaymentValidationError("This collection is not available for payment yet.", 400, "collection_unavailable", { collectionId, status });
}

function normalizePaymentRequest(input: {
  collection: Record<string, unknown>;
  metadata: Record<string, unknown>;
  paidRows?: Array<Record<string, unknown>>;
}) {
  const collection = input.collection;
  const metadata = input.metadata || {};
  const paidRows = input.paidRows || [];

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
    if (!requestedAmount || requestedAmount <= 0) {
      throw new PaymentValidationError(
        collectionType === "fundraising" ? "Enter a valid donation amount." : "Enter a valid contribution amount.",
        400, "invalid_amount", { collectionId, collectionType, requestedAmount }
      );
    }
    if (minimumAmount > 0 && requestedAmount < minimumAmount) {
      throw new PaymentValidationError(
        `${collectionType === "fundraising" ? "Minimum donation" : "Minimum contribution"} is NGN ${minimumAmount.toLocaleString("en-NG")}.`,
        400, "amount_below_minimum", { collectionId, requestedAmount, minimumAmount }
      );
    }
    if (remainingContributionCapacity !== null && remainingContributionCapacity < 1) {
      throw new PaymentValidationError("This collection has reached its contribution limit.", 400, "collection_full", { collectionId, paidCount, maxContributions });
    }
    contributionAmount = requestedAmount;

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
    codePrefix: String(
      metadata.codePrefix ||
      collection.code_prefix ||
      (collectionType === "ticket" ? "TKT" : "KLK")
    ),
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

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqData = await req.json();
    const { reference } = reqData;

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing payment reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: data.message || "Payment verification failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transaction = data.data;
    const customer =
      transaction.customer && typeof transaction.customer === "object"
        ? (transaction.customer as Record<string, unknown>)
        : {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const metadata =
      transaction.metadata && typeof transaction.metadata === "object"
        ? transaction.metadata
        : {};

    const collectionId = String(metadata.collectionId || metadata.collection_id || "").trim();
    if (!collectionId) {
      return new Response(JSON.stringify({ error: "Missing collection ID in payment metadata" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Do not filter on deleted_at — column may not exist in prod schema.
    const { data: collection, error: collectionError } = await supabase
      .from("collections").select("*").eq("id", collectionId).maybeSingle();

    if (collectionError) {
      return new Response(JSON.stringify({ error: "Error fetching collection details" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!collection) {
      return new Response(JSON.stringify({ error: "Collection not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processedContributions: Record<string, unknown>[] = [];
    let normalizedPayment: ReturnType<typeof normalizePaymentRequest> | null = null;

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
      } else {
        const { data: paidRows, error: paidRowsError } = await supabase
          .from("contributions").select("id, amount, contributor_information, contributor_unique_code").eq("collection_id", collectionId).eq("status", "paid");

        if (paidRowsError) {
          return new Response(JSON.stringify({ error: "Unable to validate payment totals right now." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          normalizedPayment = normalizePaymentRequest({
            collection,
            metadata,
            paidRows: (paidRows || []) as Array<Record<string, unknown>>,
          });
        } catch (error: unknown) {
          if (error instanceof PaymentValidationError) {
            return new Response(JSON.stringify({ error: error.message, code: error.code }), {
              status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw error;
        }

        // Verify amount matches: Paystack charged totalPayable, not contributionAmount
        const verifiedTotal = roundCurrency(Number(transaction.amount || 0) / 100);
        if (Math.abs(verifiedTotal - normalizedPayment.totalPayable) > 0.01) {
          console.error("Amount mismatch:", { reference, collectionId, verifiedTotal, expectedTotal: normalizedPayment.totalPayable });
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
          const match = code.match(/^([A-Za-z]+)\d+$/);
          if (match) {
            const p = match[1].toUpperCase();
            existingCountByPrefix.set(p, (existingCountByPrefix.get(p) || 0) + 1);
          }
        }
        // Track how many units in the CURRENT batch have used each prefix
        const batchCountByPrefix = new Map<string, number>();

        for (let index = 0; index < contributionUnits.length; index++) {
          const unit = contributionUnits[index];
          const prefix = String(unit.prefix || normalizedPayment.codePrefix || "KLK").toUpperCase();

          // Per-prefix sequential code: count existing + count in this batch so far
          const existingForPrefix = existingCountByPrefix.get(prefix) || 0;
          const batchForPrefix = batchCountByPrefix.get(prefix) || 0;
          const sequenceNumber = existingForPrefix + batchForPrefix + 1;
          batchCountByPrefix.set(prefix, batchForPrefix + 1);
          const uniqueCode = `${prefix}${String(sequenceNumber).padStart(3, "0")}`;

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
            ...(normalizedPayment.collectionType === "ticket"
              ? { check_in_status: "not_checked_in" }
              : {}),
          };

          const { data: contribution, error: contribError } = await supabase
            .from("contributions").insert(contributorPayload).select("*").single();

          if (contribError) {
            // If insert fails with a duplicate-like error (race condition: two verify
            // calls arrived simultaneously and both passed the idempotency check),
            // fetch the already-inserted row instead of failing.
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
              if (existing && existing.length > 0 && !processedContributions.find(c => c.id === existing[0].id)) {
                processedContributions.push(existing[0]);
              }
            } else {
              console.error("[verify] ❌ Error recording contribution:", JSON.stringify(contribError));
            }
            continue;
          }
          processedContributions.push(contribution);
        }
      }

      await refreshCollectionAndWallets(supabase, collectionId, collection);
    }

    const receiptData = buildReceiptData({
      transaction, normalizedPayment, collection, contributions: processedContributions, customer,
    });

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
    console.error("Server error:", msg);
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
        prefix: selection.prefix || normalizedPayment.codePrefix,
      }))
    );
  }
  return [{
    amount: normalizedPayment.contributionAmount,
    tierId: normalizedPayment.selectedTierId,
    tierName: normalizedPayment.selectedTier,
    // Use tier-specific prefix first, then collection prefix, then default
    prefix: String(normalizedPayment.selectedTierPrefix || collection.code_prefix || normalizedPayment.codePrefix),
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

