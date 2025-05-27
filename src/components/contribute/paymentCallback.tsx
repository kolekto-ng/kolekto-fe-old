import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentSuccessful from './PaymentSuccessful'
import { axiosInstance } from "@/utils/axios";
import { Loader2 } from "lucide-react";

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const transactionRef = searchParams.get("reference");
    const [receiptData, setReceiptData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(true);

    useEffect(() => {
        setLoading(true);

        if (transactionRef) {
            axiosInstance.get(`/payments/verify?reference=${transactionRef}`)
                .then((res) => {
                    setReceiptData(res.data.receiptData);
                })
                .catch(() => setReceiptData(null))
                .finally(() => setLoading(false)); // Always set loading to false
        } else {
            setLoading(false);
        }
    }, [transactionRef]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-kolekto" />
            </div>
        );
    }

    // Optionally handle error state if receiptData is null
    if (!receiptData) {
        return (
            <div className="flex justify-center items-center h-screen text-red-500">
                Unable to verify payment or no receipt found.
            </div>
        );
    }

    return (
        <PaymentSuccessful
            open={open}
            onOpenChange={setOpen}
            collectionTitle={receiptData?.collectionTitle}
            amountPaid={receiptData?.amountPaid}
            participants={receiptData?.participants}
            transactionRef={receiptData?.transactionRef}
            status={receiptData?.status}
            paidAt={receiptData?.paidAt}
            channel={receiptData?.channel}
            currency={receiptData?.currency}
            payer={receiptData?.payer}
        />
    );
};

export default PaymentCallback;