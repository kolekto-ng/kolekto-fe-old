import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Target } from 'lucide-react';
import { WizardData, displayCurrency, sanitizeCurrency, fmtCurrency } from '../wizardTypes';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const FundraisingGoalStep: React.FC<Props> = ({ data, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Campaign Goal</h2>
        <p className="text-gray-500 text-sm">Set your fundraising target and timeline</p>
      </div>

      {/* Target amount */}
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 border-2 rounded-xl">
          <input
            type="checkbox"
            id="open-ended"
            checked={data.fundraising_open_ended}
            onChange={(e) => onChange({ fundraising_open_ended: e.target.checked, fundraising_target: '' })}
            className="mt-1 accent-green-600 w-4 h-4"
          />
          <label htmlFor="open-ended" className="cursor-pointer">
            <p className="font-medium text-sm text-gray-900">Open-ended fundraiser</p>
            <p className="text-xs text-gray-500 mt-0.5">No fixed target — collect as much as possible</p>
          </label>
        </div>

        {!data.fundraising_open_ended && (
          <div className="space-y-1.5">
            <Label>
              Target Amount (₦) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="e.g. 500,000"
                value={displayCurrency(data.fundraising_target)}
                onChange={(e) => onChange({ fundraising_target: sanitizeCurrency(e.target.value) })}
                inputMode="decimal"
              />
            </div>
            {data.fundraising_target && (
              <p className="text-xs text-gray-500">
                Target: <span className="font-medium text-green-700">{fmtCurrency(parseFloat(data.fundraising_target))}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Deadline */}
      <div className="space-y-1.5">
        <Label htmlFor="fundraising-deadline">Campaign Deadline (Optional)</Label>
        <p className="text-xs text-gray-500">Leave blank for an open-ended campaign</p>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="fundraising-deadline"
            type="date"
            value={data.fundraising_deadline}
            onChange={(e) => onChange({ fundraising_deadline: e.target.value })}
            className="pl-9"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      {/* Auto close */}
      {(data.fundraising_deadline || !data.fundraising_open_ended) && (
        <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={data.fundraising_auto_close}
            onChange={(e) => onChange({ fundraising_auto_close: e.target.checked })}
            className="mt-1 accent-green-600 w-4 h-4"
          />
          <div>
            <p className="font-medium text-sm text-gray-900">Auto-close when target or deadline is reached</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Stop accepting new donations automatically when the goal is hit or deadline passes
            </p>
          </div>
        </label>
      )}

      {/* Fee note */}
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800">
        <p className="font-medium mb-1">Fundraising fee structure</p>
        <ul className="text-xs text-rose-700 space-y-1 list-disc pl-4">
          <li>Kolekto fee: 1% per donation (capped at ₦2,000)</li>
          <li>Payment gateway fee: 1.5% (capped at ₦2,000)</li>
          <li>Fees are always added to the donor's payment — you receive the full donation</li>
        </ul>
      </div>
    </div>
  );
};

export default FundraisingGoalStep;
