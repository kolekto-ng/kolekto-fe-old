import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Clock, AlertTriangle, Circle, ShieldCheck } from 'lucide-react';

type StepStatus = 'complete' | 'pending' | 'action_needed' | 'not_started';

interface JourneyStep {
  key: string;
  label: string;
  status: StepStatus;
  rejectionReason?: string | null;
}

interface Journey {
  phase: 'not_started' | 'in_progress' | 'under_review' | 'needs_more_info' | 'rejected' | 'verified';
  title: string;
  message: string;
  steps: JourneyStep[];
  accountRejectionReason?: string | null;
  averageReviewTimeHours?: number | null;
  canContinueUsingKolekto: boolean;
  unlockedFeatures: string[];
  lockedFeatures: string[];
}

const STEP_ICON: Record<StepStatus, React.ReactNode> = {
  complete: <Check className="h-4 w-4 text-emerald-600" />,
  pending: <Clock className="h-4 w-4 text-amber-500" />,
  action_needed: <AlertTriangle className="h-4 w-4 text-red-600" />,
  not_started: <Circle className="h-4 w-4 text-gray-300" />,
};

const STEP_LABEL: Record<StepStatus, string> = {
  complete: 'Verified',
  pending: 'Submitted — awaiting review',
  action_needed: 'Needs your attention',
  not_started: 'Not started',
};

/**
 * The "guided onboarding, not just a restriction" panel: what step the user
 * is on, what happens next, and — critically — what they can and can't
 * still do while they wait. Every field comes from
 * GET /settings/kyc/access-status (services/featureAccessService.js
 * getAccessStatus().journey) — nothing here is computed or hardcoded in the
 * frontend, so this can never show a state the backend didn't actually
 * observe.
 */
export const KycJourneyPanel: React.FC<{ journey?: Journey | null }> = ({ journey }) => {
  if (!journey) return null;

  const { phase, title, message, steps, accountRejectionReason, averageReviewTimeHours, unlockedFeatures, lockedFeatures } = journey;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1B5E20]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{message}</p>

        {phase === 'rejected' && accountRejectionReason && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-700 mb-1">Reason</p>
            <p className="text-xs text-red-600">{accountRejectionReason}</p>
          </div>
        )}

        {phase === 'under_review' && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs text-blue-700">
              {typeof averageReviewTimeHours === 'number'
                ? `Most recent reviews have taken about ${averageReviewTimeHours} hour${averageReviewTimeHours === 1 ? '' : 's'}.`
                : 'Reviews are typically completed within 24–48 hours.'}
            </p>
          </div>
        )}

        {/* Step checklist — built entirely from real backend flags/documents */}
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.key}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200">
                  {STEP_ICON[step.status]}
                </span>
                <span className="text-sm font-medium text-gray-900">{step.label}</span>
              </div>
              <span
                className={
                  step.status === 'action_needed'
                    ? 'text-xs font-medium text-red-600'
                    : step.status === 'complete'
                      ? 'text-xs font-medium text-emerald-600'
                      : 'text-xs text-gray-500'
                }
              >
                {STEP_LABEL[step.status]}
              </span>
            </div>
          ))}
          {steps
            .filter((s) => s.status === 'action_needed' && s.rejectionReason)
            .map((s) => (
              <div key={`${s.key}-reason`} className="rounded-lg border border-red-100 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700">{s.label}: </p>
                <p className="text-xs text-red-600">{s.rejectionReason}</p>
              </div>
            ))}
        </div>

        {/* "Can I still use Kolekto?" answered explicitly instead of left to guess. */}
        {phase !== 'verified' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Still available to you</p>
              <ul className="space-y-0.5">
                {unlockedFeatures.map((f) => (
                  <li key={f} className="text-xs text-emerald-700">• {f}</li>
                ))}
              </ul>
            </div>
            {lockedFeatures.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Unlocks once verified</p>
                <ul className="space-y-0.5">
                  {lockedFeatures.map((f) => (
                    <li key={f} className="text-xs text-gray-500">• {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KycJourneyPanel;
