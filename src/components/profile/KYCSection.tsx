import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Upload,
  Check,
  Clock,
  X,
  AlertCircle,
  ChevronRight,
  CreditCard,
  MapPin,
  RefreshCw,
  Camera,
} from 'lucide-react';
import { useAuthStore } from '@/store';
import { useProfileStore } from '@/store/useProfileStore';
import { DocumentUploadForm } from './forms/DocumentUploadForm';
import { KycJourneyPanel } from './KycJourneyPanel';
import { axiosInstance } from '@/utils/axios';
import { toast } from "@/lib/toast";
import { Skeleton } from '@/components/ui/skeleton';

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

  const handleRefresh = () => {
    if (user?.id) fetchKYCStatus(user.id);
  };

  // Skeleton only on the true FIRST load (no data yet at all) — not on every
  // background refetch. fetchKYCStatus sets kycLoading:true unconditionally,
  // including for refetches triggered by the realtime kyc_verifications
  // subscription (see useProfileStore.ensureKycSubscription) and
  // useKycFocusRefetch. The upload flow itself writes to kyc_verifications
  // (ensureKycVerificationRow), so that subscription fires mid-upload —
  // if this gated on kycLoading alone, every refetch during an in-progress
  // upload tore down this whole section (including the open
  // DocumentUploadForm dialog) and replaced it with a skeleton, then
  // remounted a BRAND NEW DocumentUploadForm instance once loading
  // finished — resetting the wizard to step 1 and silently discarding
  // whatever the user was doing, indistinguishable from a page reload from
  // the user's point of view. Once kycData exists, a background refetch
  // updates in place instead.
  if (kycLoading && !kycData) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end -mb-2">
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh status
        </button>
      </div>

      {/* Guided KYC journey — phase, real progress checklist, review-time
          estimate, and what's still available while waiting. Entirely
          driven by kycData.journey (GET /settings/kyc/access-status). */}
      <KycJourneyPanel journey={kycData?.journey} />

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
