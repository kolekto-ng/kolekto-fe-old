import React from "react";
import { CalendarDays, Heart, Share2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface ActiveCampaignCardData {
  id: string;
  slug?: string | null;
  title: string;
  summary?: string | null;
  campaign_summary?: string | null;
  main_image_url?: string | null;
  banner_url?: string | null;
  deadline?: string | null;
  target_amount?: number | null;
  total_raised?: number | null;
  contributions_count?: number;
  category?: string | null;
  campaign_category?: string | null;
  status: string;
}

interface ActiveCampaignCardProps {
  campaign: ActiveCampaignCardData;
  onOpen: () => void;
  onShare: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function formatAmount(amount?: number | null) {
  return currencyFormatter.format(Number(amount || 0));
}

function formatDeadline(date?: string | null) {
  if (!date) return "Open-ended";

  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getUrgencyBadge(deadline?: string | null) {
  if (!deadline) return null;

  const now = Date.now();
  const diff = new Date(deadline).getTime() - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days <= 0) {
    return {
      label: "Ends today",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (days === 1) {
    return {
      label: "1 day left",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (days <= 7) {
    return {
      label: `${days} days left`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Active now",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

const ActiveCampaignCard: React.FC<ActiveCampaignCardProps> = ({
  campaign,
  onOpen,
  onShare,
}) => {
  const imageUrl = campaign.banner_url || campaign.main_image_url;
  const summary = campaign.summary || campaign.campaign_summary;
  const category = campaign.category || campaign.campaign_category;
  const totalRaised = Number(campaign.total_raised || 0);
  const targetAmount = Number(campaign.target_amount || 0);
  const contributorsCount = Number(campaign.contributions_count || 0);
  const progressValue =
    targetAmount > 0 ? Math.min((totalRaised / targetAmount) * 100, 100) : 0;
  const urgency = getUrgencyBadge(campaign.deadline);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="group h-full cursor-pointer focus:outline-none"
    >
      <Card className="overflow-hidden rounded-[24px] border-gray-200 bg-white shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-primary/20">
        <div>
          <div className="relative h-52 overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-amber-500">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={campaign.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-600">
                <div className="rounded-full bg-white/12 p-4 text-white backdrop-blur-sm">
                  <Heart className="h-8 w-8" />
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/25 to-transparent" />

            <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
              {category ? (
                <Badge
                  variant="secondary"
                  className="border-white/50 bg-white/90 text-slate-900 shadow-sm"
                >
                  {category}
                </Badge>
              ) : null}
              {urgency ? (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${urgency.className}`}
                >
                  {urgency.label}
                </span>
              ) : null}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-4 top-4 h-10 w-10 rounded-full border border-white/40 bg-white/90 text-slate-900 shadow-sm hover:bg-white"
              onClick={onShare}
              aria-label={`Share ${campaign.title}`}
            >
              <Share2 className="h-4 w-4" />
            </Button>

            <div className="absolute inset-x-4 bottom-4 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
                Active campaign
              </p>
              <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-white">
                {campaign.title}
              </h3>
            </div>
          </div>

          <CardContent className="flex flex-col p-4">
            {summary ? (
              <p className="line-clamp-2 text-sm leading-5 text-slate-600">
                {summary}
              </p>
            ) : (
              <p className="text-sm leading-5 text-slate-500">
                Support this verified fundraiser and help it gain momentum.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Raised
                </p>
                <p className="mt-2 line-clamp-1 text-base font-bold text-green-700">
                  {formatAmount(totalRaised)}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Target
                </p>
                <p className="mt-2 line-clamp-1 text-base font-bold text-slate-900">
                  {formatAmount(targetAmount)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-700">Progress</p>
                <p className="text-sm font-semibold text-green-700">
                  {targetAmount > 0
                    ? `${progressValue.toFixed(0)}% funded`
                    : formatAmount(totalRaised)}
                </p>
              </div>

              <Progress
                value={targetAmount > 0 ? progressValue : totalRaised > 0 ? 100 : 0}
                className="h-2.5 bg-slate-100"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {contributorsCount} donor{contributorsCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDeadline(campaign.deadline)}
                </span>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    </article>
  );
};

export default ActiveCampaignCard;
