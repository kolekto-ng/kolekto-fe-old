/**
 * scheduled-payment-recovery — guaranteed-eventual-consistency safety net.
 *
 * Triggered every 5 minutes by pg_cron (see database migration). Finds
 * `pending_payment_context` rows older than 5 minutes with no matching
 * `contributions` row (i.e. checkout started but was never recorded — the
 * frontend callback never fired AND the webhook never fired), and calls
 * `verify-paystack-payment` for each one. That function is the single
 * source of truth for "did Paystack actually confirm this payment" — this
 * function never inserts a contribution itself, it only invokes the
 * existing, already-idempotent verify pipeline.
 *
 * Root incident this closes: kolekto-1782836957819-588622 — Paystack
 * confirmed the charge, but verify-paystack-payment was never invoked by
 * anything, so nothing ever turned it into a contribution/receipt/email.
 *
 * Safety properties (all required, none optional):
 *   - Never invoked for a reference that already has a contribution — the
 *     candidate query excludes it, AND this function re-checks immediately
 *     before calling verify (race-safety: another path may have recorded
 *     the contribution between the query and this function actually running).
 *   - Never deletes pending_payment_context rows. A failed/still-pending
 *     attempt just gets reconsidered on the next 5-minute run.
 *   - Every attempt — success, failure, or "Paystack still not done" — is
 *     recorded in payment_recovery_log with invocation_source=
 *     'scheduled_recovery', independent of whether verify-paystack-payment
 *     also logs its own attempt (it doesn't always — e.g. it returns early,
 *     with no log write, when Paystack itself reports a non-success status).
 *   - Bounded to 25 candidates per run so execution time stays predictable.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Candidate {
  reference: string;
  collection_id: string;
  selected_tier_id: string | null;
  created_at: string;
}

Deno.serve(async (_req: Request) => {
  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Diagnostic: which project this run is actually operating against —
  // makes a misrouted cron job (wrong project's service key) immediately
  // visible in logs rather than silently doing nothing or doing the wrong
  // thing.
  const projectRef = (supabaseUrl || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || "unknown";
  console.log(`[scheduled-payment-recovery] RUN_STARTED projectRef=${projectRef}`);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[scheduled-payment-recovery] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(
      JSON.stringify({ error: "Missing Supabase env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: candidates, error: candidatesError } = await supabase
    .rpc("get_orphaned_payment_candidates", { p_limit: 25 });

  if (candidatesError) {
    console.error("[scheduled-payment-recovery] CANDIDATE_QUERY_FAILED", candidatesError.message);
    return new Response(
      JSON.stringify({ error: "Candidate query failed", details: candidatesError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const list = (candidates || []) as Candidate[];
  console.log(`[scheduled-payment-recovery] CANDIDATES_FOUND count=${list.length}`);

  const results: Array<{ reference: string; outcome: string }> = [];

  for (const candidate of list) {
    const attemptStartedAt = Date.now();
    const { reference, collection_id: collectionId, selected_tier_id: selectedTierId } = candidate;

    try {
      // Race-safety re-check: a contribution may have been recorded for
      // this reference (by FE/webhook/admin) in the gap between the
      // candidate query above and this iteration actually running.
      const { data: existing, error: existingError } = await supabase
        .from("contributions")
        .select("id")
        .eq("payment_reference", reference)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.warn(`[scheduled-payment-recovery ref=${reference}] EXISTENCE_CHECK_FAILED (proceeding cautiously):`, existingError.message);
      }

      if (existing) {
        console.log(`[scheduled-payment-recovery ref=${reference}] SKIPPED_ALREADY_RECORDED`);
        results.push({ reference, outcome: "skipped_already_recorded" });
        continue;
      }

      // Attempt number: how many scheduled-recovery attempts have already
      // been logged for this reference, +1 for this one.
      const { count: priorAttempts } = await supabase
        .from("payment_recovery_log")
        .select("id", { count: "exact", head: true })
        .eq("reference", reference)
        .eq("invocation_source", "scheduled_recovery");
      const attemptNumber = (priorAttempts || 0) + 1;

      const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-paystack-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
        body: JSON.stringify({ reference, invocationSource: "scheduled_recovery" }),
      });

      const verifyBody = await verifyResponse.json().catch(() => ({}));
      const durationMs = Date.now() - attemptStartedAt;
      // verify-paystack-payment returns HTTP 200 even when Paystack reports
      // a non-success transaction status (abandoned/failed/pending) — that's
      // not an error, just nothing to record. Its response always includes
      // `contributions: [...]`, populated only when a contribution actually
      // exists (fresh insert or idempotent replay). Checking response.ok
      // alone treated every non-error abandoned-checkout candidate as a
      // false-positive "recovered" — caught via the candidate count not
      // dropping after a "successful" run. Recorded contributions, not
      // absence-of-error, is the only thing that means recovery actually
      // happened.
      const succeeded =
        verifyResponse.ok &&
        !verifyBody?.error &&
        Array.isArray(verifyBody?.contributions) &&
        verifyBody.contributions.length > 0;
      const paystackStatus = verifyBody?.status || null;

      console.log(
        `[scheduled-payment-recovery ref=${reference}] ATTEMPT_COMPLETE ` +
        `collectionId=${collectionId} selectedTierId=${selectedTierId || ""} ` +
        `invocation_source=scheduled_recovery status=${succeeded ? "success" : "failed"} ` +
        `duration_ms=${durationMs} attempt_number=${attemptNumber} ` +
        `error_message=${succeeded ? "" : String(verifyBody?.error || verifyResponse.status)}`
      );

      // A genuine error (verifyBody.error set, or non-2xx) is different
      // from Paystack legitimately reporting the transaction as NOT
      // successful (abandoned/failed/pending — the contributor simply never
      // completed checkout). The latter is not a system failure and isn't
      // retryable into success — Paystack has already given a definitive
      // answer. Conflating the two would mean every abandoned checkout in
      // the product (a completely normal, frequent occurrence) shows up
      // forever as a "Failed Recovery" needing admin attention, burying the
      // real incidents this whole mechanism exists to surface.
      const isDefinitiveNonSuccess = !succeeded && !verifyBody?.error && verifyResponse.ok;

      // Always record the attempt here, regardless of whether
      // verify-paystack-payment itself also wrote a row (it doesn't for
      // every code path — e.g. "Paystack says not successful yet" returns
      // early with no log write there).
      try {
        await supabase.from("payment_recovery_log").insert({
          reference,
          collection_id: collectionId,
          success: succeeded,
          error_code: succeeded ? null : isDefinitiveNonSuccess ? "paystack_transaction_not_successful" : "scheduled_recovery_failed",
          error_message: succeeded
            ? null
            : isDefinitiveNonSuccess
            ? `Paystack status: ${paystackStatus || "unknown"}`
            : String(verifyBody?.error || `HTTP ${verifyResponse.status}`),
          metadata_source: "scheduled_recovery",
          invocation_source: "scheduled_recovery",
          attempt_number: attemptNumber,
          duration_ms: durationMs,
          selected_tier_id: selectedTierId,
          note: succeeded
            ? "scheduled_recovery_succeeded"
            : isDefinitiveNonSuccess
            ? "paystack_confirms_not_successful_auto_resolved"
            : "scheduled_recovery_attempt_failed_will_retry_next_run",
        });
      } catch (logErr) {
        console.warn(`[scheduled-payment-recovery ref=${reference}] RECOVERY_LOG_WRITE_FAILED (non-fatal):`, (logErr as Error)?.message);
      }

      // Paystack has given a definitive "not successful" answer — stop
      // retrying this reference forever and stop it showing up as an alarm.
      // Auto-resolved, not deleted: pending_payment_context is untouched,
      // and this is fully visible/reversible via the admin dashboard's
      // audit trail (payment_admin_actions), same as a human's "Mark
      // Resolved" action.
      if (isDefinitiveNonSuccess) {
        try {
          await supabase.from("payment_admin_actions").insert({
            reference,
            collection_id: collectionId,
            admin_user_id: null,
            admin_email: "system:scheduled_recovery",
            action: "mark_resolved",
            old_status: "orphaned",
            new_status: "resolved",
            reason: `Paystack confirms this transaction was never completed (status: ${paystackStatus || "unknown"}) — not a missed payment, auto-resolved.`,
          });
        } catch (resolveErr) {
          console.warn(`[scheduled-payment-recovery ref=${reference}] AUTO_RESOLVE_WRITE_FAILED (non-fatal, will retry next run):`, (resolveErr as Error)?.message);
        }
      }

      results.push({
        reference,
        outcome: succeeded ? "recovered" : isDefinitiveNonSuccess ? "not_a_payment_auto_resolved" : "failed_will_retry",
      });
    } catch (err) {
      const durationMs = Date.now() - attemptStartedAt;
      console.error(`[scheduled-payment-recovery ref=${reference}] ATTEMPT_THREW duration_ms=${durationMs}`, (err as Error)?.message);
      try {
        await supabase.from("payment_recovery_log").insert({
          reference,
          collection_id: collectionId,
          success: false,
          error_code: "scheduled_recovery_threw",
          error_message: (err as Error)?.message || String(err),
          metadata_source: "scheduled_recovery",
          invocation_source: "scheduled_recovery",
          duration_ms: durationMs,
          selected_tier_id: selectedTierId,
          note: "scheduled_recovery_threw_will_retry_next_run",
        });
      } catch { /* best-effort logging only */ }
      results.push({ reference, outcome: "error_will_retry" });
    }
  }

  const totalDurationMs = Date.now() - startedAt;
  console.log(`[scheduled-payment-recovery] RUN_COMPLETE candidates=${list.length} duration_ms=${totalDurationMs}`);

  return new Response(
    JSON.stringify({ candidates: list.length, results, durationMs: totalDurationMs }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
