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
 *   - Bounded to MAX_SCHEDULED_ATTEMPTS retries per reference. Incident
 *     kolekto-1783668829043-357419 (an email typed into the phone field)
 *     hit a DB error on every attempt and was retried 15,190 times over 26
 *     days before the underlying bug was fixed — there was no cap. A
 *     reference that crosses the cap without succeeding is "dead-lettered":
 *     an `auto_dead_letter` row is written to payment_admin_actions (kept
 *     distinct from `mark_resolved`, which means "Paystack confirms this
 *     was never a real payment" — dead-letter means "we gave up, a human
 *     should look"), which get_orphaned_payment_candidates() excludes going
 *     forward. Nothing is deleted and admins can still manually replay it
 *     any time via the Payment Monitoring dashboard's retry action, which
 *     calls verify-paystack-payment directly and never goes through the
 *     candidate query.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Candidate {
  reference: string;
  collection_id: string;
  selected_tier_id: string | null;
  created_at: string;
}

const MAX_SCHEDULED_ATTEMPTS = 20;

// ── Cron-only guard (architectural hardening audit) ─────────────────────────
// verify_jwt is disabled on this function (like every other function in this
// project), and the public anon key trivially satisfies any JWT check anyway
// — so today ANY caller can invoke this repeatedly, forcing repeated
// external Paystack API calls (one per candidate, up to 25/run) and
// payment_recovery_log writes. This is a soft, non-breaking gate: if
// CRON_SECRET is configured in the function's environment, the caller must
// send it via `X-Cron-Secret`; if it is NOT configured (true today), this
// check is skipped entirely so the existing pg_cron job keeps working
// unchanged. Operator follow-up: set CRON_SECRET as a function secret AND
// add `'X-Cron-Secret: <value>'` to the pg_cron job's http call to actually
// close this gap.
//
// NOTE (2026-08-07 resilience audit): this guard existed ONLY in git and the
// attempt cap above existed ONLY in production — neither version was a
// superset of the other. This file is the reconciliation of both. Do not
// deploy either side in isolation again; run `npm run verify:edge-parity`.
function isAuthorizedCronCaller(req: Request): boolean {
  const configuredSecret = Deno.env.get("CRON_SECRET");
  if (!configuredSecret) return true; // not yet configured — do not break the existing job
  return req.headers.get("X-Cron-Secret") === configuredSecret;
}

Deno.serve(async (req: Request) => {
  if (!isAuthorizedCronCaller(req)) {
    console.warn("[scheduled-payment-recovery] rejected: missing/incorrect X-Cron-Secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

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

      // PHASE 3.1: never dead-letter money Paystack actually captured.
      // The attempt cap exists to stop unbounded retries of abandoned
      // checkouts (one reference was retried 15,190 times over 26 days).
      // Applying it to a CAPTURED payment is how real money stops being
      // retried forever — all six payments in the 2026-08-06 incident were
      // dead-lettered. Captured rows stay eligible indefinitely; the
      // exponential backoff in get_orphaned_payment_candidates keeps the
      // retry rate sane without ever giving up.
      const { data: ledgerRow } = await supabase
        .from("pending_payment_context")
        .select("captured_at, state")
        .eq("reference", reference)
        .maybeSingle();
      const isCaptured = Boolean(ledgerRow?.captured_at);

      if (isCaptured && attemptNumber > MAX_SCHEDULED_ATTEMPTS) {
        console.warn(
          `[scheduled-payment-recovery ref=${reference}] ATTEMPT_CAP_EXCEEDED_BUT_CAPTURED ` +
          `attempts=${attemptNumber} — NOT dead-lettering; captured money stays recoverable ` +
          `(state=${ledgerRow?.state})`
        );
      }

      if (!isCaptured && attemptNumber > MAX_SCHEDULED_ATTEMPTS) {
        console.warn(
          `[scheduled-payment-recovery ref=${reference}] ATTEMPT_CAP_EXCEEDED priorAttempts=${priorAttempts} cap=${MAX_SCHEDULED_ATTEMPTS} — dead-lettering`
        );
        try {
          await supabase.from("payment_recovery_log").insert({
            reference,
            collection_id: collectionId,
            success: false,
            error_code: "attempt_cap_exceeded",
            error_message: `Exceeded ${MAX_SCHEDULED_ATTEMPTS} scheduled recovery attempts without success.`,
            metadata_source: "scheduled_recovery",
            invocation_source: "scheduled_recovery",
            attempt_number: attemptNumber,
            duration_ms: Date.now() - attemptStartedAt,
            selected_tier_id: selectedTierId,
            note: "auto_dead_lettered",
          });
        } catch (logErr) {
          console.warn(`[scheduled-payment-recovery ref=${reference}] RECOVERY_LOG_WRITE_FAILED (non-fatal):`, (logErr as Error)?.message);
        }
        try {
          await supabase.from("payment_admin_actions").insert({
            reference,
            collection_id: collectionId,
            admin_user_id: null,
            admin_email: "system:scheduled_recovery",
            action: "auto_dead_letter",
            old_status: "failed",
            new_status: "dead_letter",
            reason: `Exceeded ${MAX_SCHEDULED_ATTEMPTS} scheduled recovery attempts (${priorAttempts} prior failures) without success — stopped automatic retries. Needs manual review; use the Payment Monitoring dashboard's retry action to replay once the underlying issue is understood.`,
          });
        } catch (deadLetterErr) {
          console.warn(`[scheduled-payment-recovery ref=${reference}] DEAD_LETTER_WRITE_FAILED (non-fatal, will retry cap check next run):`, (deadLetterErr as Error)?.message);
        }
        results.push({ reference, outcome: "dead_lettered" });
        continue;
      }

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
