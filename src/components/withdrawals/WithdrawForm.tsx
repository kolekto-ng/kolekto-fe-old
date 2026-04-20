
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Banknote } from "lucide-react";

interface WithdrawFormProps {
  availableBalance: number;
  onSubmit: (data: {
    amount: number;
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
  }) => void;
  isLoading: boolean;
}

const BANKS = [
  "9mobile 9Payment Service Bank",
  "Abbey Mortgage Bank",
  "Above Only MFB",
  "Abulesoro MFB",
  "Access Bank",
  "Access Bank (Diamond)",
  "Accion Microfinance Bank",
  "AG Mortgage Bank",
  "Ahmadu Bello University Microfinance Bank",
  "Airtel Smartcash PSB",
  "AKU Microfinance Bank",
  "Akuchukwu Microfinance Bank Limited",
  "ALAT by WEMA",
  "Amegy Microfinance Bank",
  "Amju Unique MFB",
  "AMPERSAND MICROFINANCE BANK",
  "Aramoko MFB",
  "ASO Savings and Loans",
  "Astrapolaris MFB LTD",
  "AVUENEGBE MICROFINANCE BANK",
  "AWACASH MICROFINANCE BANK",
  "Bainescredit MFB",
  "Banc Corp Microfinance Bank",
  "Baobab Microfinance Bank",
  "BellBank Microfinance Bank",
  "Benysta Microfinance Bank Limited",
  "Beststar Microfinance Bank",
  "Bowen Microfinance Bank",
  "Branch International Financial Services Limited",
  "Carbon",
  "Cashbridge Microfinance Bank Limited",
  "CASHCONNECT MFB",
  "CEMCS Microfinance Bank",
  "Chanelle Microfinance Bank Limited",
  "Chikum Microfinance bank",
  "Citibank Nigeria",
  "CITYCODE MORTAGE BANK",
  "Consumer Microfinance Bank",
  "Corestep MFB",
  "Coronation Merchant Bank",
  "County Finance Limited",
  "Crescent MFB",
  "Crust Microfinance Bank",
  "Davenport MICROFINANCE BANK",
  "Dot Microfinance Bank",
  "Ecobank Nigeria",
  "Ekimogun MFB",
  "Ekondo Microfinance Bank",
  "EXCEL FINANCE BANK",
  "Eyowo",
  "Fairmoney Microfinance Bank",
  "Fedeth MFB",
  "Fidelity Bank",
  "Firmus MFB",
  "First Bank of Nigeria",
  "First City Monument Bank",
  "FIRST ROYAL MICROFINANCE BANK",
  "FirstTrust Mortgage Bank Nigeria",
  "FLOURISH MFB",
  "FSDH Merchant Bank Limited",
  "FUTMINNA MICROFINANCE BANK",
  "Gateway Mortgage Bank LTD",
  "Globus Bank",
  "Goldman MFB",
  "GoMoney",
  "GOOD SHEPHERD MICROFINANCE BANK",
  "Goodnews Microfinance Bank",
  "Greenwich Merchant Bank",
  "Guaranty Trust Bank",
  "Hackman Microfinance Bank",
  "Hasal Microfinance Bank",
  "HopePSB",
  "Ibile Microfinance Bank",
  "Ikoyi Osun MFB",
  "Ilaro Poly Microfinance Bank",
  "Imowo MFB",
  "IMPERIAL HOMES MORTAGE BANK",
  "Infinity MFB",
  "Jaiz Bank",
  "Kadpoly MFB",
  "KANOPOLY MFB",
  "Keystone Bank",
  "KONGAPAY (Kongapay Technologies Limited)(formerly Zinternet)",
  "Kredi Money MFB LTD",
  "Kuda Bank",
  "Lagos Building Investment Company Plc.",
  "Links MFB",
  "Living Trust Mortgage Bank",
  "LOMA MFB",
  "Lotus Bank",
  "MAINSTREET MICROFINANCE BANK",
  "Mayfair MFB",
  "Mint MFB",
  "Money Master PSB",
  "Moniepoint MFB",
  "MTN Momo PSB",
  "MUTUAL BENEFITS MICROFINANCE BANK",
  "NDCC MICROFINANCE BANK",
  "NET MICROFINANCE BANK",
  "Nigerian Navy Microfinance Bank Limited",
  "NPF MICROFINANCE BANK",
  "OPay Digital Services Limited (OPay)",
  "Optimus Bank Limited",
  "Paga",
  "PalmPay",
  "Parallex Bank",
  "Parkway - ReadyCash",
  "PATHFINDER MICROFINANCE BANK LIMITED",
  "Paystack-Titan",
  "Peace Microfinance Bank",
  "PECANTRUST MICROFINANCE BANK LIMITED",
  "Personal Trust MFB",
  "Petra Mircofinance Bank Plc",
  "PFI FINANCE COMPANY LIMITED",
  "Platinum Mortgage Bank",
  "Pocket App",
  "Polaris Bank",
  "Polyunwana MFB",
  "PremiumTrust Bank",
  "PROSPERIS FINANCE LIMITED",
  "Providus Bank",
  "QuickFund MFB",
  "Rand Merchant Bank",
  "RANDALPHA MICROFINANCE BANK",
  "Refuge Mortgage Bank",
  "REHOBOTH MICROFINANCE BANK",
  "Rephidim Microfinance Bank",
  "Rigo Microfinance Bank Limited",
  "ROCKSHIELD MICROFINANCE BANK",
  "Rubies MFB",
  "Safe Haven MFB",
  "Safe Haven Microfinance Bank Limited",
  "SAGE GREY FINANCE LIMITED",
  "Shield MFB",
  "Signature Bank Ltd",
  "Solid Allianze MFB",
  "Solid Rock MFB",
  "Sparkle Microfinance Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "STANFORD MICROFINANCE BANK",
  "STATESIDE MICROFINANCE BANK",
  "Stellas MFB",
  "Sterling Bank",
  "Suntrust Bank",
  "Supreme MFB",
  "TAJ Bank",
  "Tangerine Money",
  "TCF MFB",
  "Titan Bank",
  "U&C Microfinance Bank Ltd (U AND C MFB)",
  "Uhuru MFB",
  "Unaab Microfinance Bank Limited",
  "Unical MFB",
  "Unilag Microfinance Bank",
  "Union Bank of Nigeria",
  "United Bank For Africa",
  "Unity Bank",
  "Uzondu Microfinance Bank Awka Anambra State",
  "Vale Finance Limited",
  "VFD Microfinance Bank Limited",
  "Waya Microfinance Bank",
  "Wema Bank",
  "Zenith Bank"
];


import { useSettings } from "@/store/useSettings";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, PlusCircle, CreditCard } from "lucide-react";
import { useProfileStore } from "@/store/useProfileStore";

const WithdrawForm: React.FC<WithdrawFormProps> = ({
  availableBalance,
  onSubmit,
  isLoading
}) => {
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const { payoutAccounts, getPayoutAccounts } = useSettings() as any;
  const { setActiveSection } = useProfileStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    getPayoutAccounts();
  }, []);

  // Set default account if available
  React.useEffect(() => {
    if (payoutAccounts?.length > 0 && !selectedAccountId) {
      const defaultAcc = payoutAccounts.find((acc: any) => acc.is_default) || payoutAccounts[0];
      setSelectedAccountId(defaultAcc.id);
    }
  }, [payoutAccounts, selectedAccountId]);

  const [errors, setErrors] = useState<{
    amount?: string;
    account?: string;
  }>({});

  const validate = () => {
    const newErrors: {
      amount?: string;
      account?: string;
    } = {};

    // Amount validation
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount)) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (parsedAmount <= 0) {
      newErrors.amount = 'Amount must be greater than zero';
    } else if (parsedAmount > availableBalance) {
      newErrors.amount = 'Amount exceeds available balance';
    }

    // Account validation
    if (!selectedAccountId) {
      newErrors.account = 'Please select a withdrawal account';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      const selectedAccount = payoutAccounts.find((acc: any) => acc.id === selectedAccountId);
      if (selectedAccount) {
        onSubmit({
          amount: parseFloat(amount),
          accountName: selectedAccount.account_name,
          accountNumber: selectedAccount.account_number,
          bankName: selectedAccount.bank_name,
          bankCode: selectedAccount.bank_code,
        });
      }
    }
  };

  const handleNavigateToBankSettings = () => {
    setActiveSection('bank');
    navigate('/dashboard/settings');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="amount">Amount to Withdraw (₦)</Label>
        <Input
          id="amount"
          type="number"
          value={amount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className={errors.amount ? "border-red-500" : "border-gray-200"}
        />
        {errors.amount && (
          <p className="text-sm text-red-500">{errors.amount}</p>
        )}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Available balance: <span className="font-semibold text-gray-900">₦{availableBalance.toLocaleString()}</span></span>
          <button 
            type="button" 
            onClick={() => setAmount(availableBalance.toString())}
            className="text-[#1B5E20] font-medium hover:underline"
          >
            Withdraw Max
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="account">Withdrawal Account</Label>
          <button 
            type="button"
            onClick={handleNavigateToBankSettings}
            className="text-xs font-semibold flex items-center text-[#1B5E20] hover:underline"
          >
            <PlusCircle className="w-3 h-3 mr-1" />
            Add New Mode
          </button>
        </div>

        {payoutAccounts && payoutAccounts.length > 0 ? (
          <div className="space-y-1">
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
            >
              <SelectTrigger id="account" className={errors.account ? "border-red-500 h-14" : "h-14 border-gray-200"}>
                <SelectValue placeholder="Select a saved bank account" />
              </SelectTrigger>
              <SelectContent>
                {payoutAccounts.map((account: any) => (
                  <SelectItem key={account.id} value={account.id} className="py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 leading-none mb-1">{account.account_name}</span>
                      <div className="flex items-center text-xs text-gray-500">
                        <span>{account.bank_name}</span>
                        <span className="mx-1.5">•</span>
                        <span>••••{account.account_last4}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.account && (
              <p className="text-sm text-red-500">{errors.account}</p>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">No linked bank accounts</p>
              <p className="text-xs text-gray-600 mt-0.5">Please add a bank account before withdrawing.</p>
            </div>
            <Button
              type="button"
              onClick={handleNavigateToBankSettings}
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-xs h-9"
            >
              Go to Account Settings
            </Button>
          </div>
        )}
      </div>

      <div className="pt-2 space-y-3">
        <Button
          type="submit"
          className="w-full bg-kolekto hover:bg-kolekto/90 h-11"
          disabled={isLoading || !payoutAccounts || payoutAccounts.length === 0}
        >
          {isLoading ? (
            <>Processing Withdrawal...</>
          ) : (
            <>
              <Banknote className="mr-2 h-4 w-4" />
              Withdraw Funds
            </>
          )}
        </Button>
        <p className="text-xs text-center text-gray-500">
          Withdrawals are subject to a T+1 settlement period. Funds will arrive in your bank account by the end of the next business day.
        </p>
      </div>
    </form>
  );
};

export default WithdrawForm;
