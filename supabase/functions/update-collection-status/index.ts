import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  canPublishCollection,
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

function log(event: string, meta: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, path: "edge", ...meta }));
}

// This function was undocumented (deployed with no corresponding source in
// git) until it was recovered and audited alongside the create/update/delete
// -collection incident. It had the IDENTICAL vulnerability: an unverified
// local JWT decode plus a `body.user_id` fallback, letting any caller who
// knew — or guessed — a collection owner's user id flip that collection to
// any status string, with no restriction on which transitions are valid.
//
// Owner-settable statuses are intentionally NOT restricted further here: a
// prior audit found the Express equivalent (controllers/collection.js
// updateCollectionStatus) also allows any status value including
// "pending_review" -> "active" self-approval for fundraising campaigns, and
// that neither this function's ownership check nor the payment/contribution
// intake path enforces campaign moderation. Fixing THAT is a product
// decision (an admin approval workflow doesn't exist yet) and is out of
// scope for this security pass — see the accompanying engineering report.
// This fix closes the identity-spoofing hole only.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // AUTHENTICATION — identity exclusively from a verified access token.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      log("collection.status.rejected", { requestId, reason: "no_token" });
      return json({ error: "Unauthorized" }, 401);
    }
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      log("collection.status.rejected", { requestId, reason: "token_invalid" });
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = authData.user.id;

    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) return json({ error: "id and status are required" }, 400);

    const { data: existing, error: fetchError } = await supabase
      .from("collections")
      .select("id, user_id, status")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return json({ error: "Collection not found" }, 404);
    }
    if (existing.user_id !== userId) {
      log("collection.status.rejected", { requestId, userId, collectionId: id, reason: "not_owner" });
      return json({ error: "Unauthorized: you do not own this collection" }, 403);
    }

    // ─────────────────────────────────────────────────────────────────────
    // KYC gate — publish. This function previously had NO KYC check at all,
    // which made it a bypass for the creation cap: an unverified user could
    // soft-delete a collection (dropping their counted total to 0), create a
    // fresh one, then flip the deleted row back to "active" and end up
    // holding two live collections. canPublishCollection() closes that and
    // the fundraising self-approval path, while deliberately still allowing
    // pause / resume / close of collections that were already live — a
    // legacy organizer must keep full control of what they already have.
    //
    // Mirrors routes/collection.js's requireVerifiedOrganizer("publish_collection").
    // ─────────────────────────────────────────────────────────────────────
    const accessContext = await loadAccessContext(supabase, userId);
    const mayPublish = canPublishCollection({
      ...accessContext,
      currentStatus: existing.status,
      targetStatus: status,
    });

    if (!mayPublish) {
      log("collection.status.rejected", {
        requestId,
        userId,
        collectionId: id,
        kycStatus: accessContext.status ?? "not_started",
        currentStatus: existing.status,
        targetStatus: status,
        reason: "kyc_required",
      });
      return json(kycRequiredBody("publish_collection"), 403);
    }

    const { data: collection, error } = await supabase
      .from("collections")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      log("collection.status.failed", { requestId, userId, collectionId: id, reason: error.message });
      return json({ error: error.message }, 400);
    }

    log("collection.status.succeeded", { requestId, userId, collectionId: id, newStatus: status });
    return json({ data: collection });
  } catch (err) {
    log("collection.status.failed", { requestId, reason: err instanceof Error ? err.message : String(err) });
    return json({ error: "Internal server error" }, 500);
  }
});
