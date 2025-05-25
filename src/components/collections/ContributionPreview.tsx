
import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrency } from '@/utils/formatters';

interface PriceTier {
  id?: string;
  name: string;
  price: number;
  description?: string;
  quantity?: number | null;
}

interface ContributionPreviewProps {
  collectionData: {
    title: string;
    description?: string;
    amount: number;
    deadline?: string;
    formFields: Array<{
      id: string;
      name: string;
      type: string;
      required: boolean;
      options?: string[];
    }>;
    usePriceTiers?: boolean;
    priceTiers?: PriceTier[];
  };
}

const ContributionPreview: React.FC<ContributionPreviewProps> = ({ collectionData }) => {
  const { title, description, amount, deadline, formFields, usePriceTiers, priceTiers } = collectionData;
  
  // Generate a dummy collection ID for preview purposes
  const dummyCollectionId = 'preview-' + Math.random().toString(36).substring(2, 10);
  
  // State to track the selected price tier
  const [selectedTierId, setSelectedTierId] = useState<string>(
    priceTiers && priceTiers.length > 0 ? priceTiers[0].id || '0' : ''
  );
  
  // State to track the current step
  const [step, setStep] = useState<string>(usePriceTiers && priceTiers?.length ? 'pricing' : 'contact');
  
  // Get the selected tier
  const getSelectedTier = (): PriceTier | undefined => {
    if (usePriceTiers && priceTiers && priceTiers.length > 0) {
      if (selectedTierId.match(/^\d+$/)) {
        // Handle numeric IDs
        const index = parseInt(selectedTierId);
        return priceTiers[index];
      }
      // Handle string IDs
      return priceTiers.find(tier => tier.id === selectedTierId);
    }
    return undefined;
  };
  
  // Get the selected tier price or use the base amount
  const getSelectedPrice = (): number => {
    const selectedTier = getSelectedTier();
    return selectedTier ? selectedTier.price : amount;
  };
  
  // Render the selected tier header
  const renderSelectedTierHeader = () => {
    const selectedTier = getSelectedTier();
    if (!selectedTier || step === 'pricing') return null;
    
    return (
      <div className="mt-2 p-3 bg-primary/10 rounded-md flex justify-between items-center">
        <div>
          <p className="text-sm font-medium">Selected package:</p>
          <p className="font-medium">{selectedTier.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm">Price:</p>
          <p className="font-bold">{formatCurrency(selectedTier.price)}</p>
        </div>
        {step !== 'pricing' && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setStep('pricing')} 
            className="ml-2"
          >
            Change
          </Button>
        )}
      </div>
    );
  };
  
  // Render the step indicator
  const renderStepIndicator = () => {
    const totalSteps = usePriceTiers && priceTiers?.length ? 4 : 3;
    let currentStepIndex;
    
    if (usePriceTiers && priceTiers?.length) {
      currentStepIndex = 
        step === 'pricing' ? 0 :
        step === 'contact' ? 1 :
        step === 'details' ? 2 : 3;
    } else {
      currentStepIndex = 
        step === 'contact' ? 0 :
        step === 'details' ? 1 : 2;
    }
    
    const steps = usePriceTiers && priceTiers?.length
      ? ['Package', 'Contact', 'Details', 'Payment'] 
      : ['Contact', 'Details', 'Payment'];
    
    return (
      <div className="flex justify-between mb-6">
        {steps.map((label, index) => (
          <div key={index} className="flex flex-col items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium mb-1
              ${index === currentStepIndex 
                ? 'bg-primary text-primary-foreground' 
                : index < currentStepIndex 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-gray-200 text-gray-400'}`}>
              {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span className={`text-xs ${index === currentStepIndex ? 'font-medium' : 'text-gray-500'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    );
  };
  
  // Render different steps
  const renderContent = () => {
    switch (step) {
      case 'pricing':
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Select Package</h3>
            
            <RadioGroup 
              value={selectedTierId} 
              onValueChange={setSelectedTierId}
              className="space-y-3"
            >
              {priceTiers?.map((tier, index) => (
                <div key={index} className="flex flex-col border rounded-md p-3 hover:border-gray-300 transition-colors">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value={tier.id || index.toString()} id={`tier-${index}`} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={`tier-${index}`} className="font-medium block">
                        {tier.name} - {formatCurrency(tier.price)}
                      </Label>
                      {tier.description && (
                        <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                      )}
                      {tier.quantity && (
                        <p className="text-xs text-gray-500 mt-1">Limited availability: {tier.quantity} spots</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case 'contact':
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Contact Information</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" placeholder="Enter your full name" />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="Enter your email address" />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" type="tel" placeholder="Enter your phone number" />
              </div>
            </div>
          </div>
        );
      case 'details':
        return (
          <div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="numberOfParticipants">Number of Participants</Label>
              <Select defaultValue="1">
                <SelectTrigger id="numberOfParticipants" className="w-full">
                  <SelectValue placeholder="Select number of participants" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 1 ? 'person' : 'people'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 pb-2 border-t mt-4">
              <h3 className="font-medium mb-4">Your Details</h3>
              <div className="space-y-4">
                {formFields?.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label>
                      {field.name}
                      {field.required && ' *'}
                    </Label>
                    {field.type === 'option' ? (
                      <Select>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options || []).map((option, index) => (
                            <SelectItem key={index} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.type}
                        required={field.required}
                        placeholder={`Enter ${field.name.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'payment':
        return (
          <div className="space-y-4">
            <h3 className="font-medium mb-4">Choose Payment Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border rounded-md p-4 cursor-pointer transition-colors border-kolekto bg-kolekto/5">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full border border-kolekto bg-kolekto">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <span className="ml-2 font-medium">Paystack</span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  
  // Handle navigation between steps
  const handleNext = () => {
    if (step === 'pricing') setStep('contact');
    else if (step === 'contact') setStep('details');
    else if (step === 'details') setStep('payment');
  };
  
  const handlePrevious = () => {
    if (step === 'contact' && usePriceTiers && priceTiers?.length) setStep('pricing');
    else if (step === 'details') setStep('contact');
    else if (step === 'payment') setStep('details');
  };
  
  // Render step actions
  const renderStepActions = () => {
    switch (step) {
      case 'pricing':
        return (
          <Button className="w-full bg-kolekto hover:bg-kolekto/90" onClick={handleNext}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        );
      case 'contact':
        return (
          <div className="flex gap-2 w-full">
            {usePriceTiers && priceTiers?.length > 0 && (
              <Button variant="outline" className="flex-1" onClick={handlePrevious}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            <Button className="flex-1 bg-kolekto hover:bg-kolekto/90" onClick={handleNext}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      case 'details':
        return (
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handlePrevious}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button className="flex-1 bg-kolekto hover:bg-kolekto/90" onClick={handleNext}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      case 'payment':
        return (
          <div className="flex flex-col gap-2 w-full">
            <Button className="w-full bg-kolekto hover:bg-kolekto/90">
              Pay {formatCurrency(getSelectedPrice())}
            </Button>
            <Button variant="outline" className="w-full" onClick={handlePrevious}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-md">
        <h2 className="text-amber-800 font-medium flex items-center gap-2">
          <span>Preview Mode</span>
        </h2>
        <p className="text-amber-700 text-sm mt-1">
          This is how contributors will see your collection page. The form is for preview only and won't process payments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title || 'Collection Title'}</CardTitle>
          <CardDescription>
            {description && <div className="mt-2">{description}</div>}
            {!usePriceTiers && (
              <div className="mt-2">Amount per person: {formatCurrency(parseFloat(amount?.toString() || '0'))}</div>
            )}
            {deadline && (
              <div className="mt-1 text-sm">Deadline: {new Date(deadline).toLocaleDateString()}</div>
            )}
          </CardDescription>
          {renderSelectedTierHeader()}
        </CardHeader>
        <CardContent>
          {renderStepIndicator()}
          {renderContent()}
        </CardContent>
        <CardFooter className="border-t pt-4 flex flex-col space-y-3">
          <div className="w-full flex justify-between items-center">
            <span className="font-medium">Total Amount:</span>
            <span className="font-bold text-lg">
              {formatCurrency(getSelectedPrice())}
            </span>
          </div>
          {renderStepActions()}
        </CardFooter>
      </Card>
      
      <div className="mt-6">
        <h3 className="font-medium mb-2">Contributor Link</h3>
        <div className="flex items-center gap-2">
          <Input 
            value={`${window.location.origin}/contribute/${dummyCollectionId}`}
            readOnly 
            className="font-mono text-sm"
          />
          <Button variant="outline" onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/contribute/${dummyCollectionId}`);
          }}>
            Copy
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Share this link with participants to contribute to your collection.
          The actual link will be generated when you create the collection.
        </p>
      </div>
    </div>
  );
};

export default ContributionPreview;
