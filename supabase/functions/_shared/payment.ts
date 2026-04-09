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

export interface NormalizedPaymentRequest {
  collectionId: string;
  collectionType: string;
  collectionTitle: string;
  feeBearer: FeeBearer;
  contributionAmount: number;
  platformFee: number;
  gatewayFee: number;
  totalFees: number;
  totalPayable: number;
  quantity: number;
  selectedTier: string | null;
  selectedTierId: string | null;
  ticketSelections: TicketSelection[];
  formData: Record<string, unknown>;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  isAnonymous: boolean;
  codePrefix: string;
  providedAmount: number;
}

export function roundCurrency(value: number): number {
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

export function getCollectionType(collection: Record<string, unknown>) {
  return String(
    collection.collection_type || collection.type || "fixed"
  ).trim();
}

export function getPriceTiers(collection: Record<string, unknown>) {
  const tiers = collection.price_tiers || collection.pricing_tiers;
  return Array.isArray(tiers) ? tiers : [];
}

function getTierMatchKey(tier: Record<string, unknown>, index: number) {
  return String(tier.id || tier.name || `tier-${index}`);
}

function getTierLabel(tier: Record<string, unknown>, index: number) {
  return String(tier.name || `Tier ${index + 1}`);
}

function getInfoRows(row: Record<string, unknown>) {
  if (Array.isArray(row.contributor_information)) {
    return row.contributor_information.filter(
      (entry) => entry && typeof entry === "object"
    ) as Array<Record<string, unknown>>;
  }
  if (row.contact_info && typeof row.contact_info === "object") {
    return [row.contact_info as Record<string, unknown>];
  }
  return [];
}

export function calculateFees(
  amount: number,
  collectionType: string,
  feeBearer: FeeBearer
) {
  const sanitizedAmount = roundCurrency(amount);
  const platformRate = collectionType === "fundraising" ? 0.01 : 0.005;
  const platformFee = roundCurrency(Math.min(sanitizedAmount * platformRate, 2000));
  const gatewayFee = roundCurrency(Math.min(sanitizedAmount * 0.015, 2000));
  const totalFees = roundCurrency(platformFee + gatewayFee);
  const totalPayable =
    feeBearer === "contributor"
      ? roundCurrency(sanitizedAmount + totalFees)
      : sanitizedAmount;

  return {
    platformFee,
    gatewayFee,
    totalFees,
    totalPayable,
  };
}

export function allocateAmounts(total: number, weights: number[]) {
  const normalizedWeights = weights.map((weight) =>
    roundCurrency(Math.max(0, weight))
  );
  const sum = normalizedWeights.reduce((acc, weight) => acc + weight, 0);

  if (normalizedWeights.length === 0) return [];
  if (roundCurrency(total) === 0 || sum === 0) {
    return normalizedWeights.map(() => 0);
  }

  let remaining = roundCurrency(total);

  return normalizedWeights.map((weight, index) => {
    if (index === normalizedWeights.length - 1) {
      return remaining;
    }

    const share = roundCurrency((total * weight) / sum);
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

      if (tierId) {
        soldByTier.set(tierId, (soldByTier.get(tierId) || 0) + quantity);
      } else if (tierName) {
        soldByTier.set(tierName, (soldByTier.get(tierName) || 0) + quantity);
      }
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
      "This collection is no longer available.",
      404,
      "collection_deleted",
      { collectionId, status }
    );
  }

  if (status === "paused") {
    throw new PaymentValidationError(
      "This collection is currently paused and cannot accept payments.",
      400,
      "collection_paused",
      { collectionId, status }
    );
  }

  if (status === "closed" || status === "completed") {
    throw new PaymentValidationError(
      "This collection is no longer accepting payments.",
      400,
      "collection_closed",
      { collectionId, status }
    );
  }

  if (status === "pending_review" || status === "pending_verification") {
    throw new PaymentValidationError(
      "This collection is not available for payment yet.",
      400,
      "collection_unavailable",
      { collectionId, status }
    );
  }
}

export function normalizePaymentRequest(input: {
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
    throw new PaymentValidationError(
      "A valid collection ID is required.",
      400,
      "missing_collection_id"
    );
  }

  ensureCollectionIsPayable(collection, collectionId);

  const collectionType = getCollectionType(collection);

  // Fundraising: fees are ALWAYS contributor-borne regardless of fee_bearer setting.
  // For all other types: honour the collection's fee_bearer field.
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
  const maxContributions = asPositiveInt(
    collection.max_contributions || collection.max_participants
  );
  const paidCount = paidRows.length;
  const remainingContributionCapacity =
    maxContributions > 0 ? Math.max(0, maxContributions - paidCount) : null;

  let contributionAmount = 0;
  let quantity = 1;
  let selectedTier: string | null = null;
  let selectedTierId: string | null = null;
  let ticketSelections: TicketSelection[] = [];

  if (collectionType === "fundraising" || collectionType === "open_pool") {
    const requestedAmount = roundCurrency(
      asNumber(metadata.contributionAmount || metadata.amount)
    );
    const minimumAmount = roundCurrency(
      asNumber(collection.min_contribution || collection.amount)
    );

    if (!requestedAmount || requestedAmount <= 0) {
      throw new PaymentValidationError(
        collectionType === "fundraising"
          ? "Enter a valid donation amount."
          : "Enter a valid contribution amount.",
        400,
        "invalid_amount",
        { collectionId, collectionType, requestedAmount }
      );
    }

    if (minimumAmount > 0 && requestedAmount < minimumAmount) {
      throw new PaymentValidationError(
        `${
          collectionType === "fundraising" ? "Minimum donation" : "Minimum contribution"
        } is NGN ${minimumAmount.toLocaleString("en-NG")}.`,
        400,
        "amount_below_minimum",
        { collectionId, requestedAmount, minimumAmount }
      );
    }

    if (remainingContributionCapacity !== null && remainingContributionCapacity < 1) {
      throw new PaymentValidationError(
        "This collection has reached its contribution limit.",
        400,
        "collection_full",
        { collectionId, paidCount, maxContributions }
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
        rawSelections.length === 0 &&
        (metadata.selectedTier || metadata.selectedTierId)
          ? [
              {
                tierId: metadata.selectedTierId,
                tierName: metadata.selectedTier,
                quantity: legacyQuantity,
              },
            ]
          : rawSelections;

      if (legacySelection.length === 0) {
        throw new PaymentValidationError(
          "Select at least one ticket tier before checkout.",
          400,
          "missing_ticket_selection",
          { collectionId }
        );
      }

      ticketSelections = legacySelection
        .map((selection) => {
          const tier = matchTier(allTiers, selection);
          const requestedQuantity = asPositiveInt(selection.quantity);

          if (!tier) {
            throw new PaymentValidationError(
              "One of the selected ticket tiers is no longer available.",
              404,
              "ticket_tier_not_found",
              { collectionId, selection }
            );
          }

          if (requestedQuantity < 1) {
            return null;
          }

          if (
            tier.remainingCapacity !== null &&
            requestedQuantity > Number(tier.remainingCapacity)
          ) {
            throw new PaymentValidationError(
              `${tier.tierName} does not have enough tickets left.`,
              400,
              "insufficient_ticket_capacity",
              {
                collectionId,
                tierId: tier.tierId,
                tierName: tier.tierName,
                requestedQuantity,
                remainingCapacity: tier.remainingCapacity,
              }
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
          } satisfies TicketSelection;
        })
        .filter(Boolean) as TicketSelection[];

      quantity = ticketSelections.reduce(
        (total, selection) => total + selection.quantity,
        0
      );

      if (quantity < 1) {
        throw new PaymentValidationError(
          "Select at least one ticket before checkout.",
          400,
          "missing_ticket_quantity",
          { collectionId }
        );
      }

      contributionAmount = roundCurrency(
        ticketSelections.reduce((sum, selection) => sum + selection.subtotal, 0)
      );
    } else {
      quantity = asPositiveInt(metadata.quantity) || 1;

      if (remainingContributionCapacity !== null && quantity > remainingContributionCapacity) {
        throw new PaymentValidationError(
          "Not enough tickets remain for this order.",
          400,
          "insufficient_ticket_capacity",
          {
            collectionId,
            quantity,
            remainingContributionCapacity,
          }
        );
      }

      if (String(collection.allow_multiple_quantity) === "false" && quantity > 1) {
        throw new PaymentValidationError(
          "This ticket only allows one purchase per checkout.",
          400,
          "multiple_quantity_disabled",
          { collectionId, quantity }
        );
      }

      const unitPrice = roundCurrency(asNumber(collection.amount));
      contributionAmount = roundCurrency(unitPrice * quantity);
      ticketSelections = [
        {
          tierId: null,
          tierName: String(collection.title || "Ticket"),
          pricePerUnit: unitPrice,
          quantity,
          subtotal: contributionAmount,
          prefix: collection.code_prefix ? String(collection.code_prefix) : null,
          remainingCapacity: remainingContributionCapacity,
        },
      ];
    }
  } else if (collectionType === "tiered") {
    const tier = matchTier(allTiers, {
      tierId: metadata.selectedTierId,
      tierName: metadata.selectedTier,
      name: metadata.selectedTier,
    });

    if (!tier) {
      throw new PaymentValidationError(
        "Select a valid pricing tier before checkout.",
        400,
        "invalid_selected_tier",
        { collectionId, selectedTier: metadata.selectedTier }
      );
    }

    if (tier.remainingCapacity !== null && tier.remainingCapacity < 1) {
      throw new PaymentValidationError(
        `${tier.tierName} is sold out.`,
        400,
        "tier_sold_out",
        { collectionId, tierId: tier.tierId, tierName: tier.tierName }
      );
    }

    contributionAmount = roundCurrency(asNumber(tier.price));
    selectedTier = tier.tierName;
    selectedTierId = tier.tierId;
  } else {
    if (remainingContributionCapacity !== null && remainingContributionCapacity < 1) {
      throw new PaymentValidationError(
        "This collection has reached its contribution limit.",
        400,
        "collection_full",
        { collectionId, paidCount, maxContributions }
      );
    }

    contributionAmount = roundCurrency(asNumber(collection.amount));
  }

  if (!contributionAmount || contributionAmount <= 0) {
    throw new PaymentValidationError(
      "Unable to determine a valid payment amount for this checkout.",
      400,
      "invalid_contribution_amount",
      { collectionId, collectionType, contributionAmount }
    );
  }

  const feeBreakdown = calculateFees(contributionAmount, collectionType, feeBearer);

  return {
    collectionId,
    collectionType,
    collectionTitle: String(collection.title || "Collection"),
    feeBearer,
    contributionAmount,
    platformFee: feeBreakdown.platformFee,
    gatewayFee: feeBreakdown.gatewayFee,
    totalFees: feeBreakdown.totalFees,
    totalPayable: feeBreakdown.totalPayable,
    quantity,
    selectedTier,
    selectedTierId,
    ticketSelections,
    formData,
    contact,
    isAnonymous: Boolean(metadata.isAnonymous),
    codePrefix: String(
      metadata.codePrefix ||
        collection.code_prefix ||
        (collectionType === "ticket" ? "TKT" : "KLK")
    ),
    providedAmount: roundCurrency(
      asNumber(metadata.totalPayable || metadata.amount || 0)
    ),
  } satisfies NormalizedPaymentRequest;
}
