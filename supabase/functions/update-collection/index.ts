import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, content-length, accept',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// price_tiers carries two kinds of fields: ones the host edits (name, price,
// quantity, description, prefix) and ones only the payment verifier computes
// (sold_quantity, remaining_quantity — written by refreshCollectionAndWallets
// in verify-paystack-payment/index.ts). The edit dialog never sends the
// computed fields, so writing price_tiers verbatim resets every tier's
// sold/remaining count to absent on every save. Re-attach them from the
// currently-persisted tier (matched by id, then name) so editing a
// collection never wipes its sold-ticket counters.
function mergeTierComputedFields(incomingTiers: any, existingTiers: any) {
  if (!Array.isArray(incomingTiers)) return incomingTiers;
  const existingByKey = new Map<string, any>();
  for (const t of Array.isArray(existingTiers) ? existingTiers : []) {
    const key = String(t?.id ?? t?.name ?? '');
    if (key) existingByKey.set(key, t);
  }
  return incomingTiers.map((tier: any) => {
    const key = String(tier?.id ?? tier?.name ?? '');
    const match = existingByKey.get(key);
    return {
      ...tier,
      sold_quantity: match?.sold_quantity ?? tier?.sold_quantity ?? 0,
      remaining_quantity: match?.remaining_quantity ?? tier?.remaining_quantity ?? null,
    };
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();

    const {
      id,
      user_id,
      collectionType,
      collection_type,
      title,
      description,
      deadline,
      max_contributions,
      contributions_fields,
      price_tiers,
      fee_bearer,
      banner_url,
      campaign_summary,
      story,
      story_images,
      event_date,
    } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Collection ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const colType = collectionType || collection_type;
    const isFundraising = colType === 'fundraising';
    const isTicket = colType === 'ticket';

    // Fetch the existing row once — needed for the ownership check below and
    // to preserve sold_quantity/remaining_quantity on price_tiers further down.
    const { data: existing } = await supabase
      .from('collections')
      .select('user_id, price_tiers')
      .eq('id', id)
      .single();

    // Verify ownership when user_id is provided
    if (user_id && existing && existing.user_id !== user_id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: you do not own this collection' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (fee_bearer !== undefined) updateData.fee_bearer = fee_bearer;

    const mergedPriceTiers = price_tiers !== undefined
      ? mergeTierComputedFields(price_tiers, existing?.price_tiers)
      : undefined;

    // Non-fundraising fields
    if (!isFundraising) {
      if (description !== undefined) updateData.description = description;
      if (max_contributions !== undefined) updateData.max_contributions = max_contributions;
      if (contributions_fields !== undefined) updateData.contributions_fields = contributions_fields;
      if (mergedPriceTiers !== undefined) updateData.price_tiers = mergedPriceTiers;
    }

    // Banner for fundraising + ticket
    if (isFundraising || isTicket) {
      if (banner_url !== undefined) updateData.banner_url = banner_url;
    }

    // Fundraising-specific
    if (isFundraising) {
      if (campaign_summary !== undefined) updateData.campaign_summary = campaign_summary;
      if (story !== undefined) updateData.story = story;
      if (story_images !== undefined) updateData.story_images = story_images;
    }

    // Ticket-specific
    if (isTicket) {
      if (event_date !== undefined) updateData.event_date = event_date;
      if (mergedPriceTiers !== undefined) updateData.price_tiers = mergedPriceTiers;
      if (contributions_fields !== undefined) updateData.contributions_fields = contributions_fields;
    }

    const { data, error } = await supabase
      .from('collections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
