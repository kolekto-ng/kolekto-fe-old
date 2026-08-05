import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Clock, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { useProfileStore } from '@/store/useProfileStore';

/**
 * Persistent KYC banner for unverified organizers.
 *
 * Shown to EVERY unverified user, not only legacy ones. A brand-new
 * unverified account is equally unable to withdraw or create a second
 * collection, so hiding the banner from them would leave them to discover
 * those limits by hitting an error mid-task.
 *
 * This component makes NO KYC decisions. Everything it renders comes from
 * `GET /settings/kyc/access-status` (backend `featureAccessService`) via
 * `kycData` — `showBanner`, `banner.title/message`, and the `journey`
 * progress. The backend is the authority; this is that authority made
 * visible. Copy varies by phase there, so an account already under review
 * sees "we're reviewing" rather than a call to action it has completed.
 *
 * Mount on: Dashboard, Collections, Wallet/Transactions, Settings.
 */

interface JourneyStep {
  key: string;
  label: string;
  status: 'complete' | 'pending' | 'action_needed' | 'not_started';
  rejectionReason?: string | null;
}

interface KycBannerData {
  showBanner?: boolean;
  banner?: { title: string; message: string } | null;
  journey?: {
    phase?: string;
    steps?: JourneyStep[];
    averageReviewTimeHours?: number | null;
  } | null;
}

/** Visual treatment per phase — review is informational, not a warning. */
const PHASE_STYLES: Record<
  string,
  { wrap: string; icon: string; title: string; body: string; cta: string }
> = {
  under_review: {
    wrap: 'border-blue-200 bg-blue-50',
    icon: 'text-blue-600',
    title: 'text-blue-800',
    body: 'text-blue-700',
    cta: 'bg-blue-600 hover:bg-blue-700',
  },
  default: {
    wrap: 'border-amber-200 bg-amber-50',
    icon: 'text-amber-600',
    title: 'text-amber-800',
    body: 'text-amber-700',
    cta: 'bg-amber-600 hover:bg-amber-700',
  },
};

const STEP_ICON = {
  complete: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
  pending: <Clock className="h-3.5 w-3.5 text-blue-600" />,
  action_needed: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />,
  not_started: <Circle className="h-3.5 w-3.5 text-slate-400" />,
} as const;

export const KycEnforcementBanner: React.FC = () => {
  const { kycData } = useProfileStore() as { kycData?: KycBannerData };

  if (!kycData?.showBanner || !kycData.banner) return null;

  const phase = kycData.journey?.phase;
  const steps = kycData.journey?.steps ?? [];
  const styles = PHASE_STYLES[phase ?? ''] ?? PHASE_STYLES.default;

  const inReview = phase === 'under_review';
  const needsAction = phase === 'needs_more_info' || phase === 'rejected';

  // Only show the checklist once the user has actually started — a row of
  // empty circles on a brand-new account is noise, not progress.
  const hasProgress = Boolean(phase) && phase !== 'not_started';
  const completed = steps.filter((s) => s.status === 'complete').length;

  const avgHours = kycData.journey?.averageReviewTimeHours;

  return (
    <div className={`mb-4 rounded-2xl border p-4 ${styles.wrap}`}>
      <div className="flex items-start gap-3">
        {inReview ? (
          <Clock className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} />
        ) : needsAction ? (
          <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} />
        ) : (
          <ShieldAlert className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} />
        )}

        <div className="flex-1">
          <p className={`text-sm font-semibold ${styles.title}`}>{kycData.banner.title}</p>
          <p className={`mt-1 text-xs leading-relaxed ${styles.body}`}>
            {kycData.banner.message}
          </p>

          {hasProgress && steps.length > 0 && (
            <div className="mt-3">
              <p className={`text-[11px] font-medium ${styles.body}`}>
                {completed} of {steps.length} steps complete
                {inReview && avgHours ? ` · usually reviewed within ${avgHours}h` : ''}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {steps.map((step) => (
                  <li key={step.key} className="flex items-center gap-1.5">
                    {STEP_ICON[step.status] ?? STEP_ICON.not_started}
                    <span className={`text-[11px] ${styles.body}`}>{step.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Link
          to="/dashboard/settings"
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white ${styles.cta}`}
        >
          {inReview ? 'Check status' : hasProgress ? 'Continue' : 'Verify Now'}
        </Link>
      </div>
    </div>
  );
};

export default KycEnforcementBanner;
