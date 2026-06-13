import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  FileText,
  Upload,
  Check,
  Clock,
  X,
  AlertCircle,
  ChevronRight,
  Loader2,
  CreditCard,
  MapPin,
  RefreshCw,
  Camera,
} from 'lucide-react';
import { useAuthStore } from '@/store';
import { useProfileStore } from '@/store/useProfileStore';
import { DocumentUploadForm } from './forms/DocumentUploadForm';
import { axiosInstance } from '@/utils/axios';
import { toast } from 'sonner';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<
    string,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    verified: {
      icon: <Check className="w-3 h-3" />,
      label: "Approved",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    pending: {
      icon: <Clock className="w-3 h-3" />,
      label: "Under Review",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    reviewing: {
      icon: <Clock className="w-3 h-3" />,
      label: "Under Review",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    rejected: {
      icon: <X className="w-3 h-3" />,
      label: "Rejected",
      className: "bg-red-50 text-red-700 border-red-200",
    },
    notStarted: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: "Not Submitted",
      className: "bg-gray-50 text-gray-500 border-gray-200",
    },
  };

  const statusConfig = config[status] || config.notStarted;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.className}`}
    >
      {statusConfig.icon}
      {statusConfig.label}
    </span>
  );
};

const KYCSection: React.FC = () => {
  const { user } = useAuthStore() as any;
  const { kycData, kycLoading, fetchKYCStatus } = useProfileStore();
 
  const [showIdentityUpload, setShowIdentityUpload] = useState(false);
  const [showAddressUpload, setShowAddressUpload] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchKYCStatus(user.id);
    }
  }, [user?.id]);

  const identityStatus = kycData?.identityVerification?.status || "notStarted";
  const addressStatus = kycData?.addressVerification?.status || "notStarted";
  const identityDocs = kycData?.identityVerification?.documents || [];
  const addressDocs = kycData?.addressVerification?.documents || [];

  // "Progress" should reflect what the user has actually submitted,
  // not only what has been approved by an admin.
  const identitySubmitted = identityStatus !== "notStarted";
  const addressSubmitted = addressStatus !== "notStarted";
  const submittedSteps = [identitySubmitted, addressSubmitted].filter(Boolean)
    .length;
  const totalSteps = 2;

  const handleRefresh = () => {
    if (user?.id) fetchKYCStatus(user.id);
  };

  if (kycLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KYC Progress Overview */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#1B5E20]" />
              Verification Progress
            </CardTitle>
            <button
              onClick={handleRefresh}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] rounded-full transition-all duration-500"
                style={{ width: `${(submittedSteps / totalSteps) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {submittedSteps}/{totalSteps}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                {identitySubmitted ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <p className="text-sm font-medium text-gray-900">
                  Identity Verification
                </p>
              </div>
              <StatusBadge status={identityStatus} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                {addressSubmitted ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <p className="text-sm font-medium text-gray-900">
                  Address Verification
                </p>
              </div>
              <StatusBadge status={addressStatus} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identity Verification */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#1B5E20]" />
              Identity Verification
            </CardTitle>
            <StatusBadge status={identityStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Verify your identity by providing your NIN, capturing a selfie, and uploading a valid government-issued ID.
          </p>

          {/* Uploaded Documents */}
          {identityDocs.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded Documents</Label>
              {identityDocs.slice(0, 1).map((doc: any, i: number) => (
                <div key={doc.id || i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {doc.type?.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {doc.uploadedAt
                          ? new Date(doc.uploadedAt).toLocaleDateString("en-NG")
                          : ""}
                        {doc.files?.length
                          ? ` • ${doc.files.length} file(s)`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              ))}

              {/* Rejection reason */}
              {identityDocs[0]?.status === 'rejected' && identityDocs[0]?.rejectionReason && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs font-medium text-red-700 mb-1">
                    Rejection Reason:
                  </p>
                  <p className="text-xs text-red-600">
                    {identityDocs[0].rejectionReason}
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => setShowIdentityUpload(true)}
            variant="outline"
            disabled={identityStatus === 'pending' || identityStatus === 'reviewing'}
            className="w-full border-dashed border-gray-300 text-gray-600 hover:border-[#1B5E20] hover:text-[#1B5E20] hover:bg-[#E8F5E9]/30 h-11"
          >
            <Upload className="w-4 h-4 mr-2" />
            {identityDocs.length > 0 &&
            identityDocs.some((d: any) => d.status === "rejected")
              ? "Re-upload Identity Document"
              : identityDocs.length > 0
                ? "Upload Additional Document"
                : "Upload Identity Document"}
          </Button>

          <div className="text-xs text-gray-400 space-y-0.5">
            <p>
              Accepted documents: NIN Slip, National ID Card, International
              Passport, Driver's License, Voter's Card
            </p>
            <p>Supported formats: JPG, PNG, PDF (max 5MB)</p>
          </div>
        </CardContent>
      </Card>

      {/* Address Verification */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#1B5E20]" />
              Address Verification
            </CardTitle>
            <StatusBadge status={addressStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Upload a valid proof of address document to verify your residential
            address.
          </p>

          {/* Uploaded Documents */}
          {addressDocs.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded Documents</Label>
              {addressDocs.slice(0, 1).map((doc: any, i: number) => (
                <div key={doc.id || i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {doc.type?.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {doc.uploadedAt
                          ? new Date(doc.uploadedAt).toLocaleDateString("en-NG")
                          : ""}
                        {doc.files?.length
                          ? ` • ${doc.files.length} file(s)`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              ))}

              {/* Rejection reason */}
              {addressDocs[0]?.status === 'rejected' && addressDocs[0]?.rejectionReason && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs font-medium text-red-700 mb-1">
                    Rejection Reason:
                  </p>
                  <p className="text-xs text-red-600">
                    {addressDocs[0].rejectionReason}
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => setShowAddressUpload(true)}
            variant="outline"
            disabled={addressStatus === 'pending' || addressStatus === 'reviewing'}
            className="w-full border-dashed border-gray-300 text-gray-600 hover:border-[#1B5E20] hover:text-[#1B5E20] hover:bg-[#E8F5E9]/30 h-11"
          >
            <Upload className="w-4 h-4 mr-2" />
            {addressDocs.length > 0 &&
            addressDocs.some((d: any) => d.status === "rejected")
              ? "Re-upload Address Document"
              : addressDocs.length > 0
                ? "Upload Additional Document"
                : "Upload Proof of Address"}
          </Button>

          <div className="text-xs text-gray-400 space-y-0.5">
            <p>
              Accepted documents: Utility Bill, Bank Statement, Tenancy
              Agreement, Government Letter
            </p>
            <p>Documents must be dated within the last 3 months</p>
          </div>
        </CardContent>
      </Card>


      <DocumentUploadForm
        open={showIdentityUpload}
        onOpenChange={setShowIdentityUpload}
        onSuccess={() => {
          setShowIdentityUpload(false);
          handleRefresh();
        }}
        type="identity"
        userId={user?.id || ""}
      />
      <DocumentUploadForm
        open={showAddressUpload}
        onOpenChange={setShowAddressUpload}
        onSuccess={() => {
          setShowAddressUpload(false);
          handleRefresh();
        }}
        type="address"
        userId={user?.id || ""}
      />
    </div>
  );
};

export default KYCSection;
