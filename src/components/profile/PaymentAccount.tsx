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

// Make sure to set this in your environment variables
const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_KEY; // For Vite
// const PAYSTACK_KEY = process.env.NEXT_PUBLIC_PAYSTACK_KEY; // For Next.js

export default function PaymentAccounts() {
    const [open, setOpen] = useState(false);
    const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
    const [bankCode, setBankCode] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [accountName, setAccountName] = useState("");
    const [loading, setLoading] = useState(false);
    const [verified, setVerified] = useState(false);

    // Fetch bank list from Paystack
    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await fetch("https://api.paystack.co/bank?currency=NGN", {
                    headers: {
                        Authorization: `Bearer ${PAYSTACK_KEY}`,
                    },
                });
                const data = await res.json();
                if (data.status) {
                    setBanks(data.data);
                } else {
                    console.error("Failed to fetch banks:", data);
                }
            } catch (err) {
                console.error("Error fetching banks:", err);
            }
        };

        if (open) fetchBanks();
    }, [open]);

    const PAYSTACK_KEY = 'sk_test_bf87f096f3bb69d2a2cca922e44a93890ffaf758'

    // Verify account via Paystack
    const verifyAccount = async () => {
        setLoading(true);
        setVerified(false);
        try {
            const res = await fetch(
                `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
                {
                    headers: {
                        Authorization: `Bearer ${PAYSTACK_KEY}`,
                    },
                }
            );
            const data = await res.json();
            if (data.status) {
                setAccountName(data.data.account_name);
                setVerified(true);
            } else {
                alert("Account not found");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const saveAccount = () => {
        console.log({
            bankCode,
            accountNumber,
            accountName,
        });
        setOpen(false);
        // Send to backend here
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Payment Accounts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-10">
                        <p className="text-muted-foreground">
                            No payment accounts linked yet. Please add your bank account or
                            payment method.
                        </p>
                        <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
                            Add Payment Method
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Bank Account</DialogTitle>
                        <DialogDescription>
                            Only add personal bank accounts linked to your BVN.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Bank Name</Label>
                            <Select onValueChange={setBankCode}>
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
                            <div className="bg-green-100 p-2 rounded-md">
                                <p className="text-green-700 text-sm font-medium">
                                    Account Name: {accountName}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        {!verified ? (
                            <Button
                                onClick={verifyAccount}
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
