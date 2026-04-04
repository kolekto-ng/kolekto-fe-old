import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Hash } from 'lucide-react';
import { WizardData } from '../wizardTypes';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const Step6UniqueId: React.FC<Props> = ({ data, onChange }) => {
  const isTicket = data.collection_type === 'ticket';
  const isTiered = data.collection_type === 'tiered';
  const isTicketTiered = isTicket && data.ticket_mode === 'tiered';

  // For ticket collections, unique ID is mandatory
  const mandatory = isTicket;
  const enabled = mandatory || data.unique_id_enabled;

  const toggleEnabled = () => {
    if (!mandatory) {
      onChange({ unique_id_enabled: !data.unique_id_enabled });
    }
  };

  const updateTierPrefix = (tierId: string, prefix: string) => {
    onChange({
      pricing_tiers: data.pricing_tiers.map((t) =>
        t.id === tierId ? { ...t, prefix: prefix.toUpperCase() } : t
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Unique ID Configuration</h2>
        <p className="text-gray-500 text-sm">
          {isTicket
            ? 'Each ticket receives a unique ID and QR code automatically'
            : 'Optionally assign each contributor a unique identifier'}
        </p>
      </div>

      {/* Mandatory notice for tickets */}
      {mandatory && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Unique ID is required for Ticket collections</p>
            <p className="text-xs mt-0.5 text-green-600">
              Every ticket purchase generates a unique ID and a scannable QR code automatically.
            </p>
          </div>
        </div>
      )}

      {/* Toggle for non-ticket types */}
      {!mandatory && (
        <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={data.unique_id_enabled}
            onChange={toggleEnabled}
            className="mt-1 accent-green-600 w-4 h-4"
          />
          <div>
            <p className="font-medium text-sm text-gray-900">Enable Unique ID for contributors</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Each contributor will receive a unique identifier (e.g. REG0001, VIP0042)
            </p>
          </div>
        </label>
      )}

      {/* Configuration when enabled */}
      {enabled && (
        <div className="space-y-4 animate-in fade-in">
          {/* Single prefix — for fixed, open_pool, or ticket-fixed, or tiered-with-global-prefix */}
          {(!isTiered && !isTicketTiered) && (
            <div className="space-y-1.5">
              <Label>
                ID Prefix{' '}
                <span className="text-gray-400 text-xs font-normal">(Optional — e.g. REG, VIP, KLK)</span>
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9 uppercase"
                  placeholder="e.g. KLK"
                  value={data.unique_id_prefix}
                  onChange={(e) => onChange({ unique_id_prefix: e.target.value.toUpperCase() })}
                  maxLength={8}
                />
              </div>
              {data.unique_id_prefix && (
                <p className="text-xs text-gray-500">
                  IDs will look like: <span className="font-mono font-medium text-green-700">{data.unique_id_prefix}0001</span>,{' '}
                  <span className="font-mono font-medium text-green-700">{data.unique_id_prefix}0002</span>, …
                </p>
              )}
            </div>
          )}

          {/* Per-tier prefix — tiered or ticket-tiered */}
          {(isTiered || isTicketTiered) && data.pricing_tiers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Per-tier ID prefix (optional)</p>
              <p className="text-xs text-gray-500">
                Leave blank to use the same sequence for all tiers.
              </p>

              {data.pricing_tiers.map((tier, i) => (
                <div key={tier.id} className="flex items-center gap-3 p-3 border rounded-xl bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {tier.name || `Tier ${i + 1}`}
                    </p>
                    <p className="text-xs text-gray-400">{tier.price ? `₦${parseFloat(tier.price).toLocaleString()}` : 'No price set'}</p>
                  </div>
                  <div className="w-36">
                    <Input
                      className="uppercase text-sm"
                      placeholder="e.g. VIP"
                      value={tier.prefix}
                      onChange={(e) => updateTierPrefix(tier.id, e.target.value)}
                      maxLength={8}
                    />
                  </div>
                </div>
              ))}

              {data.pricing_tiers.some((t) => t.prefix) && (
                <div className="space-y-1 text-xs text-gray-500 pl-1">
                  {data.pricing_tiers.filter((t) => t.prefix).map((t) => (
                    <p key={t.id}>
                      <span className="font-medium">{t.name || 'Unnamed'}</span>:{' '}
                      <span className="font-mono text-green-700">{t.prefix}0001</span>,{' '}
                      <span className="font-mono text-green-700">{t.prefix}0002</span>, …
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ticket note */}
          {isTicket && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
              <p className="font-medium mb-1">How ticket IDs work</p>
              <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
                <li>Each individual ticket gets its own unique ID</li>
                <li>A QR code is generated from the unique ID</li>
                <li>If a buyer purchases 3 tickets, they receive 3 different IDs & QR codes</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Step6UniqueId;
