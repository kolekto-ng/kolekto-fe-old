import React, { useRef } from 'react';
import html2pdf from 'html2pdf.js';
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Hash,
  Heart,
  Home,
  Mail,
  Phone,
  ShieldCheck,
  Ticket,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

interface PaymentDetail {
  label: string;
  value: string;
}

interface ParticipantInfo {
  id: string;
  details: PaymentDetail[];
  uniqueCode: string;
}

interface TicketSelection {
  tierName: string;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
}

interface PaymentSuccessfulProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionTitle: string;
  contributionAmount: number;
  platformFee?: number;
  gatewayFee?: number;
  totalFees?: number;
  totalPaid: number;
  participants: ParticipantInfo[];
  ticketSelections?: TicketSelection[];
  transactionRef?: string;
  status?: string;
  paidAt?: string;
  channel?: string;
  currency?: string;
  payer?: { name: string; email: string; phone: string };
  collectionType?: string;
  bannerUrl?: string;
  description?: string;
  campaignSummary?: string;
  eventDate?: string;
  uniqueIdEnabled?: boolean;
  codePrefix?: string;
}

type ReceiptCollectionType =
  | 'fixed'
  | 'tiered'
  | 'open_pool'
  | 'ticket'
  | 'fundraising';

const COLLECTION_META: Record<
  ReceiptCollectionType,
  {
    label: string;
    receiptLabel: string;
    highlightLabel: string;
    badgeClassName: string;
  }
> = {
  fixed: {
    label: 'Fixed',
    receiptLabel: 'Official payment receipt',
    highlightLabel: 'Amount paid',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  tiered: {
    label: 'Tiered',
    receiptLabel: 'Tiered collection receipt',
    highlightLabel: 'Amount paid',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  open_pool: {
    label: 'Open Pool',
    receiptLabel: 'Contribution receipt',
    highlightLabel: 'Amount paid',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  ticket: {
    label: 'Ticketing',
    receiptLabel: 'Digital ticket receipt',
    highlightLabel: 'Amount paid',
    badgeClassName: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  fundraising: {
    label: 'Fundraising',
    receiptLabel: 'Donation acknowledgement',
    highlightLabel: 'Amount donated',
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-800',
  },
};

function normalizeCollectionType(
  value?: string,
  ticketSelections: TicketSelection[] = []
): ReceiptCollectionType {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (normalized === 'tiered') return 'tiered';
  if (normalized === 'open_pool' || normalized === 'openpool') return 'open_pool';
  if (normalized === 'fundraising') return 'fundraising';
  if (normalized === 'ticket' || ticketSelections.length > 0) return 'ticket';
  return 'fixed';
}

function hasValidAuthSession() {
  const sessionStr = localStorage.getItem('kolekto-auth-token');
  if (!sessionStr) return false;

  try {
    const session = JSON.parse(sessionStr);
    const expiresAt = Number(session?.expires_at || 0);
    if (!expiresAt) return false;
    const now = Math.floor(Date.now() / 1000);
    return now < expiresAt;
  } catch {
    return false;
  }
}

function formatReceiptDate(value?: string) {
  if (!value) return 'Not available';
  return formatDateTime(value);
}

function formatEventDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isAnonymousName(value?: string) {
  return !value || value.trim().toLowerCase() === 'anonymous';
}

function getParticipantDetailValue(
  participant: ParticipantInfo,
  labels: string[]
) {
  const targetLabels = labels.map((label) => label.toLowerCase());
  return (
    participant.details.find((detail) =>
      targetLabels.includes(detail.label.toLowerCase())
    )?.value || ''
  );
}

function getParticipantExtraDetails(participant: ParticipantInfo) {
  const hiddenLabels = new Set(['name', 'full name', 'email', 'phone', 'tier']);
  return participant.details.filter(
    (detail) => !hiddenLabels.has(detail.label.toLowerCase())
  );
}

function buildTicketEntries(
  participants: ParticipantInfo[],
  ticketSelections: TicketSelection[]
) {
  if (participants.length > 0) {
    return participants.map((participant, index) => ({
      id: participant.id || `ticket-${index + 1}`,
      uniqueCode: participant.uniqueCode || '',
      tier: getParticipantDetailValue(participant, ['tier']),
      name: getParticipantDetailValue(participant, ['name', 'full name']),
      email: getParticipantDetailValue(participant, ['email']),
      phone: getParticipantDetailValue(participant, ['phone']),
      extraDetails: getParticipantExtraDetails(participant),
    }));
  }

  return ticketSelections.flatMap((selection, selectionIndex) =>
    Array.from({ length: selection.quantity }, (_, ticketIndex) => ({
      id: `${selection.tierName}-${selectionIndex}-${ticketIndex}`,
      uniqueCode: '',
      tier: selection.tierName,
      name: '',
      email: '',
      phone: '',
      extraDetails: [] as PaymentDetail[],
    }))
  );
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={cn('text-right text-sm font-medium text-slate-900', valueClassName)}>
        {value}
      </span>
    </div>
  );
}

function DetailGrid({
  details,
}: {
  details: PaymentDetail[];
}) {
  if (details.length === 0) {
    return <p className="text-sm text-slate-500">No contributor details supplied.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {details.map((detail) => (
        <div
          key={`${detail.label}-${detail.value}`}
          className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.65)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {detail.label}
          </p>
          <p className="mt-2 break-words text-sm font-medium text-slate-900">
            {detail.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PoweredByKolekto() {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/92 px-4 py-2 text-sm shadow-[0_16px_36px_-28px_rgba(15,23,42,0.45)]">
      <img
        src="/kelekto_logo-removebg-preview.png"
        alt="Kolekto logo"
        className="h-8 w-8 rounded-full object-contain"
      />
      <div className="leading-tight">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Powered by
        </p>
        <p className="font-semibold text-slate-950">Kolekto</p>
      </div>
    </div>
  );
}

const PaymentSuccessful = ({
  open,
  onOpenChange,
  collectionTitle,
  contributionAmount,
  totalPaid,
  participants,
  ticketSelections = [],
  transactionRef,
  status = 'success',
  paidAt,
  payer,
  collectionType,
  bannerUrl,
  description,
  campaignSummary,
  eventDate,
  uniqueIdEnabled,
  codePrefix,
}: PaymentSuccessfulProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const normalizedType = normalizeCollectionType(collectionType, ticketSelections);
  const meta = COLLECTION_META[normalizedType];
  const uniqueCodes = participants
    .map((participant) => participant.uniqueCode)
    .filter(Boolean);
  const primaryUniqueCode = uniqueCodes[0] || '';
  const ticketEntries = buildTicketEntries(participants, ticketSelections);
  const totalTickets = ticketSelections.reduce(
    (sum, selection) => sum + selection.quantity,
    0
  );
  const summaryText = campaignSummary || description || '';
  const paymentTime = formatReceiptDate(paidAt);
  const highlightAmount =
    normalizedType === 'fundraising' ? contributionAmount : totalPaid;
  const showStandardStamp = normalizedType !== 'ticket' && uniqueCodes.length > 0;
  const showPayerCard =
    Boolean(payer?.name || payer?.email || payer?.phone) &&
    !(normalizedType === 'fundraising' && isAnonymousName(payer?.name));

  const handleCopyToClipboard = () => {
    const url = window.location.href;
    const intro =
      normalizedType === 'fundraising'
        ? 'Thank you for supporting this fundraiser on Kolekto.'
        : normalizedType === 'ticket'
        ? 'Your Kolekto tickets are confirmed.'
        : 'Your Kolekto receipt is ready.';

    const message = [
      intro,
      '',
      `Collection: ${collectionTitle}`,
      `Type: ${meta.label}`,
      `${meta.highlightLabel}: ${formatCurrency(highlightAmount)}`,
      showPayerCard && payer?.name ? `Paid By: ${payer.name}` : '',
      payer?.email ? `Email: ${payer.email}` : '',
      payer?.phone ? `Phone: ${payer.phone}` : '',
      transactionRef ? `Transfer Reference: ${transactionRef}` : '',
      paidAt ? `Payment Time: ${paymentTime}` : '',
      normalizedType === 'ticket'
        ? `Tickets: ${ticketEntries
            .map((ticket) =>
              [ticket.uniqueCode || 'No ID assigned', ticket.tier].filter(Boolean).join(' - ')
            )
            .join(', ')}`
        : '',
      normalizedType !== 'ticket' && primaryUniqueCode
        ? `Verification ID: ${primaryUniqueCode}`
        : '',
      '',
      participants.length > 0
        ? 'Contributor Details:\n' +
          participants
            .map((participant, index) =>
              `  ${participants.length > 1 ? `(${index + 1}) ` : ''}${participant.details
                .map((detail) => `${detail.label}: ${detail.value}`)
                .join(', ')}${participant.uniqueCode ? `, ID: ${participant.uniqueCode}` : ''}`
            )
            .join('\n')
        : '',
      '',
      `View your receipt online: ${url}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard
      .writeText(message)
      .then(() => toast.success('Receipt details copied!'))
      .catch(() => toast.error('Failed to copy receipt'));
  };

  const getReceiptFilename = () => {
    const safeTitle = collectionTitle.replace(/\s+/g, '_');
    const safeRef = transactionRef ? transactionRef : 'receipt';
    const safeDate = paidAt ? new Date(paidAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    return `${safeTitle}_${safeRef}_${safeDate}_receipt@kolekto.com.ng.pdf`;
  };

  const handleDownloadPDF = () => {
    if (!receiptRef.current) return;

    html2pdf()
      .set({
        margin: 0.5,
        filename: getReceiptFilename(),
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      })
      .from(receiptRef.current)
      .save()
      .then(() => {
        toast.success('PDF receipt downloaded');
      })
      .catch(() => {
        toast.error('Failed to download PDF');
      });
  };

  const handleGoToDashboard = () => {
    onOpenChange(false);
    window.location.href = hasValidAuthSession() ? '/dashboard' : '/login';
  };

  const renderStandardReceipt = () => (
    <div className="relative overflow-hidden rounded-[32px] border border-emerald-100 bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f5_100%)] p-6 shadow-[0_30px_80px_-38px_rgba(15,23,42,0.45)] sm:p-8">
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]', meta.badgeClassName)}>
              {meta.label}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
              {meta.receiptLabel}
            </p>
            <h2 className="mt-3 max-w-2xl font-clash text-3xl leading-tight text-slate-950 sm:text-4xl">
              {collectionTitle}
            </h2>
            {summaryText ? (
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                {summaryText}
              </p>
            ) : null}
          </div>

          {showStandardStamp ? (
            <div className="shrink-0 rounded-full border border-emerald-200 bg-white/85 p-3 shadow-[0_20px_45px_-30px_rgba(5,150,105,0.6)] backdrop-blur">
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-dashed border-emerald-300 bg-[radial-gradient(circle,#ecfdf5_0%,#d1fae5_100%)] text-center">
                <ShieldCheck className="mb-2 h-5 w-5 text-emerald-700" />
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Verified ID
                </p>
                <p className="mt-1 px-3 text-[11px] font-bold leading-4 text-emerald-950">
                  {primaryUniqueCode}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-8 rounded-[28px] border border-white/90 bg-white/85 p-6 text-center shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            {meta.highlightLabel}
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 tabular-nums sm:text-5xl">
            {formatCurrency(highlightAmount)}
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[26px] border border-slate-200/80 bg-white/82 p-5 backdrop-blur">
            <SectionLabel icon={UserRound}>Paid By</SectionLabel>
            {showPayerCard ? (
              <div className="space-y-4">
                {payer?.name ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{payer.name}</p>
                  </div>
                ) : null}
                <div className="space-y-3">
                  {payer?.email ? (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="break-all">{payer.email}</span>
                    </div>
                  ) : null}
                  {payer?.phone ? (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{payer.phone}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Payment identity is available on the transfer reference only.
              </p>
            )}
          </div>

          <div className="rounded-[26px] border border-slate-200/80 bg-white/82 p-5 backdrop-blur">
            <SectionLabel icon={FileText}>Contributor Details</SectionLabel>
            <div className="space-y-4">
              {participants.map((participant, index) => (
                <div
                  key={participant.id || `participant-${index + 1}`}
                  className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Contributor {participants.length > 1 ? index + 1 : ''}
                    </p>
                    {participant.uniqueCode ? (
                      <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        {participant.uniqueCode}
                      </div>
                    ) : null}
                  </div>
                  <DetailGrid details={participant.details} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[24px] border border-slate-200/80 bg-white/80 p-5">
          <InfoRow label="Transfer reference" value={transactionRef || 'Not available'} valueClassName="font-mono text-xs sm:text-sm" />
          <InfoRow label="Payment time" value={paymentTime} />
        </div>
      </div>
    </div>
  );

  const renderTicketReceipt = () => (
    <div
      className="relative overflow-hidden rounded-[34px] border border-violet-200/40 bg-slate-950 p-5 text-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.9)] sm:p-7"
      style={
        bannerUrl
          ? {
              backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(46, 16, 101, 0.78)), url(${bannerUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {
              backgroundImage:
                'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(76,29,149,0.92), rgba(12,74,110,0.92))',
            }
      }
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.18),transparent_22%),radial-gradient(circle_at_left,rgba(255,255,255,0.08),transparent_28%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-violet-100">
              <Ticket className="h-4 w-4" />
              <span>Digital Ticket</span>
            </div>
            <h2 className="mt-4 max-w-2xl font-clash text-3xl leading-tight text-white sm:text-4xl">
              {collectionTitle}
            </h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/80">
              {eventDate ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>{formatEventDate(eventDate)}</span>
                </div>
              ) : null}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2">
                <Hash className="h-4 w-4" />
                <span>{totalTickets || ticketEntries.length} ticket{(totalTickets || ticketEntries.length) === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/15 bg-white/10 px-5 py-4 text-right backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
              Amount paid
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-white tabular-nums">
              {formatCurrency(totalPaid)}
            </p>
          </div>
        </div>

        <div className="mt-7 space-y-4">
          {ticketEntries.map((ticket, index) => (
            <div
              key={ticket.id}
              className="relative overflow-hidden rounded-[26px] border border-white/15 bg-white/10 p-5 shadow-[0_18px_45px_-34px_rgba(0,0,0,0.95)] backdrop-blur"
            >
              <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-gradient-to-b from-amber-300 via-violet-300 to-sky-300" />
              <div className="absolute left-0 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950/95" />
              <div className="absolute right-0 top-1/2 h-8 w-8 translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950/95" />
              <div className="ml-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                      Ticket {index + 1}
                    </p>
                    <p className="mt-3 break-all font-clash text-2xl leading-none text-white sm:text-3xl">
                      {ticket.uniqueCode || 'No Ticket ID Assigned'}
                    </p>
                  </div>
                  {ticket.tier ? (
                    <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
                      {ticket.tier}
                    </div>
                  ) : null}
                </div>

                <div className="relative my-5 border-t border-dashed border-white/20" />

                <div className="grid gap-4 text-sm text-white/85 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                      Holder
                    </p>
                    <p className="mt-2 font-medium text-white">
                      {ticket.name || payer?.name || 'Confirmed purchaser'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                      Email
                    </p>
                    <p className="mt-2 break-all font-medium text-white">
                      {ticket.email || payer?.email || 'Available in order record'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                      Phone
                    </p>
                    <p className="mt-2 font-medium text-white">
                      {ticket.phone || payer?.phone || 'On file'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                      Status
                    </p>
                    <p className="mt-2 inline-flex items-center gap-2 font-medium text-emerald-200">
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmed
                    </p>
                  </div>
                </div>

                {ticket.extraDetails.length > 0 ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {ticket.extraDetails.map((detail) => (
                      <div key={`${ticket.id}-${detail.label}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                          {detail.label}
                        </p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {detail.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 rounded-[26px] border border-white/15 bg-black/20 p-5 text-sm text-white/75 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Transfer reference
            </p>
            <p className="mt-2 break-all font-mono text-white/90">{transactionRef || 'Not available'}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Payment time
            </p>
            <p className="mt-2 text-white/90">{paymentTime}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFundraisingReceipt = () => (
    <div className="relative overflow-hidden rounded-[32px] border border-rose-100 bg-[linear-gradient(180deg,#fffaf7_0%,#fff3ef_100%)] p-6 shadow-[0_30px_80px_-38px_rgba(15,23,42,0.38)] sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.14),transparent_34%),radial-gradient(circle_at_left,rgba(251,191,36,0.12),transparent_26%)]" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
          <Heart className="h-4 w-4" />
          <span>Thank you for your donation</span>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="font-clash text-3xl leading-tight text-slate-950 sm:text-4xl">
              {collectionTitle}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
              {summaryText ||
                'Your support has been recorded successfully. This acknowledgement card confirms your contribution and can be shared or downloaded anytime.'}
            </p>

            <div className="mt-6 rounded-[24px] border border-white/80 bg-white/85 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.42)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Amount donated
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 tabular-nums sm:text-[2.75rem]">
                {formatCurrency(contributionAmount)}
              </p>
              {showPayerCard && payer?.name ? (
                <p className="mt-4 text-sm text-slate-600">
                  Donation received from <span className="font-semibold text-slate-900">{payer.name}</span>
                </p>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Donation received with appreciation.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[26px] border border-rose-100/90 bg-white/88 p-5 backdrop-blur">
            <SectionLabel icon={Heart}>Appreciation Card</SectionLabel>
            <p className="text-sm leading-7 text-slate-600">
              Every contribution moves this campaign forward. Keep this card as your official acknowledgement from Kolekto.
            </p>

            {showPayerCard ? (
              <div className="mt-5 rounded-[22px] bg-rose-50/80 p-4">
                <div className="space-y-3">
                  {payer?.name ? (
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <UserRound className="h-4 w-4 text-rose-400" />
                      <span>{payer.name}</span>
                    </div>
                  ) : null}
                  {payer?.email ? (
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <Mail className="h-4 w-4 text-rose-400" />
                      <span className="break-all">{payer.email}</span>
                    </div>
                  ) : null}
                  {payer?.phone ? (
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <Phone className="h-4 w-4 text-rose-400" />
                      <span>{payer.phone}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
              <InfoRow label="Transfer reference" value={transactionRef || 'Not available'} valueClassName="font-mono text-xs sm:text-sm" />
              <InfoRow label="Payment time" value={paymentTime} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReceipt = () => {
    if (normalizedType === 'ticket') return renderTicketReceipt();
    if (normalizedType === 'fundraising') return renderFundraisingReceipt();
    return renderStandardReceipt();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Payment receipt</DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-[34px] border border-white/70 bg-white/70 shadow-[0_38px_110px_-42px_rgba(15,23,42,0.75)] backdrop-blur-xl">
          <div className="border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.86)_100%)] px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-[0_16px_36px_-24px_rgba(5,150,105,0.8)]">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                    {status === 'success' ? 'Payment confirmed' : 'Payment update'}
                  </p>
                  <h1 className="mt-2 font-clash text-2xl text-slate-950 sm:text-3xl">
                    {normalizedType === 'fundraising'
                      ? 'Appreciation receipt'
                      : normalizedType === 'ticket'
                      ? 'Digital ticket bundle'
                      : 'Premium receipt'}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    {normalizedType === 'fundraising'
                      ? 'A warm, shareable acknowledgement of support.'
                      : normalizedType === 'ticket'
                      ? 'Each ticket is structured for easy scanning at a glance.'
                      : 'A clean, official summary of your completed payment.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <PoweredByKolekto />
                <Button
                  onClick={handleCopyToClipboard}
                  variant="outline"
                  className="h-11 rounded-full border-slate-200 bg-white/90 px-5"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Receipt
                </Button>
                <Button
                  onClick={handleGoToDashboard}
                  variant="outline"
                  className="h-11 rounded-full border-slate-200 bg-white/90 px-5"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard Home
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  className="h-11 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-3 sm:p-5">
            <div ref={receiptRef} className="space-y-4">
              <div className="flex justify-end">
                <PoweredByKolekto />
              </div>
              {renderReceipt()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentSuccessful;
