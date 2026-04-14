import React from 'react';
import { CheckCircle2, ChevronLeft, X, Banknote, Hash, FileText, Tag } from 'lucide-react';
import { WizardData, TYPE_META, fmtCurrency, calculateFees } from '../wizardTypes';

interface Props {
  data: WizardData;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  onSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <div className="border border-gray-200 rounded-xl p-4 space-y-3">
    <div className="flex items-center gap-2 text-gray-900 font-semibold text-sm">
      {icon}
      <span>{title}</span>
    </div>
    <div className="space-y-2 text-sm text-gray-700">{children}</div>
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-start gap-2">
    <span className="text-gray-500 flex-shrink-0">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);

const ReviewStep: React.FC<Props> = ({ data, isSubmitting, isAuthenticated, onSubmit, onBack, onCancel }) => {
  const meta = TYPE_META[data.collection_type];
  const isFundraising = data.collection_type === 'fundraising';
  const isTicket = data.collection_type === 'ticket';
  const isTiered = data.collection_type === 'tiered';
  const isOpenPool = data.collection_type === 'open_pool';

  // Representative amount for fee display
  let reprAmount = 0;
  if (data.collection_type === 'fixed') reprAmount = parseFloat(data.fixed_amount) || 0;
  else if (isTicket) reprAmount = parseFloat(data.ticket_price) || 0;
  else if (isTiered && data.pricing_tiers.length > 0)
    reprAmount = parseFloat(data.pricing_tiers[0].price) || 0;
  else if (isOpenPool) reprAmount = parseFloat(data.min_amount) || 0;
  else if (isFundraising) reprAmount = parseFloat(data.fundraising_target) || 0;

  const fees = calculateFees(reprAmount, data.collection_type, isFundraising || isOpenPool ? 'contributor' : data.fee_bearer);

  const uniqueEnabled =
    data.unique_id_enabled &&
    (Boolean(data.unique_id_prefix.trim()) || data.pricing_tiers.some((t) => Boolean(t.prefix.trim())));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Review & Publish</h2>
        <p className="text-gray-500 text-sm">Check everything looks good before going live</p>
      </div>

      {/* Type badge */}
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <span className="text-2xl">{meta.icon}</span>
        <div>
          <p className="font-semibold text-gray-900">{meta.label}</p>
          <p className="text-xs text-gray-500">{meta.tagline}</p>
        </div>
        {isFundraising && (
          <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium flex-shrink-0">
            Pending Review
          </span>
        )}
        {!isFundraising && (
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex-shrink-0">
            Goes Live Immediately
          </span>
        )}
      </div>

      {/* Basic info */}
      <Section icon={<FileText className="w-4 h-4" />} title="Basic Information">
        <Row label="Title" value={data.title || <span className="text-red-400">Missing</span>} />
        {data.description && <Row label="Description" value={<span className="text-right max-w-xs line-clamp-2">{data.description}</span>} />}
        {(data.collection_type !== 'fundraising') && data.deadline && (
          <Row label="Deadline" value={new Date(data.deadline).toLocaleDateString('en-NG', { dateStyle: 'long' })} />
        )}
        {isTicket && data.event_date && (
          <Row label="Event Date" value={new Date(data.event_date).toLocaleDateString('en-NG', { dateStyle: 'long' })} />
        )}
        {data.support_phone && <Row label="Support" value={data.support_phone} />}
      </Section>

      {/* Pricing */}
      {!isFundraising && (
        <Section icon={<Banknote className="w-4 h-4" />} title="Pricing">
          {data.collection_type === 'fixed' && (
            <>
              <Row label="Amount" value={fmtCurrency(parseFloat(data.fixed_amount) || 0)} />
              {data.max_contributors && <Row label="Max contributors" value={data.max_contributors} />}
            </>
          )}

          {isTiered && (
            <div className="space-y-2">
              {data.pricing_tiers.map((t, i) => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span className="text-gray-500">{t.name || `Tier ${i + 1}`}</span>
                  <span className="font-medium">{fmtCurrency(parseFloat(t.price) || 0)}{t.quantity ? ` (${t.quantity} slots)` : ''}</span>
                </div>
              ))}
            </div>
          )}

          {isOpenPool && (
            <>
              <Row label="Minimum" value={fmtCurrency(parseFloat(data.min_amount) || 0)} />
              {data.target_amount && <Row label="Target" value={fmtCurrency(parseFloat(data.target_amount))} />}
            </>
          )}

          {isTicket && (
            <>
              <Row label="Mode" value={<span className="capitalize">{data.ticket_mode}</span>} />
              {data.ticket_mode === 'fixed' ? (
                <>
                  <Row label="Ticket price" value={fmtCurrency(parseFloat(data.ticket_price) || 0)} />
                  {data.allow_multiple_quantity && <Row label="Multi-ticket" value="Enabled" />}
                </>
              ) : (
                data.pricing_tiers.map((t, i) => (
                  <div key={t.id} className="flex justify-between text-sm">
                    <span className="text-gray-500">{t.name || `Tier ${i + 1}`}</span>
                    <span className="font-medium">{fmtCurrency(parseFloat(t.price) || 0)}</span>
                  </div>
                ))
              )}
            </>
          )}
        </Section>
      )}

      {/* Fundraising goal */}
      {isFundraising && (
        <Section icon={<Banknote className="w-4 h-4" />} title="Campaign Goal">
          <Row
            label="Target"
            value={
              data.fundraising_open_ended
                ? 'Open-ended'
                : data.fundraising_target
                ? fmtCurrency(parseFloat(data.fundraising_target))
                : <span className="text-red-400">Not set</span>
            }
          />
          {data.fundraising_deadline && (
            <Row
              label="Deadline"
              value={new Date(data.fundraising_deadline).toLocaleDateString('en-NG', { dateStyle: 'long' })}
            />
          )}
          {data.fundraising_auto_close && <Row label="Auto-close" value="Enabled" />}
        </Section>
      )}

      {/* Charges */}
      {!isFundraising && !isOpenPool && reprAmount > 0 && (
        <Section icon={<Tag className="w-4 h-4" />} title="Fee Configuration">
          <Row label="Fee bearer" value={<span className="capitalize">{data.fee_bearer}</span>} />
          {reprAmount > 0 && (
            <>
              <Row label="Contributor pays" value={fmtCurrency(fees.totalPayable)} />
              <Row label="You receive" value={fmtCurrency(reprAmount)} />
            </>
          )}
        </Section>
      )}

      {/* Contributor fields */}
      {!isFundraising && (
        <Section icon={<FileText className="w-4 h-4" />} title="Contributor Fields">
          {data.form_fields.length === 0 ? (
            <p className="text-gray-400 text-xs">No custom fields added (name, email & phone collected by default)</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.form_fields.map((f) => (
                <span
                  key={f.id}
                  className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700"
                >
                  {f.name || 'Unnamed'} {f.required && <span className="text-red-400">*</span>}
                </span>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Unique ID */}
      {uniqueEnabled && (
        <Section icon={<Hash className="w-4 h-4" />} title="Unique ID">
          {isTicket ? (
            <p className="text-xs text-gray-600">IDs will only be issued for the prefixes configured below.</p>
          ) : (
            <>
              {data.unique_id_prefix && <Row label="Global prefix" value={<span className="font-mono text-green-700">{data.unique_id_prefix}</span>} />}
              {data.pricing_tiers.some((t) => t.prefix) && (
                <div className="space-y-1">
                  {data.pricing_tiers.filter((t) => t.prefix).map((t) => (
                    <Row
                      key={t.id}
                      label={t.name}
                      value={<span className="font-mono text-green-700">{t.prefix}</span>}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {/* Actions */}
      <div className="pt-2 space-y-3">
        {!isAuthenticated && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You can finish setting up this collection now. We will only ask you to sign in when you publish.
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isFundraising ? 'Submitting for review…' : 'Creating collection…'}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {isAuthenticated
                ? isFundraising
                  ? 'Submit for Review'
                  : 'Publish Collection'
                : 'Continue to Publish'}
            </>
          )}
        </button>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="py-2.5 rounded-xl font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            Go Back to Edit
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="py-2.5 rounded-xl font-medium text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>

        {isFundraising && (
          <p className="text-center text-xs text-gray-400">
            Your campaign will be reviewed within 24–48 hours before going live
          </p>
        )}
      </div>
    </div>
  );
};

export default ReviewStep;
