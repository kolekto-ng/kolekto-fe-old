import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

interface PriceTier {
  id: string;
  name: string;
  price: string;
  description: string;
  quantity?: string;
}

interface PricingSectionProps {
  usePriceTiers: boolean;
  setUsePriceTiers: (value: boolean) => void;
  amount: string;
  setAmount: (value: string) => void;
  priceTiers: PriceTier[];
  setPriceTiers: (tiers: PriceTier[]) => void;
  feeBearer: 'organizer' | 'contributor';
  setFeeBearer: (value: 'organizer' | 'contributor') => void;
  kolektoFee: number;
  paymentGatewayFee: number;
  totalFees: number;
  totalPayable: number;
  getKolektoFeePercentage: () => string;
}

const PricingSection: React.FC<PricingSectionProps> = ({
  usePriceTiers,
  setUsePriceTiers,
  amount,
  setAmount,
  priceTiers,
  setPriceTiers,
  feeBearer,
  setFeeBearer,
  kolektoFee,
  paymentGatewayFee,
  totalFees,
  totalPayable,
  getKolektoFeePercentage,
}) => {
  const handleAddPriceTier = () => {
    const newId = (priceTiers.length + 1).toString();
    setPriceTiers([
      ...priceTiers,
      { id: newId, name: '', price: '', description: '', quantity: '' }
    ]);
  };

  const handleRemovePriceTier = (id: string) => {
    if (priceTiers.length > 1) {
      setPriceTiers(priceTiers.filter(tier => tier.id !== id));
    } else {
      toast.error("You must have at least one price tier");
    }
  };

  const handlePriceTierChange = (id: string, field: keyof PriceTier, value: string) => {
    setPriceTiers(priceTiers.map(tier =>
      tier.id === id ? { ...tier, [field]: value } : tier
    ));
  };

  // Calculate fees for a given amount
  const calculateFeesForAmount = (amount: number) => {
    let kolektoFeePercentage;
    if (amount < 1000) {
      kolektoFeePercentage = 0.03;
    } else if (amount < 5000) {
      kolektoFeePercentage = 0.025;
    } else if (amount < 20000) {
      kolektoFeePercentage = 0.02;
    } else {
      kolektoFeePercentage = 0.015;
    }

    let gatewayFee = amount * 0.015;
    gatewayFee = Math.min(gatewayFee, 2000);

    const platformFee = amount * kolektoFeePercentage;
    const totalFees = platformFee + gatewayFee;

    return {
      kolektoFee: platformFee,
      paymentGatewayFee: gatewayFee,
      totalFees,
      totalPayable: feeBearer === 'contributor' ? amount + totalFees : amount,
      amountToReceive: feeBearer === 'organizer' ? amount - totalFees : amount,
      feePercentage: (kolektoFeePercentage * 100).toFixed(1)
    };
  };

  return (
    <div className="border-t pt-4">
      <div className="flex items-center space-x-2 mb-4">
        <Switch
          id="priceTiersToggle"
          checked={usePriceTiers}
          onCheckedChange={setUsePriceTiers}
        />
        <Label htmlFor="priceTiersToggle" className="flex items-center">
          <span>Use multiple price tiers</span>
          <Tags className="ml-1 h-4 w-4 text-gray-500" />
        </Label>
      </div>

      {/* Fee Bearer Selection - Show when using price tiers */}
      {usePriceTiers && (
        <Card className="bg-gray-50 mb-4">
          <CardContent className="pt-4">
            <h3 className="font-medium mb-3">Fee Bearer Selection</h3>
            <RadioGroup
              value={feeBearer}
              onValueChange={(value) => setFeeBearer(value as 'organizer' | 'contributor')}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="organizer" id="organizer-global" />
                <Label htmlFor="organizer-global">Organizer pays charges (deducted from collection)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contributor" id="contributor-global" />
                <Label htmlFor="contributor-global">Contributor pays charges (added to payment amount)</Label>
              </div>
            </RadioGroup>

            <div className="text-sm mt-3">
              <p className="font-medium">Fee Structure:</p>
              <ul className="list-disc pl-5 text-gray-600 space-y-1">
                <li>₦0 – ₦999: 3.0% fee</li>
                <li>₦1,000 – ₦4,999: 2.5% fee</li>
                <li>₦5,000 – ₦19,999: 2.0% fee</li>
                <li>₦20,000 and above: 1.5% fee</li>
                <li>Gateway fee: 1.5% (capped at ₦2,000)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {!usePriceTiers ? (
        <div className="space-y-2">
          <Label htmlFor="amount">Amount per Person (NGN)</Label>
          <Input
            id="amount"
            type="number"
            required
            min="0"
            step="0.01"
            placeholder="e.g. 2000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-medium text-base">Price Tiers</h3>

          {priceTiers.map((tier, index) => {
            const tierPrice = parseFloat(tier.price);
            const tierFees = !isNaN(tierPrice) && tierPrice > 0 ? calculateFeesForAmount(tierPrice) : null;

            return (
              <div key={tier.id} className="p-4 border rounded-md">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium">Tier {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemovePriceTier(tier.id)}
                    disabled={priceTiers.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-2">
                    <Label>Tier Name</Label>
                    <Input
                      value={tier.name}
                      onChange={(e) => handlePriceTierChange(tier.id, 'name', e.target.value)}
                      placeholder="e.g. Regular, VIP, etc."
                      required={usePriceTiers}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Price (NGN)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tier.price}
                      onChange={(e) => handlePriceTierChange(tier.id, 'price', e.target.value)}
                      placeholder="e.g. 5000"
                      required={usePriceTiers}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Input
                      value={tier.description}
                      onChange={(e) => handlePriceTierChange(tier.id, 'description', e.target.value)}
                      placeholder="Brief description of this tier"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity Available (Optional)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={tier.quantity}
                      onChange={(e) => handlePriceTierChange(tier.id, 'quantity', e.target.value)}
                      placeholder="Leave blank for unlimited"
                    />
                  </div>
                </div>

                {/* Fee Breakdown for this tier */}
                {tierFees && (
                  <Card className="bg-blue-50 mt-3">
                    <CardContent className="pt-3">
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm text-blue-900">Fee Breakdown for this tier</h5>

                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div>Base Price:</div>
                          <div className="text-right font-medium">₦{tierPrice.toLocaleString()}</div>

                          <div>Kolekto Fee ({tierFees.feePercentage}%):</div>
                          <div className="text-right">₦{tierFees.kolektoFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                          <div>Gateway Fee (1.5%):</div>
                          <div className="text-right">₦{tierFees.paymentGatewayFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                          <div className="border-t border-blue-200 pt-1 font-medium">Total Fees:</div>
                          <div className="border-t border-blue-200 pt-1 text-right font-medium">₦{tierFees.totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                          <div className="pt-1 font-bold text-blue-900">Amount Payable:</div>
                          <div className="pt-1 text-right font-bold text-blue-900">₦{tierFees.totalPayable.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                          <div className="font-bold text-green-700">You'll Receive:</div>
                          <div className="text-right font-bold text-green-700">₦{tierFees.amountToReceive.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleAddPriceTier}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Price Tier
          </Button>
        </div>
      )}

      {amount && parseFloat(amount) > 0 && !usePriceTiers && (
        <Card className="bg-gray-50 mt-4">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <h3 className="font-medium">Charges Breakdown</h3>

              <RadioGroup
                value={feeBearer}
                onValueChange={(value) => setFeeBearer(value as 'organizer' | 'contributor')}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="organizer" id="organizer" />
                  <Label htmlFor="organizer">Organizer pays charges (deducted from collection)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contributor" id="contributor" />
                  <Label htmlFor="contributor">Contributor pays charges (added to payment amount)</Label>
                </div>
              </RadioGroup>

              <div className="text-sm mb-2">
                <p className="font-medium">Fee Structure:</p>
                <ul className="list-disc pl-5 text-gray-600 space-y-1">
                  <li>₦0 – ₦999: 3.0% fee</li>
                  <li>₦1,000 – ₦4,999: 2.5% fee</li>
                  <li>₦5,000 – ₦19,999: 2.0% fee</li>
                  <li>₦20,000 and above: 1.5% fee</li>
                  <li>Gateway fee: 1.5% (capped at ₦2,000)</li>
                </ul>
              </div>

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
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PricingSection;