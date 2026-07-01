// Canonical collection status / tag system.
//
// The stored `collections.status` column only ever holds a *lifecycle* value
// (active, paused, closed, completed, pending_review, …). It does NOT encode
// the two *derived* states a contributor cares about:
//   • full    — contributor limit hit, or target/goal amount reached
//   • expired — past the deadline
// So a collection sitting at status="active" can really be full or expired, and
// every surface that printed the raw column showed a misleading "Active" tag.
//
// This module is the single source of truth. `resolveCollectionStatus` folds
// the raw status + deadline + capacity/target into one canonical status, and
// `getCollectionStatusMeta` returns the label + Tailwind classes to render it.
// Use it everywhere a collection tag is shown (cards, list, details, public,
// admin) so the tag is uniform and correct.

export type CollectionStatus =
  | "active"
  | "pending_review"
  | "approved"
  | "paused"
  | "closed"
  | "completed"
  | "full"
  | "expired"
  | "rejected"
  | "deleted";

export const STATUS_META: Record<CollectionStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  pending_review: { label: "Pending review", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  paused: { label: "Paused", className: "bg-yellow-100 text-yellow-800" },
  closed: { label: "Closed", className: "bg-slate-200 text-slate-700" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
  full: { label: "Full", className: "bg-indigo-100 text-indigo-700" },
  expired: { label: "Expired", className: "bg-red-100 text-red-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  deleted: { label: "Deleted", className: "bg-slate-300 text-slate-600" },
};

// Map legacy / alternate raw values onto canonical lifecycle values.
const LEGACY_MAP: Record<string, CollectionStatus> = {
  active: "active",
  live: "active",
  open: "active",
  approved: "active", // fundraising approval flips status→active
  pending: "pending_review",
  pending_review: "pending_review",
  pending_verification: "pending_review",
  under_review: "pending_review",
  paused: "paused",
  suspended: "paused",
  closed: "closed",
  completed: "completed",
  ended: "completed",
  rejected: "rejected",
  declined: "rejected",
  deleted: "deleted",
};

// Lifecycle states that are terminal/explicit and must win over any derived
// (full/expired) computation — e.g. a closed collection that is also past its
// deadline should read "Closed", not "Expired".
const EXPLICIT_OVERRIDES: CollectionStatus[] = [
  "closed",
  "completed",
  "paused",
  "pending_review",
  "rejected",
  "deleted",
];

export interface CollectionStatusInput {
  status?: string | null;
  deadline?: string | null;
  collection_type?: string | null;
  type?: string | null;
  // capacity
  max_participants?: number | null;
  max_contributions?: number | null;
  maxParticipants?: number | null;
  participants_count?: number | null;
  participantsCount?: number | null;
  paid_count?: number | null;
  // target / progress
  target_amount?: number | null;
  goal_amount?: number | null;
  goalAmount?: number | null;
  total_raised?: number | null;
  totalRaised?: number | null;
}

function num(...values: Array<number | null | undefined>): number {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function isExpired(deadline?: string | null): boolean {
  if (!deadline) return false;
  const time = new Date(deadline).getTime();
  return Number.isFinite(time) && time < Date.now();
}

export function isCollectionFull(input: CollectionStatusInput): boolean {
  const maxParticipants = num(input.max_participants, input.max_contributions, input.maxParticipants);
  const participants = Math.max(
    0,
    Number(input.participants_count ?? input.participantsCount ?? input.paid_count ?? 0) || 0,
  );
  const target = num(input.target_amount, input.goal_amount, input.goalAmount);
  const raised = Math.max(0, Number(input.total_raised ?? input.totalRaised ?? 0) || 0);

  const fullByLimit = maxParticipants > 0 && participants >= maxParticipants;
  const fullByTarget = target > 0 && raised >= target;
  return fullByLimit || fullByTarget;
}

// Returns the canonical status to display for a collection.
export function resolveCollectionStatus(input: CollectionStatusInput): CollectionStatus {
  const raw = String(input.status || "active").trim().toLowerCase();
  const lifecycle = LEGACY_MAP[raw] ?? "active";

  // Explicit terminal/paused/pending states always win.
  if (EXPLICIT_OVERRIDES.includes(lifecycle)) return lifecycle;

  // From here lifecycle is active/approved → layer on derived states.
  if (isExpired(input.deadline)) return "expired";
  if (isCollectionFull(input)) return "full";
  return "active";
}

export function getCollectionStatusMeta(input: CollectionStatusInput) {
  const status = resolveCollectionStatus(input);
  return { status, ...STATUS_META[status] };
}

// True when the collection cannot accept new payments right now. Mirrors the
// edge function's ensureCollectionIsPayable so the UI and server agree.
export function isAcceptingPayments(input: CollectionStatusInput): boolean {
  const status = resolveCollectionStatus(input);
  return status === "active";
}
