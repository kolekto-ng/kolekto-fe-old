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
  // Step state

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Form state

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

  // For fixed price quantity when not using price tiers

  const [fixedPriceQuantity, setFixedPriceQuantity] = useState('');

  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { createCollection } = useCollectionStore();

  const [isLoading, setIsLoading] = useState(false);

  const [feeBearer, setFeeBearer] = useState<'organizer' | 'contributor'>('organizer');
  const [kolektoFee, setKolektoFee] = useState(0);
  const [paymentGatewayFee, setPaymentGatewayFee] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);

  // This function calculates fees for a given price tier
  // It returns an object with detailed fee breakdown

  const calculateTierFees = (price: number) => {
    if (isNaN(price) || price <= 0) {
      return {
        kolektoFee: 0,
        paymentGatewayFee: 0,
        totalFees: 0,
        totalPayable: price,
        kolektoFeePercentage: "3.0%"
      };
    }

    let kolektoFeePercentage;
    if (price < 1000) {
      kolektoFeePercentage = 0.03;
    } else if (price < 5000) {
      kolektoFeePercentage = 0.025;
    } else if (price < 20000) {
      kolektoFeePercentage = 0.02;
    } else {
      kolektoFeePercentage = 0.015;
    }

    let gatewayFee = price * 0.015;
    gatewayFee = Math.min(gatewayFee, 2000);

    const platformFee = price * kolektoFeePercentage;
    const totalFees = platformFee + gatewayFee;

    const totalPayable = feeBearer === 'contributor' ? price + totalFees : price;

    const percentageString = `${(kolektoFeePercentage * 100).toFixed(1)}%`;

    return {
      kolektoFee: platformFee,
      paymentGatewayFee: gatewayFee,
      totalFees,
      totalPayable,
      kolektoFeePercentage: percentageString
    };
  };

  // This effect recalculates fees whenever amount, feeBearer, or usePriceTiers changes

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

  const getKolektoFeePercentage = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount === 0) return "3.0%";

    if (parsedAmount < 1000) return "3.0%";
    if (parsedAmount < 5000) return "2.5%";
    if (parsedAmount < 20000) return "2.0%";
    return "1.5%";
  };

  // Handles validation for each step

  const validateStep1 = () => {

    if (!title.trim() && deadline.trim() === '') {
      toast.error("Please enter a collection title and deadline");
      return false;
    }
    if (!title.trim()) {
      toast.error("Please enter a collection title");
      return false;
    }
    if (Date.now() > new Date(deadline).getTime() || deadline.trim() === '') {
      toast.error("Please enter a valid collection deadline");
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (usePriceTiers) {
      const invalidTiers = priceTiers.filter(tier =>
        !tier.name.trim() || parseFloat(tier.price) <= 0
      );
      if (invalidTiers.length > 0) {
        toast.error("Each price tier must have a name and a valid price greater than zero");
        return false;
      }
    } else if (!amount || parseFloat(amount) <= 100) {
      toast.error("Please enter a valid amount greater than 100");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    return true;
  };

  // Handles navigation between steps

  const nextStep = () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        break;
      default:
        isValid = true;
    }

    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // This handles the step indicators

  const StepIndicator = () => (
    <div className="flex justify-center items-center mb-8 px-4">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 ${step === currentStep
              ? 'bg-green-600 text-white border-green-600'
              : step < currentStep
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-500 border-gray-300'
              }`}
          >
            {step}
          </div>
          {step < 3 && (
            <div
              className={`w-16 h-0.5 mx-2 ${step < currentStep ? 'bg-green-600' : 'bg-gray-300'
                }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const StepTitles = () => {
    const titles = [
      'Basic Information',
      'Amount & Payment',
      'Contributor Details'
    ];

    return (
      <div className="flex justify-center items-center mb-6">
        {titles.map((title, index) => (
          <div key={index} className="flex items-center">
            <div className={`text-sm ${index + 1 === currentStep ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
              {title}
            </div>
            {index < titles.length - 1 && (
              <div className="w-8 h-0.5 mx-4 bg-gray-300" />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Handles form submission

  const handleSubmit = async () => {
    setIsLoading(true);

    if (!user) {
      toast.error("You must be logged in to create a collection.");
      setIsLoading(false);
      return;
    }

    try {
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

      const deadlineDate = deadline ? new Date(deadline) : null;
      const maxContributorsValue = isMaxContributorsEnabled ? parseInt(maxContributors) : null;

      // This handles formatting of price tiers when using price tiers

      const formattedPriceTiers = usePriceTiers
        ? priceTiers.map(tier => ({
          ...tier,
          price: parseFloat(tier.price),
          quantity: tier.quantity ? parseInt(tier.quantity) : null
        }))
        : [];

      // This handles fixed price tier when not using price tiers

      const fixedPriceTier = !usePriceTiers && amount ? [{
        id: '1',
        name: 'Standard',
        price: parseFloat(amount),
        description: '',
        quantity: fixedPriceQuantity ? parseInt(fixedPriceQuantity) : null
      }] : [];

      const collectionData = {
        organizer_id: user.id,
        title,
        description: description || null,
        amount: usePriceTiers ? 0 : parseFloat(amount),
        max_participants: maxContributorsValue,
        deadline: deadlineDate ? deadlineDate.toISOString() : null,
        contributions_fields: formFields,
        price_tiers: usePriceTiers ? formattedPriceTiers : fixedPriceTier,
        fixed_price_quantity: !usePriceTiers && fixedPriceQuantity ? parseInt(fixedPriceQuantity) : null,
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

  // This handles rendering of each step's content

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic Information</h2>
              <p className="text-gray-600">Let's start with the basics of your collection</p>
            </div>
            <BasicInfoSection
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              deadline={deadline}
              setDeadline={setDeadline}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Amount & Payment</h2>
              <p className="text-gray-600">Configure fees, choose collection type, and set pricing</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Fee Configuration</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Who pays the platform fees?
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      id="organizer-pays"
                      type="radio"
                      name="fee-bearer"
                      value="organizer"
                      checked={feeBearer === 'organizer'}
                      onChange={(e) => setFeeBearer(e.target.value as 'organizer' | 'contributor')}
                      className="h-4 w-4 border-gray-300"
                    />
                    <label htmlFor="organizer-pays" className="ml-3 block text-sm text-gray-700">
                      <span className="font-medium">Organizer pays</span>
                      <span className="text-gray-500 block">Fees are deducted from the collection amount</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="contributor-pays"
                      type="radio"
                      name="fee-bearer"
                      value="contributor"
                      checked={feeBearer === 'contributor'}
                      onChange={(e) => setFeeBearer(e.target.value as 'organizer' | 'contributor')}
                      className="h-4 w-4 border-gray-300"
                    />
                    <label htmlFor="contributor-pays" className="ml-3 block text-sm text-gray-700">
                      <span className="font-medium">Contributors pay</span>
                      <span className="text-gray-500 block">Fees are added to the collection amount</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Fee Structure Information */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-sm">
                  <p className="font-medium text-gray-900 mb-3">Fee Structure:</p>
                  <ul className="list-disc pl-5 text-gray-600 space-y-1">
                    <li>₦0 – ₦999: 3.0% fee</li>
                    <li>₦1,000 – ₦4,999: 2.5% fee</li>
                    <li>₦5,000 – ₦19,999: 2.0% fee</li>
                    <li>₦20,000 and above: 1.5% fee</li>
                    <li>Gateway fee: 1.5% (capped at ₦2,000)</li>
                  </ul>
                </div>
              </div>
            </div>
            {/* Handles Colection Types */}

            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900">Collection Type</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${!usePriceTiers ? 'border-green-600 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  onClick={() => setUsePriceTiers(false)}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={!usePriceTiers}
                      onChange={() => setUsePriceTiers(false)}
                      className="mr-3"
                    />
                    <div>
                      <h4 className="font-medium">Fixed Contribution</h4>
                      <p className="text-sm text-gray-600">Single price for all contributors</p>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${usePriceTiers ? 'border-green-600 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  onClick={() => setUsePriceTiers(true)}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={usePriceTiers}
                      onChange={() => setUsePriceTiers(true)}
                      className="mr-3"
                    />
                    <div>
                      <h4 className="font-medium">Tiered Contribution</h4>
                      <p className="text-sm text-gray-600">Multiple pricing options</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Handles Pricing Section */}

            <div className="space-y-4">
              {!usePriceTiers ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount (₦) *
                      </label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Enter amount"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Number of Contributors (Optional)
                      </label>
                      <input
                        type="number"
                        value={fixedPriceQuantity}
                        onChange={(e) => setFixedPriceQuantity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Unlimited"
                        min="1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty for unlimited contributors
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Price Tiers</h3>
                  {priceTiers.map((tier, index) => (
                    <div key={tier.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-medium text-gray-900">Tier {index + 1}</h4>
                        {priceTiers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updatedTiers = priceTiers.filter((_, i) => i !== index);
                              setPriceTiers(updatedTiers);
                            }}
                            className="text-amber-600 hover:text-red-600 p-1"
                            title="Remove Tier"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tier Name
                          </label>
                          <input
                            type="text"
                            value={tier.name}
                            onChange={(e) => {
                              const updatedTiers = [...priceTiers];
                              updatedTiers[index] = { ...tier, name: e.target.value };
                              setPriceTiers(updatedTiers);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="e.g., Regular, VIP, etc."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price (₦)
                          </label>
                          <input
                            type="number"
                            value={tier.price}
                            onChange={(e) => {
                              const updatedTiers = [...priceTiers];
                              updatedTiers[index] = { ...tier, price: e.target.value };
                              setPriceTiers(updatedTiers);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          value={tier.description}
                          onChange={(e) => {
                            const updatedTiers = [...priceTiers];
                            updatedTiers[index] = { ...tier, description: e.target.value };
                            setPriceTiers(updatedTiers);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          rows={2}
                          placeholder="Brief description of this tier"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Number Of Contributor (Optional)
                        </label>
                        <input
                          type="number"
                          value={tier.quantity}
                          onChange={(e) => {
                            const updatedTiers = [...priceTiers];
                            updatedTiers[index] = { ...tier, quantity: e.target.value };
                            setPriceTiers(updatedTiers);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Leave blank for unlimited"
                          min="1"
                        />
                      </div>

                      {/* This Handles the Inline Fee Breakdown for each price tier */}

                      {tier.price && parseFloat(tier.price) > 0 && !isNaN(parseFloat(tier.price)) && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h5 className="font-medium text-blue-800 mb-3 text-center bg-blue-100 py-2 rounded">
                            Fee Breakdown for this tier
                          </h5>
                          {(() => {
                            const price = parseFloat(tier.price);
                            const fees = calculateTierFees(price);

                            return (
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-700">Base Price:</span>
                                  <span className="font-medium">₦{price.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-700">Kolekto Fee ({fees.kolektoFeePercentage}):</span>
                                  <span className="font-medium">₦{Math.round(fees.kolektoFee)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-700">Gateway Fee (1.5%):</span>
                                  <span className="font-medium">₦{Math.round(fees.paymentGatewayFee)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                  <span className="text-gray-700 font-medium">Total Fees:</span>
                                  <span className="font-medium">₦{Math.round(fees.totalFees)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-blue-700 font-medium">Amount Payable:</span>
                                  <span className="font-medium text-blue-700">
                                    ₦{feeBearer === 'contributor'
                                      ? Math.round(fees.totalPayable)
                                      : price
                                    }
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-green-700 font-medium">You'll Receive:</span>
                                  <span className="font-medium text-green-700">
                                    ₦{feeBearer === 'contributor'
                                      ? price
                                      : Math.round(price - fees.kolektoFee - fees.paymentGatewayFee)
                                    }
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      const newTier: PriceTier = {
                        id: Date.now().toString(),
                        name: '',
                        price: '0',
                        description: '',
                        quantity: ''
                      };
                      setPriceTiers([...priceTiers, newTier]);
                    }}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-500 hover:text-green-600 transition-colors"
                  >
                    + Add Another Tier
                  </button>
                </div>
              )}
            </div>

            {/* This Handles the Fee Breakdown for fixed amount collections */}

            {!usePriceTiers && amount && (
              <div className="bg-blue-100 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Fee Breakdown</h4>

                <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-200 pt-3">
                  <div>Base Amount:</div>
                  <div className="text-right font-medium">₦{parseFloat(amount).toLocaleString()}</div>

                  <div>Kolekto Fee ({getKolektoFeePercentage()}):</div>
                  <div className="text-right">₦{kolektoFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                  <div>Payment Gateway (1.5%):</div>
                  <div className="text-right">₦{paymentGatewayFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                  <div className="border-t border-gray-200 pt-1 font-medium">Total Fees:</div>
                  <div className="border-t border-gray-200 pt-1 text-right font-medium">₦{totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                  {feeBearer && (
                    <>
                      <div className="pt-3 font-bold">Amount Payable (by contributor):</div>
                      <div className="pt-3 text-right font-bold">₦{totalPayable.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                      <div className="pt-3 font-bold">Amount collection would receive:</div>
                      <div className="pt-3 text-right font-bold">₦{(feeBearer === 'organizer' ? parseFloat(amount) - totalFees : parseFloat(amount)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </>
                  )}

                  {/* Handles quantity in fixed fees breakdown */}
                  {fixedPriceQuantity && parseInt(fixedPriceQuantity) > 0 && (
                    <>
                      <div className="border-t border-gray-200 pt-2 text-blue-700 font-medium">Available Slots:</div>
                      <div className="border-t border-gray-200 pt-2 text-right text-blue-700 font-medium">{parseInt(fixedPriceQuantity).toLocaleString()}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            <ContributorLimitSection
              priceTiers={priceTiers}
              isMaxContributorsEnabled={isMaxContributorsEnabled}
              setIsMaxContributorsEnabled={setIsMaxContributorsEnabled}
              maxContributors={maxContributors}
              setMaxContributors={setMaxContributors}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Contributor Details</h2>
              <p className="text-gray-600">Define what information you want to collect and configure unique codes</p>
            </div>
            <ContributorFieldsSection
              formFields={formFields}
              setFormFields={setFormFields}
            />

            <UniqueCodesSection
              generateUniqueCodes={generateUniqueCodes}
              setGenerateUniqueCodes={setGenerateUniqueCodes}
              codePrefix={codePrefix}
              setCodePrefix={setCodePrefix}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <StepIndicator />
      <StepTitles />

      <div className="bg-white">
        {renderStepContent()}

        {/* Handles Button Navigation */}

        <div className="border-t pt-6 mt-8">
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 hover:bg-amber-400"
            >
              Previous
            </Button>

            <div className="flex gap-3">
              {onPreview && currentStep === totalSteps && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
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
                      feeBearer,
                      fixedPriceQuantity: fixedPriceQuantity ? parseInt(fixedPriceQuantity) : null
                    };
                    onPreview(previewData);
                  }}
                >
                  Preview
                </Button>
              )}

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="bg-green-600 hover:bg-green-700 px-6"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 px-6"
                >
                  {isLoading ? "Creating Collection..." : "Create Collection"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCollectionForm;