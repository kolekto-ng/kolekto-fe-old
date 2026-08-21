// Canonical withdrawal-status helpers shared across all FE surfaces.
//
// The BE writes "approved" when the admin manually marks a withdrawal as
// paid out (this is the current path). Legacy rows from the old Paystack
// transfer flow used "success" / "successful" / "completed". Every place
// that asks "did this withdrawal leave the wallet?" must treat all four
// as equivalent, otherwise the UI shows wrong totals — the "Total
// Withdrawn" stat reads as 0 even though the host has received money.
//
// Stay in sync with:
//   - kolekto-be-old/utils/financial.js#computeWalletBalances
//     (filter `["completed","successful","success","approved"]`)
//   - kolekto-be-old/controllers/dashboard.js#withdrawalStatusToActivityType

export type WithdrawalStatus =
    | 'pending'
    | 'processing'
    | 'pending_owner_approval'
    | 'approved'
    | 'completed'
    | 'successful'
    | 'success'
    | 'rejected'
    | 'declined'
    | 'failed'
    | 'reversed'
    | 'owner_rejected'
    | string;

const COMPLETED = new Set([
    'approved',
    'completed',
    'successful',
    'success',
    'processed',
]);

// Wave 6.7F — 'pending_owner_approval' is the two-stage withdrawal approval
// flow's first stage: an ADMIN-initiated withdrawal sits here until the
// workspace OWNER approves it (POST /withdrawals/:id/owner-approve), at which
// point it becomes a normal 'pending' withdrawal. It is still awaiting admin
// action, exactly like 'pending'/'processing', so it buckets the same way —
// see withdrawalStatusLabel() below for the distinct display label.
const PENDING = new Set(['pending', 'processing', 'pending_owner_approval']);

// 'owner_rejected' is the sibling of 'pending_owner_approval' — the workspace
// OWNER declining an ADMIN-initiated withdrawal (POST
// /withdrawals/:id/owner-reject) before it ever reaches the existing Kolekto
// Super Admin 'rejected' stage. It is a genuinely different event from plain
// 'rejected' (Super Admin's own rejection) and must never be conflated with
// it — see withdrawalStatusLabel() below for the distinct display label. It
// still buckets as REJECTED: the withdrawal will not pay out.
const REJECTED = new Set(['rejected', 'declined', 'failed', 'reversed', 'owner_rejected']);

function normalise(status: WithdrawalStatus | null | undefined): string {
    return String(status || '').toLowerCase();
}

/** True if the withdrawal has actually paid out (deducted from the wallet). */
export function isCompletedWithdrawal(status: WithdrawalStatus | null | undefined): boolean {
    return COMPLETED.has(normalise(status));
}

/** True if the withdrawal is still awaiting admin action. */
export function isPendingWithdrawal(status: WithdrawalStatus | null | undefined): boolean {
    return PENDING.has(normalise(status));
}

/** True if the withdrawal will not pay out (admin declined / payout failed). */
export function isRejectedWithdrawal(status: WithdrawalStatus | null | undefined): boolean {
    return REJECTED.has(normalise(status));
}

/**
 * Map raw DB status → coarse bucket the UI groups on (used by status filters,
 * badges, and icons). Returns one of: 'completed' | 'pending' | 'rejected' | 'unknown'.
 */
export function withdrawalStatusBucket(
    status: WithdrawalStatus | null | undefined
): 'completed' | 'pending' | 'rejected' | 'unknown' {
    if (isCompletedWithdrawal(status)) return 'completed';
    if (isPendingWithdrawal(status)) return 'pending';
    if (isRejectedWithdrawal(status)) return 'rejected';
    return 'unknown';
}

/** Human-readable label for the bucket. */
export function withdrawalStatusLabel(status: WithdrawalStatus | null | undefined): string {
    // 'pending_owner_approval' is bucketed as PENDING (it hasn't failed, and
    // it hasn't paid out) but reads as generic "Pending" to a host who has no
    // idea it's specifically stuck waiting on their workspace OWNER — call
    // that out explicitly instead of collapsing it into the same label as
    // every other pending withdrawal.
    if (normalise(status) === 'pending_owner_approval') return 'Awaiting Owner Approval';
    // Must read as distinct from plain 'Rejected' (Kolekto Super Admin's own
    // separate rejection of a different-stage withdrawal) — see this file's
    // header note and the REJECTED set's comment above.
    if (normalise(status) === 'owner_rejected') return 'Owner Rejected';
    const bucket = withdrawalStatusBucket(status);
    switch (bucket) {
        case 'completed': return 'Approved';
        case 'pending': return 'Pending';
        case 'rejected': return 'Rejected';
        default: return String(status || 'Unknown');
    }
}
