import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Accept id from POST body or GET query param
    let id: string | null = null;
    const url = new URL(req.url);
    id = url.searchParams.get("id");

    if (!id && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        id = body?.id || null;
      } catch { /* no body */ }
    }

    if (!id) {
      return json({ error: "Missing required parameter: id" }, 400);
    }

    // Admin client with service role — bypasses RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: collection, error: collErr } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (collErr) throw collErr;
    if (!collection) return json({ error: "Campaign not found" }, 404);

    const [campRes, profRes, kycRes, docsRes, imgRes, donRes, contRes] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("id, full_name, email").eq("id", collection.user_id).single(),
      supabase.from("kyc_verifications").select("status").eq("user_id", collection.user_id).maybeSingle(),
      supabase.from("verification_documents").select("*").eq("campaign_id", id),
      supabase.from("campaign_images").select("*").eq("campaign_id", id).order("display_order"),
      supabase.from("campaign_donations").select("*").eq("campaign_id", id).order("created_at", { ascending: false }),
      supabase.from("contributions").select("id, status").eq("collection_id", id),
    ]);

    const camp = campRes.data;
    const profile = profRes.data
      ? { ...profRes.data, kyc_status: kycRes.data?.status || "unverified" }
      : null;
    const docs = docsRes.data || [];
    const images = imgRes.data || [];
    const donations = donRes.data || [];
    const paidCount = (contRes.data || []).filter((c: any) => c.status === "paid").length;

    const story = typeof collection.story === "object" && collection.story ? collection.story : null;
    const socialLinks = Array.isArray(collection.social_links) ? collection.social_links : [];
    const storyImages = Array.isArray(collection.story_images) ? collection.story_images : [];

    const findSocialUrl = (platforms: string[]): string | null => {
      for (const link of socialLinks) {
        const p = (link?.platform || "").toLowerCase().replace(/\s+/g, "");
        for (const target of platforms) {
          if (p.includes(target)) return link.url || null;
        }
      }
      return null;
    };

    const normalizeStatus = (status: string | null) => {
      if (!status) return "draft";
      const s = (status || "").toLowerCase().replace(/\s+/g, "_");
      if (s === "pending_review") return "pending_verification";
      return s;
    };

    const totalRaised = donations
      .filter((d: any) => d.status === "success" || d.status === "paid")
      .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

    const enriched = {
      id: collection.id,
      creator_id: collection.user_id,
      creator_name: profile?.full_name || profile?.email || "Unknown",
      creator_email: profile?.email || "",
      creator_kyc_status: profile?.kyc_status || "unverified",
      title: collection.title,
      summary: collection.campaign_summary || camp?.summary || collection.description || null,
      main_image_url: storyImages[0] || camp?.main_image_url || collection.banner_url || null,
      target_amount: collection.target_amount || camp?.target_amount || null,
      min_contribution: collection.min_contribution || camp?.min_contribution || null,
      currency: collection.currency || "NGN",
      is_open_ended: collection.is_open_ended || false,
      deadline: collection.deadline || camp?.deadline || null,
      story_for: story?.what || camp?.story_for || null,
      story_why: story?.why || camp?.story_why || null,
      story_achieve: story?.impact || camp?.story_achieve || null,
      story,
      phone_number: collection.support_phone_number || camp?.phone_number || null,
      country_code: camp?.country_code || "NG +234",
      country: collection.campaign_country || camp?.country || "Nigeria",
      city: camp?.city || null,
      category: collection.campaign_category || camp?.category || null,
      keywords: camp?.keywords || (collection.campaign_keywords
        ? collection.campaign_keywords.split(",").map((k: string) => k.trim())
        : null),
      social_twitter: findSocialUrl(["twitter", "x"]) || camp?.social_twitter || null,
      social_instagram: findSocialUrl(["instagram"]) || camp?.social_instagram || null,
      social_facebook: findSocialUrl(["facebook"]) || camp?.social_facebook || null,
      social_links: socialLinks,
      status: normalizeStatus(collection.status || camp?.status),
      created_at: collection.created_at,
      updated_at: collection.updated_at,
      verified_at: camp?.verified_at || null,
      campaign_summary: collection.campaign_summary || null,
      campaign_category: collection.campaign_category || null,
      campaign_keywords: collection.campaign_keywords || null,
      campaign_country: collection.campaign_country || null,
      story_images: storyImages,
      banner_url: collection.banner_url || null,
      support_phone_number: collection.support_phone_number || null,
      verification_documents: docs,
      campaign_images: images,
      campaign_donations: donations,
      total_raised: totalRaised,
      contributions_count: paidCount,
    };

    return json({ data: enriched });
  } catch (err: any) {
    console.error("Error fetching campaign by id:", err);
    return json({ error: "Failed to fetch campaign", details: err.message }, 500);
  }
});
