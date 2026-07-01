
// functions/settle-pending-deposits/index.ts
//
// Daily T+1 settlement sweep, triggered by pg_cron at 4am UTC. Moves
// pending wallet balances into available balance via the
// process_deposit_settlements() Postgres function.
//
// Previously this file hardcoded the Supabase project URL and an anon-role
// JWT directly in source (inconsistent with every other edge function in
// this codebase, which reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from
// the environment). That also forced the test project's pg_cron job to
// carry a long-lived service-role JWT literally in the cron command (only
// way to satisfy this function's verify_jwt=true) — readable by anyone who
// can query cron.job. Fixed on both counts: env-sourced credentials here,
// and verify_jwt=false on deploy (matching prod) so the cron job needs no
// embedded secret at all.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (_req) => {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[settle-pending-deposits] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Missing Supabase env vars", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log("Running settlement process...");
    const { error } = await supabase.rpc("process_deposit_settlements");
    if (error) {
      console.error("RPC error:", error);
      return new Response(`RPC failed: ${error.message}`, {
        status: 500
      });
    }
    console.log("Settlement function completed successfully");
    return new Response("Settlements processed successfully", {
      status: 200
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(`Unexpected error: ${(err as Error).message}`, {
      status: 500
    });
  }
});
