import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertCircle, ArrowRight, Loader2, Mail, MailCheck, Plus, Trash2, Users, X,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useCollectionAccessStore } from '@/store/useCollectionAccessStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';

interface ManageAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  collectionTitle: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ManageAccessDialog: React.FC<ManageAccessDialogProps> = ({
  open,
  onOpenChange,
  collectionId,
  collectionTitle,
}) => {
  const {
    inviteStep,
    inviteError,
    otpSentToEmail,
    accessList,
    accessListLoading,
    requestAccess,
    verifyAccessOTP,
    resetInviteState,
    fetchAccessList,
    revokeAccess,
    cancelAccessInvite,
  } = useCollectionAccessStore() as any;
  const { collections, fetchCollections } = useCollectionStore() as any;
  const { user } = useAuthStore() as any;

  const [view, setView] = useState<'list' | 'invite'>('list');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([collectionId]);
  const [canViewEarnings, setCanViewEarnings] = useState(false);
  const [canViewContributors, setCanViewContributors] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [localError, setLocalError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      fetchAccessList(collectionId);
      if (user?.id) fetchCollections(user.id, { silent: true }).catch(() => undefined);
    }
  }, [open, collectionId, user?.id, fetchAccessList, fetchCollections]);

  useEffect(() => {
    if (!open) {
      setView('list');
      resetInviteState();
      setRecipientEmail('');
      setSelectedCollectionIds([collectionId]);
      setCanViewEarnings(false);
      setCanViewContributors(false);
      setOtp(['', '', '', '', '', '']);
      setLocalError('');
    }
  }, [open, collectionId, resetInviteState]);

  const toggleCollection = (id: string) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleRequest = async () => {
    setLocalError('');
    if (!EMAIL_RE.test(recipientEmail)) {
      setLocalError('Enter a valid email address');
      return;
    }
    if (selectedCollectionIds.length === 0) {
      setLocalError('Select at least one collection');
      return;
    }
    const ok = await requestAccess(selectedCollectionIds, recipientEmail, canViewEarnings, canViewContributors);
    if (ok) toast.success('OTP sent to your email');
  };

  const handleVerify = async () => {
    setLocalError('');
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setLocalError('Please enter the complete 6-digit OTP');
      return;
    }
    const ok = await verifyAccessOTP(otpString);
    if (ok) {
      toast.success('Invite sent');
      fetchAccessList(collectionId);
    }
  };

  const handleRevoke = async (grantId: string) => {
    setBusyId(grantId);
    const ok = await revokeAccess(grantId);
    setBusyId(null);
    if (ok) {
      toast.success('Access revoked');
      fetchAccessList(collectionId);
    } else {
      toast.error('Could not revoke access');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setBusyId(inviteId);
    const ok = await cancelAccessInvite(inviteId);
    setBusyId(null);
    if (ok) {
      toast.success('Invite cancelled');
      fetchAccessList(collectionId);
    } else {
      toast.error('Could not cancel invite');
    }
  };

  const currentError = localError || inviteError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Access</DialogTitle>
          <DialogDescription>
            Give other Kolekto accounts limited, read-only access to "{collectionTitle}".
          </DialogDescription>
        </DialogHeader>

        {view === 'list' && (
          <div className="space-y-4 py-2">
            {accessListLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <div className="space-y-2 pr-2">
                  {(accessList?.activeGrants || []).map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{g.collaborator_email || 'Unknown user'}</p>
                        <p className="text-xs text-gray-500">
                          {g.can_view_earnings ? 'Sees earnings' : 'No earnings'} · {g.can_view_contributors ? 'Sees contributors' : 'No contributors'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                        onClick={() => handleRevoke(g.id)}
                        disabled={busyId === g.id}
                      >
                        {busyId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}
                  {(accessList?.pendingInvites || []).map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-amber-100 bg-amber-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-amber-900 truncate">{inv.to_email}</p>
                        <p className="text-xs text-amber-600">
                          {inv.otp_verified_at ? 'Pending their acceptance' : 'Awaiting your verification code'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-700 hover:text-amber-900 h-8 w-8 p-0"
                        onClick={() => handleCancelInvite(inv.id)}
                        disabled={busyId === inv.id}
                      >
                        {busyId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}
                  {(accessList?.activeGrants || []).length === 0 && (accessList?.pendingInvites || []).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No one has access yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={() => setView('invite')}
                className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
              >
                <Plus className="w-4 h-4 mr-2" /> Invite Someone
              </Button>
            </DialogFooter>
          </div>
        )}

        {view === 'invite' && (
          <div className="space-y-4 py-2">
            {currentError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{currentError}</p>
              </div>
            )}

            {(inviteStep === 'idle' || inviteStep === 'requesting' || inviteStep === 'error') && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Their Email
                  </Label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="teammate@gmail.com"
                    className="border-gray-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collections to Share
                  </Label>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 p-2">
                    <div className="space-y-1.5">
                      {(collections || []).map((c: any) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <Checkbox
                            checked={selectedCollectionIds.includes(c.id)}
                            onCheckedChange={() => toggleCollection(c.id)}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">See money raised</p>
                    <p className="text-xs text-gray-500">Earnings, balance, withdrawals</p>
                  </div>
                  <Switch checked={canViewEarnings} onCheckedChange={setCanViewEarnings} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">See contributors</p>
                    <p className="text-xs text-gray-500">Who contributed and their details</p>
                  </div>
                  <Switch checked={canViewContributors} onCheckedChange={setCanViewContributors} />
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button
                    onClick={handleRequest}
                    disabled={inviteStep === 'requesting' || !recipientEmail}
                    className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                  >
                    {inviteStep === 'requesting' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Send Verification Code
                  </Button>
                  <Button variant="ghost" onClick={() => setView('list')} className="w-full">
                    Cancel
                  </Button>
                </DialogFooter>
              </>
            )}

            {(inviteStep === 'otp-sent' || inviteStep === 'verifying') && (
              <>
                <div className="p-4 rounded-xl bg-[#E8F5E9]/50 border border-[#E8F5E9]">
                  <p className="text-sm text-gray-600">
                    A 6-digit code has been sent to <span className="font-semibold text-gray-900">{otpSentToEmail || 'your email'}</span> to confirm this invite.
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200 rounded-lg focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/20 outline-none transition-all"
                    />
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleVerify}
                    disabled={inviteStep === 'verifying' || otp.join('').length !== 6}
                    className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                  >
                    {inviteStep === 'verifying' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4 mr-2" />
                    )}
                    Verify &amp; Send Invite
                  </Button>
                </DialogFooter>
              </>
            )}

            {inviteStep === 'link-sent' && (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                  <MailCheck className="w-7 h-7 text-[#1B5E20]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Invite sent</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    They can accept or decline from the link we emailed them. Access won't apply until they accept.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setView('list')}
                  className="border-gray-200"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManageAccessDialog;
