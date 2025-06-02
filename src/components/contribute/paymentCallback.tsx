import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentSuccessful from './PaymentSuccessful'
import { axiosInstance } from "@/utils/axios";
import { Loader2 } from "lucide-react";

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const transactionRef = searchParams.get("reference");
    const [receiptData, setReceiptData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(true);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let isMounted = true;
        if (!transactionRef) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const verify = () => {
            axiosInstance.get(`/payments/verify?reference=${transactionRef}`)
                .then((res) => {
                    if (isMounted && res.data.receiptData) {
                        setReceiptData(res.data.receiptData);
                        setLoading(false);
                    } else if (isMounted && retryCount < MAX_RETRIES) {
                        setTimeout(() => setRetryCount(c => c + 1), RETRY_DELAY);
                    } else if (isMounted) {
                        setLoading(false);
                    }
                })
                .catch(() => {
                    if (isMounted && retryCount < MAX_RETRIES) {
                        setTimeout(() => setRetryCount(c => c + 1), RETRY_DELAY);
                    } else if (isMounted) {
                        setLoading(false);
                    }
                });
        };

        verify();

        return () => { isMounted = false; };
        // eslint-disable-next-line
    }, [transactionRef, retryCount]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-kolekto" />
            </div>
        );
    }

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