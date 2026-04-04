import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { WizardData, WizardTier, displayCurrency, sanitizeCurrency, calculateFees, fmtCurrency } from '../wizardTypes';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

// ─── Shared tier card ─────────────────────────────────────────────────────────

const TierCard: React.FC<{
  tier: WizardTier;
  index: number;
  total: number;
  showPrefix?: boolean;
  onUpdate: (id: string, key: keyof WizardTier, val: string) => void;
  onRemove: (id: string) => void;
}> = ({ tier, index, total, showPrefix, onUpdate, onRemove }) => (
  <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-400">
        <GripVertical className="w-4 h-4" />
        <span className="text-sm font-medium text-gray-700">Tier {index + 1}</span>
      </div>
      {total > 1 && (
        <button
          type="button"
          onClick={() => onRemove(tier.id)}
          className="text-red-400 hover:text-red-600 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Tier Name *</Label>
        <Input
          placeholder="e.g. Regular, VIP"
          value={tier.name}
          onChange={(e) => onUpdate(tier.id, 'name', e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Price (₦) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
          <Input
            className="pl-7"
            placeholder="0"
            value={displayCurrency(tier.price)}
            onChange={(e) => onUpdate(tier.id, 'price', sanitizeCurrency(e.target.value))}
            inputMode="decimal"
          />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Capacity (Optional)</Label>
        <Input
          type="number"
          placeholder="Unlimited"
          min={1}
          value={tier.quantity}
          onChange={(e) => onUpdate(tier.id, 'quantity', e.target.value)}
        />
      </div>
      {showPrefix && (
        <div className="space-y-1">
          <Label className="text-xs">Unique ID Prefix (Optional)</Label>
          <Input
            placeholder="e.g. VIP2026"
            value={tier.prefix}
            onChange={(e) => onUpdate(tier.id, 'prefix', e.target.value.toUpperCase())}
            maxLength={10}
          />
        </div>
      )}
    </div>

    <div className="space-y-1">
      <Label className="text-xs">Description (Optional)</Label>
      <Input
        placeholder="What's included in this tier?"
        value={tier.description}
        onChange={(e) => onUpdate(tier.id, 'description', e.target.value)}
      />
    </div>
  </div>
);

// ─── Fixed pricing ─────────────────────────────────────────────────────────

const FixedPricing: React.FC<Props> = ({ data, onChange }) => {
  const fees = calculateFees(parseFloat(data.fixed_amount) || 0, data.collection_type, data.fee_bearer);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>
            Amount (₦) <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
            <Input
              className="pl-7"
              placeholder="e.g. 5,000"
              value={displayCurrency(data.fixed_amount)}
              onChange={(e) => onChange({ fixed_amount: sanitizeCurrency(e.target.value) })}
              inputMode="decimal"
            />
          </div>
          <p className="text-xs text-gray-500">Minimum ₦101</p>
        </div>

        <div className="space-y-1.5">
          <Label>Max Contributors (Optional)</Label>
          <Input
            type="number"
            placeholder="Unlimited"
            min={1}
            value={data.max_contributors}
            onChange={(e) => onChange({ max_contributors: e.target.value })}
          />
          <p className="text-xs text-gray-500">Leave empty for unlimited</p>
        </div>
      </div>

      {data.fixed_amount && parseFloat(data.fixed_amount) > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2 text-sm">
          <p className="font-medium text-gray-900">Fee Preview</p>
          <p className="text-gray-500 text-xs">Each contributor pays exactly:</p>
          <div className="space-y-1 text-gray-700">
            <div className="flex justify-between">
              <span>Base amount</span>
              <span>{fmtCurrency(parseFloat(data.fixed_amount))}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs">
              <span>Kolekto fee (0.5%, max ₦2,000)</span>
              <span>{data.fee_bearer === 'contributor' ? `+${fmtCurrency(fees.kolektoFee)}` : 'Absorbed'}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs">
              <span>Gateway fee (1.5%, max ₦2,000)</span>
              <span>{data.fee_bearer === 'contributor' ? `+${fmtCurrency(fees.gatewayFee)}` : 'Absorbed'}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2 mt-1">
              <span>Total payable</span>
              <span className="text-green-700">{fmtCurrency(fees.totalPayable)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tiered pricing ───────────────────────────────────────────────────────────

const TieredPricing: React.FC<Props & { showPrefix?: boolean }> = ({ data, onChange, showPrefix }) => {
  const updateTier = (id: string, key: keyof WizardTier, val: string) => {
    onChange({
      pricing_tiers: data.pricing_tiers.map((t) => (t.id === id ? { ...t, [key]: val } : t)),
    });
  };

  const addTier = () => {
    onChange({
      pricing_tiers: [
        ...data.pricing_tiers,
        { id: Date.now().toString(), name: '', price: '', description: '', quantity: '', prefix: '' },
      ],
    });
  };

  const removeTier = (id: string) => {
    onChange({ pricing_tiers: data.pricing_tiers.filter((t) => t.id !== id) });
  };

  return (
    <div className="space-y-4">
      {data.pricing_tiers.map((tier, i) => (
        <TierCard
          key={tier.id}
          tier={tier}
          index={i}
          total={data.pricing_tiers.length}
          showPrefix={showPrefix}
          onUpdate={updateTier}
          onRemove={removeTier}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addTier}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 mr-2" /> Add Tier
      </Button>
    </div>
  );
};

// ─── Open Pool pricing ────────────────────────────────────────────────────────

const OpenPoolPricing: React.FC<Props> = ({ data, onChange }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label>
          Minimum Amount (₦) <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
          <Input
            className="pl-7"
            placeholder="e.g. 500"
            value={displayCurrency(data.min_amount)}
            onChange={(e) => onChange({ min_amount: sanitizeCurrency(e.target.value) })}
            inputMode="decimal"
          />
        </div>
        <p className="text-xs text-gray-500">Contributors cannot pay less than this</p>
      </div>

      <div className="space-y-1.5">
        <Label>Target Amount (₦) — Optional</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
          <Input
            className="pl-7"
            placeholder="e.g. 500,000"
            value={displayCurrency(data.target_amount)}
            onChange={(e) => onChange({ target_amount: sanitizeCurrency(e.target.value) })}
            inputMode="decimal"
          />
        </div>
        <p className="text-xs text-gray-500">Shows a progress bar on the contribution page</p>
      </div>
    </div>

    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
      <p className="font-medium mb-1">Open Pool charges</p>
      <p className="text-xs">
        Fees (0.5% Kolekto + 1.5% gateway, each capped at ₦2,000) are always added to the contributor's payment
        in Open Pool collections.
      </p>
    </div>
  </div>
);

// ─── Ticket pricing ───────────────────────────────────────────────────────────

const TicketPricing: React.FC<Props> = ({ data, onChange }) => {
  const isFixed = data.ticket_mode === 'fixed';

  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div>
        <Label className="mb-2 block">Ticket Pricing Mode</Label>
        <div className="grid grid-cols-2 gap-3">
          {(['fixed', 'tiered'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ ticket_mode: mode })}
              className={`p-3 border-2 rounded-xl text-left transition-all ${
                data.ticket_mode === mode
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-sm capitalize">{mode} Price</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {mode === 'fixed' ? 'One price, one ticket type' : 'Multiple ticket categories'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {isFixed ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Ticket Price (₦) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                <Input
                  className="pl-7"
                  placeholder="e.g. 10,000"
                  value={displayCurrency(data.ticket_price)}
                  onChange={(e) => onChange({ ticket_price: sanitizeCurrency(e.target.value) })}
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Total Tickets Available (Optional)</Label>
              <Input
                type="number"
                placeholder="Unlimited"
                min={1}
                value={data.max_contributors}
                onChange={(e) => onChange({ max_contributors: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={data.allow_multiple_quantity}
              onChange={(e) => onChange({ allow_multiple_quantity: e.target.checked })}
              className="mt-0.5 accent-green-600"
            />
            <div>
              <p className="font-medium text-sm">Allow multiple tickets per purchase</p>
              <p className="text-xs text-gray-500">
                Buyers can select quantity — each ticket gets its own unique ID & QR code
              </p>
            </div>
          </label>
        </div>
      ) : (
        <TieredPricing data={data} onChange={onChange} showPrefix />
      )}
    </div>
  );
};

// ─── Main export ─────────────────────────────────────────────────────────────

const Step3Pricing: React.FC<Props> = ({ data, onChange }) => {
  const headings: Record<string, { heading: string; sub: string }> = {
    fixed: { heading: 'Pricing Setup', sub: 'Set the amount every contributor will pay' },
    tiered: { heading: 'Pricing Tiers', sub: 'Create multiple pricing categories for contributors' },
    open_pool: { heading: 'Amount Configuration', sub: 'Set the floor and target for your open pool' },
    ticket: { heading: 'Ticket Pricing', sub: 'Configure ticket types and pricing' },
  };

  const { heading, sub } = headings[data.collection_type] || headings.fixed;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{heading}</h2>
        <p className="text-gray-500 text-sm">{sub}</p>
      </div>

      {data.collection_type === 'fixed' && <FixedPricing data={data} onChange={onChange} />}
      {data.collection_type === 'tiered' && <TieredPricing data={data} onChange={onChange} />}
      {data.collection_type === 'open_pool' && <OpenPoolPricing data={data} onChange={onChange} />}
      {data.collection_type === 'ticket' && <TicketPricing data={data} onChange={onChange} />}
    </div>
  );
};

export default Step3Pricing;
