import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PaymentSuccessful from "./PaymentSuccessful";
import { Loader2 } from "lucide-react";

const PENDING_KEY = "kolekto-pending-contribution";

function generateUniqueCode(prefix?: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return prefix ? `${prefix}-${code}` : code;
}

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const transactionRef = searchParams.get("reference") || searchParams.get("trxref");

  const [receiptData, setReceiptData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!transactionRef) {
      setErrorMsg("No payment reference found.");
      setLoading(false);
      return;
    }

    const process = async () => {
      try {
        // 1. Verify payment via Edge Function
        const { data: verifyRes, error: verifyErr } = await supabase.functions.invoke(
          "verify-paystack-payment",
          { body: { reference: transactionRef } }
        );

        if (verifyErr) throw new Error(verifyErr.message || "Payment verification failed");

        const paymentStatus: string = verifyRes?.data?.status || verifyRes?.status || "unknown";
        const paystackData = verifyRes?.data || verifyRes || {};
        const verifiedContributions = Array.isArray(paystackData.contributions)
          ? paystackData.contributions
          : Array.isArray(verifyRes?.contributions)
            ? verifyRes.contributions
            : [];

        if (paymentStatus !== "success" && paymentStatus !== "paid") {
          throw new Error(`Payment not successful (status: ${paymentStatus})`);
        }

        // 2. Read pending contribution from localStorage
        const pendingRaw = localStorage.getItem(PENDING_KEY);
        if (!pendingRaw) {
          // Payment succeeded but no pending data — show minimal receipt
          setReceiptData({
            collectionTitle: "Your Collection",
            amountPaid: (paystackData.amount || 0) / 100,
            participants: [],
            transactionRef,
            status: "success",
            paidAt: paystackData.paid_at || new Date().toISOString(),
            channel: paystackData.channel || "card",
            currency: paystackData.currency || "NGN",
            payer: paystackData.customer
              ? { name: paystackData.customer.first_name || "", email: paystackData.customer.email, phone: paystackData.customer.phone || "" }
              : undefined,
          });
          setLoading(false);
          return;
        }

        const pending = JSON.parse(pendingRaw);
        const { collectionTitle, contact, formData, selectedTier, amount, quantity, isAnonymous, codePrefix } = pending;

        // 3. Clear pending data after verification succeeds
        localStorage.removeItem(PENDING_KEY);

        // 4. Build receipt participants array from authoritative verification output
        const participants = (verifiedContributions.length > 0
          ? verifiedContributions
          : Array.from({ length: quantity || 1 }, (_, idx) => ({
              id: `fallback-${idx + 1}`,
              name: isAnonymous ? "Anonymous" : contact.name,
              amount: amount / Math.max(1, quantity || 1),
              uniqueCode: generateUniqueCode(codePrefix),
            }))
        ).map((participant: any, idx: number) => ({
          id: participant.id || `p-${idx + 1}`,
          details: [
            { label: "Name", value: participant.name || (isAnonymous ? "Anonymous" : contact.name) },
            ...Object.entries(formData || {}).map(([key, val]) => ({ label: key, value: String(val) })),
            ...(selectedTier ? [{ label: "Tier", value: selectedTier }] : []),
          ],
          uniqueCode: participant.uniqueCode || "",
        }));

        setReceiptData({
          collectionTitle: collectionTitle || "Collection",
          amountPaid: amount,
          participants,
          transactionRef,
          status: "success",
          paidAt: paystackData.paidAt || paystackData.paid_at || new Date().toISOString(),
          channel: paystackData.channel || "card",
          currency: paystackData.currency || "NGN",
          payer: { name: isAnonymous ? "Anonymous" : contact.name, email: contact.email, phone: contact.phone || "" },
        });
      } catch (err: any) {
        console.error("Payment callback error:", err);
        setErrorMsg(err.message || "Failed to verify payment");
      } finally {
        setLoading(false);
      }
    };

    process();
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
          If you were charged, please contact support with reference: <strong>{transactionRef}</strong>
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
      amountPaid={receiptData.amountPaid}
      participants={receiptData.participants}
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
