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

  // Guard against React 18 StrictMode double-invocation AND component remounts.
  // We use sessionStorage so the lock survives remounts within the same browser tab.
  // Without this, verify fires twice simultaneously — the second call passes the
  // idempotency check before the first insert completes, doubling contributions.
  const processingRef = React.useRef(false);

  useEffect(() => {
    if (!transactionRef) {
      setErrorMsg("No payment reference found.");
      setLoading(false);
      return;
    }

    // In-memory guard: catches React StrictMode's same-instance double-fire
    if (processingRef.current) return;

    // Session-level guard: catches remounts within the same tab session.
    // Key includes the reference so different payments are not blocked.
    const lockKey = `kolekto-verify-lock-${transactionRef}`;
    if (sessionStorage.getItem(lockKey)) {
      // Already processed — pull existing receipt from localStorage if present
      setLoading(false);
      return;
    }
    sessionStorage.setItem(lockKey, "1");
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
          localStorage.removeItem("kolekto-pending-contribution");
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
