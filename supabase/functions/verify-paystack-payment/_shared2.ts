// Re-exports everything index.ts needs from _shared1.ts too, so index.ts
// only has one import source. Split from _shared1.ts purely to keep each
// deployed file a manageable size — no behavior change.
export * from "./_shared1.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePaymentRequest, roundCurrency, getSettlementCutoff, COMPLETED_WITHDRAWAL_STATUSES, buildTierAvailability, getPriceTiers, hasAnyConfiguredPrefix } from "./_shared1.ts";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export function buildContributionUnits(
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
export async function refreshCollectionAndWallets(
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

export function getReceiptFromContribution(contribution: Record<string, unknown>): Record<string, unknown> {
  const infoRows = Array.isArray(contribution.contributor_information)
    ? (contribution.contributor_information as Array<Record<string, unknown>>)
    : [];
  // Receipt data is stored under _receipt key inside contributor_information[0]
  return (infoRows[0]?._receipt as Record<string, unknown>) || {};
}

export function formatContributionSummary(contribution: Record<string, unknown>) {
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

export function buildReceiptData(input: {
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

export function formatParticipantDetails(contribution: Record<string, unknown>) {
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

export function groupTicketSelectionsFromContributions(contributions: Array<Record<string, unknown>>) {
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

export function stripStandardFields(data: Record<string, unknown>) {
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
export const KOLEKTO_LOGO_URL =
  "https://www.kolekto.com.ng/lovable-uploads/1da42b31-fdee-4d4b-a844-19fa3100d598.png";

/** Friendly, human-facing label for each internal collection_type. */
export function collectionTypeLabel(t: string): string {
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
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ReceiptEmailData {
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
export function renderReceiptEmail(d: ReceiptEmailData): string {
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
export async function sendReceiptEmail(params: {
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
