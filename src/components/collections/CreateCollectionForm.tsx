import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/store/useCollectionStore';
import BasicInfoSection from './form/BasicInfoSection';
import PricingSection from './form/PricingSection';
import ContributorLimitSection from './form/ContributorLimitSection';
import UniqueCodesSection from './form/UniqueCodesSection';
import ContributorFieldsSection from './form/ContributorFieldsSection';
import { FormField, PriceTier } from '@/types';
import { useAuthStore } from '@/store';

interface CreateCollectionFormProps {
  onPreview?: (data: any) => void;
}

const CreateCollectionForm: React.FC<CreateCollectionFormProps> = ({ onPreview }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxContributors, setMaxContributors] = useState('');
  const [isMaxContributorsEnabled, setIsMaxContributorsEnabled] = useState(false);
  const [generateUniqueCodes, setGenerateUniqueCodes] = useState(false);
  const [codePrefix, setCodePrefix] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([
    { id: '1', name: '', type: 'text', required: false },
  ]);

  const [usePriceTiers, setUsePriceTiers] = useState(false);
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([
    { id: '1', name: 'Regular', price: '0', description: '', quantity: '' }
  ]);

  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { createCollection } = useCollectionStore();

  const [isLoading, setIsLoading] = useState(false);

  const [feeBearer, setFeeBearer] = useState<'organizer' | 'contributor'>('organizer');
  const [kolektoFee, setKolektoFee] = useState(0);
  const [paymentGatewayFee, setPaymentGatewayFee] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);

  // ------------------ Fee Calculation ------------------
  useEffect(() => {
    if (amount && !usePriceTiers) {
      const parsedAmount = parseFloat(amount);
      if (!isNaN(parsedAmount)) {
        let kolektoFeePercentage;
        if (parsedAmount < 1000) {
          kolektoFeePercentage = 0.03;
        } else if (parsedAmount < 5000) {
          kolektoFeePercentage = 0.025;
        } else if (parsedAmount < 20000) {
          kolektoFeePercentage = 0.02;
        } else {
          kolektoFeePercentage = 0.015;
        }

        let gatewayFee = parsedAmount * 0.015;
        gatewayFee = Math.min(gatewayFee, 2000);

        const platformFee = parsedAmount * kolektoFeePercentage;

        setKolektoFee(platformFee);
        setPaymentGatewayFee(gatewayFee);
        setTotalFees(platformFee + gatewayFee);

        if (feeBearer === 'contributor') {
          setTotalPayable(parsedAmount + platformFee + gatewayFee);
        } else {
          setTotalPayable(parsedAmount);
        }
      }
    } else {
      setKolektoFee(0);
      setPaymentGatewayFee(0);
      setTotalFees(0);
      setTotalPayable(0);
    }
  }, [amount, feeBearer, usePriceTiers]);

  // ------------------ Preview ------------------
  const handlePreview = () => {
    if (onPreview) {
      const previewData = {
        title,
        description,
        amount: usePriceTiers ? 0 : (amount ? parseFloat(amount) : 0),
        deadline,
        formFields,
        maxContributors: isMaxContributorsEnabled ? parseInt(maxContributors) : null,
        generateUniqueCodes,
        codePrefix,
        usePriceTiers,
        priceTiers: usePriceTiers ? priceTiers : [],
        feeBearer
      };
      onPreview(previewData);
    }
  };

  // ------------------ Submit ------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!user) {
      toast.error("You must be logged in to create a collection.");
      setIsLoading(false);
      return;
    }

    // Validate price tiers if enabled
    if (usePriceTiers) {
      const invalidTiers = priceTiers.filter(tier =>
        !tier.name.trim() || parseFloat(tier.price) <= 0
      );
      if (invalidTiers.length > 0) {
        toast.error("Each price tier must have a name and a valid price greater than zero");
        setIsLoading(false);
        return;
      }
    } else if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount greater than zero");
      setIsLoading(false);
      return;
    }

    const deadlineDate = deadline ? new Date(deadline) : null;
    const maxContributorsValue = isMaxContributorsEnabled ? parseInt(maxContributors) : null;

    try {
      // Validate option-type fields
      const invalidFields = formFields.filter(field =>
        (field.type === 'select' || field.type === 'radio') &&
        (!field.options || field.options.length < 2 || field.options.some(opt => !opt.trim()))
      );

      if (invalidFields.length > 0) {
        const fieldNames = invalidFields.map(f => f.name || 'Unnamed field').join(', ');
        toast.error(`Please add at least 2 non-empty options for: ${fieldNames}`);
        setIsLoading(false);
        return;
      }

      // Convert price tiers to proper format
      const formattedPriceTiers = usePriceTiers
        ? priceTiers.map(tier => ({
          ...tier,
          price: parseFloat(tier.price),
          quantity: tier.quantity ? parseInt(tier.quantity) : null
        }))
        : [];

      const collectionData = {
        organizer_id: user.id,
        title,
        description: description || null,
        amount: usePriceTiers ? 0 : parseFloat(amount),
        max_participants: maxContributorsValue,
        deadline: deadlineDate ? deadlineDate.toISOString() : null,
        form_fields: formFields,
        pricing_tiers: formattedPriceTiers,
        fee_bearer: feeBearer,
        status: "active" as const
      };

      const data = await createCollection(collectionData);
      console.log(collectionData, 'collection data');


      toast.success("Collection created successfully!");
      console.log("Collection created:", data);

      navigate('/dashboard/collections');
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    }

    setIsLoading(false);
  };

  // ------------------ Fee % Label ------------------
  const getKolektoFeePercentage = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount === 0) return "3.0%";

    if (parsedAmount < 1000) return "3.0%";
    if (parsedAmount < 5000) return "2.5%";
    if (parsedAmount < 20000) return "2.0%";
    return "1.5%";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto px-4 sm:px-0">
      <BasicInfoSection
        title={title}
        setTitle={setTitle}
        description={description}
        setDescription={setDescription}
        deadline={deadline}
        setDeadline={setDeadline}
      />

      <PricingSection
        usePriceTiers={usePriceTiers}
        setUsePriceTiers={setUsePriceTiers}
        amount={amount}
        setAmount={setAmount}
        priceTiers={priceTiers}
        setPriceTiers={setPriceTiers}
        feeBearer={feeBearer}
        setFeeBearer={setFeeBearer}
        kolektoFee={kolektoFee}
        paymentGatewayFee={paymentGatewayFee}
        totalFees={totalFees}
        totalPayable={totalPayable}
        getKolektoFeePercentage={getKolektoFeePercentage}
      />

      <ContributorLimitSection
        priceTiers={priceTiers}
        isMaxContributorsEnabled={isMaxContributorsEnabled}
        setIsMaxContributorsEnabled={setIsMaxContributorsEnabled}
        maxContributors={maxContributors}
        setMaxContributors={setMaxContributors}
      />

      <UniqueCodesSection
        generateUniqueCodes={generateUniqueCodes}
        setGenerateUniqueCodes={setGenerateUniqueCodes}
        codePrefix={codePrefix}
        setCodePrefix={setCodePrefix}
      />

      <ContributorFieldsSection
        formFields={formFields}
        setFormFields={setFormFields}
      />

      <div className="border-t pt-6 flex gap-4">
        <Button
          type="submit"
          className="flex-1 bg-kolekto hover:bg-kolekto/90"
          disabled={isLoading}
        >
          {isLoading ? "Creating Collection..." : "Create Collection"}
        </Button>

        {onPreview && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handlePreview}
          >
            Preview
          </Button>
        )}
      </div>
    </form>
  );
};

export default CreateCollectionForm;