/**
 * verify-paystack-payment — entrypoint. Business logic lives in
 * ./_shared1.ts and ./_shared2.ts (split out solely to keep each deployed
 * file a manageable size — no behavior change from the previous
 * single-file version).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  PaymentValidationError,
  roundCurrency,
  asNumber,
  hasAnyConfiguredPrefix,
  allocateAmounts,
  normalizePaymentRequest,
  attemptDeterministicCollectionRecovery,
  attemptContributorInfoBackfill,
  logRecoveryAttempt,
  buildContributionUnits,
  refreshCollectionAndWallets,
  formatContributionSummary,
  buildReceiptData,
  stripStandardFields,
  sendReceiptEmail,
} from "./_shared2.ts";
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqData = await req.json();
    // Two callers hit this endpoint with different payload shapes:
    //   - the FE's verifyPayment() call (usePaystack.ts): { reference }
    //   - Paystack's own webhook: { event: "charge.success", data: { reference, ... } }
    // Accept both so this function can serve as the webhook target too —
    // it's the idempotent, currently-used verify logic; the only thing
    // missing to use it as the webhook was reading the nested shape.
    const reference = reqData.reference || reqData?.data?.reference;
    // Manual recovery hint: only used when automatic metadata resolution
    // (pending_payment_context + Paystack metadata) both fail to produce a
    // collectionId. Supplied by Admin Reconcile when a human has confirmed,
    // out-of-band (e.g. by searching Paystack dashboard for the contributor's
    // email/amount), which collection a stranded payment belongs to.
    const overrideCollectionId = String(reqData.overrideCollectionId || "").trim() || null;
    // Same idea as overrideCollectionId, for the rarer case where amount-based
    // tier inference (see the "tiered" branch of normalizePaymentRequest) is
    // ambiguous — two or more tiers happen to cost the same totalPayable.
    // Admin Reconcile confirms the right tier out-of-band and supplies it here.
    const overrideSelectedTierId = String(reqData.overrideSelectedTierId || "").trim() || null;

    // Paystack sends webhooks for many event types once a webhook URL is
    // configured (charge.success, transfer.success, refund.processed, ...).
    // Only charge.success is relevant here; acknowledge anything else with
    // 200 so Paystack doesn't retry, without spending a verify-API call on it.
    if (reqData.event && reqData.event !== "charge.success") {
      return new Response(JSON.stringify({ status: true, message: "Event ignored" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing payment reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // F4: payment-lifecycle correlation log — every line below uses this prefix.
    console.log(`[verify ref=${reference}] VERIFY_CALLED`);

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}`, "Content-Type": "application/json" } }
    );

    const data = await response.json();
    if (!response.ok || !data.status) {
      // F4: Paystack verify rejected the reference
      console.warn(
        `[verify ref=${reference}] VERIFY_PAYSTACK_FAILED status=${response.status} message=${data?.message || ""}`
      );
      return new Response(JSON.stringify({ error: data.message || "Payment verification failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transaction = data.data;
    // F4: Paystack confirmed
    console.log(
      `[verify ref=${reference}] VERIFY_PAYSTACK_OK status=${transaction?.status} amount=${transaction?.amount} channel=${transaction?.channel || ""}`
    );
    const customer =
      transaction.customer && typeof transaction.customer === "object"
        ? (transaction.customer as Record<string, unknown>)
        : {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Diagnostic: which project this invocation is actually running
    // against — a misrouted webhook (backend pointed at the wrong
    // Supabase project) becomes visible in logs instead of silently
    // failing to find a collection.
    const projectRef = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || "unknown";
    console.log(`[verify ref=${reference}] ENV_CHECK projectRef=${projectRef}`);

    // ══ UNIVERSAL CAPTURE GUARANTEE (Phase 3.1 final) ═══════════════════════
    // This is the EARLIEST point at which we know Paystack has the money —
    // before metadata parsing, before collection resolution, before any
    // lookup that can fail. Record it here.
    //
    // Previously the capture write sat after collection resolution, so a
    // payment whose metadata was missing/corrupt hit `missing_collection_id`
    // and returned 400 with nothing recorded — the last remaining way for
    // captured money to avoid the ledger entirely.
    //
    // collection_id is deliberately NULL here: it is not yet known, and the
    // column is nullable precisely so an unresolvable payment can still be
    // recorded. It is filled in later (COALESCE inside record_payment_capture)
    // the moment resolution succeeds, on this same row.
    let captureRecorded = false;
    if (transaction?.status === "success") {
      const { error: earlyCaptureError } = await supabase.rpc("record_payment_capture", {
        p_reference: String(transaction.reference ?? reference),
        p_collection_id: null,
        p_transaction_id: transaction.id != null ? String(transaction.id) : null,
        p_status: String(transaction.status),
        p_amount: roundCurrency(Number(transaction.amount || 0) / 100),
        p_currency: transaction.currency ? String(transaction.currency) : null,
        p_channel: transaction.channel ? String(transaction.channel) : null,
        p_paid_at: transaction.paid_at ?? null,
        p_payload: transaction as unknown as Record<string, unknown>,
        p_contributor_email: customer?.email ? String(customer.email) : null,
        p_organizer_id: null,
      });

      if (earlyCaptureError) {
        // Fail closed: never process a payment we could not durably record.
        // 500 makes Paystack retry, which is the safe outcome.
        console.error(
          `[verify ref=${reference}] EARLY_CAPTURE_WRITE_FAILED — refusing to process`,
          earlyCaptureError.message
        );
        return new Response(
          JSON.stringify({
            error: "Could not durably record this payment. It is safe on Paystack — please retry.",
            code: "capture_ledger_write_failed",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      captureRecorded = true;
      console.log(
        `[verify ref=${reference}] CAPTURE_RECORDED_EARLY amount=${Number(transaction.amount || 0) / 100} (collection not yet resolved)`
      );
    }

    // Invocation-source tracking (additive, never changes matching/recovery
    // behavior): every existing caller keeps working unchanged because this
    // is inferred from the SAME request shapes already branched on above —
    // an explicit `invocationSource` in the body (used by the scheduled
    // recovery sweep) always wins; otherwise infer from shape.
    const requestStartedAt = Date.now();
    const invocationSource: string =
      String(reqData.invocationSource || "").trim() ||
      (reqData.event ? "webhook" : (overrideCollectionId || overrideSelectedTierId) ? "admin_reconcile" : "frontend_callback");
    const { count: priorAttemptCount } = await supabase
      .from("payment_recovery_log")
      .select("id", { count: "exact", head: true })
      .eq("reference", reference);
    const attemptNumber = (priorAttemptCount || 0) + 1;
    // Thin wrapper so the 11 existing logRecoveryAttempt call sites below
    // don't each need to be taught about invocationSource/attemptNumber/
    // durationMs individually — they already pass everything else.
    const logAttempt = (entry: Parameters<typeof logRecoveryAttempt>[1]) =>
      logRecoveryAttempt(supabase, {
        ...entry,
        invocationSource,
        attemptNumber,
        durationMs: Date.now() - requestStartedAt,
        selectedTierId: entry.selectedTierId ?? (overrideSelectedTierId || null),
      });

    // D-1: root-cause fix for "Missing collection ID in payment metadata".
    //
    // This used to trust `transaction.metadata` from Paystack's verify
    // response unconditionally, only guarding against it being absent
    // (`typeof transaction.metadata === "object"`). That guard silently
    // discards metadata that comes back as a JSON-ENCODED STRING instead
    // of an already-parsed object — a real Paystack API inconsistency —
    // and offered no protection against metadata being truncated by
    // Paystack for exceeding an undocumented size limit. Either failure
    // mode produces exactly this symptom: collectionId present at
    // initiate time, missing at verify time, with nothing wrong on our
    // side that the logs could show — because we never logged what
    // Paystack actually sent back.
    //
    // Fix: don't depend on Paystack to round-trip our own data at all.
    // We wrote this exact metadata into `pending_payment_context` at
    // initiate time, keyed by this same reference — read it back from
    // there FIRST. Only fall back to (defensively parsed) Paystack
    // metadata for references that predate this change.
    let metadata: Record<string, unknown> = {};
    let metadataSource = "none";

    const { data: pendingContext, error: pendingContextError } = await supabase
      .from("pending_payment_context")
      .select("collection_id, metadata")
      .eq("reference", reference)
      .maybeSingle();

    if (pendingContextError) {
      console.warn(
        `[verify ref=${reference}] PENDING_CONTEXT_LOOKUP_FAILED (falling back to Paystack metadata):`,
        pendingContextError.message
      );
    }

    if (pendingContext?.metadata && typeof pendingContext.metadata === "object") {
      metadata = pendingContext.metadata as Record<string, unknown>;
      metadataSource = "pending_payment_context";
    } else {
      // Fallback: parse whatever Paystack actually returned, tolerating
      // both an already-parsed object AND a JSON-encoded string.
      const rawMetadata = transaction.metadata;
      if (rawMetadata && typeof rawMetadata === "object") {
        metadata = rawMetadata as Record<string, unknown>;
        metadataSource = "paystack_object";
      } else if (typeof rawMetadata === "string" && rawMetadata.trim()) {
        try {
          const parsed = JSON.parse(rawMetadata);
          if (parsed && typeof parsed === "object") {
            metadata = parsed as Record<string, unknown>;
            metadataSource = "paystack_string_parsed";
          }
        } catch (parseErr) {
          console.error(
            `[verify ref=${reference}] METADATA_PARSE_FAILED raw_snippet="${rawMetadata.slice(0, 300)}"`,
            (parseErr as Error)?.message
          );
        }
      }
    }

    // F4/D-1 diagnostic: exactly what we received and decided, without
    // exposing secrets (this transaction's own metadata is not secret —
    // it's the same data the contributor's own browser sent moments ago).
    console.log(`[verify ref=${reference}] METADATA_DIAGNOSTIC`, {
      metadataSource,
      rawMetadataType: typeof transaction.metadata,
      pendingContextFound: Boolean(pendingContext),
      resolvedKeys: Object.keys(metadata),
      collectionIdFromCollectionId: metadata.collectionId ?? null,
      collectionIdFromSnakeCase: metadata.collection_id ?? null,
    });

    let collectionId = String(metadata.collectionId || metadata.collection_id || "").trim();
    if (!collectionId && overrideCollectionId) {
      // Manual recovery: automatic resolution failed, but an admin supplied
      // a collectionId via Admin Reconcile (confirmed out-of-band). Use it,
      // and log loudly since this bypasses the normal metadata trail.
      collectionId = overrideCollectionId;
      metadataSource = "manual_override";
      console.warn(
        `[verify ref=${reference}] MANUAL_OVERRIDE_COLLECTION_ID collectionId=${collectionId}`
      );
    }
    if (!collectionId) {
      // Both primary safety nets (pending_payment_context + Paystack's own
      // metadata) came back empty. Before failing, try the deterministic
      // recovery strategies — exact payment_reference match in a sibling
      // table, then (only if unambiguous) email+amount+recency inference.
      const recovered = await attemptDeterministicCollectionRecovery(supabase, {
        reference,
        customerEmail: String(customer.email || "").trim(),
        grossAmountPaid: roundCurrency(Number(transaction.amount || 0) / 100),
      });
      if (recovered) {
        collectionId = recovered.collectionId;
        metadataSource = recovered.strategy;
        console.warn(
          `[verify ref=${reference}] DETERMINISTIC_RECOVERY strategy=${recovered.strategy} collectionId=${collectionId}`
        );
        await logAttempt({
          reference, collectionId, success: true, metadataSource,
          note: `recovered_via_${recovered.strategy}`,
        });
      }
    }
    if (!collectionId) {
      console.error(
        `[verify ref=${reference}] MISSING_COLLECTION_ID metadataSource=${metadataSource} ` +
        `rawMetadataType=${typeof transaction.metadata} resolvedKeys=${Object.keys(metadata).join(",")}`
      );
      await logAttempt({
        reference, collectionId: null, success: false,
        errorCode: "missing_collection_id", errorMessage: "Missing collection ID in payment metadata",
        metadataSource, context: { resolvedKeys: Object.keys(metadata) },
      });

      // UNIVERSAL CAPTURE GUARANTEE: if Paystack captured the money, it is
      // already in the ledger (recorded above, before this lookup ran). Park
      // it for review instead of returning 400 — an unresolvable collection
      // is an admin problem, not a reason for money to vanish. The admin can
      // supply `overrideCollectionId` via Admin Reconcile to finish it.
      if (captureRecorded) {
        await supabase.rpc("mark_payment_needs_review", {
          p_reference: String(transaction.reference ?? reference),
          p_failure_code: "missing_collection_id",
          p_failure_reason: "Captured by Paystack but the collection could not be resolved from metadata.",
          p_failure_context: { resolvedKeys: Object.keys(metadata), metadataSource },
        });
        return new Response(JSON.stringify({
          status: "needs_review",
          reference: String(transaction.reference ?? reference),
          error: "Missing collection ID in payment metadata",
          code: "missing_collection_id",
          recorded: true,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: "Missing collection ID in payment metadata" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manual tier override only ever applies on top of whatever metadata we
    // resolved — never clobbers a real selectedTierId that came from
    // pending_payment_context or Paystack's own metadata.
    if (overrideSelectedTierId && !metadata.selectedTierId) {
      metadata = { ...metadata, selectedTierId: overrideSelectedTierId };
      console.warn(
        `[verify ref=${reference}] MANUAL_OVERRIDE_SELECTED_TIER_ID tierId=${overrideSelectedTierId}`
      );
    }

    // Do not filter on deleted_at — column may not exist in prod schema.
    const { data: collection, error: collectionError } = await supabase
      .from("collections").select("*").eq("id", collectionId).maybeSingle();

    if (collectionError) {
      await logAttempt({
        reference, collectionId, success: false,
        errorCode: "collection_fetch_failed", errorMessage: collectionError.message, metadataSource,
      });
      return new Response(JSON.stringify({ error: "Error fetching collection details" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!collection) {
      await logAttempt({
        reference, collectionId, success: false,
        errorCode: "collection_not_found", errorMessage: "Collection not found.", metadataSource,
      });

      // UNIVERSAL CAPTURE GUARANTEE: the collection was deleted (or the id is
      // wrong) AFTER the contributor paid. Returning 404 here used to strand
      // the money. Attach the resolved collection id to the ledger row and
      // park it for review instead.
      if (captureRecorded) {
        await supabase.rpc("record_payment_capture", {
          p_reference: String(transaction.reference ?? reference),
          p_collection_id: collectionId,
          p_transaction_id: transaction.id != null ? String(transaction.id) : null,
          p_status: String(transaction.status),
          p_amount: roundCurrency(Number(transaction.amount || 0) / 100),
          p_currency: transaction.currency ? String(transaction.currency) : null,
          p_channel: transaction.channel ? String(transaction.channel) : null,
          p_paid_at: transaction.paid_at ?? null,
          p_payload: transaction as unknown as Record<string, unknown>,
          p_contributor_email: customer?.email ? String(customer.email) : null,
          p_organizer_id: null,
        });
        await supabase.rpc("mark_payment_needs_review", {
          p_reference: String(transaction.reference ?? reference),
          p_failure_code: "collection_not_found",
          p_failure_reason: "Captured by Paystack but the collection no longer exists.",
          p_failure_context: { collectionId, metadataSource },
        });
        return new Response(JSON.stringify({
          status: "needs_review",
          reference: String(transaction.reference ?? reference),
          error: "Collection not found.",
          code: "collection_not_found",
          recorded: true,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: "Collection not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processedContributions: Record<string, unknown>[] = [];
    let normalizedPayment: ReturnType<typeof normalizePaymentRequest> | null = null;
    let isNewPayment = false; // true only when we insert new contributions (not idempotent replay)

    if (transaction.status === "success") {
      // ══ PHASE 3.1 — CAPTURE GUARANTEE ════════════════════════════════════
      // Paystack has confirmed the money exists. Record that as a DURABLE
      // FACT before any business rule gets a chance to reject it.
      //
      // Before this existed, a validation failure below returned 4xx and
      // inserted nothing, so a captured payment could vanish entirely — the
      // 2026-08-06 incident (₦520,200 across 6 payments). Capture is now
      // written first, so from this line onward the payment always exists in
      // the ledger and is always visible in the Payment Inbox.
      //
      // record_payment_capture is idempotent: it COALESCEs the write-once
      // capture facts (so a redelivered webhook writes identical values and
      // the immutability trigger permits it) and never downgrades a payment
      // that already reached completed/reconciled.
      //
      // FAIL CLOSED: if this write fails we must NOT continue. Returning 500
      // makes Paystack retry, which is the correct outcome — the alternative
      // is processing a payment we have not durably recorded, which is the
      // exact failure mode this whole change exists to remove.
      const { error: captureError } = await supabase.rpc("record_payment_capture", {
        p_reference: String(transaction.reference),
        p_collection_id: collectionId,
        p_transaction_id: transaction.id != null ? String(transaction.id) : null,
        p_status: String(transaction.status),
        p_amount: roundCurrency(Number(transaction.amount || 0) / 100),
        p_currency: transaction.currency ? String(transaction.currency) : null,
        p_channel: transaction.channel ? String(transaction.channel) : null,
        p_paid_at: transaction.paid_at ?? null,
        p_payload: transaction as unknown as Record<string, unknown>,
        p_contributor_email: customer?.email ? String(customer.email) : null,
        p_organizer_id: (collection as Record<string, unknown>)?.user_id
          ? String((collection as Record<string, unknown>).user_id)
          : null,
      });

      if (captureError) {
        console.error(
          `[verify ref=${reference}] CAPTURE_LEDGER_WRITE_FAILED — refusing to process`,
          captureError.message
        );
        await logAttempt({
          reference, collectionId, success: false,
          errorCode: "capture_ledger_write_failed",
          errorMessage: captureError.message, metadataSource,
        });
        return new Response(
          JSON.stringify({
            error: "Could not durably record this payment. It is safe on Paystack — please retry.",
            code: "capture_ledger_write_failed",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[verify ref=${reference}] CAPTURE_RECORDED amount=${Number(transaction.amount || 0) / 100}`);

      // ── Idempotency: check if we already recorded contributions for this reference ──
      // Use the new payment_reference column that was added via migration.
      const { data: existingContributions } = await supabase
        .from("contributions")
        .select("*")
        .eq("payment_reference", String(transaction.reference))
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: true });

      if ((existingContributions || []).length > 0) {
        processedContributions = existingContributions || [];
        // F4: idempotent return — already-recorded payment, no inserts needed.
        // This is the ordinary late-replay case (e.g. a page refresh long
        // after the original success) — distinct from the atomic branch's
        // duplicate_race_lost, which specifically means a concurrent request
        // won a genuine near-simultaneous race.
        console.log(
          `[verify ref=${reference}] payment.verify.idempotent_hit existing=${processedContributions.length}`
        );
        await logAttempt({
          reference, collectionId, success: true, metadataSource,
          note: `idempotent_hit existing=${processedContributions.length}`,
        });
      } else {
        const { data: paidRows, error: paidRowsError } = await supabase
          .from("contributions").select("id, amount, contributor_information, contributor_unique_code").eq("collection_id", collectionId).eq("status", "paid");

        if (paidRowsError) {
          return new Response(JSON.stringify({ error: "Unable to validate payment totals right now." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // verifiedTotal is computed right before the mismatch check below
        const verifiedTotalEarly = roundCurrency(Number(transaction.amount || 0) / 100);
        // H2: claim_payment_contributions is now the ONLY persistence path
        // (see below) — it makes idempotency, capacity, contributor-code
        // allocation, and insert one atomic operation. The 5 capacity-based
        // throws inside normalizePaymentRequest are always deferred to it
        // (see deferCapacityChecks) so a stale `paidRows` snapshot taken
        // here can never wrongly reject an already-successful reference.
        // See database/h1_atomic_payment_verification.sql (the original
        // atomicity fix) and database/h2_atomic_contributor_code_allocation.sql
        // (this change: moves contributor-code allocation inside the same
        // atomic RPC instead of minting it here beforehand).
        try {
          normalizedPayment = normalizePaymentRequest({
            collection,
            metadata,
            deferCapacityChecks: true,
            paidRows: (paidRows || []) as Array<Record<string, unknown>>,
            paystackVerifiedTotal: verifiedTotalEarly,
          });
        } catch (error: unknown) {
          if (error instanceof PaymentValidationError) {
            await logAttempt({
              reference, collectionId, success: false,
              errorCode: error.code, errorMessage: error.message, metadataSource,
              context: error.logContext ?? null,
            });

            // PHASE 3.1 — the money is already captured and already in the
            // ledger. A business rule refusing it (tier_sold_out,
            // collection_full, invalid_selected_tier, collection_deleted, …)
            // must NOT make it disappear: park it in needs_review so it stays
            // in the Payment Inbox and stays recoverable from the admin panel.
            const { error: reviewError } = await supabase.rpc("mark_payment_needs_review", {
              p_reference: String(transaction.reference),
              p_failure_code: error.code,
              p_failure_reason: error.message,
              p_failure_context: (error.logContext ?? null) as Record<string, unknown> | null,
            });

            if (reviewError) {
              // Never acknowledge a payment we failed to durably annotate —
              // 500 makes Paystack retry rather than consider it handled.
              console.error(`[verify ref=${reference}] NEEDS_REVIEW_WRITE_FAILED`, reviewError.message);
              return new Response(
                JSON.stringify({ error: "Could not record payment state. Please retry.", code: "needs_review_write_failed" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            // 200: the payment is durably recorded and awaiting review, so
            // Paystack should stop retrying. No `receiptData` is returned, so
            // the contributor's callback page still shows the error (it keys
            // off receiptData, not the status code).
            return new Response(JSON.stringify({
              status: "needs_review",
              reference: String(transaction.reference),
              error: error.message,
              code: error.code,
              recorded: true,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          throw error;
        }

        // Verify amount matches: Paystack charged totalPayable, not contributionAmount.
        // For open_pool/fundraising where metadata.contributionAmount was missing and we
        // reverse-calculated the amount from verifiedTotal, allow a slightly wider tolerance
        // to absorb binary-search rounding (max ~₦0.10 off).
        const verifiedTotal = verifiedTotalEarly;
        const metadataHadAmount =
          asNumber(metadata.contributionAmount || metadata.amount) > 0;
        const isOpenAmount =
          normalizedPayment.collectionType === "open_pool" ||
          normalizedPayment.collectionType === "fundraising";
        const mismatchTolerance = isOpenAmount && !metadataHadAmount ? 1.0 : 0.01;
        if (Math.abs(verifiedTotal - normalizedPayment.totalPayable) > mismatchTolerance) {
          console.error("Amount mismatch:", { reference, collectionId, verifiedTotal, expectedTotal: normalizedPayment.totalPayable });
          await logAttempt({
            reference, collectionId, success: false,
            errorCode: "amount_mismatch", errorMessage: "Payment amount validation failed.", metadataSource,
            context: { verifiedTotal, expectedTotal: normalizedPayment.totalPayable },
          });

          // PHASE 3.1 — THIS IS THE LINE THAT LOST ₦520,200 ON 2026-08-06.
          // It used to return 400 and insert nothing, so a payment Paystack
          // had already captured simply ceased to exist. The capture is now
          // in the ledger (written above) and this records WHY it was refused,
          // leaving it visible and replayable instead of gone.
          const { error: reviewError } = await supabase.rpc("mark_payment_needs_review", {
            p_reference: String(transaction.reference),
            p_failure_code: "amount_mismatch",
            p_failure_reason: "Payment amount validation failed.",
            p_failure_context: { verifiedTotal, expectedTotal: normalizedPayment.totalPayable },
          });

          if (reviewError) {
            console.error(`[verify ref=${reference}] NEEDS_REVIEW_WRITE_FAILED`, reviewError.message);
            return new Response(
              JSON.stringify({ error: "Could not record payment state. Please retry.", code: "needs_review_write_failed" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(JSON.stringify({
            status: "needs_review",
            reference: String(transaction.reference),
            error: "Payment amount validation failed. Contact support with your reference.",
            code: "amount_mismatch",
            recorded: true,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Recovery backfill: only when metadata gave us literally nothing beyond
        // the tier/amount (both pending_payment_context and Paystack's own
        // metadata echo were empty) — the exact gap that, in a real incident,
        // left a contribution with only {Tier, TierId, Quantity} on file. See
        // attemptContributorInfoBackfill above for the matching discipline.
        const payerEmailForBackfill = normalizedPayment.contact.email || String(customer.email || "");
        const metadataHadNoAnswers =
          Object.keys(normalizedPayment.formData || {}).length === 0 &&
          !normalizedPayment.contact.name &&
          !normalizedPayment.contact.phone;
        const backfill = metadataHadNoAnswers
          ? await attemptContributorInfoBackfill(supabase, {
              reference,
              collectionId,
              email: payerEmailForBackfill,
            })
          : null;
        if (backfill) {
          console.warn(
            `[verify ref=${reference}] CONTRIBUTOR_BACKFILL_APPLIED fromContributionId=${backfill.contributionId} fields=${Object.keys(backfill.fields).join(",")}`
          );
          await logAttempt({
            reference, collectionId, success: true, metadataSource,
            note: `contributor_info_backfilled fromContributionId=${backfill.contributionId}`,
            context: { fields: Object.keys(backfill.fields) },
          });
        }

        const contactName =
          normalizedPayment.contact.name ||
          backfill?.name ||
          String(customer.email || "").split("@")[0] ||
          "Anonymous";
        const payerName =
          normalizedPayment.isAnonymous && normalizedPayment.collectionType === "fundraising"
            ? "Anonymous"
            : contactName;

        // Fix #4: Only host-requested form fields go into contributorInformation.
        // Contact info (name/email/phone) is stored on top-level columns only.
        const baseFields = {
          ...(normalizedPayment.formData || {}),
          ...(backfill?.fields || {}),
        };

        const contributionUnits = buildContributionUnits(normalizedPayment, collection);
        const unitAmounts = contributionUnits.map((u) => u.amount);
        const allocatedPlatformFees = allocateAmounts(normalizedPayment.platformFee, unitAmounts);
        const allocatedGatewayFees = allocateAmounts(normalizedPayment.gatewayFee, unitAmounts);
        const allocatedTotals = allocateAmounts(normalizedPayment.totalPayable, unitAmounts);

        // H2: contributor-code allocation no longer happens in this loop —
        // it moved inside claim_payment_contributions, atomically with the
        // insert (database/h2_atomic_contributor_code_allocation.sql). This
        // loop only resolves WHICH prefix applies to each unit (unchanged
        // resolution logic) and passes it through; the RPC mints the code,
        // uppercases it, and strips internal whitespace itself — this
        // function is now the single source of truth for code construction.
        const builtRows: Array<Record<string, unknown>> = [];

        for (let index = 0; index < contributionUnits.length; index++) {
          const unit = contributionUnits[index];
          // A configured prefix — this unit's tier/ticket prefix, falling
          // back to the collection-level code_prefix — is what drives
          // generation; unique_id_enabled is NOT checked here (see
          // hasAnyConfiguredPrefix above for why).
          const prefix = String(unit.prefix || normalizedPayment.codePrefix || "").trim();

          // Fix #1: When organizer absorbs fees, contributions.amount = net the host receives.
          // When contributor pays fees, contributions.amount = base contribution amount.
          const allocatedFees = roundCurrency(
            (allocatedPlatformFees[index] || 0) + (allocatedGatewayFees[index] || 0)
          );
          const netAmount =
            normalizedPayment.feeBearer === "organizer"
              ? roundCurrency(unit.amount - allocatedFees)
              : unit.amount;

          const contributorInformation = {
            ...baseFields,
            ...(unit.tierName ? { Tier: unit.tierName } : {}),
            ...(unit.tierId ? { TierId: unit.tierId } : {}),
            TierAmount: unit.amount,
            Quantity: 1,
            collectionType: normalizedPayment.collectionType,
            channel: transaction.channel,
            paidAt: transaction.paid_at,
          };

          // ── contributions table columns (actual schema): ─────────────────
          //   id, collection_id, name, email, phone, amount, gross_amount,
          //   contributor_information, contributor_unique_code, status,
          //   payment_id, payment_reference, check_in_status,
          //   created_at, updated_at
          //
          // amount      = net to host (contributionAmount minus fees if organizer-borne)
          // gross_amount= what contributor actually paid (inc. fees or same as amount)

          const lineItemGross = roundCurrency(allocatedTotals[index] || unit.amount);

          // Embed receipt data inside contributor_information so it's queryable
          // without a separate table. Standard fields are in named keys;
          // receipt metadata sits under _receipt so it doesn't pollute the UI.
          const infoWithReceipt = {
            ...stripStandardFields(contributorInformation),
            _receipt: {
              transaction_id: transaction.id,
              reference: transaction.reference,
              paid_at: transaction.paid_at,
              payment_channel: transaction.channel,
              collection_title: collection.title || null,
              // H2: filled in server-side by claim_payment_contributions
              // (jsonb_set on contributor_information[0]._receipt.unique_code)
              // once the code is actually allocated — this function no
              // longer knows the code at build time.
              unique_code: null,
              name: payerName,
              line_item_amount: unit.amount,
              line_item_net_amount: netAmount,
              line_item_platform_fee: allocatedPlatformFees[index] || 0,
              line_item_gateway_fee: allocatedGatewayFees[index] || 0,
              line_item_total_paid: lineItemGross,
              order_contribution_amount: normalizedPayment.contributionAmount,
              order_platform_fee: normalizedPayment.platformFee,
              order_gateway_fee: normalizedPayment.gatewayFee,
              order_total_fees: normalizedPayment.totalFees,
              order_total_paid: normalizedPayment.totalPayable,
              order_quantity: normalizedPayment.quantity,
              fee_bearer: normalizedPayment.feeBearer,
              tier_id: unit.tierId,
              tier_name: unit.tierName,
              ticket_selections: normalizedPayment.ticketSelections,
              // Payer contact stored here — used in Activities tab only
              _payer: {
                name: payerName,
                email: normalizedPayment.contact.email || String(customer.email || ""),
                phone: normalizedPayment.contact.phone || backfill?.phone || null,
              },
              // Provenance for the auto-backfill above (see
              // attemptContributorInfoBackfill) — present only when this
              // contribution's custom-field answers were recovered from an
              // earlier paid contribution by the same email, not submitted
              // directly with this payment.
              ...(backfill ? { recoveredFromContributionId: backfill.contributionId } : {}),
            },
          };

          const contributorPayload: Record<string, unknown> = {
            collection_id: collectionId,
            // ─── CORRECT column names (matching actual schema) ───────────────
            name: payerName,
            email: normalizedPayment.contact.email || String(customer.email || ""),
            phone: normalizedPayment.contact.phone || backfill?.phone || null,
            // amount = net to host (deducts fees when organizer-borne)
            amount: netAmount,
            // gross_amount = what contributor actually paid
            gross_amount: lineItemGross,
            status: "paid",
            payment_reference: String(transaction.reference),
            // H2: no contributor_unique_code here — claim_payment_contributions
            // allocates and sets it atomically with the insert. `prefix` is
            // the only input this function supplies for code construction.
            prefix,
            contributor_information: [infoWithReceipt],
            // F3: per-unit line index. Combined with (collection_id,
            // payment_reference) this is unique (enforced by the constraint
            // added in f3_step2_line_index_constraint.sql). Without this,
            // two concurrent verify calls for the same reference could each
            // insert N rows = 2N total rows.
            line_index: index,
            ...(normalizedPayment.collectionType === "ticket"
              ? { check_in_status: "not_checked_in" }
              : {}),
          };

          builtRows.push(contributorPayload);
        }

        // H2: claim_payment_contributions is now the ONLY persistence path —
        // one call, one row lock, authoritative idempotency + capacity +
        // contributor-code allocation + insert, all in one transaction. See
        // database/h2_atomic_contributor_code_allocation.sql. The previous
        // flag-gated default (per-unit insert with client-side minting) is
        // retired — it could not provide this guarantee without duplicating
        // the same atomic logic a second time.
        // tier_id/tier_name/tier_quantity let the function re-verify
        // capacity live (never trusting this request's earlier, possibly
        // stale, paidRows snapshot). `prefix` (from builtRows) is the only
        // code-related input — the function allocates and returns the code.
        const rpcRows = builtRows.map((row, index) => ({
          ...row,
          tier_id: contributionUnits[index].tierId || null,
          tier_name: contributionUnits[index].tierName || null,
          tier_quantity: 1,
        }));

        console.log(`[verify ref=${reference}] payment.verify.started mode=atomic units=${rpcRows.length}`);

        const { data: claimResult, error: claimError } = await supabase.rpc(
          "claim_payment_contributions",
          {
            p_collection_id: collectionId,
            p_payment_reference: String(transaction.reference),
            p_rows: rpcRows,
          }
        );

        if (claimError) {
          console.error(`[verify ref=${reference}] payment.verify.claim_rpc_failed`, claimError.message);
          await logAttempt({
            reference, collectionId, success: false,
            errorCode: "claim_rpc_failed", errorMessage: claimError.message, metadataSource,
          });
          return new Response(
            JSON.stringify({
              error: "Failed to record contribution. The payment is recorded on Paystack — please retry; this is safe.",
              code: "claim_rpc_failed",
              details: claimError.message,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const outcome = String((claimResult as Record<string, unknown>)?.outcome || "");

        if (outcome === "capacity_exceeded") {
          const isCollectionFull = Boolean((claimResult as Record<string, unknown>)?.collection_full);
          const failedTierName = (claimResult as Record<string, unknown>)?.failed_tier_name as string | null;
          const errorCode = isCollectionFull ? "collection_full" : "tier_sold_out";
          const errorMessage = isCollectionFull
            ? "This collection has reached its contribution limit."
            : `${failedTierName || "Selected tier"} is sold out.`;
          console.warn(
            `[verify ref=${reference}] payment.verify.capacity_rejected collectionFull=${isCollectionFull} tier=${failedTierName || ""}`
          );
          await logAttempt({
            reference, collectionId, success: false,
            errorCode, errorMessage, metadataSource, note: "capacity_exceeded_atomic",
          });
          return new Response(
            JSON.stringify({ error: errorMessage, code: errorCode }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        processedContributions = ((claimResult as Record<string, unknown>)?.contributions as Record<string, unknown>[]) || [];
        isNewPayment = outcome === "inserted";

        if (outcome === "idempotent") {
          // Reaching this branch at all means the EARLY idempotency check
          // (top of the request) found nothing yet — so if the
          // authoritative, locked check now finds an existing contribution,
          // a concurrent caller for this exact reference won the race while
          // we were mid-flight. This is the direct, provable "lost" signal.
          console.log(
            `[verify ref=${reference}] payment.verify.duplicate_race_lost count=${processedContributions.length} attemptNumber=${attemptNumber}`
          );
          await logAttempt({
            reference, collectionId, success: true, metadataSource,
            note: `idempotent_hit_atomic existing=${processedContributions.length}`,
          });
        } else {
          // attemptNumber > 1 means an earlier payment_recovery_log entry
          // already exists for this reference (a prior concurrent attempt
          // logged first) — this insert won a genuine race. attemptNumber
          // === 1 is the uncontested, ordinary-success case.
          const raceWon = attemptNumber > 1;
          console.log(
            `[verify ref=${reference}] payment.verify.${raceWon ? "duplicate_race_won" : "success"} mode=atomic count=${processedContributions.length} attemptNumber=${attemptNumber}`
          );
          await logAttempt({
            reference, collectionId, success: true, metadataSource,
            note: `new_contribution_recorded_atomic count=${processedContributions.length}${raceWon ? " race_won" : ""}`,
          });
        }
      }

      await refreshCollectionAndWallets(supabase, collectionId, collection);
      // F4: wallet recompute complete (source-of-truth derivation)
      console.log(
        `[verify ref=${reference}] WALLET_UPDATED collectionId=${collectionId}`
      );

      // PHASE 3.1 — close the ledger entry. Contribution(s) and wallet are
      // now recorded, so the payment has reached a terminal success state.
      // `reconciled` rather than `completed` when this came via a recovery
      // path or the row was previously parked in needs_review, so the Payment
      // Inbox keeps showing which payments needed rescuing.
      // Best-effort by design: the money is already recorded in
      // `contributions`, so failing to update the state label must not fail
      // the request. The invariant view catches any row left behind.
      if (processedContributions.length > 0) {
        const viaRecovery =
          invocationSource === "scheduled_recovery" || invocationSource === "admin_reconcile";
        const { error: completeError } = await supabase.rpc("mark_payment_completed", {
          p_reference: String(transaction.reference),
          p_via_recovery: viaRecovery,
        });
        if (completeError) {
          console.warn(
            `[verify ref=${reference}] LEDGER_COMPLETE_WRITE_FAILED (non-fatal, invariant view will surface it)`,
            completeError.message
          );
        }
      }

      // ── Send receipt + organizer email (best-effort, non-blocking) ──────────
      // Primary path: call the backend's /api/payments/send-receipt endpoint
      //   which uses ZeptoMail SMTP (already configured in the backend).
      // Fallback: ZeptoMail HTTP API (if ZEPTOMAIL_API_TOKEN is set as a Supabase secret).
      // Fires only on first-time payment insertion — never on idempotent replays.
      if (isNewPayment && normalizedPayment) {
        const payerEmail = normalizedPayment.contact.email || String(customer.email || "");
        const payerName = normalizedPayment.contact.name || payerEmail.split("@")[0];

        if (payerEmail) {
          // @ts-ignore — Deno is a valid global in Supabase Edge Functions
          const backendUrl = Deno.env.get("BACKEND_URL");
          // @ts-ignore
          const notifySecret = Deno.env.get("BACKEND_NOTIFY_SECRET");

          // Build participant list for the email template
          const emailParticipants = processedContributions.map((c) => {
            const infoRows = Array.isArray((c as Record<string, unknown>).contributor_information)
              ? ((c as Record<string, unknown>).contributor_information as Array<Record<string, unknown>>)
              : [];
            const details = infoRows.flatMap((row) =>
              Object.entries(row)
                .filter(([k]) => !k.startsWith("_"))
                .map(([label, value]) => ({ label, value: String(value) }))
            );
            return {
              id: String((c as Record<string, unknown>).id || ""),
              uniqueCode: String((c as Record<string, unknown>).contributor_unique_code || ""),
              details,
            };
          });

          // Resolve organizer name once for the receipt's collection card
          // (best-effort — the card simply omits the line when unavailable).
          let organizerName: string | undefined;
          try {
            const { data: org } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", String((collection as Record<string, unknown>).user_id || ""))
              .maybeSingle();
            if (org?.full_name) organizerName = String(org.full_name);
          } catch { /* non-fatal: organizer line is optional */ }

          // Single normalized argument set for the ZeptoMail fallback, built once
          // here (where `normalizedPayment` is non-null) and reused by every
          // fallback branch below — no duplicated object literals.
          const receiptArgs = {
            payerEmail,
            payerName,
            collectionTitle: String(collection.title || "Collection"),
            collectionType: normalizedPayment.collectionType,
            collectionDescription: collection.description ? String(collection.description) : undefined,
            organizerName,
            contributionAmount: normalizedPayment.contributionAmount,
            platformFee: normalizedPayment.platformFee,
            gatewayFee: normalizedPayment.gatewayFee,
            totalPaid: normalizedPayment.totalPayable,
            currency: "NGN",
            transactionRef: String(transaction.reference || ""),
            transactionId: transaction.id ? String(transaction.id) : undefined,
            paidAt: String(transaction.paid_at || new Date().toISOString()),
            channel: transaction.channel ? String(transaction.channel) : undefined,
            uniqueCodes: processedContributions
              .map((c) => String((c as Record<string, unknown>).contributor_unique_code || ""))
              .filter(Boolean),
          };

          if (backendUrl) {
            // ── Primary: backend Zoho SMTP email ──────────────────────────────
            fetch(`${backendUrl}/api/payments/send-receipt`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(notifySecret ? { "x-internal-secret": notifySecret } : {}),
              },
              body: JSON.stringify({
                payerEmail,
                payerName,
                collectionTitle: receiptArgs.collectionTitle,
                collectionType: receiptArgs.collectionType,
                collectionDescription: receiptArgs.collectionDescription,
                organizerName: receiptArgs.organizerName,
                contributionAmount: receiptArgs.contributionAmount,
                platformFee: receiptArgs.platformFee,
                gatewayFee: receiptArgs.gatewayFee,
                totalPaid: receiptArgs.totalPaid,
                currency: "NGN",
                transactionRef: receiptArgs.transactionRef,
                transactionId: receiptArgs.transactionId,
                paidAt: receiptArgs.paidAt,
                channel: receiptArgs.channel || "card",
                participants: emailParticipants,
                uniqueCodes: receiptArgs.uniqueCodes,
                collectionId: collectionId,
              }),
            }).then(async (r) => {
              if (!r.ok) {
                const body = await r.text().catch(() => "");
                console.warn("[verify] backend email non-OK:", r.status, body);
                // Fallback to ZeptoMail HTTP API if backend returned an error
                return sendReceiptEmail(receiptArgs).catch((e: unknown) =>
                  console.warn("[verify] ZeptoMail fallback also failed:", (e as Error)?.message)
                );
              }
              console.log(
                `[verify ref=${reference}] RECEIPT_EMAIL_SENT channel=backend`
              );
            }).catch((err: unknown) => {
              console.warn("[verify] backend email fetch error, trying ZeptoMail:", (err as Error)?.message);
              // Fallback to ZeptoMail HTTP API on network error
              sendReceiptEmail(receiptArgs).catch((e: unknown) =>
                console.warn("[verify] ZeptoMail fallback also failed:", (e as Error)?.message)
              );
            });
          } else {
            // ── No BACKEND_URL configured: fall back to ZeptoMail HTTP API directly ───────
            sendReceiptEmail(receiptArgs).catch((err: unknown) =>
              console.warn("[verify] ZeptoMail email failed (no backend URL set):", (err as Error)?.message)
            );
          }
        }
      }
    }

    const receiptData = buildReceiptData({
      transaction, normalizedPayment, collection, contributions: processedContributions, customer,
    });

    // F4: final lifecycle checkpoint — clean filterable end-of-flow marker
    console.log(
      `[verify ref=${reference}] PAYMENT_COMPLETED contributions=${processedContributions.length} fresh=${isNewPayment}`
    );

    return new Response(
      JSON.stringify({
        status: transaction.status,
        reference: transaction.reference,
        amount: transaction.amount / 100,
        paidAt: transaction.paid_at,
        channel: transaction.channel,
        currency: transaction.currency,
        customer: transaction.customer,
        contributions: processedContributions.map(formatContributionSummary),
        receiptData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    // F4: capture unexpected errors with whatever reference we have in scope.
    // (Best-effort — if the error fired before we parsed the body, ref is unknown.)
    console.error(`[verify ref=?] VERIFY_UNHANDLED_ERROR ${msg}`);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
