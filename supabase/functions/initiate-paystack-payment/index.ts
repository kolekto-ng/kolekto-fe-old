/**
 * initiate-paystack-payment — self-contained single-file edge function.
 * Safe to paste directly into the Supabase web console editor.
 * All shared utilities are inlined — no external local imports needed.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ────────────────────────────────────────────────────────────────────
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
    const parsed = Number(value.replace(/,/g, ""));
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

/**
 * Fee rates (must stay in sync with backend utils/financial.js):
 *   Platform: 1% for fundraising, 0.5% for all others — capped at ₦2,000
 *   Gateway:  1.5% for all types                       — capped at ₦2,000
 *
 * Fee bearer rules:
 *   - fundraising: ALWAYS contributor-borne (fees added on top of donation)
 *   - all others:  honours collection.fee_bearer setting
 *
 * Total Raised = contributionAmount (NEVER includes fees)
 * totalPayable = what contributor actually pays to Paystack
 */
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
    const remainingCapacity =
      totalCapacity == null ? null : Math.max(0, totalCapacity - sold);
    return {
      ...tier,
      tierId,
      tierName,
      tierKey: getTierMatchKey(tier, index),
      sold,
      totalCapacity,
      remainingCapacity,
    };
  });
}

function matchTier(
  tiers: Array<Record<string, unknown>>,
  selection: Record<string, unknown>
) {
  const requestedTierId = selection.tierId
    ? String(selection.tierId)
    : selection.id
    ? String(selection.id)
    : null;
  const requestedTierName = selection.tierName
    ? String(selection.tierName)
    : selection.name
    ? String(selection.name)
    : null;

  return (
    tiers.find((tier) => {
      if (requestedTierId && tier.tierId === requestedTierId) return true;
      if (requestedTierName && tier.tierName === requestedTierName) return true;
      return false;
    }) || null
  );
}

function ensureCollectionIsPayable(
  collection: Record<string, unknown>,
  collectionId: string
) {
  const status = String(collection.status || "active");
  if (collection.deleted_at) {
    throw new PaymentValidationError(
      "This collection is no longer available.", 404, "collection_deleted", { collectionId, status }
    );
  }
  if (status === "paused") {
    throw new PaymentValidationError(
      "This collection is currently paused and cannot accept payments.", 400, "collection_paused", { collectionId, status }
    );
  }
  if (status === "closed" || status === "completed") {
    throw new PaymentValidationError(
      "This collection is no longer accepting payments.", 400, "collection_closed", { collectionId, status }
    );
  }
  if (status === "pending_review" || status === "pending_verification") {
    throw new PaymentValidationError(
      "This collection is not available for payment yet.", 400, "collection_unavailable", { collectionId, status }
    );
  }
}

function normalizePaymentRequest(input: {
  collection: Record<string, unknown>;
  metadata: Record<string, unknown>;
  paidRows?: Array<Record<string, unknown>>;
}) {
  const collection = input.collection;
  const metadata = input.metadata || {};
  const paidRows = input.paidRows || [];

  const collectionId = String(
    metadata.collectionId || metadata.collection_id || collection.id || ""
  ).trim();

  if (!collectionId) {
    throw new PaymentValidationError("A valid collection ID is required.", 400, "missing_collection_id");
  }

  ensureCollectionIsPayable(collection, collectionId);

  const collectionType = getCollectionType(collection);

  // CRITICAL: fundraising fees are ALWAYS paid by contributor.
  // This ensures Total Raised = pure contribution amount, fees are separate.
  const feeBearer: FeeBearer =
    collectionType === "fundraising"
      ? "contributor"
      : String(collection.fee_bearer || metadata.feeBearer || "organizer") === "contributor"
      ? "contributor"
      : "organizer";

  const contactSource =
    metadata.contact && typeof metadata.contact === "object"
      ? (metadata.contact as Record<string, unknown>)
      : {};
  const formData =
    metadata.formData && typeof metadata.formData === "object"
      ? (metadata.formData as Record<string, unknown>)
      : {};
  const contact = {
    name: String(contactSource.name || "").trim(),
    email: String(contactSource.email || "").trim(),
    phone: String(contactSource.phone || "").trim(),
  };

  const allTiers = buildTierAvailability(getPriceTiers(collection), paidRows);
  const maxContributions = asPositiveInt(collection.max_contributions || collection.max_participants);
  const paidCount = paidRows.length;
  const remainingContributionCapacity =
    maxContributions > 0 ? Math.max(0, maxContributions - paidCount) : null;

  let contributionAmount = 0;
  let quantity = 1;
  let selectedTier: string | null = null;
  let selectedTierId: string | null = null;
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
      throw new PaymentValidationError(
        "This collection has reached its contribution limit.", 400, "collection_full", { collectionId, paidCount, maxContributions }
      );
    }
    contributionAmount = requestedAmount;

  } else if (collectionType === "ticket") {
    if (String(collection.ticket_mode || "") === "tiered") {
      const rawSelections = Array.isArray(metadata.ticketSelections)
        ? (metadata.ticketSelections as Array<Record<string, unknown>>)
        : [];
      const legacyQuantity = asPositiveInt(metadata.quantity) || 1;
      const legacySelection =
        rawSelections.length === 0 && (metadata.selectedTier || metadata.selectedTierId)
          ? [{ tierId: metadata.selectedTierId, tierName: metadata.selectedTier, quantity: legacyQuantity }]
          : rawSelections;

      if (legacySelection.length === 0) {
        throw new PaymentValidationError(
          "Select at least one ticket tier before checkout.", 400, "missing_ticket_selection", { collectionId }
        );
      }

      ticketSelections = legacySelection
        .map((selection) => {
          const tier = matchTier(allTiers, selection);
          const requestedQuantity = asPositiveInt(selection.quantity);
          if (!tier) {
            throw new PaymentValidationError(
              "One of the selected ticket tiers is no longer available.", 404, "ticket_tier_not_found", { collectionId, selection }
            );
          }
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
            tierName: tier.tierName,
            pricePerUnit: roundCurrency(asNumber(tier.price)),
            quantity: requestedQuantity,
            subtotal: roundCurrency(asNumber(tier.price) * requestedQuantity),
            description: tier.description ? String(tier.description) : null,
            prefix: tier.prefix ? String(tier.prefix) : null,
            remainingCapacity: tier.remainingCapacity,
          } as TicketSelection;
        })
        .filter(Boolean) as TicketSelection[];

      quantity = ticketSelections.reduce((t, s) => t + s.quantity, 0);
      if (quantity < 1) {
        throw new PaymentValidationError(
          "Select at least one ticket before checkout.", 400, "missing_ticket_quantity", { collectionId }
        );
      }
      contributionAmount = roundCurrency(ticketSelections.reduce((s, sel) => s + sel.subtotal, 0));

    } else {
      quantity = asPositiveInt(metadata.quantity) || 1;
      if (remainingContributionCapacity !== null && quantity > remainingContributionCapacity) {
        throw new PaymentValidationError(
          "Not enough tickets remain for this order.", 400, "insufficient_ticket_capacity",
          { collectionId, quantity, remainingContributionCapacity }
        );
      }
      if (String(collection.allow_multiple_quantity) === "false" && quantity > 1) {
        throw new PaymentValidationError(
          "This ticket only allows one purchase per checkout.", 400, "multiple_quantity_disabled", { collectionId, quantity }
        );
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
    if (!tier) {
      throw new PaymentValidationError(
        "Select a valid pricing tier before checkout.", 400, "invalid_selected_tier", { collectionId, selectedTier: metadata.selectedTier }
      );
    }
    if (tier.remainingCapacity !== null && Number(tier.remainingCapacity) < 1) {
      throw new PaymentValidationError(
        `${tier.tierName} is sold out.`, 400, "tier_sold_out", { collectionId, tierId: tier.tierId, tierName: tier.tierName }
      );
    }
    contributionAmount = roundCurrency(asNumber(tier.price));
    selectedTier = tier.tierName != null ? String(tier.tierName) : null;
    selectedTierId = tier.tierId != null ? String(tier.tierId) : null;

  } else {
    // fixed (default)
    if (remainingContributionCapacity !== null && remainingContributionCapacity < 1) {
      throw new PaymentValidationError(
        "This collection has reached its contribution limit.", 400, "collection_full", { collectionId, paidCount, maxContributions }
      );
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
    contributionAmount,       // ← Total Raised tracks THIS value
    platformFee: feeBreakdown.platformFee,
    gatewayFee: feeBreakdown.gatewayFee,
    totalFees: feeBreakdown.totalFees,
    totalPayable: feeBreakdown.totalPayable,  // ← what Paystack charges
    quantity,
    selectedTier,
    selectedTierId,
    ticketSelections,
    formData,
    contact,
    isAnonymous: Boolean(metadata.isAnonymous),
    codePrefix: String(metadata.codePrefix || collection.code_prefix || "").trim(),
    providedAmount: roundCurrency(asNumber(metadata.totalPayable || metadata.amount || 0)),
  };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: new Headers(corsHeaders) });
  }

  try {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY");

    console.log("[initiate] env check:", {
      hasPaystackKey: !!paystackSecretKey,
      paystackKeyPrefix: paystackSecretKey ? paystackSecretKey.slice(0, 7) : null,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
    });

    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({
          error: "PAYSTACK_SECRET_KEY is not set in Supabase Edge Function secrets.",
          code: "missing_paystack_secret",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const keyOk =
      (paystackSecretKey.startsWith("sk_test_") || paystackSecretKey.startsWith("sk_live_")) &&
      paystackSecretKey.length >= 30;

    if (!keyOk) {
      return new Response(
        JSON.stringify({
          error: "PAYSTACK_SECRET_KEY is malformed (must start with sk_test_ or sk_live_).",
          code: "invalid_paystack_secret",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          error: "Supabase URL or service role key not available inside edge function.",
          code: "missing_supabase_env",
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let requestData: Record<string, unknown>;
    try {
      requestData = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, metadata, callback_url } = requestData as any;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "A valid email address is required." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!metadata || typeof metadata !== "object") {
      return new Response(
        JSON.stringify({ error: "Payment metadata is required." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const collectionId = String(
      (metadata as any).collectionId || (metadata as any).collection_id || ""
    ).trim();

    if (!collectionId) {
      return new Response(
        JSON.stringify({ error: "A valid collection is required before checkout." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // NOTE: do NOT filter on deleted_at here — column may not exist in prod
    // and would fail the whole query. ensureCollectionIsPayable() below
    // checks the deleted_at value on the fetched row if present.
    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("id", collectionId)
      .maybeSingle();

    if (collectionError) {
      console.error("[initiate] collection fetch error:", collectionError);
      return new Response(
        JSON.stringify({
          error: `Unable to load collection for checkout: ${collectionError.message}`,
          code: "collection_fetch_failed",
          details: collectionError,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!collection) {
      return new Response(
        JSON.stringify({ error: "Collection not found. Please check the payment link and try again." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: paidRows, error: paidRowsError } = await supabase
      .from("contributions")
      .select("id, amount, contributor_information")
      .eq("collection_id", collectionId)
      .eq("status", "paid");

    if (paidRowsError) {
      console.error("[initiate] paid rows fetch error:", paidRowsError);
      return new Response(
        JSON.stringify({
          error: `Unable to validate collection availability: ${paidRowsError.message}`,
          code: "paid_rows_fetch_failed",
          details: paidRowsError,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let normalized: ReturnType<typeof normalizePaymentRequest>;
    try {
      normalized = normalizePaymentRequest({
        collection,
        metadata: metadata as Record<string, unknown>,
        paidRows: (paidRows || []) as Array<Record<string, unknown>>,
      });
    } catch (error: any) {
      if (error instanceof PaymentValidationError) {
        return new Response(
          JSON.stringify({ error: error.message, code: error.code }),
          { status: error.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw error;
    }

    const reference = `kolekto-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    // F4: structured payment-lifecycle log (correlation ID = Paystack reference).
    console.log(
      `[initiate ref=${reference}] PAYMENT_INITIATED collectionId=${normalized.collectionId} type=${normalized.collectionType} contributionAmount=${normalized.contributionAmount} totalPayable=${normalized.totalPayable} feeBearer=${normalized.feeBearer} quantity=${normalized.quantity}`
    );

    // Paystack metadata MUST be a simple JSON object. Deeply-nested objects,
    // arrays of objects with many fields, or oversized payloads (> ~5KB) cause
    // Paystack to reject the transaction with a generic "An error occurred" 400.
    //
    // Strategy: keep only primitives at the top level, and serialize any
    // structured data (ticketSelections, formData, contact) into short
    // JSON strings. The verify step parses these back.
    const safeStringify = (value: unknown, maxLen = 1800) => {
      try {
        const s = JSON.stringify(value ?? null);
        return s.length > maxLen ? s.slice(0, maxLen) : s;
      } catch {
        return "null";
      }
    };

    const normalizedMetadata: Record<string, unknown> = {
      collectionId: normalized.collectionId,
      collectionType: normalized.collectionType,
      collectionTitle: String(normalized.collectionTitle || "").slice(0, 200),
      contributionAmount: normalized.contributionAmount,
      platformFee: normalized.platformFee,
      gatewayFee: normalized.gatewayFee,
      totalFees: normalized.totalFees,
      totalPayable: normalized.totalPayable,
      feeBearer: normalized.feeBearer,
      selectedTier: normalized.selectedTier || "",
      selectedTierId: normalized.selectedTierId || "",
      quantity: normalized.quantity,
      codePrefix: normalized.codePrefix,
      isAnonymous: normalized.isAnonymous ? 1 : 0,
      contactName: String(normalized.contact?.name || "").slice(0, 120),
      contactEmail: String(normalized.contact?.email || "").slice(0, 120),
      contactPhone: String(normalized.contact?.phone || "").slice(0, 30),
      // Structured fields serialized to strings so metadata stays flat.
      ticketSelectionsJson: safeStringify(normalized.ticketSelections),
      formDataJson: safeStringify(normalized.formData),
      // Paystack renders custom_fields in the receipt UI — optional.
      custom_fields: [
        {
          display_name: "Collection",
          variable_name: "collection_title",
          value: String(normalized.collectionTitle || "").slice(0, 100),
        },
      ],
    };

    console.log("Initiating Paystack payment:", {
      collectionId: normalized.collectionId,
      collectionType: normalized.collectionType,
      contributionAmount: normalized.contributionAmount,
      feeBearer: normalized.feeBearer,
      totalFees: normalized.totalFees,
      totalPayable: normalized.totalPayable,
      reference,
    });

    const paystackUrl = "https://api.paystack.co/transaction/initialize";
    const paystackBody = {
      email,
      amount: Math.round(normalized.totalPayable * 100), // kobo, always totalPayable
      reference,
      callback_url:
        callback_url ||
        `${Deno.env.get("PUBLIC_CALLBACK_URL") || "https://kolekto.vercel.app"}/payment-callback`,
      metadata: normalizedMetadata,
    };

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          console.log(`Retry attempt ${attempt}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        let paystackResponse: Response;
        try {
          paystackResponse = await fetch(paystackUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${paystackSecretKey}`,
              Accept: "application/json",
            },
            body: JSON.stringify(paystackBody),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        console.log("Paystack response:", paystackResponse.status);

        const contentType = paystackResponse.headers.get("Content-Type") || "";

        if (!contentType.includes("application/json")) {
          const text = await paystackResponse.text();
          console.error("Non-JSON Paystack response:", { status: paystackResponse.status, body: text.slice(0, 300) });

          if (paystackResponse.status === 401 || paystackResponse.status === 403) {
            return new Response(
              JSON.stringify({ error: "Payment gateway authentication failed. Check your Paystack secret key in Supabase secrets." }),
              { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          if (attempt < MAX_RETRIES) { lastError = new Error(`Paystack non-JSON (${paystackResponse.status})`); continue; }

          return new Response(
            JSON.stringify({ error: "Payment gateway returned an unexpected response. Please try again." }),
            { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const paystackResult = await paystackResponse.json();

        if (!paystackResponse.ok) {
          // F4: Paystack rejected the initialization
          console.error(
            `[initiate ref=${reference}] PAYSTACK_INIT_FAILED status=${paystackResponse.status}`,
            {
              body: paystackResult,
              sentAmount: paystackBody.amount,
              sentEmail: paystackBody.email,
              metadataKeys: Object.keys(normalizedMetadata),
              metadataSize: JSON.stringify(normalizedMetadata).length,
            }
          );

          const msg = paystackResult?.message || paystackResult?.error || "Failed to initialize payment";
          if (paystackResponse.status === 401 || paystackResponse.status === 403) {
            return new Response(
              JSON.stringify({
                error: "Payment gateway authentication failed. Check your Paystack secret key in Supabase secrets.",
                code: "paystack_auth_failed",
                paystackStatus: paystackResponse.status,
                paystackBody: paystackResult,
              }),
              { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
          if (attempt < MAX_RETRIES && paystackResponse.status >= 500) { lastError = new Error(msg); continue; }
          // Return Paystack's exact status code so the frontend knows it was a
          // client-side (400) error and can show the real message, not 502.
          return new Response(
            JSON.stringify({
              error: `Paystack: ${msg}`,
              code: "paystack_rejected",
              paystackStatus: paystackResponse.status,
              paystackBody: paystackResult,
            }),
            {
              status: paystackResponse.status >= 400 && paystackResponse.status < 500 ? 400 : 502,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        if (!paystackResult.status) {
          return new Response(
            JSON.stringify({ error: paystackResult?.message || "Failed to initialize payment." }),
            { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // F4: Paystack accepted the initialization
        console.log(
          `[initiate ref=${reference}] PAYSTACK_INIT_OK auth_url_present=${!!paystackResult.data?.authorization_url}`
        );

        return new Response(
          JSON.stringify(paystackResult.data),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

      } catch (apiError: any) {
        const isTransient =
          apiError.name === "AbortError" ||
          String(apiError.message).includes("fetch failed") ||
          String(apiError.message).includes("network");

        if (attempt < MAX_RETRIES && isTransient) { lastError = apiError; continue; }

        return new Response(
          JSON.stringify({ error: `Payment gateway connection error: ${apiError.message}` }),
          { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: "Payment service is temporarily unavailable. Please try again shortly.",
        details: lastError ? String(lastError) : "All retries exhausted",
      }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[initiate] Unhandled exception:", error?.message, error?.stack);
    return new Response(
      JSON.stringify({
        error: `Unexpected error: ${error?.message || "Unknown error"}`,
        code: "unhandled_exception",
        stack: error?.stack ? String(error.stack).split("\n").slice(0, 5).join("\n") : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
