import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hash } from 'lucide-react';
import { WizardData } from '../wizardTypes';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const Step6UniqueId: React.FC<Props> = ({ data, onChange }) => {
  const isTicket = data.collection_type === 'ticket';
  const isTiered = data.collection_type === 'tiered';
  const isTicketTiered = isTicket && data.ticket_mode === 'tiered';
  const enabled = data.unique_id_enabled;

  const toggleEnabled = () => {
    onChange({ unique_id_enabled: !data.unique_id_enabled });
  };

  const updateTierPrefix = (tierId: string, prefix: string) => {
    onChange({
      pricing_tiers: data.pricing_tiers.map((tier) =>
        tier.id === tierId ? { ...tier, prefix: prefix.toUpperCase() } : tier
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-gray-900">Unique ID Configuration</h2>
        <p className="text-sm text-gray-500">
          {isTicket
            ? 'Add a prefix only if you want ticket IDs generated for each purchase'
            : 'Optionally assign each contributor a unique identifier'}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors hover:bg-gray-50">
        <input
          type="checkbox"
          checked={data.unique_id_enabled}
          onChange={toggleEnabled}
          className="mt-1 h-4 w-4 accent-green-600"
        />
        <div>
          <p className="text-sm font-medium text-gray-900">
            {isTicket ? 'Enable Ticket IDs' : 'Enable Unique ID for contributors'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            IDs are only generated when you add a prefix. No prefix means no unique ID will be assigned.
          </p>
        </div>
      </label>

      {enabled && (
        <div className="animate-in space-y-4 fade-in">
          {(!isTiered && !isTicketTiered) && (
            <div className="space-y-1.5">
              <Label>
                ID Prefix{' '}
                <span className="text-xs font-normal text-gray-400">(Optional, for example REG or VIP)</span>
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-9 uppercase"
                  placeholder="e.g. REG"
                  value={data.unique_id_prefix}
                  onChange={(e) => onChange({ unique_id_prefix: e.target.value.toUpperCase() })}
                  maxLength={8}
                />
              </div>
              {data.unique_id_prefix && (
                <p className="text-xs text-gray-500">
                  IDs will look like <span className="font-mono font-medium text-green-700">{data.unique_id_prefix}0001</span> and <span className="font-mono font-medium text-green-700">{data.unique_id_prefix}0002</span>.
                </p>
              )}
            </div>
          )}

          {(isTiered || isTicketTiered) && data.pricing_tiers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Per-tier ID prefix (optional)</p>
              <p className="text-xs text-gray-500">
                Add a prefix only to the tiers that should generate IDs.
              </p>

              {data.pricing_tiers.map((tier, index) => (
                <div key={tier.id} className="flex items-center gap-3 rounded-xl border bg-gray-50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {tier.name || `Tier ${index + 1}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {tier.price ? `NGN ${parseFloat(tier.price).toLocaleString()}` : 'No price set'}
                    </p>
                  </div>
                  <div className="w-36">
                    <Input
                      className="text-sm uppercase"
                      placeholder="e.g. VIP"
                      value={tier.prefix}
                      onChange={(e) => updateTierPrefix(tier.id, e.target.value)}
                      maxLength={8}
                    />
                  </div>
                </div>
              ))}

              {data.pricing_tiers.some((tier) => tier.prefix) && (
                <div className="space-y-1 pl-1 text-xs text-gray-500">
                  {data.pricing_tiers.filter((tier) => tier.prefix).map((tier) => (
                    <p key={tier.id}>
                      <span className="font-medium">{tier.name || 'Unnamed'}</span>: <span className="font-mono text-green-700">{tier.prefix}0001</span>, <span className="font-mono text-green-700">{tier.prefix}0002</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {isTicket && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="mb-1 font-medium">How ticket IDs work</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-gray-500">
                <li>Each ticket gets its own ID only when you add a prefix</li>
                <li>No prefix means tickets are issued without generated IDs</li>
                <li>If a buyer purchases 3 tickets, each ticket gets its own ID only when enabled and configured</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Step6UniqueId;
