import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Check,
  Upload,
  AlertCircle,
  Shield,
  FileText,
  Camera,
  Clock,
  X,
  CreditCard
} from 'lucide-react';
import second from '../settings/comprehensive-kyc-system.js'
import { toFriendlyErrorMessage } from '@/utils/errorMessages';

const VERIFIED = 'verified';
const PENDING = 'pending';
const REJECTED = 'rejected';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentUploadForm } from './forms/DocumentUploadForm';
import ComprehensiveKYC from '../settings/comprehensive-kyc-system.js';
import { axiosInstance } from '@/utils/axios.js';
import { useAuthStore } from '@/store/useAuthStore.js';

// REMOVED — second bank-name matching algorithm.
//
// This file used to contain a `BVNVerificationForm` whose `crossCheckBankAccount`
// compared a BVN-derived name to a bank account name with a first-token
// substring test in either direction ("does either name contain the other's
// first word"). That is a THIRD answer to "do these names belong to the same
// person", disagreeing with both the server-side rule and each other, and by
// that test "Alex Felix" matched "Alex Johnson".
//
// It was also unreachable and non-enforcing: the card that opened it is
// commented out below, its result never blocked anything (only a `critical`
// severity counted, which the name check never set), and a "Proceed Anyway"
// button overrode it regardless. It called Paystack from the BROWSER using
// `process.env.REACT_APP_PAYSTACK_SECRET_KEY` — a CRA-style variable Vite
// never injects, so it would have sent `Bearer undefined`; had it been wired
// up under a name Vite does inject, it would have shipped the Paystack secret
// key to every visitor.
//
// The single authority for bank-account name verification is
// kolekto-be-old/utils/bankNameMatch.js, called only from the Express
// controllers that write payout accounts. Do not reintroduce a client-side
// pre-check here: a second rule that disagrees is worse than no rule.

const BVNVerificationForm = ({ open, onOpenChange, onSuccess, userData }) => {
  const [bvnNumber, setBvnNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setVerificationResult(null);

    // Validate BVN format
    if (!bvnNumber || bvnNumber.length !== 11 || !/^\d{11}$/.test(bvnNumber)) {
      setError('Please enter a valid 11-digit BVN');
      return;
    }

    // BVN verification has no backend endpoint today. The previous
    // implementation called Paystack directly from the browser and then ran
    // its own name-matching rule on the response — both removed above.
    //
    // If BVN verification is reintroduced it must go through the Express API
    // (the provider secret cannot live in a bundle), and any name comparison
    // must call the one authority, utils/bankNameMatch.js, server-side.
    setError('BVN verification is unavailable right now. Please use identity document upload instead.');
  };

  const handleClose = () => {
    setBvnNumber('');
    setError('');
    setVerificationResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Verify Your BVN
          </DialogTitle>
          <DialogDescription>
            Enter your 11-digit Bank Verification Number to complete your identity verification.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bvn">Bank Verification Number (BVN)</Label>
            <Input
              id="bvn"
              type="text"
              placeholder="Enter your 11-digit BVN"
              value={bvnNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                setBvnNumber(value);
                setError('');
                setVerificationResult(null);
              }}
              className={error ? 'border-red-500' : ''}
              disabled={isLoading}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* The verification-result panel that stood here rendered the
              removed cross-check's match score and discrepancy list. Nothing
              produces that shape any more. */}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-800 mb-1">How to get your BVN:</h4>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• Dial *565*0# on your registered phone number</li>
              <li>• Visit any bank branch with valid ID</li>
              <li>• Use your bank's mobile app or USSD code</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            {/* The "Proceed Anyway" button that stood here let a user accept
                their own BVN verification despite a reported name
                discrepancy — the check it overrode is gone, and an
                override-your-own-verification control should not come back
                with it. */}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Verify BVN
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Mock components for other forms (replace with your actual imports)
// const DocumentUploadForm = ({ open, onOpenChange, type, onSuccess }) => null;
// const ComprehensiveKYC = () => null;

const KYCVerificationTab = () => {
  const [showBVNForm, setShowBVNForm] = useState(false);
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [kycData, setKycData] = useState({
    overallStatus: 'notStarted',
    completionPercentage: 0,
    bvnVerification: {
      status: 'notStarted',
      bvn: '',
      verifiedAt: null,
      lastUpdated: null
    },
    identityVerification: { status: 'notStarted', documents: [] },
    addressVerification: { status: 'notStarted', documents: [] },
    phoneVerification: {
      phoneNumber: '',
      status: 'notStarted',
      verifiedAt: null
    },
    emailVerification: {
      email: '',
      status: 'notStarted',
      verifiedAt: null
    },
    bankVerification: {
      bankName: '',
      accountNumber: '',
      bvn: '',
      accountName: '',
      status: 'notStarted',
      verifiedAt: null
    }
  });
  const [loading, setLoading] = useState(true);

  const { user } = useAuthStore(); // Replace with actual user ID from auth context/store
  console.log(user);

  // Fetch KYC data from API on mount
  useEffect(() => {
    const fetchKYCData = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/settings/kyc/${user.id}`);
        console.log(res, 'res');

        if (res.data) {
          // Map documents to identity and address sections
          const documents = res.data.documents || [];
          console.log(res, documents, 'res and documents');

          const identityDocs = documents
            .filter(doc => doc.document_type === 'identity')
            .map(doc => ({
              id: doc.id,
              type: doc.verification_type,
              status: doc.status,
              uploadedAt: doc.uploaded_at,
              files: doc.files || [],
            }));
          const addressDocs = documents
            .filter(doc => doc.document_type === 'address')
            .map(doc => ({
              id: doc.id,
              type: doc.verification_type,
              status: doc.status,
              uploadedAt: doc.uploaded_at,
              files: doc.files || [],
            }));

          setKycData(prev => ({
            ...prev,
            ...res.data.kycData,
            identityVerification: {
              status: identityDocs.length > 0 ? identityDocs[0].status : 'notStarted',
              documents: identityDocs,
            },
            addressVerification: {
              status: addressDocs.length > 0 ? addressDocs[0].status : 'notStarted',
              documents: addressDocs,
            },
          }));
        }
      } catch (error) {
        console.error('Failed to fetch KYC data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKYCData();
  }, [user.id]);

  console.log(kycData, 'KYC Data');


  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <Check className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <X className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-600 border-gray-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Not Started
          </Badge>
        );
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'rejected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* KYC Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              KYC Verification Status
            </CardTitle>
            {getStatusBadge(kycData.overallStatus)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Verification Progress</span>
              <span className="font-medium">{kycData.completionPercentage}%</span>
            </div>
            <Progress value={kycData.completionPercentage} className="h-2" />
          </div>

          {kycData.overallStatus === 'verified' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-800">Verification Complete</h4>
                  <p className="text-sm text-green-600">
                    Your account has been fully verified. You have access to all platform features.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BVN Verification Card */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              BVN Verification
            </span>
            {getStatusBadge(kycData.bvnVerification.status)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-medium text-blue-800">Bank Verification Number (BVN)</h4>
                <p className="text-sm text-blue-600">
                  Your BVN helps us verify your identity with Nigerian banks and ensures secure transactions.
                </p>
              </div>
            </div>
          </div>

          Only show BVN data if status is not 'notStarted'
          {kycData.bvnVerification.status !== 'notStarted' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <CreditCard className={`h-5 w-5 ${getStatusColor(kycData.bvnVerification.status)}`} />
                  <div>
                    <p className="font-medium">BVN: {kycData.bvnVerification.bvn}</p>
                    <p className="text-sm text-muted-foreground">
                      {kycData.bvnVerification.status === 'verified'
                        ? `Verified on ${new Date(kycData.bvnVerification.verifiedAt).toLocaleDateString()}`
                        : `Last updated: ${new Date(kycData.bvnVerification.lastUpdated).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                </div>
                {getStatusBadge(kycData.bvnVerification.status)}
              </div>

              Show verification details if available
              {kycData.bvnVerification.status === 'verified' && kycData.bvnVerification.bvnData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-800">
                        BVN Verified - Match Score: {kycData.bvnVerification.matchScore}%
                      </p>
                      <p className="text-xs text-green-600">
                        Name: {kycData.bvnVerification.bvnData.first_name} {kycData.bvnVerification.bvnData.last_name}
                      </p>
                      {kycData.bvnVerification.hasDiscrepancies && (
                        <p className="text-xs text-yellow-600">
                          ⚠️ {kycData.bvnVerification.discrepancies.length} discrepancy(ies) noted
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {kycData.bvnVerification.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <X className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">BVN Verification Failed</p>
                  <p className="text-sm text-red-600">
                    The provided BVN could not be verified. Please ensure you entered the correct 11-digit BVN.
                  </p>
                </div>
              </div>
            </div>
          )}

          {kycData.bvnVerification.status === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <Clock className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">BVN Verification in Progress</p>
                  <p className="text-sm text-yellow-600">
                    We're currently verifying your BVN with the banking system. This usually takes 1-2 business days.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowBVNForm(true)}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {kycData.bvnVerification.status === 'notStarted' ? 'Verify BVN' : 'Update BVN'}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Your BVN is a unique 11-digit number assigned by the Central Bank of Nigeria</p>
            <p>• Dial *565*0# on your registered phone number to get your BVN</p>
            <p>• Your BVN information is encrypted and securely stored</p>
          </div>
        </CardContent>
      </Card> */}

      {/* Identity Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Identity Verification
            </span>
            {getStatusBadge(kycData.identityVerification.status)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Only show document data if there are documents */}
          {kycData.identityVerification.documents.length > 0 && kycData.identityVerification.documents.map((doc, index) => (
            <div key={doc.id || index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className={`h-5 w-5 ${getStatusColor(doc.status)}`} />
                <div>
                  <p className="font-medium">{doc.type}</p>
                  <p className="text-sm text-muted-foreground">
                    Uploaded on {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
                  </p>
                  {/* Show file info if available */}
                  {doc.files && doc.files.length > 0 && (
                    <ul className="text-xs text-muted-foreground mt-1">
                      {doc.files.map((file, idx) => (
                        <li key={file.id || idx}>
                          {file.file_name} ({Math.round(file.file_size / 1024)} KB)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {getStatusBadge(doc.status)}
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowIdentityForm(true)}
            disabled={kycData.identityVerification.status === 'pending' || kycData.identityVerification.status === 'reviewing'}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Identity Document
          </Button>
        </CardContent>
      </Card>

      {/* Address Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Address Verification
            </span>
            {getStatusBadge(kycData.addressVerification.status)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Only show document data if status is not 'notStarted' */}
          {kycData.addressVerification.documents.length > 0 && kycData.addressVerification.documents.map((doc, index) => (
            <div key={doc.id || index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className={`h-5 w-5 ${getStatusColor(doc.status)}`} />
                <div>
                  <p className="font-medium">{doc.type}</p>
                  <p className="text-sm text-muted-foreground">
                    Uploaded on {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
                  </p>
                  {/* Show file info if available */}
                  {doc.files && doc.files.length > 0 && (
                    <ul className="text-xs text-muted-foreground mt-1">
                      {doc.files.map((file, idx) => (
                        <li key={file.id || idx}>
                          {file.file_name} ({Math.round(file.file_size / 1024)} KB)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {getStatusBadge(doc.status)}
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAddressForm(true)}
            disabled={kycData.addressVerification.status === 'pending' || kycData.addressVerification.status === 'reviewing'}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Proof of Address
          </Button>
        </CardContent>
      </Card>

      {/* Verification Methods */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Verification Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Check className={`h-5 w-5 ${getStatusColor(kycData.phoneVerification.status)}`} />
                <div>
                  <p className="font-medium">Phone Verification</p>
                  <p className="text-sm text-muted-foreground">
                    Verified on {new Date(kycData.phoneVerification.verifiedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {getStatusBadge(kycData.phoneVerification.status)}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Check className={`h-5 w-5 ${getStatusColor(kycData.emailVerification.status)}`} />
                <div>
                  <p className="font-medium">Email Verification</p>
                  <p className="text-sm text-muted-foreground">
                    Verified on {new Date(kycData.emailVerification.verifiedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {getStatusBadge(kycData.emailVerification.status)}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg md:col-span-2">
              <div className="flex items-center space-x-3">
                <Check className={`h-5 w-5 ${getStatusColor(kycData.bankVerification.status)}`} />
                <div>
                  <p className="font-medium">Bank Account Verification</p>
                  <p className="text-sm text-muted-foreground">
                    Verified on {new Date(kycData.bankVerification.verifiedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {getStatusBadge(kycData.bankVerification.status)}
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Compliance Information */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Compliance & Risk Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-medium text-blue-800">Risk Level: Low</h4>
                <p className="text-sm text-blue-600">
                  Your account has been assessed as low risk based on the provided documentation and verification status.
                </p>
                <div className="flex items-center space-x-4 text-sm text-blue-600">
                  <span>• Transaction Limit: ₦5,000,000</span>
                  <span>• Daily Limit: ₦1,000,000</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium">Data Protection & Privacy</h4>
            <p className="text-sm text-muted-foreground">
              All your personal information and documents are encrypted and stored securely in compliance with
              Nigerian Data Protection Regulation (NDPR) and international standards.
            </p>
          </div>
        </CardContent>
      </Card> */}

      {/* Modals */}
      <BVNVerificationForm
        open={showBVNForm}
        onOpenChange={setShowBVNForm}
        userData={kycData}
        onSuccess={(verificationData) => {
          setKycData(prev => ({
            ...prev,
            bvnVerification: {
              ...prev.bvnVerification,
              status: verificationData.status,
              verifiedAt: verificationData.verifiedAt,
              bvnData: verificationData.bvnData,
              matchScore: verificationData.matchScore,
              hasDiscrepancies: verificationData.hasDiscrepancies || false,
              discrepancies: verificationData.discrepancies || [],
              lastUpdated: new Date().toISOString()
            }
          }));
        }}
      />

      <DocumentUploadForm
        open={showIdentityForm}
        onOpenChange={setShowIdentityForm}
        type="identity"
        onSuccess={() => {
          setKycData(prev => ({
            ...prev,
            identityVerification: { ...prev.identityVerification, status: 'pending' }
          }));
        }}
      />

      <DocumentUploadForm
        open={showAddressForm}
        onOpenChange={setShowAddressForm}
        type="address"
        onSuccess={() => {
          setKycData(prev => ({
            ...prev,
            addressVerification: { ...prev.addressVerification, status: 'pending' }
          }));
        }}
      />

    </div>
  );
};

export default KYCVerificationTab;
