import React, { useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { CheckIcon, Download, Copy, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/formatters';
import { Separator } from '@/components/ui/separator';

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
  status?: string;
  paidAt?: string;
  channel?: string;
  currency?: string;
  payer?: { name: string; email: string; phone: string };
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
}: PaymentSuccessfulProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleCopyToClipboard = () => {
    const url = window.location.href;
    const message = [
      "🎉 This is my receipt from Kolekto!",
      "",
      `Collection: ${collectionTitle}`, ` Amount Paid: ${formatCurrency(amountPaid)}`,
      transactionRef ? `Transaction Ref: ${transactionRef}` : "", paidAt ? ` Paid At: ${new Date(paidAt).toLocaleString('en-NG')}` : "",
      channel ? `Channel: ${channel}` : "", currency ? `Currency: ${currency}` : "",
      "",
      participants && participants.length > 0
        ? "Contributor Details:\n" + participants.map((p, idx) =>
          `  ${participants.length > 1 ? `(${idx + 1}) ` : ""}${p.details.map(d => `${d.label}: ${d.value}`).join(", ")}${p.uniqueCode ? `, Unique Code: ${p.uniqueCode}` : ""}`
        ).join("\n")
        : "",
      "",
      `View your receipt online: ${url}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(message)
      .then(() => toast.success('Receipt details copied!'))
      .catch(() => toast.error('Failed to copy receipt'));
  };

  const getReceiptFilename = () => {
    const safeTitle = collectionTitle.replace(/\s+/g, '_');
    const safeRef = transactionRef ? transactionRef : 'receipt';
    const safeDate = paidAt ? new Date(paidAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    return `${safeTitle}_${safeRef}_${safeDate}_receipt@kolekto.com.ng.pdf`;
  };

  const handleDownloadPDF = () => {
    if (receiptRef.current) {
      // Save original styles
      const originalMaxHeight = receiptRef.current.style.maxHeight;
      const originalOverflowY = receiptRef.current.style.overflowY;

      // Remove scroll/max-height for PDF rendering
      receiptRef.current.style.maxHeight = 'none';
      receiptRef.current.style.overflowY = 'visible';

      html2pdf()
        .set({
          margin: 0.5,
          filename: getReceiptFilename(),
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        })
        .from(receiptRef.current)
        .save()
        .then(() => {
          // Restore original styles
          receiptRef.current.style.maxHeight = originalMaxHeight;
          receiptRef.current.style.overflowY = originalOverflowY;
          toast.success('PDF receipt downloaded');
        })
        .catch(() => {
          receiptRef.current.style.maxHeight = originalMaxHeight;
          receiptRef.current.style.overflowY = originalOverflowY;
          toast.error('Failed to download PDF');
        });
    }
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
      <DialogContent className="sm:max-w-md md:max-w-lg pb-4 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckIcon className="h-6 w-6 text-green-600" />
          </div>
          <DialogTitle className="text-center">Payment Successful!</DialogTitle>
        </DialogHeader>

        {/* Scrollable receipt area */}
        <div
          ref={receiptRef}
          className="space-y-6 overflow-x-auto overflow-y-auto min-w-[320px] max-h-[50vh] sm:max-h-[60vh] pr-2"
          style={{ scrollbarGutter: "stable" }}
        >
          <Card className="border border-gray-200 shadow-sm min-w-[340px]">
            <div className="bg-primary px-6 py-4">
              <div className="flex justify-between items-center">
                {/* Logo and Receipt title */}
                <div className="flex items-center gap-2">
                  <img src="../../../public/favicon.ico" alt="Kolekto Logo" className="h-8 w-8 rounded bg-white p-1" />
                  <h2 className="text-white font-bold text-xl">Receipt</h2>
                </div>
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

                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-sm text-gray-700">
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
                        <table className="w-full text-sm">
                          <tbody>
                            {participant.details.map((detail, i) => (
                              <tr key={i}>
                                <td className="font-medium text-gray-500 pr-2 align-top">{detail.label}</td>
                                <td className="text-gray-900">{detail.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-3 sm:justify-between">
          <Button
            onClick={handleCopyToClipboard}
            variant="outline"
            className="w-full sm:w-1/2"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Receipt
          </Button>
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            className="w-full sm:w-1/2"
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentSuccessful;
