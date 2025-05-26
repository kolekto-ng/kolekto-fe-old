import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PaymentSuccessful from './PaymentSuccessful'
import axios from "axios";

const dummyParticipants = [
    {
        id: "1",
        uniqueCode: "ABC123",
        details: [
            { label: "Full Name", value: "Jane Doe" },
            { label: "Email", value: "jane@example.com" },
            { label: "Phone", value: "+2348012345678" },
        ],
    }
];

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const transactionRef = searchParams.get("reference");
    const [receiptData, setReceiptData] = useState(null);
    const [open, setOpen] = useState(true); // Control dialog open state
    // useEffect(() => {
    //     if (transactionRef) {
    //         axios
    //             .get(`/api/payment/receipt?reference=${transactionRef}`)
    //             .then((res) => setReceiptData(res.data))
    //             .catch(() => setReceiptData(null));
    //     }
    // }, [transactionRef]);

    // if (error) return <div className="text-red-500">{error}</div>;
    // if (!receiptData) return <div>Loading...</div>;

    // if (!receiptData) return <div>Loading...</div>;

    // Pass receiptData to your PaymentSuccessful component
    console.log("Transaction Reference:", transactionRef);

    return (
        <PaymentSuccessful
            // open={true}
            // onOpenChange={() => { }}
            // collectionTitle={receiptData.collectionTitle}
            // amountPaid={receiptData.amountPaid}
            // participants={receiptData.participants}
            transactionRef={transactionRef}

            open={open}
            onOpenChange={setOpen}
            collectionTitle="Handout"
            amountPaid={5000}
            participants={dummyParticipants}
        />
    );
};

export default PaymentCallback;