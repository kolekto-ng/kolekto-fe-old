
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { usePaystackStore } from '@/store/usePaystackStore';
import { useContributionStore } from '@/store/useContributionStore';
import { formatCurrency } from '@/utils/formatters';
import { CreditCard, User, DollarSign } from 'lucide-react';

interface PriceTier {
  name: string;
  price: number;
  description?: string;
  quantity?: number | null;
}

interface FormField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface ContributionFormProps {
  collection: {
    id: string;
    title: string;
    amount: number;
    description?: string;
    deadline?: string;
  };
  formFields: FormField[];
  pricingTiers?: PriceTier[];
  onPaymentSuccess: (data: any) => void;
  onPaymentError: (error: string) => void;
}

const ContributionForm: React.FC<ContributionFormProps> = ({
  collection,
  formFields,
  pricingTiers,
  onPaymentSuccess,
  onPaymentError
}) => {
  const [selectedAmount, setSelectedAmount] = useState(
    pricingTiers && pricingTiers.length > 0 ? pricingTiers[0].price : collection.amount
  );
  const [selectedTier, setSelectedTier] = useState(
    pricingTiers && pricingTiers.length > 0 ? pricingTiers[0].name : ''
  );
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const { initiatePayment, verifyPayment } = usePaystackStore();
  const { createContribution } = useContributionStore();

  // Required fields for payment
  const [contributorName, setContributorName] = useState('');
  const [contributorEmail, setContributorEmail] = useState('');
  const [contributorPhone, setContributorPhone] = useState('');

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleTierChange = (tierName: string) => {
    const tier = pricingTiers?.find(t => t.name === tierName);
    if (tier) {
      setSelectedTier(tierName);
      setSelectedAmount(tier.price);
    }
  };

  const validateForm = () => {
    if (!contributorName.trim()) {
      toast.error('Please enter your full name');
      return false;
    }
    if (!contributorEmail.trim()) {
      toast.error('Please enter your email address');
      return false;
    }
    if (!contributorPhone.trim()) {
      toast.error('Please enter your phone number');
      return false;
    }

    // Validate required custom fields
    for (const field of formFields) {
      if (field.required && !formData[field.id]) {
        toast.error(`Please fill in the required field: ${field.name}`);
        return false;
      }
    }

    return true;
  };

  const handlePayment = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);

    try {
      // Create contribution record first
      const contributionData = {
        collection_id: collection.id,
        contributor_id: 'anonymous', // For anonymous contributions
        contributor_name: contributorName,
        contributor_email: contributorEmail,
        contributor_phone: contributorPhone,
        amount: selectedAmount,
        payment_method: 'card',
        status: 'pending',
        receipt_details: {
          ...formData,
          selectedTier: selectedTier || 'Standard'
        },
        contact_info: {
          name: contributorName,
          email: contributorEmail,
          phone: contributorPhone
        }
      };

      const contribution = await createContribution(contributionData);

      // Initiate Paystack payment
      const paymentData = await initiatePayment({
        email: contributorEmail,
        amount: selectedAmount * 100, // Convert to kobo
        metadata: {
          collection_id: collection.id,
          contribution_id: contribution.id,
          contributor_name: contributorName,
          custom_fields: formData
        }
      });

      // Redirect to Paystack
      window.location.href = paymentData.authorization_url;

    } catch (error: any) {
      console.error('Payment initiation error:', error);
      onPaymentError(error.message || 'Failed to initiate payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderFormField = (field: FormField) => {
    const fieldId = field.id;
    const fieldValue = formData[fieldId] || '';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <Input
            type={field.type}
            value={fieldValue}
            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={fieldValue}
            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            required={field.required}
          />
        );

      case 'select':
        return (
          <Select value={fieldValue} onValueChange={(value) => handleFieldChange(fieldId, value)}>
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
          <RadioGroup value={fieldValue} onValueChange={(value) => handleFieldChange(fieldId, value)}>
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
              checked={fieldValue || false}
              onCheckedChange={(checked) => handleFieldChange(fieldId, checked)}
              id={fieldId}
            />
            <Label htmlFor={fieldId}>{field.name}</Label>
          </div>
        );

      default:
        return (
          <Input
            value={fieldValue}
            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
            placeholder={`Enter ${field.name.toLowerCase()}`}
            required={field.required}
          />
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Collection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {collection.title}
          </CardTitle>
          {collection.description && (
            <p className="text-gray-600">{collection.description}</p>
          )}
        </CardHeader>
        <CardContent>
          {pricingTiers && pricingTiers.length > 0 ? (
            <div className="space-y-4">
              <Label>Select Amount</Label>
              <RadioGroup value={selectedTier} onValueChange={handleTierChange}>
                {pricingTiers.map((tier, index) => (
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
          ) : (
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-lg font-semibold">Amount: {formatCurrency(collection.amount)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participant Information Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Participant Information
          </CardTitle>
          <p className="text-sm text-gray-600">
            Please provide your information for this contribution
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={contributorEmail}
                onChange={(e) => setContributorEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={contributorPhone}
              onChange={(e) => setContributorPhone(e.target.value)}
              placeholder="Enter your phone number"
              required
            />
          </div>

          {/* Custom Form Fields */}
          {formFields.map((field) => (
            <div key={field.id}>
              <Label htmlFor={field.id}>
                {field.name} {field.required && '*'}
              </Label>
              {renderFormField(field)}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Information
          </CardTitle>
          <p className="text-sm text-gray-600">
            Complete your contribution by proceeding to secure payment
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Payment Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-medium">{formatCurrency(selectedAmount)}</span>
                </div>
                {selectedTier && (
                  <div className="flex justify-between">
                    <span>Tier:</span>
                    <span className="font-medium">{selectedTier}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-blue-900">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedAmount)}</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-kolekto hover:bg-kolekto/90 text-white py-3 text-lg"
                size="lg"
              >
                {isProcessing ? 'Processing...' : `Pay ${formatCurrency(selectedAmount)}`}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                You will be redirected to our secure payment processor
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContributionForm;
