import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PaymentSuccessful from "./PaymentSuccessful";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const transactionRef = searchParams.get("reference") || searchParams.get("trxref");

  const [receiptData, setReceiptData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  // Guard against React 18 StrictMode double-invocation within the SAME render
  // cycle. processingRef prevents the same component instance from firing twice.
  // We intentionally do NOT use a sessionStorage lock for the full page — if the
  // user lands on this page (e.g. after a Paystack redirect or page refresh) we
  // always call verify. The edge function is idempotent: it returns existing
  // contribution data without creating duplicates.
  const processingRef = React.useRef(false);

  useEffect(() => {
    if (!transactionRef) {
      setErrorMsg("No payment reference found.");
      setLoading(false);
      return;
    }

    // In-memory guard only: prevents the same component instance from firing twice
    // (React 18 StrictMode double-invocation in development).
    if (processingRef.current) return;
    processingRef.current = true;

    const process = async () => {
      try {
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
          } catch { /* ignore read errors */ }
          throw new Error(serverMessage);
        }

        if (data?.receiptData) {
          setReceiptData(data.receiptData);
          return;
        }

        throw new Error(data?.error || "Unable to load payment receipt");
      } catch (err: any) {
        console.error("Payment callback error:", err);
        const msg = err?.message || "Failed to verify payment";
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    };

    process();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionRef]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-kolekto" />
        <p className="text-sm text-gray-500">Verifying your payment...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-3 px-4 text-center">
        <p className="text-red-500 font-medium">{errorMsg}</p>
        <p className="text-sm text-gray-500">
          If you were charged, please contact support with reference:{" "}
          <strong>{transactionRef}</strong>
        </p>
      </div>
    );
  }

  if (!receiptData) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Unable to load receipt.
      </div>
    );
  }

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
    />
  );
};

export default PaymentCallback;
