
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


const WithdrawForm: React.FC<WithdrawFormProps> = ({
  availableBalance,
  onSubmit,
  isLoading
}) => {
  const [amount, setAmount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');

  const [errors, setErrors] = useState<{
    amount?: string;
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
  }>({});

  const validate = () => {
    const newErrors: {
      amount?: string;
      accountName?: string;
      accountNumber?: string;
      bankName?: string;
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

    // Account name validation
    if (!accountName.trim()) {
      newErrors.accountName = 'Account name is required';
    } else if (accountName.trim().length < 3) {
      newErrors.accountName = 'Please enter a valid account name';
    }

    // Account number validation
    const accountNumberRegex = /^\d{10}$/;
    if (!accountNumber) {
      newErrors.accountNumber = 'Account number is required';
    } else if (!accountNumberRegex.test(accountNumber)) {
      newErrors.accountNumber = 'Account number must be 10 digits';
    }

    // Bank name validation
    if (!bankName) {
      newErrors.bankName = 'Please select a bank';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      onSubmit({
        amount: parseFloat(amount),
        accountName,
        accountNumber,
        bankName
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="amount">Amount to Withdraw (₦)</Label>
        <Input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className={errors.amount ? "border-red-500" : ""}
        />
        {errors.amount && (
          <p className="text-sm text-red-500">{errors.amount}</p>
        )}
        <p className="text-sm text-gray-500">Available balance: ₦{availableBalance.toLocaleString()}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountName">Account Name</Label>
        <Input
          id="accountName"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="Enter account name"
          className={errors.accountName ? "border-red-500" : ""}
        />
        {errors.accountName && (
          <p className="text-sm text-red-500">{errors.accountName}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountNumber">Account Number</Label>
        <Input
          id="accountNumber"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="Enter 10-digit account number"
          className={errors.accountNumber ? "border-red-500" : ""}
          maxLength={10}
        />
        {errors.accountNumber && (
          <p className="text-sm text-red-500">{errors.accountNumber}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bankName">Bank</Label>
        <Select
          value={bankName}
          onValueChange={setBankName}
        >
          <SelectTrigger id="bankName" className={errors.bankName ? "border-red-500" : ""}>
            <SelectValue placeholder="Select bank" />
          </SelectTrigger>
          <SelectContent>
            {BANKS.map((bank) => (
              <SelectItem key={bank} value={bank}>
                {bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.bankName && (
          <p className="text-sm text-red-500">{errors.bankName}</p>
        )}
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          className="w-full bg-kolekto hover:bg-kolekto/90"
          disabled={isLoading}
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
      </div>
    </form>
  );
};

export default WithdrawForm;
