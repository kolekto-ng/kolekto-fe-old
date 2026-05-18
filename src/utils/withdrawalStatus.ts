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
    | 'approved'
    | 'completed'
    | 'successful'
    | 'success'
    | 'rejected'
    | 'declined'
    | 'failed'
    | 'reversed'
    | string;

const COMPLETED = new Set([
    'approved',
    'completed',
    'successful',
    'success',
    'processed',
]);

const PENDING = new Set(['pending', 'processing']);

const REJECTED = new Set(['rejected', 'declined', 'failed', 'reversed']);

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
    const bucket = withdrawalStatusBucket(status);
    switch (bucket) {
        case 'completed': return 'Approved';
        case 'pending': return 'Pending';
        case 'rejected': return 'Rejected';
        default: return String(status || 'Unknown');
    }
}
