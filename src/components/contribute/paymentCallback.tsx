import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, Mail, RefreshCw, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PaymentSuccessful from "./PaymentSuccessful";
import { Button } from "@/components/ui/button";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const transactionRef = searchParams.get("reference") || searchParams.get("trxref");

  const [receiptData, setReceiptData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  // In-memory guard: prevents the same component instance from firing twice
  // (React 18 StrictMode double-invocation in development).
  // The edge function is idempotent — safe to re-call on page refresh.
  const processingRef = React.useRef(false);

  const verify = React.useCallback(async () => {
    if (!transactionRef) {
      setErrorMsg("No payment reference found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // The edge function is the source of truth for payment verification.
      // It: verifies with Paystack, creates the contribution record,
      // updates wallet/collection totals, and returns receipt data.
      // It is idempotent — safe to call multiple times for the same reference.
      const { data, error } = await supabase.functions.invoke(
        "verify-paystack-payment",
        { body: { reference: transactionRef } }
      );

      if (error) {
        let serverMessage = error.message || "Verification failed";
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) serverMessage = body.error;
          }
        } catch { /* ignore parse errors */ }
        throw new Error(serverMessage);
      }

      if (data?.receiptData) {
        setReceiptData(data.receiptData);
        return;
      }

      throw new Error(data?.error || "Unable to load payment receipt");
    } catch (err: any) {
      console.error("Payment callback error:", err);
        setErrorMsg(toFriendlyErrorMessage(err, "Could not verify payment. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [transactionRef]);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    processingRef.current = false;
    verify();
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-kolekto/10 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-kolekto" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Confirming your payment…</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Please wait while we verify your transaction. This usually takes a few seconds.
          </p>
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-left">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-700 leading-relaxed">
              Your payment is already recorded on Paystack. This page just loads your receipt.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Receipt couldn't load</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{errorMsg}</p>
            </div>

            {transactionRef && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-left">
                <p className="text-xs text-gray-500 mb-1">Your payment reference</p>
                <p className="text-sm font-mono font-semibold text-gray-800 break-all">{transactionRef}</p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                onClick={handleRetry}
                className="w-full bg-kolekto hover:bg-kolekto/90 flex items-center gap-2 justify-center"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              <Link to="/" className="w-full">
                <Button variant="outline" className="w-full flex items-center gap-2 justify-center">
                  <Home className="w-4 h-4" />
                  Go to Home
                </Button>
              </Link>
            </div>
          </div>

          {/* Resilience fallback message */}
          <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-green-800">Your payment is safe</p>
            </div>
            <p className="text-sm text-green-700 leading-relaxed">
              If you completed payment on Paystack, it has been recorded. This page only displays your receipt — your payment is not at risk.
            </p>
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 leading-relaxed">
                <strong>Check your email</strong> — a receipt was sent to the address you used at checkout. Check spam if you don't see it, or contact support with the reference above.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── No data ───────────────────────────────────────────────────────────────
  if (!receiptData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-gray-600">Unable to load receipt.</p>
          <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-green-600" />
              <p className="text-sm font-semibold text-green-800">Check your email for your receipt</p>
            </div>
            <p className="text-sm text-green-700">
              If payment was successful, a receipt has been sent to your email address.
            </p>
          </div>
          <Button onClick={handleRetry} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Reload Receipt
          </Button>
        </div>
      </div>
    );
  }

  // ── Success — show receipt ────────────────────────────────────────────────
  return (
    <PaymentSuccessful
      open={open}
      onOpenChange={setOpen}
      collectionTitle={receiptData.collectionTitle}
      contributionAmount={receiptData.contributionAmount}
      platformFee={receiptData.platformFee}
      gatewayFee={receiptData.gatewayFee}
      totalFees={receiptData.totalFees}
      totalPaid={receiptData.totalPaid}
      participants={receiptData.participants}
      ticketSelections={receiptData.ticketSelections}
      transactionRef={receiptData.transactionRef}
      status={receiptData.status}
      paidAt={receiptData.paidAt}
      channel={receiptData.channel}
      currency={receiptData.currency}
      payer={receiptData.payer}
      collectionType={receiptData.collectionType}
      bannerUrl={receiptData.bannerUrl}
      description={receiptData.description}
      campaignSummary={receiptData.campaignSummary}
      eventDate={receiptData.eventDate}
      uniqueIdEnabled={receiptData.uniqueIdEnabled}
      codePrefix={receiptData.codePrefix}
    />
  );
};

export default PaymentCallback;
