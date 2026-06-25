import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Banknote,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Building2,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { toFriendlyErrorMessage } from '@/utils/errorMessages';
import { toast } from 'sonner';
import { useSettings } from '@/store/useSettings';
import { axiosInstance } from '@/utils/axios';

function dedupeBanks(list: Array<{ name: string; code: string }> = []) {
  const seen = new Set<string>();
  return list.filter((bank) => {
    const code = String(bank?.code || '').trim();
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

const BankDetailsSection: React.FC = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { loading, payoutAccounts, getBanks, verifyAccount, getPayoutAccounts, deletePayoutAccount } =
    useSettings() as any;

  useEffect(() => {
    getPayoutAccounts();
  }, []);

  useEffect(() => {
    if (showAddDialog) {
      getBanks().then((data: any) => {
        const payload = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setBanks(dedupeBanks(payload));
      }).catch((error: any) => {
        const message = toFriendlyErrorMessage(error, 'Could not load banks. Please try again.');
        toast.error(message);
      });
    }
  }, [showAddDialog]);

  const handleVerifyAccount = async () => {
    setVerified(false);
    setAccountName('');
    try {
      const data = await verifyAccount({ accountNumber, bankCode });
      if (data?.status && data?.data?.account_name) {
        setAccountName(data.data.account_name);
        setVerified(true);
        return;
      }
      setAccountName('');
      toast.error('Unable to verify that bank account.');
    } catch (error: any) {
      const message = toFriendlyErrorMessage(error, 'Unable to verify that bank account.');
      toast.error(message);
    }
  };

  const handleSaveAccount = async () => {
    setSaving(true);
    try {
      await axiosInstance.post('/settings/profile/save-account', {
        bankCode,
        accountNumber,
        accountName,
        bankName,
      });
      setShowAddDialog(false);
      resetForm();
      await getPayoutAccounts();
      toast.success('Bank account saved');
    } catch (error) {
      console.error('Save account error:', error);
      const message = toFriendlyErrorMessage(error, 'Could not save bank account. Please try again.');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setBankCode('');
    setBankName('');
    setAccountNumber('');
    setAccountName('');
    setVerified(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deletePayoutAccount(deleteConfirm);
      toast.success('Bank account removed.');
      setDeleteConfirm(null);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to remove bank account.';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1B5E20]" />
              Bank Accounts
            </CardTitle>
            <Button
              onClick={handleOpenAdd}
              size="sm"
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white h-8 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Manage your bank accounts for receiving withdrawals. Your primary account will be used for all payouts.
          </p>

          {/* Bank Account Cards */}
          {payoutAccounts && payoutAccounts.length > 0 ? (
            <div className="space-y-3">
              {payoutAccounts.map((account: any, i: number) => (
                <div
                  key={account.id || i}
                  className="group relative flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-all"
                >
                  {/* Left: Bank info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] flex items-center justify-center flex-shrink-0">
                      <Banknote className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{account.account_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{account.bank_name}</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-500 font-mono">••••{account.account_last4}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status & Actions */}
                  <div className="flex items-center gap-2">
                    {account.is_decryptable === false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3" />
                        Needs re-adding
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                    {account.is_default && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#1B5E20]">
                        Default
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 h-8 w-8 p-0"
                      onClick={() => setDeleteConfirm(account.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No bank accounts yet</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-xs">
                Add a bank account to start receiving withdrawals from your collections.
              </p>
              <Button
                onClick={handleOpenAdd}
                className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Important note */}
      <Card className="border-0 shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Important</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Your bank account must match your verified identity (name on your ID). Mismatched accounts may cause withdrawal delays.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Bank Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowAddDialog(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1B5E20]" />
              Add Bank Account
            </DialogTitle>
            <DialogDescription>
              Enter your bank details. We'll verify the account before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Bank Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Bank Name</Label>
              <Select
                onValueChange={(value) => {
                  setBankCode(value);
                  const selected = banks.find((b) => b.code === value);
                  setBankName(selected?.name || '');
                  setVerified(false);
                  setAccountName('');
                }}
              >
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder="Select your bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Number</Label>
              <Input
                type="text"
                placeholder="Enter 10-digit account number"
                value={accountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setAccountNumber(val);
                  setVerified(false);
                  setAccountName('');
                }}
                maxLength={10}
                className="border-gray-200 font-mono"
              />
              {accountNumber && accountNumber.length !== 10 && (
                <p className="text-xs text-amber-500">Account number must be exactly 10 digits</p>
              )}
            </div>

            {/* Verification Result */}
            {verified && accountName && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Account Verified</p>
                  <p className="text-sm font-semibold text-emerald-800">{accountName}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {!verified ? (
              <Button
                onClick={handleVerifyAccount}
                disabled={!bankCode || accountNumber.length !== 10 || loading}
                className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Account'
                )}
              </Button>
            ) : (
              <Button
                onClick={handleSaveAccount}
                disabled={saving}
                className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white h-11"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Account'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove bank account?</DialogTitle>
            <DialogDescription>
              This account will no longer be available for withdrawals. You can add it again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirm(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankDetailsSection;
