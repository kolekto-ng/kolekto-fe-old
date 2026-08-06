import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "PUT") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { full_name, first_name, last_name, phone_number, date_of_birth, address } = body;

    // Validate required fields
    if (!full_name && !first_name && !last_name) {
      return new Response(JSON.stringify({ error: "At least a name field is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Once KYC is verified, the name is tied to a verified government ID and
    // must not drift from it — silently drop name fields from this request
    // rather than failing it outright, so a simultaneous phone/DOB/address
    // edit still goes through.
    const { data: kyc } = await supabaseAdmin
      .from("kyc_verifications")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    const nameLocked = kyc?.status === "verified";

    // Build update object
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (!nameLocked && full_name !== undefined) updateData.full_name = full_name;
    if (!nameLocked && first_name !== undefined) updateData.first_name = first_name;
    if (!nameLocked && last_name !== undefined) updateData.last_name = last_name;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
    if (address !== undefined) updateData.address = address;

    // Update profiles table
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
      return new Response(JSON.stringify({ error: "Failed to update profile", details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also update user metadata in auth. Use `data.full_name` (the
    // authoritative post-update value from the profiles row) rather than the
    // request body, so a locked name never gets overwritten in auth metadata
    // even indirectly.
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        full_name: data.full_name,
        phone: phone_number,
        dob: date_of_birth,
        address: address,
      },
    });

    return new Response(JSON.stringify({ success: true, data, nameLocked }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
