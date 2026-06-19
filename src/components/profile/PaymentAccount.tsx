import React, { useState, useEffect } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Banknote, CheckCircle2, Plus, Trash2, AlertCircle } from "lucide-react";
import { useSettings } from "@/store/useSettings";
import { axiosInstance } from "@/utils/axios";
import { toast } from "sonner";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

export default function PaymentAccounts() {
    const [open, setOpen] = useState(false);
    const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
    const [bankCode, setBankCode] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [accountName, setAccountName] = useState("");
    const [verified, setVerified] = useState(false);
    const [kycVerified, setKycVerified] = useState(false); // Set to false to show error
    const { loading, payoutAccounts, getBanks, verifyAccount, getPayoutAccounts } =
        useSettings();

    useEffect(() => {
        if (open) {
            getBanks().then((data) => {
                if (data?.status) setBanks(data.data);
            });
        }
    }, [open]);

    useEffect(() => {
        getPayoutAccounts();
        // TODO: Check KYC status from your API/store
        // Example: setKycVerified(user.kycVerified);
    }, []);

    const handleAddAccount = () => {
        if (!kycVerified) {
            return; // Dialog won't open if KYC not verified
        }
        setOpen(true);
    };

    const handleVerifyAccount = async () => {
        setVerified(false);
        const data = await verifyAccount({ accountNumber, bankCode });
        if (data.status) {
            setAccountName(data.data.account_name);
            setVerified(true);
        } else {
            toast.error("Account not found");
        }
    };

    const saveAccount = async () => {
        try {
            await axiosInstance.post("/settings/profile/save-account", {
                bankCode,
                accountNumber,
                accountName,
                bankName,
            });
            await getPayoutAccounts();
            setOpen(false);
        } catch (error) {
            console.error("Save account error:", error);
            toast.error(toFriendlyErrorMessage(error, "Unable to save bank account. Please try again."));
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle className="text-lg font-semibold">
                        Connected Bank Accounts
                    </CardTitle>
                    {kycVerified &&
                        <Button onClick={handleAddAccount}>
                            <Plus className="w-4 h-4 mr-1" /> Add Account
                        </Button>
                    }
                </CardHeader>
                <CardContent>
                    {!kycVerified && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Please complete your KYC verification before adding a bank account.
                            </AlertDescription>
                        </Alert>
                    )}

                    {payoutAccounts.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {payoutAccounts.map((account, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-4 rounded-xl border shadow-sm bg-white hover:shadow-md transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <Banknote className="w-6 h-6 text-blue-600" />
                                        <div>
                                            <p className="font-medium">{account.account_name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {account.bank_name} ••••{account.account_last4}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {kycVerified && payoutAccounts.length === 0 &&
                        (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Banknote className="w-10 h-10 text-muted-foreground mb-2" />
                                <p className="text-muted-foreground mb-2">
                                    No bank accounts linked yet.
                                </p>
                                <Button onClick={handleAddAccount}>
                                    <Plus className="w-4 h-4 mr-1" /> Add your first account
                                </Button>
                            </div>
                        )
                    }
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Bank Account</DialogTitle>
                        <DialogDescription>
                            Ensure the account matches your BVN details.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Bank Name</Label>
                            <Select
                                onValueChange={(value) => {
                                    setBankCode(value);
                                    const selected = banks.find((b) => b.code === value);
                                    setBankName(selected?.name || "");
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a bank" />
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

                        <div>
                            <Label>Account Number</Label>
                            <Input
                                type="text"
                                placeholder="Enter account number"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                maxLength={10}
                            />
                        </div>

                        {verified && (
                            <div className="bg-green-50 border border-green-200 p-3 rounded-md">
                                <p className="text-green-700 text-sm font-medium">
                                    ✅ Verified Account: {accountName}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        {!verified ? (
                            <Button
                                onClick={handleVerifyAccount}
                                disabled={!bankCode || accountNumber.length !== 10 || loading}
                            >
                                {loading ? "Verifying..." : "Verify Account"}
                            </Button>
                        ) : (
                            <Button onClick={saveAccount}>Save Account</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
