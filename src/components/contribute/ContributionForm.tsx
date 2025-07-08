import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { usePaystackStore } from "@/store/usePaystackStore";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { axiosInstance } from "@/utils/axios";

interface Field {
  name: string;
  type: string;
  required: boolean;
}

interface Participant {
  id: string;
  data: { [key: string]: string };
}

interface ContributionFormProps {
  collectionId: string;
  collectionTitle: string;
  amount: number;
  amountBreakdown: { totalPayable: number; totalFees: number };
  fields: Field[];
  description?: string;
  onPaymentSuccess: (formData: any) => void;
  onPaymentError: (errorMsg: string) => void;
}

const ContributionForm = ({
  collectionId,
  collectionTitle,
  amount,
  amountBreakdown,
  fields,
  description,
}) => {
  const [step, setStep] = useState<"details" | "contact" | "payment">("details"); // 1. Start at "details"
  const [numberOfParticipants, setNumberOfParticipants] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "1", data: {} },
  ]);
  const [paymentMethod, setPaymentMethod] = useState("Paystack");
  const [isLoading, setIsLoading] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [verificationInterval, setVerificationInterval] =
    useState<NodeJS.Timeout | null>(null);

  const { initializePayment, verifyPayment, } =
    usePaystackStore();
  let paymentLoading = false
  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (verificationInterval) {
        clearInterval(verificationInterval);
      }
    };
  }, [verificationInterval]);

  const handleContactInfoChange = (field: string, value: string) => {
    setContactInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleParticipantsChange = (value: string) => {
    const num = parseInt(value);
    if (isNaN(num)) return;

    setNumberOfParticipants(Math.max(1, Math.min(10, num))); // Limit to 1-10 participants

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

  const handleFieldChange = (
    participantId: string,
    fieldName: string,
    value: string
  ) => {

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? { ...p, data: { ...p.data, [fieldName]: value } }
          : p
      )
    );
  };

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
    for (const participant of participants) {
      for (const field of fields) {
        if (field.required && field.name.toLowerCase() === "unique code")
          return true; // Skip validation for unique code
        if (field.required && !participant.data[field.name]?.trim()) {
          toast.error(`Please fill in ${field.name} for all participants`);
          return false;
        }
      }
    }
    return true;
  };

  const nextStep = () => {
    setPaymentError(null);
    if (step === "details" && validateParticipantData()) {
      setStep("contact"); // 2. Go to contact after details
    } else if (step === "contact" && validateContactInfo()) {
      setStep("payment");
    }
  };

  const previousStep = () => {
    setPaymentError(null);
    setStep(step === "payment" ? "contact" : "details"); // 3. Go back in the new order
  };

  const createContributor = async () => {
    try {
      const response = await axiosInstance.post(
        `/contributions/${collectionId}`,
        {
          name: contactInfo.name,
          email: contactInfo.email,
          phoneNumber: contactInfo.phone,
          amount: amount * numberOfParticipants,
          contributionInformation: participants.map((participant) => ({
            ...participant.data,
          })),
          collectionId,
        }
      );

      if (!response.data.success) {
        throw new Error(
          response.data.message || "Failed to create contributor"
        );
      }

      return response.data.contributor?.id || response.data.contributor?._id;
    } catch (error: any) {
      console.error(
        "Create contributor error:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.message || "Failed to create contributor"
      );
    }
  };

  const startPaymentVerification = async (reference: string) => {
    const interval = setInterval(async () => {
      try {
        const verification = await verifyPayment(reference);

        if (verification?.status === "success") {
          clearInterval(interval);
          // handlePaymentSuccess(reference);
        }
      } catch (error) {
        console.error("Verification error:", error);
      }
    }, 5000); // Check every 5 seconds

    setVerificationInterval(interval);

    // Timeout after 15 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (isLoading) {
        setIsLoading(false);
        toast.info(
          "Payment verification timed out. Please check your email for confirmation."
        );
      }
    }, 900000);
  };

  const handlePaymentSuccess = (reference: string) => {
    const successData = {
      collectionId,
      collectionTitle,
      // participants: prepareParticipantData(),
      paymentMethod,
      totalAmount: amount * numberOfParticipants,
      contactInfo,
      transactionRef: reference,
      timestamp: new Date().toISOString(),
    };

    setIsLoading(false);
    toast.success("Payment successful!");
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create contributor record
      // const contributorId = await createContributor();

      // 2. Initialize payment
      const paymentData = {
        contributor: {
          name: contactInfo.name,
          email: contactInfo.email,
          phoneNumber: contactInfo.phone,
          amount: amount * numberOfParticipants,
          contributionInformation: participants.map((participant) => ({
            ...participant.data,
          })),
          collectionId,
        },

        fullName: contactInfo.name,
        email: contactInfo.email,
        phoneNumber: contactInfo.phone,
        amount:
          amount != amountBreakdown.totalPayable
            ? amountBreakdown.totalFees + amount * numberOfParticipants
            : amount,
        collectionId,
        callback_url: `${window.location.origin}/payment/verify`, // <-- Add this
      };
      const paymentResponse = await initializePayment(paymentData);
      if (!paymentResponse?.authorization_url) {
        throw new Error("Failed to get payment URL");
      }

      // 3. Open payment gateway

      window.location.href = paymentResponse.authorization_url;
      // 4. Start verification process
      // startPaymentVerification(paymentResponse.reference);
    } catch (error: any) {
      console.error("Payment error:", error);
      setIsLoading(false);
      const errorMsg = error.message || "Payment failed. Please try again.";
      toast.error(errorMsg);
    }
  };

  const renderContactForm = () => (
    <div className="space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <span>Contact Information</span>
        <span className="text-kolekto" title="Required for payment">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 1a7 7 0 0 0-7 7v3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V8a7 7 0 0 0-7-7Zm-5 7a5 5 0 1 1 10 0v3H7V8Zm13 5v7H4v-7h16Z"
            ></path>
          </svg>
        </span>
      </h3>
      <div className="text-xs text-gray-600 mb-2">
        Please provide your contact details. This information is required to
        process your payment and send your receipt.
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

  const renderParticipantForm = () => (
    <div className="space-y-4">
      {/* <div className="space-y-2">
        <Label htmlFor="numberOfParticipants">Number of Participants</Label>
        <Select 
          value={numberOfParticipants.toString()} 
          onValueChange={handleParticipantsChange}
        >
          <SelectTrigger id="numberOfParticipants" className="w-full">
            <SelectValue placeholder="Select number of participants" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map(num => (
              <SelectItem key={num} value={num.toString()}>
                {num} {num === 1 ? 'person' : 'people'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div> */}

      {participants.map((participant, index) => (
        <div key={participant.id} className="pt-4 pb-2 border-t">
          <h3 className="font-medium mb-4">
            {index === 0 ? "Your Details" : `Participant ${index + 1} Details`}
          </h3>
          <div className="space-y-4">

            {fields.map((field) => {
              const isUniqueCode = field.name.toLowerCase() === "unique code";
              // Render select for select/selectdropdown fields
              if (field.type === "select" || field.type === "selectdropdown") {
                return (
                  <div key={`${participant.id}-${field.name}`} className="space-y-2">
                    <Label>
                      {field.name}
                      {field.required && " *"}
                    </Label>
                    <Select
                      value={participant.data?.[field.name] || ""}
                      onValueChange={(value) =>
                        handleFieldChange(participant.id, field.name, value)
                      }
                      required={field.required}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map((opt: string) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              // Default: render input for other types
              return (
                <div key={`${participant.id}-${field.name}`} className="space-y-2">
                  {!isUniqueCode && (
                    <>
                      <Label>
                        {field.name}
                        {field.required && " *"}
                      </Label>
                      <Input
                        type={field.type}
                        value={participant.data?.[field.name] || ""}
                        onChange={(e) =>
                          handleFieldChange(participant.id, field.name, e.target.value)
                        }
                        required={field.required}
                        readOnly={isUniqueCode}
                        placeholder={`Enter ${field.name.toLowerCase()}`}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {/* {Object.values(fields || {}).map((field) => {
              console.log(field);

              const isUniqueCode = field.name.toLowerCase() === "unique code";
              console.log(isUniqueCode);

              return (
                <div
                  key={`${participant.id}-${field.name}`}
                  className="space-y-2"
                >
                  {!isUniqueCode && (
                    <>
                      <Label>
                        {field.name}
                        {field.required && " *"}
                      </Label>
                      <Input
                        type={field.type}
                        value={participant.data?.[field.name] || ""}
                        onChange={(e) =>
                          !isUniqueCode &&
                          handleFieldChange(
                            participant.id,
                            field.name,
                            e.target.value
                          )
                        }
                        required={field.required}
                        readOnly={isUniqueCode}
                        placeholder={`Enter ${field.name.toLowerCase()}`}
                      />
                    </>
                  )}
                </div>
              );
            })} */}
          </div>
        </div>
      ))}
    </div>
  );

  const renderPaymentForm = () => (
    <div className="space-y-4">
      {paymentError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Payment Error</AlertTitle>
          <AlertDescription>{paymentError}</AlertDescription>
        </Alert>
      )}

      <h3 className="font-medium mb-2 text-lg">Payment Details</h3>
      <div className="bg-gray-50 rounded-md p-4 border space-y-4">
        {/* Contributor Info Section */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">Contributor Info</span>
            <span className="text-xs text-gray-500">(provided for payment processing only)</span>
          </div>
          <div className="flex flex-col gap-2 text-sm ml-2">
            {participants.map((participant, idx) => (
              <div key={participant.id} className="mb-2">
                <div className="font-medium">
                  {idx === 0 ? "Your Details" : `Participant ${idx + 1} Details`}
                </div>
                {fields.map((field) => (
                  <div key={field.name} className="flex gap-2">
                    <span className="text-gray-600">{field.name}:</span>
                    <span>{participant.data[field.name] || <span className="text-gray-400">N/A</span>}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-1 italic">
            These details are required to process your payment and will not be used for any other purpose.
          </div>
        </div>
        {/* Payment Summary Section */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between">
            <span>Collection:</span>
            <span className="font-semibold">{collectionTitle}</span>
          </div>
          <div className="flex justify-between">
            <span>Participants:</span>
            <span>{numberOfParticipants}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount per Participant:</span>
            <span>₦{amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Fees:</span>
            <span>₦{amountBreakdown.totalFees.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2">
            <span>Total Payable:</span>
            <span>
              ₦
              {amount !== amountBreakdown.totalPayable
                ? (amountBreakdown.totalFees + amount * numberOfParticipants).toLocaleString()
                : amount.toLocaleString()}
            </span>
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

  const getStepContent = () => {
    switch (step) {
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



  const pay =
    amount != amountBreakdown.totalPayable
      ? amountBreakdown.totalFees + amount * numberOfParticipants
      : amount;


  const getStepActions = () => {
    switch (step) {
      case "details":
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
              disabled={isLoading || paymentLoading}
            >
              {isLoading || paymentLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ₦${amount != amountBreakdown.totalPayable
                  ? amountBreakdown.totalFees + amount * numberOfParticipants
                  : amount
                }`
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

  const steps = [
    { key: "details", label: "Contributor Details" },
    { key: "contact", label: "Contact Info (for Payment)" },
    { key: "payment", label: "Payment" },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{collectionTitle}</CardTitle>
          <CardDescription>
            {description && <div className="mt-2">{description}</div>}
            <div className="mt-2">
              Total Amount: ₦{amount.toLocaleString()}
              {amount != amountBreakdown.totalPayable
                ? ` + ₦${amountBreakdown.platformFee} (kolekto fee) + ₦${amountBreakdown.paymentGatewayFee} (gateway fee)`
                : null}{" "}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
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
                <span className={`mt-2 text-xs text-center ${idx === currentStepIndex ? "font-bold text-kolekto" : "text-gray-500"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          {getStepContent()}
        </CardContent>
        <CardFooter className="border-t pt-4 flex flex-col space-y-3">
          <div className="w-full flex justify-between items-center">
            <span className="font-medium">Total Amount:</span>
            <span className="font-bold text-lg">
              ₦
              {amount != amountBreakdown.totalPayable
                ? amountBreakdown.totalFees + amount * numberOfParticipants
                : amount}
            </span>
          </div>
          {getStepActions()}
        </CardFooter>
      </Card>
    </div>
  );
};

export default ContributionForm;
