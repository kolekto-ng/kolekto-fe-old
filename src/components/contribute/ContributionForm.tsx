import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Check, Loader2, CreditCard, User, DollarSign } from "lucide-react";
import { usePaystackStore } from "@/store/usePaystackStore";
import { useContributionStore } from "@/store/useContributionStore";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { axiosInstance } from "@/utils/axios";
import { formatCurrency } from "@/utils/formatters";

interface PriceTier {
  name: string;
  price: number;
  description?: string;
  quantity?: number | null;
}

interface Field {
  id?: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  value?: string;
}

interface Participant {
  id: string;
  data: { [key: string]: string };
}

interface ContributionFormProps {
  // Legacy props from first version
  collection?: {
    id: string;
    title: string;
    amount: number;
    description?: string;
    deadline?: string;
  };
  formFields?: Field[];
  pricingTiers?: PriceTier[];
  onPaymentSuccess?: (data: any) => void;
  onPaymentError?: (error: string) => void;
  supportPhone?: string;
  // New props from second version
  collectionId?: string;
  collectionTitle?: string;
  amount?: number;
  amountBreakdown?: { totalPayable: number; totalFees: number; platformFee?: number; paymentGatewayFee?: number };
  fields?: Field[];
  description?: string;
  max_contributions?: number;
  total_contributions?: number;
  fee_bearer?: '',
  wallet?: [],
  collection?: any; // Accept entire collection object
}

const ContributionForm: React.FC<ContributionFormProps> = (props) => {
  // Handle both prop formats
  const collectionId = props.collectionId || props.collection?.id || '';
  const collectionTitle = props.collectionTitle || props.collection?.title || '';
  let baseAmount = props.amount || props.collection?.amount || 0;
  const description = props.description || props.collection?.description;
  const fields = props.fields || props.formFields || [];
  const pricingTiers = props.pricingTiers;
  const collectionType = props?.collection?.type
  console.log(collectionType, 'collectionType');

  const amountBreakdown = props.amountBreakdown;
  const onPaymentSuccess = props.onPaymentSuccess;
  const onPaymentError = props.onPaymentError;
  const supportPhone = props.supportPhone || props.collection?.support_phone_number || '';
  // State management
  const [step, setStep] = useState<"pricing" | "details" | "contact" | "payment">(
    pricingTiers && pricingTiers.length > 0 ? "pricing" : "details"
  );
  let [selectedAmount, setSelectedAmount] = useState(
    pricingTiers && pricingTiers.length > 0 ? pricingTiers[0].price : baseAmount
  );
  const [selectedTier, setSelectedTier] = useState(
    pricingTiers && pricingTiers.length > 0 ? pricingTiers[0].name : ''
  );
  const [numberOfParticipants, setNumberOfParticipants] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "1", data: {} },
  ]);
  const [contactInfo, setContactInfo] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("Paystack");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [verificationInterval, setVerificationInterval] = useState<NodeJS.Timeout | null>(null);
  const [fundraisingAmount, setFundraisingAmount] = useState('');
  // Store hooks
  const { initializePayment, initiatePayment, verifyPayment } = usePaystackStore();
  const { createContribution } = useContributionStore();

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (verificationInterval) {
        clearInterval(verificationInterval);
      }
    };
  }, [verificationInterval]);

  // Handle pricing tier selection
  const handleTierChange = (tierName: string) => {
    const tier = pricingTiers?.find(t => t.name === tierName);
    if (tier) {
      setSelectedTier(tierName);
      setSelectedAmount(tier.price);
      // baseAmount = tier.price
    }
  };

  // Handle participant changes
  const handleParticipantsChange = (value: string) => {
    const num = parseInt(value);
    if (isNaN(num)) return;

    setNumberOfParticipants(Math.max(1, Math.min(10, num)));

    setParticipants((prev) => {
      if (num > prev.length) {
        const newParticipants = [...prev];
        for (let i = prev.length; i < num; i++) {
          newParticipants.push({ id: (i + 1).toString(), data: {} });
        }
        return newParticipants;
      }
      return prev.slice(0, num);
    });
  };

  const handleContactInfoChange = (field: string, value: string) => {
    setContactInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldChange = (participantId: string, fieldName: string, value: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? { ...p, data: { ...p.data, [fieldName]: value } }
          : p
      )
    );
  };

  // Validation functions
  const validateContactInfo = () => {
    const errors = [];
    if (!contactInfo.name.trim()) errors.push("Full name is required");
    if (!contactInfo.email.trim()) errors.push("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email))
      errors.push("Valid email is required");
    if (!contactInfo.phone.trim()) errors.push("Phone number is required");

    if (errors.length > 0) {
      toast.error(errors.join(", "));
      return false;
    }
    return true;
  };

  const validateParticipantData = () => {

    if (collectionType === 'fundraising' && (!fundraisingAmount || parseFloat(fundraisingAmount) < baseAmount)) {
      toast.error(`Please enter an amount greater than ${formatCurrency(baseAmount)}`);
      return false;
    }

    for (const participant of participants) {
      for (const field of fields) {
        if (field.required && field.name.toLowerCase() === "unique code")
          continue; // Skip validation for unique code
        if (field.required && !participant.data[field.name]?.trim()) {
          toast.error(`Please fill in ${field.name} for all participants`);
          return false;
        }
      }
    }
    return true;
  };

  // Navigation functions
  const nextStep = () => {
    setPaymentError(null);

    if (step === "pricing") {
      setStep("details");
    } else if (step === "details" && validateParticipantData()) {
      setStep("contact");
    } else if (step === "contact" && validateContactInfo()) {
      setStep("payment");
    }
  };

  const previousStep = () => {
    setPaymentError(null);

    if (step === "payment") {
      setStep("contact");
    } else if (step === "contact") {
      setStep("details");
    } else if (step === "details" && pricingTiers && pricingTiers.length > 0) {
      setStep("pricing");
    }
  };

  // Payment handling
  const createContributor = async () => {
    try {
      const response = await axiosInstance.post(
        `/contributions/${collectionId}`,
        {
          name: contactInfo.name,
          email: contactInfo.email,
          phoneNumber: contactInfo.phone,
          amount: selectedAmount * numberOfParticipants,
          contributionInformation: participants.map((participant) => ({
            ...participant.data,
          })),
          collectionId,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to create contributor");
      }

      return response.data.contributor?.id || response.data.contributor?._id;
    } catch (error: any) {
      console.error("Create contributor error:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "Failed to create contributor");
    }
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setIsLoading(true);

    try {

      // Use new payment flow if amountBreakdown exists (second version)
      let payableAmount = selectedAmount;

      console.log(selectedAmount, payableAmount, 'selectedAmount');
      if (props?.fee_bearer == "contributor" && amountBreakdown && props.collection?.amount) {
        payableAmount = amountBreakdown.totalPayable
      }

      if (pricingTiers && pricingTiers.length > 0) {
        baseAmount = selectedAmount
      }


      let fees = 0;
      if (amountBreakdown && props.fee_bearer == "contributor" && props.collection?.amount) {
        fees = amountBreakdown.totalFees;
        payableAmount = selectedAmount + fees;
      }
      if (props.fee_bearer == "contributor" && pricingTiers) {

        fees = props.wallet?.fee_breakdown?.tiers.find(t => t.name === selectedTier)?.totalFees || 0;

        payableAmount = selectedAmount + fees;
      }
      if (amountBreakdown || selectedAmount) {
        console.log('paymet initialize');

        if (collectionType === 'fundraising' && (fundraisingAmount || parseFloat(fundraisingAmount) > baseAmount)) {
          // fees = 0.025 * parseFloat(fundraisingAmount)
          payableAmount = fundraisingAmount
        }

        const paymentData = {
          contributor: {
            name: contactInfo.name,
            email: contactInfo.email,
            phoneNumber: contactInfo.phone,
            amount: payableAmount,
            contributionInformation: participants.map((participant) => {

              if (pricingTiers && pricingTiers.length > 0) {
                return ({
                  ...participant.data,
                  Tier: selectedTier,
                  TierAmount: payableAmount
                });
              }

              return ({
                ...participant.data,
              })
            }

            ),
            collectionId,
          },
          fullName: contactInfo.name,
          email: contactInfo.email,
          phoneNumber: contactInfo.phone,
          amount: payableAmount,
          collectionId,
          collectionType,
          callback_url: `${window.location.origin}/payment/verify`,
        };

        console.log(paymentData, 'paymentData');


        const paymentResponse = await initializePayment(paymentData);
        if (!paymentResponse?.authorization_url) {
          throw new Error("Failed to get payment URL");
        }

        window.location.href = paymentResponse.authorization_url;
      }

    } catch (error: any) {
      console.error("Payment error:", error);
      setIsLoading(false);
      const errorMsg = error.message || "Payment failed. Please try again.";
      toast.error(errorMsg);
      if (onPaymentError) {
        onPaymentError(errorMsg);
      }
    }
  };

  // Render functions
  const renderPricingForm = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-lg">
        Select Tier
      </h3>
      <RadioGroup value={selectedTier} onValueChange={handleTierChange}>
        {pricingTiers?.map((tier, index) => (
          <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
            <RadioGroupItem value={tier.name} id={tier.name} />
            <Label htmlFor={tier.name} className="flex-1 cursor-pointer">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{tier.name}</p>
                  {tier.description && (
                    <p className="text-sm text-gray-500">{tier.description}</p>
                  )}
                </div>
                <p className="font-bold text-kolekto">{formatCurrency(tier.price)}</p>
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const handlefundraisingAmountChange = (value: string) => {
    const num = parseFloat(value);

  }
  const gatewayFee = fundraisingAmount * 0.015
  const platformFee = fundraisingAmount * 0.01
  const totalFees = gatewayFee + platformFee
  const renderParticipantForm = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-lg flex items-center gap-2">
        <User className="h-5 w-5" />
        Participant Details
      </h3>


      {participants.map((participant, index) => (
        <div key={participant.id} className="pt-4 pb-2 border-t">
          <h4 className="font-medium mb-4">
            {index === 0 ? "Your Details" : `Participant ${index + 1} Details`}
          </h4>
          <div className="space-y-4">

            {collectionType === 'fundraising' && (
              <div className="space-y-2">
                <Label>Donate Amount</Label>
                <Input
                  type="number"
                  value={fundraisingAmount || ""}
                  onChange={(e) =>
                    setFundraisingAmount(parseFloat(e.target.value) || 0)
                  }
                  placeholder={
                    baseAmount
                      ? `Minimum amount to contribute is ${formatCurrency(baseAmount)}`
                      : "Enter amount to contribute"
                  }
                  required
                />

                {fundraisingAmount > 0 && (
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      Payment gateway fee: <strong>{formatCurrency(gatewayFee)}</strong> (1.5%) capped at 2000 NGN
                    </p>
                    <p>
                      Kolekto platform fee: <strong>{formatCurrency(platformFee)}</strong> (1%) capped at 2000 NGN
                    </p>
                    <p>
                      Total fees: <strong>{formatCurrency(totalFees)}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {fields.map((field) => {
              const fieldId = field.id || field.name;
              const isUniqueCode = field.name.toLowerCase() === "unique code";

              if (isUniqueCode) return null;

              return (
                <div key={`${participant.id}-${fieldId}`} className="space-y-2">
                  <Label>
                    {field.name}
                    {field.required && " *"}
                  </Label>
                  {renderFormField(field, participant.id)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderFormField = (field: Field, participantId: string) => {
    const fieldId = field.id || field.name;
    const fieldValue = participants.find(p => p.id === participantId)?.data[field.name] || '';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <Input
            type={field.type}
            value={fieldValue}
            onChange={(e) => handleFieldChange(participantId, field.name, e.target.value)}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={fieldValue}
            onChange={(e) => handleFieldChange(participantId, field.name, e.target.value)}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            required={field.required}
          />
        );

      case 'select':
      case 'selectdropdown':
        return (
          <Select
            value={fieldValue}
            onValueChange={(value) => handleFieldChange(participantId, field.name, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={fieldValue}
            onValueChange={(value) => handleFieldChange(participantId, field.name, value)}
          >
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${fieldId}-${index}`} />
                <Label htmlFor={`${fieldId}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={fieldValue === 'true' || fieldValue === true}
              onCheckedChange={(checked) => handleFieldChange(participantId, field.name, checked.toString())}
              id={fieldId}
            />
            <Label htmlFor={fieldId}>{field.name}</Label>
          </div>
        );

      default:
        return (
          <Input
            value={fieldValue}
            onChange={(e) => handleFieldChange(participantId, field.name, e.target.value)}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            required={field.required}
          />
        );
    }
  };

  const renderContactForm = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-lg flex items-center gap-2">
        <User className="h-5 w-5" />
        Contact Information
        <span className="text-kolekto" title="Required for payment">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 1a7 7 0 0 0-7 7v3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V8a7 7 0 0 0-7-7Zm-5 7a5 5 0 1 1 10 0v3H7V8Zm13 5v7H4v-7h16Z"
            />
          </svg>
        </span>
      </h3>
      <div className="text-xs text-gray-600 mb-2">
        Please provide your contact details. This information is required to process your payment and send your receipt.
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={contactInfo.name}
            onChange={(e) => handleContactInfoChange("name", e.target.value)}
            required
            placeholder="Enter your full name"
          />
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={contactInfo.email}
            onChange={(e) => handleContactInfoChange("email", e.target.value)}
            required
            placeholder="Enter your email address"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            value={contactInfo.phone}
            onChange={(e) => handleContactInfoChange("phone", e.target.value)}
            required
            placeholder="Enter your phone number"
          />
        </div>
      </div>
    </div>
  );

  const renderPaymentForm = () => {
    const totalAmount = selectedAmount;
    let payableAmount = selectedAmount;

    console.log(selectedAmount, payableAmount, 'selectedAmount');
    if (props?.fee_bearer == "contributor" && amountBreakdown && props.collection?.amount) {
      payableAmount = amountBreakdown.totalPayable
    }

    if (pricingTiers && pricingTiers.length > 0) {
      baseAmount = selectedAmount
    }

    // if (selectedTier) {
    //   baseAmount = selectedAmount
    //   payableAmount = selectedAmount
    //   return
    // }
    // payableAmount = amountBreakdown && selectedAmount !== amountBreakdown.totalPayable
    //   ? amountBreakdown.totalFees + totalAmount
    //   : totalAmount;

    console.log(payableAmount, totalAmount, 'payableAmount');

    let fees = 0;
    if (amountBreakdown && props.fee_bearer == "contributor" && props.collection?.amount) {
      fees = amountBreakdown.totalFees;
      payableAmount = selectedAmount + fees;
    }
    if (props.fee_bearer == "contributor" && pricingTiers) {

      fees = props.wallet?.fee_breakdown?.tiers.find(t => t.name === selectedTier)?.totalFees || 0;

      payableAmount = selectedAmount + fees;
    }

    if (collectionType === 'fundraising' && (fundraisingAmount || parseFloat(fundraisingAmount) > baseAmount)) {
      selectedAmount = fundraisingAmount
      fees = 0.025 * parseFloat(fundraisingAmount)
      payableAmount = parseFloat(fundraisingAmount) + fees
    }


    return (
      <div className="space-y-4">
        {paymentError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Payment Error</AlertTitle>
            <AlertDescription>{paymentError}</AlertDescription>
          </Alert>
        )}

        <h3 className="font-medium text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </h3>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Payment Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Collection:</span>
              <span className="font-medium">{collectionTitle}</span>
            </div>
            {/* <div className="flex justify-between">
              <span>Participants:</span>
              <span>{numberOfParticipants}</span>
            </div> */}
            <div className="flex justify-between">
              <span>Amount</span>
              <span>{formatCurrency(selectedAmount)}</span>
            </div>
            {selectedTier && (
              <div className="flex justify-between">
                <span>Tier:</span>
                <span className="font-medium">{selectedTier}</span>
              </div>
            )}
            {amountBreakdown && props.fee_bearer == "contributor" && (
              <div className="flex justify-between">
                <span>Fees:</span>
                <span>{formatCurrency(fees)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-blue-900">
              <span>Total:</span>
              <span>{formatCurrency(payableAmount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-medium mb-2">Choose Payment Method</h4>
          <div
            className={`border rounded-md p-4 cursor-pointer transition-colors ${paymentMethod === "Paystack"
              ? "border-kolekto bg-kolekto/5"
              : "hover:border-gray-300"
              }`}
            onClick={() => setPaymentMethod("Paystack")}
          >
            <div className="flex items-center">
              <div
                className={`w-4 h-4 rounded-full border ${paymentMethod === "Paystack"
                  ? "border-kolekto bg-kolekto"
                  : "border-gray-300"
                  }`}
              >
                {paymentMethod === "Paystack" && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
              <span className="ml-2 font-medium">
                Paystack (Cards, Bank Transfer, USSD)
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Secure payment processing powered by Paystack.
          </div>
        </div>
      </div>
    );
  };

  const getStepContent = () => {
    switch (step) {
      case "pricing":
        return renderPricingForm();
      case "details":
        return renderParticipantForm();
      case "contact":
        return renderContactForm();
      case "payment":
        return renderPaymentForm();
      default:
        return null;
    }
  };

  const getStepActions = () => {
    const totalAmount = selectedAmount * numberOfParticipants;
    // const payableAmount = amountBreakdown && selectedAmount !== amountBreakdown.totalPayable
    //   ? amountBreakdown.totalFees + totalAmount
    //   : totalAmount;

    let payableAmount = selectedAmount

    let fees = 0;
    if (amountBreakdown && props.fee_bearer == "contributor" && props.collection?.amount) {
      fees = amountBreakdown.totalFees;
      payableAmount = selectedAmount + fees;
    }
    if (props.fee_bearer == "contributor" && pricingTiers) {

      fees = props.wallet?.fee_breakdown?.tiers.find(t => t.name === selectedTier)?.totalFees || 0;

      payableAmount = selectedAmount + fees;
    }

    if (collectionType === 'fundraising' && (fundraisingAmount || parseFloat(fundraisingAmount) > baseAmount)) {
      selectedAmount = fundraisingAmount
      fees = 0.025 * parseFloat(fundraisingAmount)
      payableAmount = parseFloat(fundraisingAmount) + fees
    }

    switch (step) {
      case "pricing":
        return (
          <Button
            type="button"
            onClick={nextStep}
            className="w-full bg-kolekto hover:bg-kolekto/90"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        );
      case "details":
        return (
          <div className="flex gap-2 w-full">
            {pricingTiers && pricingTiers.length > 0 && (
              <Button
                type="button"
                onClick={previousStep}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
            )}
            <Button
              type="button"
              onClick={nextStep}
              className="flex-1 bg-kolekto hover:bg-kolekto/90"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      case "contact":
        return (
          <div className="flex gap-2 w-full">
            <Button
              type="button"
              onClick={previousStep}
              variant="outline"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={nextStep}
              className="flex-1 bg-kolekto hover:bg-kolekto/90"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      case "payment":
        return (
          <div className="flex flex-col gap-2 w-full">
            <Button
              type="button"
              onClick={handlePayment}
              className="w-full bg-kolekto hover:bg-kolekto/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${formatCurrency(payableAmount)}`
              )}
            </Button>
            <Button
              type="button"
              onClick={previousStep}
              variant="outline"
              className="w-full"
            >
              Back
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  // Define steps based on available features
  const getSteps = () => {
    const steps = [];
    if (pricingTiers && pricingTiers.length > 0) {
      steps.push({ key: "pricing", label: "Select Amount" });
    }
    steps.push(
      { key: "details", label: "Contributor Details" },
      { key: "contact", label: "Contact Info" },
      { key: "payment", label: "Payment" }
    );
    return steps;
  };

  const steps = getSteps();
  const currentStepIndex = steps.findIndex((s) => s.key === step);
  const totalAmount = selectedAmount;
  // let payableAmount = amountBreakdown && selectedAmount !== amountBreakdown.totalPayable
  //   ? amountBreakdown.totalFees + totalAmount
  //   : totalAmount;

  // if (selectedAmount) {
  let payableAmount = selectedAmount
  // }

  let fees = 0;
  if (amountBreakdown && props.fee_bearer == "contributor" && props.collection?.amount) {
    fees = amountBreakdown.totalFees;
    payableAmount = selectedAmount + fees;
  }
  if (props.fee_bearer == "contributor" && pricingTiers) {

    fees = props.wallet?.fee_breakdown?.tiers.find(t => t.name === selectedTier)?.totalFees || 0;

    payableAmount = selectedAmount + fees;
  }

  if (collectionType === 'fundraising' && (fundraisingAmount || parseFloat(fundraisingAmount) > baseAmount)) {
    selectedAmount = fundraisingAmount
    fees = 0.025 * parseFloat(fundraisingAmount)
    payableAmount = parseFloat(fundraisingAmount) + fees
  }


  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        {supportPhone && (
          <div className="mt-4 mx-4 p-3 border rounded-md bg-gray-50 text-sm flex items-center justify-between">
            <div>
              <span className="font-medium">Need help?</span>
              <span className="ml-1">Contact the organizer:</span>
              <a
                href={`tel:${supportPhone}`}
                className="ml-1 text-kolekto font-medium"
              >
                {supportPhone}
              </a>
            </div>
            <a
              href={`https://wa.me/${supportPhone.replace(/^\+/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:underline"
            >
              WhatsApp
            </a>
          </div>
        )}
        <CardHeader>
          <CardTitle>{collectionTitle}</CardTitle>
          <CardDescription>
            {description && <div className="mt-2">{description}</div>}
            {collectionType !== 'fundraising' && (<div className="mt-2">
              {pricingTiers && pricingTiers.length > 0 ? (
                `Selected Amount: ${formatCurrency(selectedAmount)}`
              ) : (
                `Total Amount: ${formatCurrency(baseAmount)}`
              )}
              {amountBreakdown && selectedAmount !== amountBreakdown.totalPayable && (
                <span className="text-sm text-gray-600">
                  {fees > 0 && " + fees: "}
                  {amountBreakdown.platformFee && `₦${amountBreakdown.platformFee} (platform) `}
                  {amountBreakdown.paymentGatewayFee && `₦${amountBreakdown.paymentGatewayFee} (gateway)`}
                  {fees > 0 && ` ₦${fees} (contributor fees)`}
                </span>
              )}
            </div>)}
            {collectionType == 'fundraising' && (<div className="mt-2">
              {`total amount contributed: ${formatCurrency(props.collection.wallets[0].net_payment)}`}
            </div>)}

            {props.max_contributions && (
              <div className="text-sm text-gray-600">
                Maximum contributions: {props.max_contributions}
                {props.total_contributions && ` | Current: ${props.total_contributions}`}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {steps.length > 1 && (
            <div className="flex items-center justify-between mb-6">
              {steps.map((s, idx) => (
                <div key={s.key} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 flex items-center justify-center rounded-full border-2
                      ${idx === currentStepIndex
                        ? "border-kolekto bg-kolekto text-white"
                        : idx < currentStepIndex
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-gray-300 bg-white text-gray-400"
                      }`}
                  >
                    {idx < currentStepIndex ? <Check className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className={`mt-2 text-xs text-center ${idx === currentStepIndex ? "font-bold text-kolekto" : "text-gray-500"
                    }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          {getStepContent()}
        </CardContent>
        <CardFooter className="border-t pt-4 flex flex-col space-y-3">
          <div className="w-full flex justify-between items-center">
            <span className="font-medium">Total Amount:</span>
            <span className="font-bold text-lg">
              {formatCurrency(payableAmount)}
            </span>
          </div>
          {getStepActions()}
        </CardFooter>
      </Card>
    </div>
  );
};

export default ContributionForm;