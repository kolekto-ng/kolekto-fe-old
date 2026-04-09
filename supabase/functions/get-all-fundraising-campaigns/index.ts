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
    // Create admin client with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch all fundraising collections
    const { data: colls, error: collErr } = await supabase
      .from("collections")
      .select("*")
      .eq("collection_type", "fundraising")
      .order("created_at", { ascending: false });

    if (collErr) throw collErr;

    const collections = colls || [];
    const ids = collections.map((c) => c.id);
    const creatorIds = [...new Set(collections.map((c) => c.user_id))];

    let campaignsMap: Record<string, any> = {};
    let profilesMap: Record<string, any> = {};
    let docsMap: Record<string, any[]> = {};
    let imagesMap: Record<string, any[]> = {};
    let donationsMap: Record<string, any[]> = {};
    let contribMap: Record<string, number> = {};

    // Fetch related data in parallel
    if (ids.length > 0) {
      const [campRes, profRes, kycRes, docsRes, imgRes, donRes, contRes] = await Promise.all([
        supabase.from("campaigns").select("*").in("id", ids),
        creatorIds.length > 0 ? supabase.from("profiles").select("id, full_name, email").in("id", creatorIds) : { data: [] },
        creatorIds.length > 0 ? supabase.from("kyc_verifications").select("user_id, status").in("user_id", creatorIds) : { data: [] },
        supabase.from("verification_documents").select("*").in("campaign_id", ids),
        supabase.from("campaign_images").select("*").in("campaign_id", ids),
        supabase.from("campaign_donations").select("*").in("campaign_id", ids),
        supabase.from("contributions").select("id, collection_id, status").in("collection_id", ids),
      ]);

      (campRes.data || []).forEach((c: any) => { campaignsMap[c.id] = c; });
      (profRes.data || []).forEach((p: any) => { profilesMap[p.id] = p; });
      ((kycRes as any).data || []).forEach((k: any) => {
        if (profilesMap[k.user_id]) profilesMap[k.user_id].kyc_status = k.status;
      });
      (docsRes.data || []).forEach((d: any) => {
        if (!docsMap[d.campaign_id]) docsMap[d.campaign_id] = [];
        docsMap[d.campaign_id].push(d);
      });
      (imgRes.data || []).forEach((i: any) => {
        if (!imagesMap[i.campaign_id]) imagesMap[i.campaign_id] = [];
        imagesMap[i.campaign_id].push(i);
      });
      (donRes.data || []).forEach((d: any) => {
        if (!donationsMap[d.campaign_id]) donationsMap[d.campaign_id] = [];
        donationsMap[d.campaign_id].push(d);
      });
      (contRes.data || []).forEach((c: any) => {
        if (c.status === "paid") contribMap[c.collection_id] = (contribMap[c.collection_id] || 0) + 1;
      });
    }

    // Build enriched campaign objects
    const enriched = collections.map((c: any) => {
      const camp = campaignsMap[c.id];
      const profile = profilesMap[c.user_id];
      const story = typeof c.story === "object" && c.story ? c.story : null;
      const socialLinks = Array.isArray(c.social_links) ? c.social_links : [];
      const storyImages = Array.isArray(c.story_images) ? c.story_images : [];

      const donations = donationsMap[c.id] || [];
      const totalRaised = donations
        .filter((d: any) => d.status === "success" || d.status === "paid")
        .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

      // Helper: case-insensitive platform matching
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

      return {
        id: c.id,
        creator_id: c.user_id,
        creator_name: profile?.full_name || profile?.email || "Unknown",
        creator_email: profile?.email || "",
        creator_kyc_status: profile?.kyc_status || "unverified",
        title: c.title,
        summary: c.campaign_summary || camp?.summary || c.description || null,
        main_image_url: storyImages[0] || camp?.main_image_url || c.banner_url || null,
        target_amount: c.target_amount || camp?.target_amount || null,
        min_contribution: c.min_contribution || camp?.min_contribution || null,
        currency: c.currency || "NGN",
        is_open_ended: c.is_open_ended || false,
        deadline: c.deadline || camp?.deadline || null,
        story_for: story?.what || camp?.story_for || null,
        story_why: story?.why || camp?.story_why || null,
        story_achieve: story?.impact || camp?.story_achieve || null,
        story,
        phone_number: c.support_phone_number || camp?.phone_number || null,
        country_code: camp?.country_code || "NG +234",
        country: c.campaign_country || camp?.country || "Nigeria",
        city: camp?.city || null,
        category: c.campaign_category || camp?.category || null,
        keywords: camp?.keywords || (c.campaign_keywords ? c.campaign_keywords.split(",").map((k: string) => k.trim()) : null),
        social_twitter: findSocialUrl(["twitter", "x"]) || camp?.social_twitter || null,
        social_instagram: findSocialUrl(["instagram"]) || camp?.social_instagram || null,
        social_facebook: findSocialUrl(["facebook"]) || camp?.social_facebook || null,
        social_links: socialLinks,
        status: normalizeStatus(c.status || camp?.status),
        created_at: c.created_at,
        updated_at: c.updated_at,
        verified_at: camp?.verified_at || null,
        campaign_summary: c.campaign_summary || null,
        campaign_category: c.campaign_category || null,
        campaign_keywords: c.campaign_keywords || null,
        campaign_country: c.campaign_country || null,
        story_images: storyImages,
        banner_url: c.banner_url || null,
        support_phone_number: c.support_phone_number || null,
        verification_documents: docsMap[c.id] || [],
        campaign_images: imagesMap[c.id] || [],
        campaign_donations: donations,
        total_raised: totalRaised,
        contributions_count: contribMap[c.id] || 0,
      };
    });

    // Calculate statistics
    const stats = {
      total: enriched.length,
      pending_verification: enriched.filter((c: any) => c.status === "pending_verification" || c.status === "pending").length,
      active: enriched.filter((c: any) => c.status === "active").length,
      paused: enriched.filter((c: any) => c.status === "paused").length,
      rejected: enriched.filter((c: any) => c.status === "rejected").length,
      closed: enriched.filter((c: any) => c.status === "closed" || c.status === "completed").length,
    };

    return json({ data: enriched, stats });
  } catch (err: any) {
    console.error("Error fetching campaigns:", err);
    return json({ error: "Failed to fetch campaigns", details: err.message }, 500);
  }
});
