import React from "react";
import {
  CalendarDays,
  Heart,
  Layers,
  Lock,
  Share2,
  Target,
  Ticket,
  TrendingUp,
  Users,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "active" | "paused" | "expired" | "completed" | "closed" | "deleted" | "pending_review" | string;
type CollectionType = "fixed" | "tiered" | "open_pool" | "ticket" | "fundraising" | "flat" | string;

interface CollectionCardProps {
  id: string;
  title: string;
  amount: number;
  deadline?: string;
  status: Status;
  type: CollectionType;
  participantsCount: number;
  maxParticipants?: number;
  dateCreated?: string;
  tiers?: { amount: number; name: string }[];
  totalRaised?: number;
  goalAmount?: number;
  onShare: (e: React.MouseEvent) => void;
  onViewDetails: () => void;
}

function fmt(n: number) {
  return `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

const TYPE_ICON: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  fixed: { label: "Fixed", description: "Everyone contributes the same amount", icon: Lock },
  flat: { label: "Fixed", description: "Everyone contributes the same amount", icon: Lock },
  tiered: { label: "Tiered", description: "Multiple options for different contributor levels", icon: Layers },
  open_pool: { label: "Open Pool", description: "Supporters choose what they want to give", icon: Waves },
  ticket: { label: "Ticketing", description: "Track sales and attendees from one place", icon: Ticket },
  fundraising: { label: "Fundraising", description: "Campaign-first collections with donor momentum", icon: Heart },
};

const DEFAULT_TYPE = { label: "Collection", description: "Track contributions and payout activity", icon: Target };

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-yellow-100 text-yellow-800",
  expired: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  closed: "bg-slate-200 text-slate-700",
  deleted: "bg-slate-300 text-slate-600",
  pending_review: "bg-amber-100 text-amber-700",
};

const CollectionCard: React.FC<CollectionCardProps> = ({
  title,
  amount,
  deadline,
  status,
  type,
  participantsCount,
  maxParticipants,
  dateCreated,
  tiers,
  totalRaised = 0,
  goalAmount,
  onShare,
  onViewDetails,
}) => {
  const cfg = TYPE_ICON[type] ?? DEFAULT_TYPE;
  const Icon = cfg.icon;
  const sCls = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
  const sLabel = status ? status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "—";
  const progress = goalAmount && goalAmount > 0 ? Math.min((totalRaised / goalAmount) * 100, 100) : 0;
  const lowestTier = tiers?.length ? Math.min(...tiers.map(t => t.amount)) : 0;
  const isFundraising = type === "fundraising";
  const isTicket = type === "ticket";
  const isTiered = type === "tiered";
  const isOpenPool = type === "open_pool";

  return (
    <article
      className="group overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col"
      style={{ minHeight: '320px' }}
      onClick={onViewDetails}
    >
      {/* Header */}
      <div className="px-5 py-4" style={{ backgroundColor: '#f5ce42' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-2xl bg-white/30 p-3 text-gray-900 backdrop-blur-sm">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-800/70">{cfg.label}</span>
              <h3 className="mt-1 text-base font-semibold leading-snug text-gray-900 line-clamp-1">{title}</h3>
              <p className="mt-0.5 text-xs leading-5 text-gray-800/60 line-clamp-1">{cfg.description}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${sCls}`}>{sLabel}</span>
        </div>
      </div>

      {/* Body */}
      <div className="border-t border-gray-200 px-5 py-5 bg-gray-50/50 flex-1 flex flex-col">
        <div className="grid gap-3 grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 truncate">Raised</p>
            <p className="mt-2 text-base font-bold text-green-700 truncate">{fmt(totalRaised)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 truncate">
              {isTicket ? "Ticket price" : isTiered ? "Starts at" : isOpenPool ? "Minimum" : isFundraising ? "Target" : "Amount"}
            </p>
            <p className="mt-2 text-base font-bold text-slate-900 truncate">
              {isFundraising
                ? fmt(goalAmount || 0)
                : isTiered
                  ? lowestTier > 0 ? fmt(lowestTier) : "—"
                  : isOpenPool
                    ? amount > 0 ? fmt(amount) : "Any"
                    : fmt(amount)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 truncate">
              {isTicket ? "Tickets sold" : "Contributors"}
            </p>
            <p className="mt-2 text-base font-bold text-slate-900 truncate">
              {participantsCount}
              {maxParticipants ? <span className="text-sm font-medium text-slate-400"> / {maxParticipants}</span> : null}
            </p>
          </div>
        </div>

        {goalAmount && goalAmount > 0 && (isFundraising || isOpenPool) && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Progress</span>
              </div>
              <span className="font-semibold text-green-700">{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-green-600" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {participantsCount} {isFundraising ? "donor" : "participant"}{participantsCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {fmtDate(deadline || dateCreated)}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-xl border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-100"
            onClick={onShare}
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Share
          </Button>
        </div>
      </div>
    </article>
  );
};

export default CollectionCard;
