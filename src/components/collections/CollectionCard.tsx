import React from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Eye, Share, Wallet } from "lucide-react";

// ---------------------------
// Types
// ---------------------------
type Status =
  | "active"
  | "paused"
  | "expired"
  | "completed"
  | "closed"
  | "deleted";

interface CollectionCardProps {
  id: string;
  title: string;
  description?: string;
  amount: number;
  deadline: string;
  status: Status;
  type: "fixed" | "tiered" | "fundraising";
  participantsCount: number;
  maxParticipants?: number;
  dateCreated?: string;
  tiers?: { amount: number; name: string }[];
  onShare: () => void;
  onViewDetails: () => void;
}

// ---------------------------
// Rule-based Status Engine
// ---------------------------
interface StatusRule {
  name: Status;
  priority: number;
  check: (ctx: {
    statusFlag?: Status;
    totalRaised: number;
    targetAmount: number;
    deadlineDate: Date;
    now: Date;
    type?: string;
  }) => boolean;
}

const statusRules: StatusRule[] = [
  {
    name: "deleted",
    priority: 100,
    check: ({ statusFlag }) => statusFlag === "deleted",
  },
  {
    name: "closed",
    priority: 90,
    check: ({ statusFlag }) => statusFlag === "closed",
  },
  {
    name: "paused",
    priority: 80,
    check: ({ statusFlag }) => statusFlag === "paused",
  },
  {
    name: "completed",
    priority: 70,
    check: ({ totalRaised, targetAmount, type }) => {
      // For fundraising, completion is strictly when target is met
      if (type === 'fundraising') {
        return targetAmount > 0 && totalRaised >= targetAmount;
      }
      return totalRaised >= targetAmount;
    },
  },
  {
    name: "expired",
    priority: 60,
    check: ({ deadlineDate, now }) => deadlineDate <= now,
  },
  {
    name: "active",
    priority: 10,
    check: () => true, // fallback
  },
];

function computeStatus(ctx: {
  statusFlag?: Status;
  totalRaised: number;
  targetAmount: number;
  deadlineDate: Date;
  now?: Date;
  type?: string;
}): Status {
  const now = ctx.now ?? new Date();

  return statusRules
    .sort((a, b) => b.priority - a.priority)
    .find((rule) => rule.check({ ...ctx, now }))!.name;
}

// ---------------------------
// Hooks & Helpers
// ---------------------------
function useCollectionStatus(
  initialStatus: Status,
  deadline: string,
  totalRaised: number,
  targetAmount: number,
  type: string
) {
  const deadlineDate = React.useMemo(() => new Date(deadline), [deadline]);
  const computedStatus = React.useMemo(
    () =>
      computeStatus({
        statusFlag: initialStatus,
        totalRaised,
        targetAmount,
        deadlineDate,
        type
      }),
    [initialStatus, totalRaised, targetAmount, deadlineDate, type]
  );

  return { computedStatus, deadlineDate };
}

function useFormattedDate(dateString?: string) {
  return React.useMemo(() => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [dateString]);
}

function formatCurrency(amount: number) {
  return `₦${amount.toLocaleString()}`;
}

function calcTotalRaised(amount: number, participants: number) {
  return amount * participants;
}




// ---------------------------
// Components
// ---------------------------

function getLowestTierAmount(tiers?: { amount: number; name: string }[]): number {
  if (!tiers || tiers.length === 0) return 0;
  return Math.min(...tiers.map((t) => t.amount));
}

const statusColors: Record<Status, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  expired: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800", // Success
  closed: "bg-gray-200 text-gray-800",     // Manual Close
  deleted: "bg-gray-400 text-gray-900",
};

const StatusBadge: React.FC<{ status: Status }> = ({ status }) => {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge className={statusColors[status]}>{label}</Badge>;
};

// ---------------------------
// Main Component
// ---------------------------
const CollectionCard: React.FC<CollectionCardProps & { totalRaised?: number }> = ({
  id,
  title,
  description,
  amount,
  deadline,
  status,
  type,
  participantsCount,
  maxParticipants,
  dateCreated,
  tiers,
  totalRaised: propTotalRaised,
  onShare,
  onViewDetails,
}) => {
  // Use passed totalRaised if available (for fundraising), otherwise calculate
  const totalRaised = propTotalRaised !== undefined ? propTotalRaised : calcTotalRaised(amount, participantsCount);

  // For fundraising, amount is the target
  const targetAmount = type === 'fundraising' ? amount : calcTotalRaised(amount, maxParticipants || 0);

  const { computedStatus } = useCollectionStatus(
    status,
    deadline,
    totalRaised,
    targetAmount,
    type
  );

  const formattedDeadline = useFormattedDate(deadline);
  const formattedCreatedDate = useFormattedDate(dateCreated);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-lg">{title}</h3>
          <div className="flex gap-1">
            <Badge className={`
              ${type === "fixed" ? "bg-purple-100 text-purple-800" : ""}
              ${type === "tiered" ? "bg-blue-100 text-blue-800" : ""}
              ${type === "fundraising" ? "bg-orange-100 text-orange-800" : ""}
            `}>
              {type === "fixed" ? "Fixed" : type === "tiered" ? "Tier" : "Fundraising"}
            </Badge>
            <StatusBadge status={computedStatus} />
          </div>
        </div>
        {description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{description}</p>
        )}
      </CardHeader>

      <CardContent className="py-2 flex-grow">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <p className="text-sm text-gray-600">
              {type === 'fundraising' ? 'Goal' : 'Amount'}
            </p>
            <p className="font-medium">
              {(() => {
                const displayAmount = type === "tiered" ? getLowestTierAmount(tiers) : amount;
                return displayAmount > 0 ? formatCurrency(displayAmount) : (type === 'fundraising' ? 'No Limit' : "__");
              })()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Deadline</p>
            <p className="font-medium">{formattedDeadline}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              {type === 'fundraising' ? 'Donors' : 'Contributors'}
            </p>
            <p className="font-medium">
              {participantsCount}
              {maxParticipants && ` / ${maxParticipants}`}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Raised</p>
            <p className="font-medium">{formatCurrency(totalRaised)}</p>
          </div>
          {dateCreated && (
            <div className="col-span-2 flex items-center gap-1 text-sm text-gray-500 mt-1">
              <CalendarDays size={12} />
              <span>Created: {formattedCreatedDate}</span>
            </div>
          )}

          {/* Progress Bar for Fundraising */}
          {type === 'fundraising' && amount > 0 && (
            <div className="col-span-2 mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${Math.min((totalRaised / amount) * 100, 100)}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{Math.round((totalRaised / amount) * 100)}% Funded</span>
              </div>
            </div>
          )}

        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <div className="w-full grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            className="flex items-center justify-center"
          >
            <Share className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="flex items-center justify-center"
          >
            <Eye className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">View</span>
          </Button>
          <Button
            size="sm"
            className="bg-kolekto hover:bg-kolekto/90 flex items-center justify-center"
          >
            <Wallet className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Withdraw</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default CollectionCard;
