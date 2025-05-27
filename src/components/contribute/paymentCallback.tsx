import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentSuccessful from './PaymentSuccessful'
import axios from "axios";
import { axiosInstance } from "@/utils/axios";
import { set } from "date-fns";

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const transactionRef = searchParams.get("reference");
    const [receiptData, setReceiptData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(true); // Control dialog open state
    // After redirect from Paystack

    useEffect(() => {
        setLoading(true);

        if (transactionRef) {
            axiosInstance.get(`/payments/verify?reference=${transactionRef}`)
                .then((res) => {
                    console.log(res.data, "receiptData res");

                    setReceiptData(res.data.receiptData)
                    setLoading(false);
                })
                .catch(() => setReceiptData(null));
        }
    }, [transactionRef]);
    console.log(receiptData, "receiptData");

    // if (error) return <div className="text-red-500">{error}</div>;
    // if (!receiptData) return <div>Loading...</div>;

    // if (!receiptData) return <div>Loading...</div>;

    // Pass receiptData to your PaymentSuccessful component
    console.log("Transaction Reference:", transactionRef);

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
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