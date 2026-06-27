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
 * Best-effort, never-throwing diagnostic log into `payment_recovery_log`.
 * Covers requirement: durable visibility into every post-success verify /
 * admin-reconcile outcome (not just ephemeral console logs that vanish once
 * the edge function instance recycles). Failures to write this row must
 * never affect the actual payment outcome.
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
      //   which uses ZeptoMail SMTP (already configured in the backend).
      // Fallback: ZeptoMail HTTP API (if ZEPTOMAIL_API_TOKEN is set as a Supabase secret).
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

          // Resolve organizer name once for the receipt's collection card
          // (best-effort — the card simply omits the line when unavailable).
          let organizerName: string | undefined;
          try {
            const { data: org } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", String((collection as Record<string, unknown>).user_id || ""))
              .maybeSingle();
            if (org?.full_name) organizerName = String(org.full_name);
          } catch { /* non-fatal: organizer line is optional */ }

          // Single normalized argument set for the ZeptoMail fallback, built once
          // here (where `normalizedPayment` is non-null) and reused by every
          // fallback branch below — no duplicated object literals.
          const receiptArgs = {
            payerEmail,
            payerName,
            collectionTitle: String(collection.title || "Collection"),
            collectionType: normalizedPayment.collectionType,
            collectionDescription: collection.description ? String(collection.description) : undefined,
            organizerName,
            contributionAmount: normalizedPayment.contributionAmount,
            platformFee: normalizedPayment.platformFee,
            gatewayFee: normalizedPayment.gatewayFee,
            totalPaid: normalizedPayment.totalPayable,
            currency: "NGN",
            transactionRef: String(transaction.reference || ""),
            transactionId: transaction.id ? String(transaction.id) : undefined,
            paidAt: String(transaction.paid_at || new Date().toISOString()),
            channel: transaction.channel ? String(transaction.channel) : undefined,
            uniqueCodes: processedContributions
              .map((c) => String((c as Record<string, unknown>).contributor_unique_code || ""))
              .filter(Boolean),
          };

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
                collectionTitle: receiptArgs.collectionTitle,
                collectionType: receiptArgs.collectionType,
                collectionDescription: receiptArgs.collectionDescription,
                organizerName: receiptArgs.organizerName,
                contributionAmount: receiptArgs.contributionAmount,
                platformFee: receiptArgs.platformFee,
                gatewayFee: receiptArgs.gatewayFee,
                totalPaid: receiptArgs.totalPaid,
                currency: "NGN",
                transactionRef: receiptArgs.transactionRef,
                transactionId: receiptArgs.transactionId,
                paidAt: receiptArgs.paidAt,
                channel: receiptArgs.channel || "card",
                participants: emailParticipants,
                uniqueCodes: receiptArgs.uniqueCodes,
                collectionId: collectionId,
              }),
            }).then(async (r) => {
              if (!r.ok) {
                const body = await r.text().catch(() => "");
                console.warn("[verify] backend email non-OK:", r.status, body);
                // Fallback to ZeptoMail HTTP API if backend returned an error
                return sendReceiptEmail(receiptArgs).catch((e: unknown) =>
                  console.warn("[verify] ZeptoMail fallback also failed:", (e as Error)?.message)
                );
              }
              console.log(
                `[verify ref=${reference}] RECEIPT_EMAIL_SENT channel=backend`
              );
            }).catch((err: unknown) => {
              console.warn("[verify] backend email fetch error, trying ZeptoMail:", (err as Error)?.message);
              // Fallback to ZeptoMail HTTP API on network error
              sendReceiptEmail(receiptArgs).catch((e: unknown) =>
                console.warn("[verify] ZeptoMail fallback also failed:", (e as Error)?.message)
              );
            });
          } else {
            // ── No BACKEND_URL configured: fall back to ZeptoMail HTTP API directly ───────
            sendReceiptEmail(receiptArgs).catch((err: unknown) =>
              console.warn("[verify] ZeptoMail email failed (no backend URL set):", (err as Error)?.message)
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

// ─── PREMIUM RECEIPT EMAIL TEMPLATE ─────────────────────────────────────────────
//
// Brand system (sourced from the frontend tailwind.config.ts `kolekto` palette):
//   primary  #1B5E20 (deep green)   light    #E8F5E9
//   gradient #2E7D32 / #388E3C      accents  #FFCA28 (yellow) / #FFA726 (orange)
// Logo is the same asset the app navbar uses, served from the site root.
//
// Design constraints honoured here:
//   • 100% table-based layout + inline styles  → Gmail / Outlook / Apple Mail safe
//   • a <style> head block adds mobile + dark-mode polish that DEGRADES gracefully
//   • "NGN" is used instead of the ₦ glyph, and all icons are HTML entities
//     (&#10003;) — no raw astral-plane Unicode that tripped earlier debugging
//   • every user-supplied value is HTML-escaped (esc) so a stray "<" in a title
//     can never break the layout or inject markup
const KOLEKTO_LOGO_URL =
  "https://www.kolekto.com.ng/lovable-uploads/1da42b31-fdee-4d4b-a844-19fa3100d598.png";

/** Friendly, human-facing label for each internal collection_type. */
function collectionTypeLabel(t: string): string {
  const map: Record<string, string> = {
    fixed: "Contribution",
    tiered: "Contribution",
    open_pool: "Open Contribution",
    ticket: "Event Ticket",
    fundraising: "Donation",
  };
  return map[t] || "Payment";
}

/** HTML-escape any value that originates from user / organizer input. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ReceiptEmailData {
  payerName: string;
  collectionTitle: string;
  collectionType: string;
  collectionDescription?: string;
  organizerName?: string;
  contributionAmount: number;
  platformFee: number;
  gatewayFee: number;
  totalPaid: number;
  currency?: string;
  transactionRef: string;
  transactionId?: string;
  paidAt: string;
  channel?: string;
  uniqueCodes: string[];
  /** Frontend base URL for the "View Receipt" link; falls back to production. */
  baseUrl?: string;
}

/**
 * Builds the full premium receipt email HTML. Pure function — no I/O — so it is
 * trivially testable and reused by every send path.
 */
function renderReceiptEmail(d: ReceiptEmailData): string {
  const currency = d.currency || "NGN";
  const money = (n: number) =>
    `${currency} ${(Number(n) || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const typeLabel = collectionTypeLabel(d.collectionType);
  const isTicket = d.collectionType === "ticket";

  // "View Receipt" link back to the verify page. Reference is passed twice
  // (trxref + reference) to match Paystack's own callback URL shape, which the
  // frontend's /payment/verify page already parses & re-verifies.
  const base = (d.baseUrl || "https://www.kolekto.com.ng").replace(/\/+$/, "");
  const receiptUrl = `${base}/payment/verify?trxref=${encodeURIComponent(d.transactionRef)}&reference=${encodeURIComponent(d.transactionRef)}`;

  let paidDate = d.paidAt;
  try {
    paidDate = new Date(d.paidAt).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Lagos",
    });
  } catch { /* keep raw string */ }

  // ── Section 4: amount rows (each fee shown only when actually charged) ──
  const amountRow = (label: string, val: number, opts?: { muted?: boolean }) => `
              <tr>
                <td style="padding:7px 0;color:${opts?.muted ? "#5b6b60" : "#1f2d23"};font-size:14px;line-height:1.4;">${label}</td>
                <td align="right" style="padding:7px 0;color:#1f2d23;font-size:14px;line-height:1.4;white-space:nowrap;">${money(val)}</td>
              </tr>`;
  const feeRows =
    (d.platformFee > 0 ? amountRow("Platform fee", d.platformFee, { muted: true }) : "") +
    (d.gatewayFee > 0 ? amountRow("Gateway fee", d.gatewayFee, { muted: true }) : "");

  // ── Section 4: receipt meta rows ──
  const metaRow = (label: string, valueHtml: string) => `
                <tr>
                  <td style="padding:9px 0;color:#5b6b60;font-size:13px;width:42%;vertical-align:top;">${label}</td>
                  <td align="right" style="padding:9px 0;color:#1f2d23;font-size:13px;font-weight:600;vertical-align:top;word-break:break-word;">${valueHtml}</td>
                </tr>`;
  const meta =
    metaRow(
      "Status",
      `<span style="display:inline-block;background:#E8F5E9;color:#1B5E20;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 10px;border-radius:999px;">Successful</span>`,
    ) +
    metaRow("Reference", `<span style="font-family:'Courier New',Courier,monospace;">${esc(d.transactionRef)}</span>`) +
    (d.transactionId
      ? metaRow("Transaction ID", `<span style="font-family:'Courier New',Courier,monospace;">${esc(d.transactionId)}</span>`)
      : "") +
    metaRow("Date &amp; time", esc(paidDate)) +
    (d.channel ? metaRow("Payment method", esc(d.channel.charAt(0).toUpperCase() + d.channel.slice(1))) : "");

  // ── Section 3: collection card extras ──
  const organizerLine = d.organizerName
    ? `<tr><td style="padding:6px 0 0;color:#5b6b60;font-size:13px;">Organized by <strong style="color:#1f2d23;">${esc(d.organizerName)}</strong></td></tr>`
    : "";
  const desc = d.collectionDescription || "";
  const descLine = desc
    ? `<tr><td style="padding:8px 0 0;color:#5b6b60;font-size:13px;line-height:1.6;">${esc(desc.length > 180 ? desc.slice(0, 177) + "..." : desc)}</td></tr>`
    : "";

  // ── Section 5: unique codes (omitted entirely when there are none).
  // Tickets get a distinct "admit one" stub treatment; everything else gets
  // compact monospace chips. ──
  const codeCount = d.uniqueCodes.length;
  const codesHeading = isTicket
    ? `Your ticket${codeCount > 1 ? "s" : ""}`
    : `Your unique code${codeCount > 1 ? "s" : ""}`;
  const ticketStub = (c: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid #FFE082;border-radius:10px;overflow:hidden;">
            <tr>
              <td width="6" style="background:#FFCA28;font-size:0;line-height:0;width:6px;">&nbsp;</td>
              <td style="padding:12px 16px;background:#FFFDF5;">
                <p style="margin:0 0 3px;color:#9a7b1e;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Admit one &middot; Entry code</p>
                <p style="margin:0;color:#1B5E20;font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;letter-spacing:.1em;">${esc(c)}</p>
              </td>
            </tr>
          </table>`;
  const codeChip = (c: string) =>
    `<span style="display:inline-block;background:#FFFDF5;border:1px solid #FFE082;color:#1B5E20;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;letter-spacing:.08em;padding:9px 14px;border-radius:8px;margin:0 8px 8px 0;">${esc(c)}</span>`;
  const codeChips =
    codeCount > 0
      ? `
        <tr><td class="px" style="padding:6px 32px 0;">
          <p style="margin:0 0 9px;color:#7a8a7f;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">${codesHeading}</p>
          ${d.uniqueCodes.map((c) => (isTicket ? ticketStub(c) : codeChip(c))).join("")}
          ${isTicket ? `<p style="margin:2px 0 0;color:#9aa69d;font-size:12px;line-height:1.5;">Present ${codeCount > 1 ? "these codes" : "this code"} at the entrance for check-in.</p>` : ""}
        </td></tr>`
      : "";

  // ── Section 6: trust timeline ──
  const steps = ["Payment received", "Payment verified", "Contribution recorded", "Receipt generated"];
  const timeline = steps
    .map(
      (s) => `
            <tr>
              <td width="22" valign="middle" style="padding:5px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="20" height="20" align="center" valign="middle" bgcolor="#1B5E20" style="background:#1B5E20;border-radius:999px;color:#ffffff;font-size:11px;line-height:20px;">&#10003;</td></tr></table>
              </td>
              <td valign="middle" style="padding:5px 0 5px 12px;color:#1f2d23;font-size:14px;">${s}</td>
            </tr>`,
    )
    .join("");

  // ── Full document ──
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>Payment Successful - Kolekto</title>
  <style>
    body{margin:0;padding:0;width:100%!important;background:#eef1ee;}
    img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
    table{border-collapse:collapse!important;}
    a{color:#1B5E20;}
    @media only screen and (max-width:600px){
      .container{width:100%!important;border-radius:0!important;}
      .px{padding-left:20px!important;padding-right:20px!important;}
      .hero-h1{font-size:23px!important;}
      .total-amt{font-size:20px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef1ee;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preheader (hidden inbox preview line) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#eef1ee;">Payment successful - your ${esc(typeLabel.toLowerCase())} of ${money(d.totalPaid)} to ${esc(d.collectionTitle)} is confirmed and recorded on Kolekto.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1ee;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e8e4;">

        <!-- Brand accent bar -->
        <tr><td style="height:4px;background:#1B5E20;line-height:4px;font-size:4px;">&nbsp;</td></tr>

        <!-- Section 1a: logo header (on white, so any logo colour reads well) -->
        <tr><td align="center" style="padding:26px 32px 6px;">
          <img src="${KOLEKTO_LOGO_URL}" alt="Kolekto" height="34" style="height:34px;width:auto;display:block;"/>
        </td></tr>

        <!-- Section 1b: success hero -->
        <tr><td align="center" class="px" style="padding:16px 32px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="62" height="62" align="center" valign="middle" bgcolor="#1B5E20" style="background:#1B5E20;border-radius:999px;color:#ffffff;font-size:30px;line-height:62px;">&#10003;</td></tr></table>
          <h1 class="hero-h1" style="margin:18px 0 5px;color:#14210f;font-size:26px;font-weight:800;letter-spacing:-.02em;">Payment Successful</h1>
          <p style="margin:0;color:#5b6b60;font-size:15px;line-height:1.5;">Your ${esc(typeLabel.toLowerCase())} has been received and recorded.</p>
        </td></tr>

        <!-- Section 2: greeting -->
        <tr><td class="px" style="padding:0 32px;">
          <p style="margin:0 0 6px;color:#14210f;font-size:16px;font-weight:600;">Hi ${esc(d.payerName)},</p>
          <p style="margin:0 0 22px;color:#5b6b60;font-size:14px;line-height:1.7;">Thank you. Your payment has been successfully received and recorded on Kolekto. Keep this email as your official receipt and proof of payment.</p>
        </td></tr>

        <!-- Section 3: collection information card -->
        <tr><td class="px" style="padding:0 32px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8f5;border:1px solid #e2eae3;border-radius:12px;">
            <tr><td style="padding:18px;">
              <span style="display:inline-block;background:#E8F5E9;color:#1B5E20;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 11px;border-radius:999px;">${esc(typeLabel)}</span>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:11px;">
                <tr><td style="color:#14210f;font-size:17px;font-weight:700;line-height:1.35;">${esc(d.collectionTitle)}</td></tr>
                ${organizerLine}
                ${descLine}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Section 4: receipt document card -->
        <tr><td class="px" style="padding:16px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5eae6;border-radius:12px;overflow:hidden;">
            <tr><td style="background:#fbfcfb;border-bottom:1px solid #eef2ef;padding:12px 18px;">
              <span style="color:#7a8a7f;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">Receipt</span>
            </td></tr>
            <tr><td style="padding:12px 18px 2px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${amountRow(typeLabel + " amount", d.contributionAmount)}
                ${feeRows}
              </table>
            </td></tr>
            <tr><td style="padding:6px 18px;"><div style="border-top:1px dashed #d7ded9;font-size:0;line-height:0;height:1px;">&nbsp;</div></td></tr>
            <tr><td style="padding:4px 18px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#14210f;font-size:15px;font-weight:700;vertical-align:middle;">Total paid</td>
                  <td align="right" class="total-amt" style="color:#1B5E20;font-size:22px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;vertical-align:middle;">${money(d.totalPaid)}</td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="background:#fbfcfb;border-top:1px solid #eef2ef;padding:8px 18px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${meta}
              </table>
            </td></tr>
          </table>
        </td></tr>
        ${codeChips}

        <!-- Section 6: trust timeline -->
        <tr><td class="px" style="padding:22px 32px 4px;">
          <p style="margin:0 0 10px;color:#7a8a7f;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">Status</p>
          <table role="presentation" cellpadding="0" cellspacing="0">${timeline}
          </table>
        </td></tr>

        <!-- View receipt button (bulletproof: VML for Outlook, anchor elsewhere) -->
        <tr><td class="px" align="center" style="padding:22px 32px 2px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${receiptUrl}" style="height:46px;v-text-anchor:middle;width:210px;" arcsize="22%" stroke="f" fillcolor="#1B5E20">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">View Receipt</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${receiptUrl}" target="_blank" style="display:inline-block;background:#1B5E20;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 34px;border-radius:10px;mso-padding-alt:0;">View Receipt</a>
          <!--<![endif]-->
          <p style="margin:13px 0 0;color:#7a8a7f;font-size:12px;line-height:1.6;">Page didn't open? Your payment is recorded - quote reference <span style="font-family:'Courier New',Courier,monospace;color:#1f2d23;">${esc(d.transactionRef)}</span> to support.</p>
        </td></tr>

        <!-- Section 7: footer -->
        <tr><td style="padding:26px 32px 30px;border-top:1px solid #eef2ef;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <div style="font-size:18px;font-weight:800;color:#1B5E20;letter-spacing:-.02em;">Kolekto</div>
            <p style="margin:6px 0 12px;color:#7a8a7f;font-size:12px;line-height:1.6;">Building trust in community payments across Africa.</p>
            <p style="margin:0 0 6px;">
              <a href="https://www.kolekto.com.ng" style="color:#1B5E20;font-size:12px;text-decoration:none;font-weight:600;">kolekto.com.ng</a>
              <span style="color:#c4cdc6;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
              <a href="mailto:team@kolekto.com.ng" style="color:#1B5E20;font-size:12px;text-decoration:none;font-weight:600;">team@kolekto.com.ng</a>
            </p>
            <p style="margin:8px 0 0;color:#aab4ac;font-size:11px;">&copy; ${new Date().getFullYear()} Kolekto. All rights reserved.</p>
          </td></tr></table>
        </td></tr>

      </table>
      <p style="margin:14px 0 0;color:#9aa69d;font-size:11px;">This is an automated receipt from Kolekto. Please do not reply.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── RECEIPT EMAIL SENDER ───────────────────────────────────────────────────────
/**
 * Sends the premium HTML receipt to the payer via ZeptoMail's HTTP API.
 * Requires ZEPTOMAIL_API_TOKEN env var. Fails gracefully if not configured.
 */
async function sendReceiptEmail(params: {
  payerEmail: string;
  payerName: string;
  collectionTitle: string;
  collectionType: string;
  collectionDescription?: string;
  organizerName?: string;
  contributionAmount: number;
  totalPaid: number;
  platformFee: number;
  gatewayFee: number;
  currency?: string;
  transactionRef: string;
  transactionId?: string;
  paidAt: string;
  channel?: string;
  uniqueCodes: string[];
}): Promise<void> {
  // @ts-ignore — Deno is a valid global in Supabase Edge Functions
  const rawZeptoToken = Deno.env.get("ZEPTOMAIL_API_TOKEN");
  if (!rawZeptoToken) {
    console.warn("[verify] ZEPTOMAIL_API_TOKEN not set — skipping receipt email");
    return;
  }
  // Root-cause guard (incident 2026-06-27): ZeptoMail's dashboard displays the
  // credential as the full Authorization header value — "Zoho-enczapikey <token>".
  // If that whole string is pasted into the secret, the line below would emit
  // "Authorization: Zoho-enczapikey Zoho-enczapikey <token>" (doubled prefix),
  // which ZeptoMail's gateway rejects with an opaque HTTP 500 + empty body
  // (NOT a clean 401), making it very hard to diagnose. Normalize defensively so
  // the secret works whether it's stored as the raw token OR with the prefix.
  const zeptoApiToken = rawZeptoToken.trim().replace(/^Zoho-enczapikey\s+/i, "");

  const { payerEmail, payerName, collectionTitle } = params;
  const subjectLabel = collectionTypeLabel(params.collectionType);

  // Frontend base URL for the "View Receipt" link. Set FRONTEND_URL (or SITE_URL)
  // as a Supabase secret to override per environment; defaults to production.
  // @ts-ignore — Deno is a valid global in Supabase Edge Functions
  const siteBase = Deno.env.get("FRONTEND_URL") || Deno.env.get("SITE_URL") || undefined;

  // All markup is delegated to the pure, reusable renderReceiptEmail() above.
  const html = renderReceiptEmail({
    payerName,
    collectionTitle,
    collectionType: params.collectionType,
    collectionDescription: params.collectionDescription,
    organizerName: params.organizerName,
    contributionAmount: params.contributionAmount,
    platformFee: params.platformFee,
    gatewayFee: params.gatewayFee,
    totalPaid: params.totalPaid,
    currency: params.currency,
    transactionRef: params.transactionRef,
    transactionId: params.transactionId,
    paidAt: params.paidAt,
    channel: params.channel,
    uniqueCodes: params.uniqueCodes,
    baseUrl: siteBase,
  });

  const res = await fetch("https://api.zeptomail.com/v1.1/email", {
    method: "POST",
    headers: {
      Authorization: `Zoho-enczapikey ${zeptoApiToken}`,
      "Content-Type": "application/json",
      // Deno's default fetch User-Agent gets blocked by ZeptoMail's WAF
      // (returns an empty HTML challenge page instead of the JSON API response).
      "User-Agent": "Mozilla/5.0 (compatible; Kolekto-Edge-Function/1.0)",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: { address: "notification@kolekto.com.ng", name: "Kolekto Payments" },
      to: [{ email_address: { address: payerEmail, name: payerName } }],
      subject: `${subjectLabel} confirmed - ${collectionTitle}`,
      htmlbody: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // An empty/HTML body with status 500 almost always means a malformed
    // Authorization header (e.g. doubled "Zoho-enczapikey" prefix) rather than
    // a genuine server fault — surface a hint plus the token length (never the
    // token itself) so this is diagnosable straight from the logs next time.
    const looksLikeAuthIssue = res.status === 500 && body.trim().length <= 2;
    throw new Error(
      `ZeptoMail API error ${res.status}: ${JSON.stringify(body)}` +
      (looksLikeAuthIssue
        ? ` — empty 500 body usually means a malformed Authorization header. ` +
          `Check ZEPTOMAIL_API_TOKEN (normalized length=${zeptoApiToken.length}); ` +
          `it must be the raw enczapikey token WITHOUT the "Zoho-enczapikey " prefix.`
        : "")
    );
  }
  console.log("[verify] ✅ Receipt email sent to", payerEmail);
}
