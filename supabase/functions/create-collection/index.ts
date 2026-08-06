import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  canCreateCollection,
  kycRequiredBody,
  loadAccessContext,
} from "../_shared/featureAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Structured, single-line JSON logs — mirrors kolekto-be-old/utils/logger.js's
// shape so a request can be traced the same way regardless of which write
// path (Express or this edge function) handled it. NEVER logs title,
// description, story, or any other collection content — only identifiers and
// booleans/enums needed to explain an authorization decision.
function log(event: string, meta: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, path: "edge", ...meta }));
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ─────────────────────────────────────────────────────────────────────
    // AUTHENTICATION — the caller's identity comes EXCLUSIVELY from a
    // cryptographically verified Supabase access token. There is no
    // `body.user_id` fallback: a request body is client-controlled and
    // proves nothing about who sent it. `auth.getUser(jwt)` calls Supabase
    // Auth (GoTrue) to verify the token's signature and expiry — this is
    // NOT the same as decoding the JWT payload locally, which only reads
    // claims without checking whether they were ever legitimately signed.
    // ─────────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      log("collection.create.rejected", { requestId, reason: "no_token" });
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      log("collection.create.rejected", {
        requestId,
        reason: authError?.message?.includes("expired") ? "token_expired" : "token_invalid",
      });
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = authData.user.id;

    // ─────────────────────────────────────────────────────────────────────
    // KYC gate — unverified users may create only one collection.
    //
    // The rule itself now lives in ../_shared/featureAccess.ts, imported by
    // every edge function that needs it, instead of being re-inlined here.
    // That module documents the sync contract with the Node implementation
    // (kolekto-be-old/services/featureAccessService.js) — the two runtimes
    // cannot share code, but there is exactly one copy per runtime.
    // ─────────────────────────────────────────────────────────────────────
    const accessContext = await loadAccessContext(supabase, userId);
    const allowed = canCreateCollection(accessContext);

    log("collection.create.authorization", {
      requestId,
      userId,
      kycStatus: accessContext.status ?? "not_started",
      collectionCount: accessContext.collectionCount,
      // Deliberately no `group` field: classifying B vs C needs payout-account
      // data this path doesn't load, so emitting it here would under-report
      // legacy users in the logs. GET /settings/kyc/access-status and
      // scripts/kycLegacyUserAudit.js are the authorities on grouping.
      decision: allowed ? "allowed" : "blocked",
    });

    if (!allowed) {
      log("collection.create.rejected", { requestId, userId, reason: "kyc_required" });
      return json(kycRequiredBody("create_collection"), 403);
    }

    const {
      collection_type = "fixed",
      title,
      description,
      amount,
      deadline,
      contributions_fields,
      price_tiers,
      max_contributions,
      fee_bearer = "contributor",
      code_prefix,
      unique_id_enabled = false,
      target_amount,
      min_contribution = 0,
      event_date,
      ticket_mode,
      allow_multiple_quantity = true,
      is_open_ended = false,
      auto_close = false,
      story,
      campaign_category,
      campaign_keywords,
      campaign_country = "Nigeria",
      social_links,
      support_phone,
      campaign_summary,
      story_images = [],
      verification_documents = [],
      banner_url = null,
    } = body;

    if (!title?.trim()) {
      return json({ error: "Title is required" }, 400);
    }

    const status =
      collection_type === "fundraising" ? "pending_review" : "active";

    // legacyType drives the DB trigger validate_collection_amount():
    //   'flat'   → requires amount >= 100
    //   'tiered' → requires amount === 0
    //   anything else → no restriction
    // open_pool and fundraising can have amount < 100 (or 0), so use their
    // own collection_type value to bypass the flat-amount constraint.
    const legacyType =
      collection_type === "tiered" ||
      (collection_type === "ticket" && ticket_mode === "tiered")
        ? "tiered"
        : collection_type === "open_pool" || collection_type === "fundraising"
        ? collection_type
        : "flat";

    const { data: collection, error: insertError } = await supabase
      .from("collections")
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description?.trim() || null,
        amount: amount ?? 0,
        deadline: deadline || null,
        contributions_fields: contributions_fields || [],
        price_tiers: price_tiers || [],
        max_contributions: max_contributions || null,
        fee_bearer,
        code_prefix: code_prefix || null,
        unique_id_enabled,
        target_amount: target_amount || null,
        min_contribution: min_contribution || 0,
        collection_type,
        type: legacyType,
        event_date: event_date || null,
        ticket_mode: ticket_mode || null,
        allow_multiple_quantity,
        is_open_ended,
        auto_close,
        story: story || null,
        campaign_category: campaign_category || null,
        campaign_keywords: campaign_keywords || null,
        campaign_country,
        social_links: social_links || [],
        support_phone_number: support_phone || null,
        campaign_summary: campaign_summary || null,
        story_images: story_images,
        banner_url: banner_url || null,
        status,
        currency: "NGN",
        currency_symbol: "₦",
        slug: generateSlug(title),
      })
      .select()
      .single();

    if (insertError) {
      log("collection.create.failed", { requestId, userId, reason: insertError.message });
      return json({ error: insertError.message }, 400);
    }

    // Create wallet for the collection (upsert to handle duplicates)
    const { error: walletError } = await supabase.from("wallets").upsert(
      {
        collection_id: collection.id,
        available_balance: 0,
        ledger_balance: 0,
        gross_payment: 0,
        net_payment: 0,
        withdrawn: 0,
        pending_balance: 0,
        currency: "NGN",
        currency_symbol: "₦",
      },
      { onConflict: "collection_id", ignoreDuplicates: true }
    );

    if (walletError) {
      console.warn("Wallet creation warning:", walletError.message);
    }

    if (collection_type === "fundraising") {
      // Helper: case-insensitive platform matching
      const findSocial = (platforms: string[]) => {
        const sl = Array.isArray(social_links) ? social_links : [];
        for (const link of sl) {
          const p = (link?.platform || "").toLowerCase().replace(/\s+/g, "");
          for (const target of platforms) {
            if (p.includes(target)) return link.url || null;
          }
        }
        return null;
      };

      const { data: campaign, error: campError } = await supabase
        .from("campaigns")
        .insert({
          id: collection.id,
          creator_id: userId,
          title: title.trim(),
          summary: campaign_summary || null,
          main_image_url: banner_url || story_images[0] || null,
          target_amount: target_amount || null,
          min_contribution: min_contribution || 0,
          currency: "NGN",
          is_open_ended: is_open_ended || false,
          deadline: deadline || null,
          story_for: story?.what || null,
          story_why: story?.why || null,
          story_achieve: story?.impact || null,
          phone_number: support_phone || null,
          country_code: "NG +234",
          country: campaign_country || "Nigeria",
          category: campaign_category || null,
          keywords: campaign_keywords
            ? (typeof campaign_keywords === "string"
                ? campaign_keywords.split(",").map((k: string) => k.trim())
                : campaign_keywords)
            : null,
          social_twitter: findSocial(["twitter", "x"]),
          social_instagram: findSocial(["instagram"]),
          social_facebook: findSocial(["facebook"]),
          status: "pending_verification",
        })
        .select()
        .single();

      // Use collection.id as the campaign reference for docs/images
      // even if the campaign insert fails
      const campaignId = campaign?.id || collection.id;

      if (campError) {
        console.error("Campaign insert error:", campError.message, campError.details);
      }

      // Always save verification documents
      // Accepts both [{url, name}] objects (new format) and plain strings (legacy)
      if (verification_documents.length > 0) {
        const docs = verification_documents.map((doc: any, idx: number) => {
          const docUrl = typeof doc === "string" ? doc : doc.url;
          const docName = typeof doc === "string"
            ? `Verification Document ${idx + 1}`
            : (doc.name || `Verification Document ${idx + 1}`);
          return {
            campaign_id: campaignId,
            document_url: docUrl,
            document_name: docName,
          };
        });
        const { error: docErr } = await supabase
          .from("verification_documents")
          .insert(docs);
        if (docErr) console.error("Verification docs insert error:", docErr.message);
      }

      // Always save story images
      if (story_images.length > 0) {
        const images = story_images.map((url: string, idx: number) => ({
          campaign_id: campaignId,
          image_url: url,
          caption: null,
          display_order: idx,
        }));
        const { error: imgErr } = await supabase
          .from("campaign_images")
          .insert(images);
        if (imgErr) console.error("Campaign images insert error:", imgErr.message);
      }
    }

    log("collection.create.succeeded", { requestId, userId, collectionId: collection.id });
    return json({ data: collection });
  } catch (err) {
    log("collection.create.failed", { requestId, reason: err instanceof Error ? err.message : String(err) });
    return json({ error: "Internal server error" }, 500);
  }
});
