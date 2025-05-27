import React, { useState } from 'react';
import { CheckIcon, Download, Copy, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/formatters';
import { Separator } from '@/components/ui/separator';
import { useSearchParams } from 'react-router-dom';

interface PaymentDetail {
  label: string;
  value: string;
}

interface ParticipantInfo {
  id: string;
  details: PaymentDetail[];
  uniqueCode: string;
}

interface PaymentSuccessfulProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionTitle: string;
  amountPaid: number;
  participants: ParticipantInfo[];
  transactionRef?: string;
}

const PaymentSuccessful = ({
  open,
  onOpenChange,
  collectionTitle,
  amountPaid,
  participants,
  transactionRef,
  status = 'success',
  paidAt,
  channel = 'card',
  currency = 'NGN',
  payer
}) => {
  const [receiptData, setReceiptData] = useState(null);


  const handleCopyToClipboard = () => {
    const text = `Payment for: ${collectionTitle}\nAmount: ₦${amountPaid.toLocaleString()}\nTransaction Ref: ${transactionRef || 'N/A'}\n\n` +
      participants.map(participant => {
        const details = participant.details.map(detail => `${detail.label}: ${detail.value}`).join('\n');
        return `${details}\nUnique Code: ${participant.uniqueCode}\n`;
      }).join('\n');

    navigator.clipboard.writeText(text)
      .then(() => toast.success('Receipt copied to clipboard'))
      .catch(() => toast.error('Failed to copy receipt'));
  };

  const handleDownload = () => {
    const text = `Payment for: ${collectionTitle}\nAmount: ₦${amountPaid.toLocaleString()}\nTransaction Ref: ${transactionRef || 'N/A'}\n\n` +
      participants.map(participant => {
        const details = participant.details.map(detail => `${detail.label}: ${detail.value}`).join('\n');
        return `${details}\nUnique Code: ${participant.uniqueCode}\n`;
      }).join('\n');

    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${collectionTitle.replace(/\s+/g, '_')}_receipt.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast.success('Receipt downloaded');
  };

  const formatDate = () => {
    return new Date().toLocaleString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckIcon className="h-6 w-6 text-green-600" />
          </div>
          <DialogTitle className="text-center">Payment Successful!</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-primary px-6 py-4">
              <div className="flex justify-between items-center">
                <h2 className="text-white font-bold text-xl">Receipt</h2>
                <FileText className="h-6 w-6 text-white" />
              </div>
            </div>

            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-medium">{collectionTitle}</h3>
                  <p className="text-2xl font-bold">{formatCurrency(amountPaid)}</p>
                  <p className="text-sm text-gray-500 mt-1">{formatDate()}</p>
                </div>

                <Separator />

                {transactionRef && (
                  <div className="bg-gray-50 p-3 rounded-md text-center">
                    <p className="text-sm text-gray-500">Transaction Reference</p>
                    <p className="font-mono font-medium">{transactionRef}</p>
                  </div>
                )}

                {payer && (
                  <div className="bg-gray-50 p-3 rounded-md text-center mb-2">
                    <p className="text-sm text-gray-500 font-medium">Paid by</p>
                    <div className="font-medium">{payer.name}</div>
                    <div className="text-xs text-gray-600">{payer.email}</div>
                    <div className="text-xs text-gray-600">{payer.phone}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    <span className={status === "success" ? "text-green-600" : "text-red-600"}>
                      {status?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Paid At:</span>{" "}
                    {paidAt ? new Date(paidAt).toLocaleString() : "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Channel:</span> {channel || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Currency:</span> {currency || "NGN"}
                  </div>
                </div>

                <div className="space-y-3">
                  {participants?.map((participant, index) => (
                    <Card key={participant.id} className="bg-gray-50 border-dashed">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex justify-between items-center">
                          <span>Contributor Details {participants.length > 1 ? ` (${index + 1})` : ''}</span>
                          <Badge variant="outline" className="font-mono">{participant.uniqueCode}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <dl className="divide-y divide-gray-100">
                          {participant.details.map((detail, i) => (
                            <div key={i} className="px-1 py-2 sm:grid sm:grid-cols-3 sm:gap-4">
                              <dt className="text-sm font-medium text-gray-500">{detail.label}</dt>
                              <dd className="text-sm sm:col-span-2 overflow-hidden text-ellipsis">{detail.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleCopyToClipboard}
              variant="outline"
              className="w-full sm:w-1/2"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Receipt
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full sm:w-1/2"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentSuccessful;
