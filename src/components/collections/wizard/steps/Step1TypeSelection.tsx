import React from 'react';
import { CollectionType, TYPE_META } from '../wizardTypes';
import { Lock, Layers, Waves, Ticket, Heart } from 'lucide-react';

const ICON_MAP: Record<CollectionType, React.ElementType> = {
  fixed: Lock,
  tiered: Layers,
  open_pool: Waves,
  ticket: Ticket,
  fundraising: Heart,
};

interface Props {
  value: CollectionType;
  onChange: (type: CollectionType) => void;
}

const TYPE_ORDER: CollectionType[] = ['fixed', 'tiered', 'open_pool', 'ticket', 'fundraising'];

const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-500 bg-blue-50 ring-blue-200',
  purple: 'border-purple-500 bg-purple-50 ring-purple-200',
  cyan: 'border-cyan-500 bg-cyan-50 ring-cyan-200',
  orange: 'border-orange-500 bg-orange-50 ring-orange-200',
  rose: 'border-rose-500 bg-rose-50 ring-rose-200',
};

const DOT_MAP: Record<string, string> = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  cyan: 'bg-cyan-500',
  orange: 'bg-orange-500',
  rose: 'bg-rose-500',
};

const DETAILS: Record<CollectionType, string[]> = {
  fixed: [
    'All contributors pay the same amount',
    'Optional contributor limit',
    'Custom form fields',
    'Unique ID support',
  ],
  tiered: [
    'Multiple pricing categories',
    'Per-tier capacity limits',
    'Drag-to-reorder tiers',
    'Per-tier unique ID prefix',
  ],
  open_pool: [
    'Contributors set their own amount',
    'Set a minimum contribution',
    'Optional fundraising target',
    'Progress bar for contributors',
  ],
  ticket: [
    'Fixed or tiered ticket pricing',
    'QR code per ticket',
    'Multi-quantity purchases',
    'Ticket template upload',
  ],
  fundraising: [
    'Campaign story with images',
    'Donor wall (optional anonymous)',
    'Preset & custom amounts',
    'Pending review before going live',
  ],
};

const Step1TypeSelection: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose Collection Type</h2>
        <p className="text-gray-500 text-sm">Select the type that best fits your campaign</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TYPE_ORDER.map((type) => {
          const meta = TYPE_META[type];
          const isSelected = value === type;
          const colorClass = isSelected ? COLOR_MAP[meta.color] : 'border-gray-200 bg-white hover:border-gray-300';

          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`text-left p-4 border-2 rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ${colorClass} ${isSelected ? `ring-2` : ''}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-xl flex-shrink-0 ${isSelected ? DOT_MAP[meta.color] + ' text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {React.createElement(ICON_MAP[type], { className: "w-5 h-5" })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{meta.label}</h3>
                    {isSelected && (
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_MAP[meta.color]}`} />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.tagline}</p>
                </div>
              </div>

              <ul className="space-y-1">
                {DETAILS[type].map((detail, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {detail}
                  </li>
                ))}
              </ul>

              {type === 'fundraising' && (
                <div className="mt-3 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                  Requires verification review before going live
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
        <strong>Selected:</strong> {TYPE_META[value].label} — {TYPE_META[value].tagline}
      </div>
    </div>
  );
};

export default Step1TypeSelection;
