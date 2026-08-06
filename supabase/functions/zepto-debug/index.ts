import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// Decommissioned diagnostic/preview function (ZeptoMail incident + receipt redesign, 2026-06-27).
// Safe to delete from the dashboard. Intentionally inert.
serve(() =>
  new Response(
    JSON.stringify({ status: "gone", note: "zepto-debug decommissioned; safe to delete" }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
