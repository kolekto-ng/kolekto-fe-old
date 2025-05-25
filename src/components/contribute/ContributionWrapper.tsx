
import React, { useState } from 'react';
import ContributionForm from './ContributionForm';
import PaymentSuccessful from './PaymentSuccessful';
import PaymentErrorHandler from './PaymentErrorHandler';

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
  fields: any[];
  description?: string;
  deadline?: string;
  priceTiers?: PriceTier[];
}

const ContributionWrapper: React.FC<ContributionWrapperProps> = ({
  collectionId,
  collectionTitle,
  amount,
  fields,
  description,
  deadline,
  priceTiers
}) => {
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(true);

  const handlePaymentSuccess = (data: any) => {
    setPaymentData(data);
    setPaymentStatus('success');
  };

  const handlePaymentError = (errorMsg: string) => {
    setErrorMessage(errorMsg);
    setPaymentStatus('error');
  };

  const handleRetryPayment = () => {
    setPaymentStatus('pending');
    setErrorMessage(null);
  };

  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open);
    // If modal is closed and status is success or error, reset to pending
    if (!open && (paymentStatus === 'success' || paymentStatus === 'error')) {
      setPaymentStatus('pending');
    }
  };

  // Process payment data for PaymentSuccessful component
  const processedParticipants = paymentData ? [{
    id: '1',
    details: Object.entries(paymentData.formData || {}).map(([key, value]) => ({
      label: key,
      value: value as string
    })),
    uniqueCode: paymentData.referenceCode || 'N/A'
  }] : [];

  // Create collection object from props
  const collection = {
    id: collectionId,
    title: collectionTitle,
    amount: amount,
    description: description,
    deadline: deadline
  };

  return (
    <div>
      {paymentStatus === 'pending' && (
        <ContributionForm
          collection={collection}
          formFields={fields}
          pricingTiers={priceTiers}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
        />
      )}

      {paymentStatus === 'success' && (
        <PaymentSuccessful
          open={isModalOpen}
          onOpenChange={handleModalChange}
          collectionTitle={collectionTitle}
          amountPaid={paymentData?.amount || amount}
          participants={processedParticipants}
          transactionRef={paymentData?.referenceCode}
        />
      )}

      {paymentStatus === 'error' && (
        <PaymentErrorHandler
          error={errorMessage || 'An error occurred during payment processing.'}
          onRetry={handleRetryPayment}
        />
      )}
    </div>
  );
};

export default ContributionWrapper;
