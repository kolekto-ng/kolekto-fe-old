import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, content-length, accept',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// Soft delete only — never removes a collection or its contributions/wallets/
// withdrawals. `collections.status` already has a first-class "deleted" value
// (see src/utils/collectionStatus.ts) with its own label; this just makes
// that status actually mean "gone from every read path" instead of being a
// purely cosmetic tag, and cleans up the in-app notification feed that has no
// FK to collections and would otherwise keep referencing it forever.
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
    const { id, user_id } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Collection ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from('collections')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return new Response(
        JSON.stringify({ error: 'Collection not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (user_id && existing.user_id !== user_id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: you do not own this collection' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (existing.status !== 'deleted') {
      const { error: updateError } = await supabase
        .from('collections')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Clean up the orphaned in-app notification feed. This never touches the
    // underlying contribution/wallet/withdrawal records — only the transient
    // bell-icon copy (notifications has no FK to collections at all).
    const { data: contributions } = await supabase
      .from('contributions')
      .select('id')
      .eq('collection_id', id);

    const contributionIds = (contributions || []).map((c: any) => c.id);
    const orConditions = [`and(entity_type.eq.collection,entity_id.eq.${id})`];
    if (contributionIds.length > 0) {
      orConditions.push(`and(entity_type.eq.contribution,entity_id.in.(${contributionIds.join(',')}))`);
    }
    await supabase.from('notifications').delete().or(orConditions.join(','));

    return new Response(
      JSON.stringify({ data: { archived: true } }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
