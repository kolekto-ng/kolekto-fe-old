import React from 'react';
import { Lock } from 'lucide-react';
import { WizardData, WizardTier, calculateFees, fmtCurrency } from '../wizardTypes';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const LOCK_REASON: Partial<Record<string, string>> = {
  open_pool: 'Open Pool collections always pass charges to contributors.',
  fundraising: 'Fundraising campaigns always pass charges to donors.',
};

const FeeRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-gray-600">{label}</span>
    <span className="font-medium text-gray-900">{value}</span>
  </div>
);

// Single tier breakdown block
const TierFeeBlock: React.FC<{
  tier: WizardTier;
  index: number;
  feeBearer: 'contributor' | 'organizer';
  collectionType: WizardData['collection_type'];
}> = ({ tier, index, feeBearer, collectionType }) => {
  const price = parseFloat(tier.price) || 0;
  if (price <= 0) return null;
  const fees = calculateFees(price, collectionType, feeBearer);
  const isContributor = feeBearer === 'contributor';

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {tier.name || `Tier ${index + 1}`}
        </span>
        <span className="text-xs text-gray-500">Base: {fmtCurrency(price)}</span>
      </div>
      <div className="p-4 space-y-2">
        <FeeRow label="Base amount" value={fmtCurrency(price)} />
        <FeeRow
          label="Kolekto fee (0.5%, max ₦2,000)"
          value={isContributor ? `+${fmtCurrency(fees.kolektoFee)}` : `−${fmtCurrency(fees.kolektoFee)}`}
        />
        <FeeRow
          label="Gateway fee (1.5%, max ₦2,000)"
          value={isContributor ? `+${fmtCurrency(fees.gatewayFee)}` : `−${fmtCurrency(fees.gatewayFee)}`}
        />
        <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
          <div className="flex justify-between text-sm font-semibold">
            <span>Contributor pays</span>
            <span className="text-green-700">{fmtCurrency(fees.totalPayable)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>You receive</span>
            <span className="text-gray-800">{fmtCurrency(price)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Step4Charges: React.FC<Props> = ({ data, onChange }) => {
  const locked = data.collection_type === 'open_pool' || data.collection_type === 'fundraising';
  const lockReason = LOCK_REASON[data.collection_type];

  const isTiered = data.collection_type === 'tiered';
  const isTicketTiered = data.collection_type === 'ticket' && data.ticket_mode === 'tiered';
  const showTierBreakdown = isTiered || isTicketTiered;

  // Single amount for fixed / ticket-fixed
  const fixedAmount =
    data.collection_type === 'fixed'
      ? parseFloat(data.fixed_amount) || 0
      : data.collection_type === 'ticket' && data.ticket_mode === 'fixed'
      ? parseFloat(data.ticket_price) || 0
      : 0;

  const effectiveBearer = locked ? 'contributor' : data.fee_bearer;
  const fixedFees = calculateFees(fixedAmount, data.collection_type, effectiveBearer);

  const handleToggle = (bearer: 'contributor' | 'organizer') => {
    if (!locked) onChange({ fee_bearer: bearer });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Charges Configuration</h2>
        <p className="text-gray-500 text-sm">Decide who absorbs the platform processing fees</p>
      </div>

      {/* Lock notice */}
      {locked && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{lockReason}</span>
        </div>
      )}

      {/* Toggle */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Who pays the processing fees?</p>

        <div
          onClick={() => handleToggle('contributor')}
          className={`flex items-start gap-3 p-4 border-2 rounded-xl transition-all cursor-pointer ${
            effectiveBearer === 'contributor'
              ? 'border-green-600 bg-green-50'
              : 'border-gray-200 hover:border-gray-300'
          } ${locked ? 'cursor-default' : ''}`}
        >
          <input
            type="radio"
            name="fee-bearer"
            checked={effectiveBearer === 'contributor'}
            onChange={() => handleToggle('contributor')}
            disabled={locked}
            className="mt-1 accent-green-600"
          />
          <div>
            <p className="font-medium text-sm text-gray-900">Contributors pay fees</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Fees are added on top — you receive the full amount
            </p>
          </div>
        </div>

        <div
          onClick={() => handleToggle('organizer')}
          className={`flex items-start gap-3 p-4 border-2 rounded-xl transition-all ${
            !locked && data.fee_bearer === 'organizer'
              ? 'border-green-600 bg-green-50'
              : locked
              ? 'border-gray-200 opacity-40 cursor-not-allowed'
              : 'border-gray-200 hover:border-gray-300 cursor-pointer'
          }`}
        >
          <input
            type="radio"
            name="fee-bearer"
            checked={!locked && data.fee_bearer === 'organizer'}
            onChange={() => handleToggle('organizer')}
            disabled={locked}
            className="mt-1 accent-green-600"
          />
          <div>
            <p className="font-medium text-sm text-gray-900">Organizer absorbs fees</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Fees are deducted from your payout — contributors pay the displayed amount only
            </p>
          </div>
        </div>
      </div>

      {/* Fee structure note */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-600 space-y-1">
        <p className="font-medium text-gray-800 text-sm">Platform Fee Structure</p>
        <p>• Kolekto fee: 0.5% per transaction (capped at ₦2,000)</p>
        <p>• Payment gateway fee: 1.5% per transaction (capped at ₦2,000)</p>
      </div>

      {/* Breakdowns */}
      {showTierBreakdown && data.pricing_tiers.some((t) => parseFloat(t.price) > 0) && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Fee breakdown per tier</p>
          {data.pricing_tiers.map((tier, i) => (
            <TierFeeBlock
              key={tier.id}
              tier={tier}
              index={i}
              feeBearer={effectiveBearer}
              collectionType={data.collection_type}
            />
          ))}
        </div>
      )}

      {/* Fixed / ticket-fixed breakdown */}
      {!showTierBreakdown && fixedAmount > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-100 px-4 py-2">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Fee Breakdown
            </span>
          </div>
          <div className="p-4 space-y-2">
            <FeeRow label="Base amount" value={fmtCurrency(fixedAmount)} />
            <FeeRow
              label="Kolekto fee (0.5%, max ₦2,000)"
              value={
                effectiveBearer === 'contributor'
                  ? `+${fmtCurrency(fixedFees.kolektoFee)}`
                  : `−${fmtCurrency(fixedFees.kolektoFee)}`
              }
            />
            <FeeRow
              label="Gateway fee (1.5%, max ₦2,000)"
              value={
                effectiveBearer === 'contributor'
                  ? `+${fmtCurrency(fixedFees.gatewayFee)}`
                  : `−${fmtCurrency(fixedFees.gatewayFee)}`
              }
            />
            <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
              <div className="flex justify-between text-sm font-semibold">
                <span>Contributor pays</span>
                <span className="text-green-700">{fmtCurrency(fixedFees.totalPayable)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>You receive</span>
                <span className="text-gray-800">{fmtCurrency(fixedAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4Charges;
