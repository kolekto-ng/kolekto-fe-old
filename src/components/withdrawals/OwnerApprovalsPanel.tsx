// OwnerApprovalsPanel.tsx — Wave 6.7F.5 frontend.
//
// The workspace OWNER's queue of ADMIN-initiated withdrawals sitting at
// 'pending_owner_approval' — withdrawals an ADMIN requested that cannot even
// reach the existing Kolekto Super Admin approval flow until the workspace
// OWNER clears this stage (POST /withdrawals/:id/owner-approve).
//
// Renders NOTHING for anyone but the OWNER: gated on the live
// `canApproveWithdrawals` capability from workspaceCapabilities.ts (backed by
// withdrawal:approve, OWNER-only per services/workspaceAuthorizationService.js).
// That gate is cosmetic, same disclaimer as every other capability check in
// this app — the backend independently re-derives and enforces it on both
// GET /withdrawals/owner-approvals and POST /withdrawals/:id/owner-approve.
//
// This component performs NO approval business logic itself. It calls the
// backend endpoint and reflects whatever it returns.
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useWithdrawalStore } from '@/store';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useWorkspaceCapabilities } from '@/hooks/useWorkspaceCapabilities';
import { formatDateTime } from '@/utils/formatters';

function formatAmount(amount: number, currencySymbol?: string | null) {
  const symbol = currencySymbol || '₦';
  return `${symbol}${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
}

export const OwnerApprovalsPanel: React.FC = () => {
  const { canApproveWithdrawals } = useWorkspaceCapabilities();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const members = useWorkspaceStore((s) => s.members);
  const fetchMembers = useWorkspaceStore((s) => s.fetchMembers);

  const {
    ownerApprovals,
    ownerApprovalsLoading,
    ownerApprovalsError,
    fetchOwnerApprovals,
    ownerApproveWithdrawal,
    ownerRejectWithdrawal,
  } = useWithdrawalStore() as any;

  const [approvingId, setApprovingId] = useState<string | null>(null);
  // The withdrawal currently targeted by the reject confirmation dialog, or
  // null when the dialog is closed. Modeled on WorkspacePage.tsx's
  // `removeTarget` pattern: dialog visibility is driven by this being
  // non-null, and it is only cleared on success so a failed request leaves
  // the dialog open (matching that same precedent).
  const [rejectTarget, setRejectTarget] = useState<{ id: string; amount: number; currencySymbol?: string | null } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Load the queue whenever this becomes visible, and whenever the active
  // workspace changes (a different workspace has a different queue).
  useEffect(() => {
    if (!canApproveWithdrawals) return;
    void fetchOwnerApprovals();
  }, [canApproveWithdrawals, activeWorkspaceId, fetchOwnerApprovals]);

  // Resolve "who initiated this?" from the workspace roster (withdrawals.user_id
  // is the initiator — see database/w9_withdrawal_owner_approval_columns'
  // own note). GET /withdrawals/owner-approvals does not embed a profile
  // join, so this is the only source of a display name available to the FE;
  // members.manage is available to OWNER, so this fetch is safe to make from
  // an OWNER-only surface.
  useEffect(() => {
    if (!canApproveWithdrawals || !activeWorkspaceId) return;
    if (members.length > 0) return;
    void fetchMembers(activeWorkspaceId);
  }, [canApproveWithdrawals, activeWorkspaceId, members.length, fetchMembers]);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, { full_name: string | null; email: string | null }>();
    for (const m of members) {
      map.set(m.user_id, { full_name: m.full_name, email: m.email });
    }
    return map;
  }, [members]);

  const initiatorLabel = (userId?: string | null) => {
    if (!userId) return 'A workspace admin';
    const member = memberByUserId.get(userId);
    return member?.full_name || member?.email || 'A workspace admin';
  };

  const handleApprove = async (withdrawalId: string) => {
    setApprovingId(withdrawalId);
    try {
      await ownerApproveWithdrawal(withdrawalId);
      // Success/error toasts are already raised inside the store — nothing
      // further to do here. The item is removed from `ownerApprovals` by the
      // store itself, so it visibly drops off this list once its status has
      // actually moved to 'pending' server-side.
    } catch {
      // Swallow — toFriendlyErrorMessage + toast already handled in the store.
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await ownerRejectWithdrawal(rejectTarget.id, rejectReason.trim() || undefined);
      // Success — close the dialog and clear the reason. The item is
      // removed from `ownerApprovals` by the store itself, same as approve.
      setRejectTarget(null);
      setRejectReason('');
    } catch {
      // Swallow — toFriendlyErrorMessage + toast already handled in the
      // store. Leave the dialog open so the OWNER can retry, matching
      // WorkspacePage.tsx's remove-member confirmation precedent.
    } finally {
      setRejecting(false);
    }
  };

  if (!canApproveWithdrawals) return null;
  // Nothing pending and nothing loading/erroring — no need to take up space
  // on the wallet page for the common case. Guarded on `!rejectTarget` too:
  // rejecting the last row in the queue empties `ownerApprovals`, and the
  // dialog-close state update isn't guaranteed to land in the same render as
  // the store's — keep rendering (so the confirmation dialog stays mounted)
  // until the dialog itself has actually closed.
  if (!ownerApprovalsLoading && !ownerApprovalsError && ownerApprovals.length === 0 && !rejectTarget) return null;

  return (
    <>
    <section className="min-w-0 overflow-hidden rounded-[22px] border border-amber-200 bg-amber-50/40 shadow-[0_12px_24px_rgba(180,83,9,0.08)]">
      <div className="flex items-center gap-2.5 border-b border-amber-100 px-4 py-4 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-gray-950 sm:text-lg">
            Awaiting Your Approval
          </h2>
          <p className="text-xs text-gray-500 sm:text-sm">
            Withdrawals your team initiated that need your sign-off before they can proceed.
          </p>
        </div>
      </div>

      <div className="divide-y divide-amber-100/70">
        {ownerApprovalsLoading && ownerApprovals.length === 0 && (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading approvals…
          </div>
        )}

        {!ownerApprovalsLoading && ownerApprovalsError && (
          // Already a user-facing string — toFriendlyErrorMessage() ran once
          // inside the store's fetchOwnerApprovals(). Do not re-run it here:
          // this string may itself contain the word "withdrawal", which
          // would match errorMessages.ts's FRIENDLY_ERROR_MAPPINGS pattern
          // for that word and get silently rewritten to a misleading
          // "could not send the withdrawal request" message.
          <div className="px-4 py-6 text-sm text-red-600 sm:px-5">
            {ownerApprovalsError}
          </div>
        )}

        {ownerApprovals.map((w: any) => {
          const collection = Array.isArray(w.collections) ? w.collections[0] : w.collections;
          const isApproving = approvingId === w.id;
          return (
            <div
              key={w.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-950">
                    {formatAmount(w.amount, collection?.currency_symbol)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    <Clock className="h-3 w-3" />
                    Admin-initiated
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-gray-600">
                  {collection?.title || 'Unknown collection'}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <UserRound className="h-3 w-3 shrink-0" />
                  Requested by {initiatorLabel(w.user_id)}
                  {w.created_at ? ` · ${formatDateTime(w.created_at)}` : ''}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setRejectTarget({ id: w.id, amount: w.amount, currencySymbol: collection?.currency_symbol })
                  }
                  disabled={isApproving}
                  className="min-h-10 justify-center gap-1.5 rounded-xl border-red-200 px-4 text-sm font-medium text-red-700 shadow-sm transition-all hover:bg-red-50 hover:text-red-800 active:scale-[0.98] disabled:opacity-70"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleApprove(w.id)}
                  disabled={isApproving}
                  className="min-h-10 justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-70"
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>

    <AlertDialog
      open={!!rejectTarget}
      onOpenChange={(open) => {
        if (!open) {
          setRejectTarget(null);
          setRejectReason('');
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this withdrawal?</AlertDialogTitle>
          <AlertDialogDescription>
            {rejectTarget
              ? `${formatAmount(rejectTarget.amount, rejectTarget.currencySymbol)} will be rejected and will not proceed to Kolekto for payout. The admin who requested it can see why below (optional).`
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="owner-reject-reason" className="text-sm font-medium text-gray-700">
            Reason <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <Textarea
            id="owner-reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Let the requester know why this was rejected…"
            disabled={rejecting}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={rejecting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={rejecting}
            onClick={(e) => {
              // Keep the dialog mounted while the request is in flight so the
              // busy state is visible; handleConfirmReject closes it on
              // success (same pattern as WorkspacePage.tsx's remove-member
              // confirmation).
              e.preventDefault();
              void handleConfirmReject();
            }}
          >
            {rejecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Reject withdrawal'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default OwnerApprovalsPanel;
