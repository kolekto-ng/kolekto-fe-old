import React, { useState } from "react";
import ContributionForm from "./ContributionForm";
import PaymentSuccessful from "./PaymentSuccessful";
import PaymentErrorHandler from "./PaymentErrorHandler";
import { toast } from "sonner";
import { format } from "path";
import Maintenance from "../Maintenance";

interface Field {
  name: string;
  type: string;
  required: boolean;
  value?: string;
}

interface PriceTier {
  name: string;
  price: number;
  description?: string;
  quantity?: number | null;
}

interface ContributionWrapperProps {
  collectionId: string;
  collectionTitle: string;
  amount: number;
  amountBreakdown: { totalPayable: number; totalFees: number };
  fields: Field[];
  description?: string;
  deadline?: string;
  max_contributions?: number;
  total_contributions?: number;
  priceTiers?: PriceTier[];
  fee_bearer?: '',
  wallet?: [],
  collection?: any; // Add this line to accept the entire collection object
}

const ContributionWrapper: React.FC<ContributionWrapperProps> = ({
  collectionId,
  collectionTitle,
  amount,
  amountBreakdown,
  fields,
  description,
  deadline,
  max_contributions,
  total_contributions,
  priceTiers,
  fee_bearer,
  wallet,
  collection
}) => {
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [participantDetails, setParticipantDetails] = useState<any[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [transactionRef, setTransactionRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(true);

  const isExpired = deadline ? new Date(deadline) < new Date() : false;

  const handlePaymentSuccess = (data: any) => {
    // Handle both old and new data formats
    if (data.participants) {
      // New format from second version
      const formattedParticipants = data.participants.map(
        (participant: any, index: number) => {
          return {
            id: `participant-${index + 1}`,
            details: Object.entries(participant.data).map(([key, value]) => ({
              label: key,
              value: value as string,
            })),
            uniqueCode: `${data.collectionId}-${Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase()}`,
          };
        }
      );
      setParticipantDetails(formattedParticipants);
      setAmountPaid(data.totalAmount);
      setTransactionRef(data.transactionRef || "");
    } else {
      // Old format from first version
      const processedParticipants = [{
        id: '1',
        details: Object.entries(data.formData || {}).map(([key, value]) => ({
          label: key,
          value: value as string
        })),
        uniqueCode: data.referenceCode || 'N/A'
      }];
      setParticipantDetails(processedParticipants);
      setAmountPaid(data.amount || amount);
      setTransactionRef(data.referenceCode || "");
    }

    setPaymentData(data);
    setPaymentStatus('success');
  };

  const handlePaymentError = (errorMsg: string) => {
    setError(errorMsg);
    setPaymentStatus('error');
    setTimeout(() => {
      setError(null);
    }, 10000);
  };

  const handleRetryPayment = () => {
    setPaymentStatus('pending');
    setError(null);
  };

  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open);
    // If modal is closed and status is success or error, reset to pending
    if (!open && (paymentStatus === 'success' || paymentStatus === 'error')) {
      setPaymentStatus('pending');
    }
  };

  // Create collection object from props for backward compatibility
  // const collection = {
  //   id: collectionId,
  //   title: collectionTitle,
  //   amount: amount,
  //   description: description,
  //   deadline: deadline
  // };

  // Uncomment to enable maintenance mode
  // return (
  //   <div className="max-w-3xl mx-auto p-4">
  //     <Maintenance />
  //   </div>
  // );

  console.log(total_contributions)

  if (max_contributions === total_contributions) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold mb-2">Collection Full</h2>
        <p className="text-gray-600">
          This collection has reached its maximum number of contributions and is no longer accepting new contributions.
        </p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold mb-2">Collection Expired</h2>
        <p className="text-gray-600">
          The deadline for this collection has passed and it is no longer
          accepting contributions.
        </p>
      </div>
    );
  }

  return (
    <div>
      {paymentStatus === 'error' && (
        <PaymentErrorHandler
          error={error || 'An error occurred during payment processing.'}
          onRetry={handleRetryPayment}
        />
      )}

      {paymentStatus === 'pending' && (
        <ContributionForm
          // Support both old and new prop formats
          collection={collection}
          collectionId={collectionId}
          collectionTitle={collectionTitle}
          amount={amount}
          amountBreakdown={amountBreakdown}
          formFields={fields}
          fields={fields}
          description={description}
          max_contributions={max_contributions}
          total_contributions={total_contributions}
          pricingTiers={priceTiers}
          fee_bearer={fee_bearer}
          wallet={wallet}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
        />
      )}

      {paymentStatus === 'success' && (
        <PaymentSuccessful
          open={isModalOpen}
          onOpenChange={handleModalChange}
          collectionTitle={collectionTitle}
          amountPaid={amountPaid}
          participants={participantDetails}
          transactionRef={transactionRef}
        />
      )}
    </div>
  );
};

export default ContributionWrapper;