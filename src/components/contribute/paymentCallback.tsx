import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentSuccessful from './PaymentSuccessful'
import axios from "axios";
import { axiosInstance } from "@/utils/axios";

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const transactionRef = searchParams.get("reference");
    const [receiptData, setReceiptData] = useState({
        "collectionTitle": "Handout",
        "amountPaid": 30899.98,
        "participants": [
            {
                "id": "1",
                "uniqueCode": "ABC123",
                "details": [
                    { "label": "Full Name", "value": "Jane Doe" },
                    { "label": "Email", "value": "jane@example.com" },
                    { "label": "Phone", "value": "+2348012345678" }
                ]
            },
            {
                "id": "2",
                "uniqueCode": "XYZ789",
                "details": [
                    { "label": "Full Name", "value": "John Smith" },
                    { "label": "Email", "value": "john@example.com" },
                    { "label": "Phone", "value": "+2348098765432" }
                ]
            }
        ],
        "transactionRef": "6gnxahinyd",
        "status": "success",
        "paidAt": "2025-05-27T08:21:23+00:00",
        "channel": "card",
        "currency": "NGN",
        "payer": {
            "name": "Mohammed Abdullahi",
            "email": "moh.abdullahi2003@gmail.com",
            "phone": "08025275911"
        }
    });
    const [open, setOpen] = useState(true); // Control dialog open state
    // After redirect from Paystack

    useEffect(() => {
        if (transactionRef) {
            axiosInstance.get(`/payments/verify?reference=${transactionRef}`)
                .then((res) => {
                    console.log(res.data, "receiptData res");

                    setReceiptData(res.data.receiptData)
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