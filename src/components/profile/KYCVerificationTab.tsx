// import React, { useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import { Progress } from '@/components/ui/progress';
// import { Separator } from '@/components/ui/separator';
// import {
//   Check,
//   Upload,
//   AlertCircle,
//   Shield,
//   FileText,
//   Camera,
//   Clock,
//   X
// } from 'lucide-react';
// import { BVNVerificationForm } from './forms/BVNVerificationForm';
// import { DocumentUploadForm } from './forms/DocumentUploadForm';
// import ComprehensiveKYC from '../settings/comprehensive-kyc-system';


// const VERIFIED = 'verified';
// const PENDING = 'pending';
// const REJECTED = 'rejected';



// const KYCVerificationTab: React.FC = () => {
//   const [showBVNForm, setShowBVNForm] = useState(false);
//   const [showIdentityForm, setShowIdentityForm] = useState(false);
//   const [showAddressForm, setShowAddressForm] = useState(false);
//   const [kycData, setKycData] = useState({
//     overallStatus: 'pending', // 'pending', 'pending', 'rejected'
//     completionPercentage: 100,
//     identityVerification: {
//       status: REJECTED,
//       documents: [
//         { type: 'National ID', status: REJECTED, uploadedAt: '2024-01-15' },
//         { type: 'Passport Photo', status: REJECTED, uploadedAt: '2024-01-15' }
//       ]
//     },
//     addressVerification: {
//       status: REJECTED,
//       documents: [
//         { type: 'Utility Bill', status: REJECTED, uploadedAt: '2024-01-16' }
//       ]
//     },
//     phoneVerification: {
//       phoneNumber: '+2341234567890',
//       status: REJECTED,
//       verifiedAt: '2024-01-10'
//     },
//     emailVerification: {
//       email: '',
//       status: REJECTED,
//       verifiedAt: '2024-01-10'
//     },
//     bankVerification: {
//       bankName: 'First Bank',
//       accountNumber: '1234567890',
//       bvn: '12345678901',
//       accountName: 'John Doe',
//       status: REJECTED,
//       verifiedAt: '2024-01-17'
//     }
//   });

//   const getStatusBadge = (status: string) => {
//     switch (status) {
//       case 'verified':
//         return (
//           <Badge variant="outline" className="text-green-600 border-green-600">
//             <Check className="h-3 w-3 mr-1" />
//             Verified
//           </Badge>
//         );
//       case 'pending':
//         return (
//           <Badge variant="outline" className="text-yellow-600 border-yellow-600">
//             <Clock className="h-3 w-3 mr-1" />
//             Pending
//           </Badge>
//         );
//       case 'rejected':
//         return (
//           <Badge variant="outline" className="text-red-600 border-red-600">
//             <X className="h-3 w-3 mr-1" />
//             Rejected
//           </Badge>
//         );
//       default:
//         return (
//           <Badge variant="outline" className="text-gray-600 border-gray-600">
//             <AlertCircle className="h-3 w-3 mr-1" />
//             Not Started
//           </Badge>
//         );
//     }
//   };

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case 'verified': return 'text-green-600';
//       case 'pending': return 'text-yellow-600';
//       case 'rejected': return 'text-red-600';
//       default: return 'text-gray-600';
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {/* KYC Overview */}
//       <Card>
//         <CardHeader>
//           <div className="flex items-center justify-between">
//             <CardTitle className="flex items-center">
//               <Shield className="h-5 w-5 mr-2" />
//               KYC Verification Status
//             </CardTitle>
//             {getStatusBadge(kycData.overallStatus)}
//           </div>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <div className="space-y-2">
//             <div className="flex justify-between text-sm">
//               <span>Verification Progress</span>
//               <span className="font-medium">{kycData.completionPercentage}%</span>
//             </div>
//             <Progress value={kycData.completionPercentage} className="h-2" />
//           </div>

//           {kycData.overallStatus === 'verified' && (
//             <div className="bg-green-50 border border-green-200 rounded-lg p-4">
//               <div className="flex items-center space-x-2">
//                 <Check className="h-5 w-5 text-green-600" />
//                 <div>
//                   <h4 className="font-medium text-green-800">Verification Complete</h4>
//                   <p className="text-sm text-green-600">
//                     Your account has been fully verified. You have access to all platform features.
//                   </p>
//                 </div>
//               </div>
//             </div>
//           )}
//         </CardContent>
//       </Card>

//       {/* Identity Verification */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center justify-between">
//             <span className="flex items-center">
//               <FileText className="h-5 w-5 mr-2" />
//               Identity Verification
//             </span>
//             {getStatusBadge(kycData.identityVerification.status)}
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           {kycData.identityVerification.documents.map((doc, index) => (
//             <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
//               <div className="flex items-center space-x-3">
//                 <FileText className={`h-5 w-5 ${getStatusColor(doc.status)}`} />
//                 <div>
//                   <p className="font-medium">{doc.type}</p>
//                   <p className="text-sm text-muted-foreground">
//                     Uploaded on {new Date(doc.uploadedAt).toLocaleDateString()}
//                   </p>
//                 </div>
//               </div>
//               {getStatusBadge(doc.status)}
//             </div>
//           ))}

//           <Button
//             variant="outline"
//             className="w-full"
//             onClick={() => setShowIdentityForm(true)}
//           >
//             <Upload className="h-4 w-4 mr-2" />
//             Upload Identity Document
//           </Button>
//         </CardContent>
//       </Card>

//       {/* Address Verification */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center justify-between">
//             <span className="flex items-center">
//               <FileText className="h-5 w-5 mr-2" />
//               Address Verification
//             </span>
//             {getStatusBadge(kycData.addressVerification.status)}
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           {kycData.addressVerification.documents.map((doc, index) => (
//             <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
//               <div className="flex items-center space-x-3">
//                 <FileText className={`h-5 w-5 ${getStatusColor(doc.status)}`} />
//                 <div>
//                   <p className="font-medium">{doc.type}</p>
//                   <p className="text-sm text-muted-foreground">
//                     Uploaded on {new Date(doc.uploadedAt).toLocaleDateString()}
//                   </p>
//                 </div>
//               </div>
//               {getStatusBadge(doc.status)}
//             </div>
//           ))}

//           <Button
//             variant="outline"
//             className="w-full"
//             onClick={() => setShowAddressForm(true)}
//           >
//             <Upload className="h-4 w-4 mr-2" />
//             Upload Proof of Address
//           </Button>
//         </CardContent>
//       </Card>

//       {/* Verification Methods */}
//       <Card>
//         <CardHeader>
//           <CardTitle>Verification Methods</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <div className="flex items-center justify-between p-3 border rounded-lg">
//               <div className="flex items-center space-x-3">
//                 <Check className={`h-5 w-5 ${getStatusColor(kycData.phoneVerification.status)}`} />
//                 <div>
//                   <p className="font-medium">Phone Verification</p>
//                   <p className="text-sm text-muted-foreground">
//                     Verified on {new Date(kycData.phoneVerification.verifiedAt).toLocaleDateString()}
//                   </p>
//                 </div>
//               </div>
//               {getStatusBadge(kycData.phoneVerification.status)}
//             </div>

//             <div className="flex items-center justify-between p-3 border rounded-lg">
//               <div className="flex items-center space-x-3">
//                 <Check className={`h-5 w-5 ${getStatusColor(kycData.emailVerification.status)}`} />
//                 <div>
//                   <p className="font-medium">Email Verification</p>
//                   <p className="text-sm text-muted-foreground">
//                     Verified on {new Date(kycData.emailVerification.verifiedAt).toLocaleDateString()}
//                   </p>
//                 </div>
//               </div>
//               {getStatusBadge(kycData.emailVerification.status)}
//             </div>

//             <div className="flex items-center justify-between p-3 border rounded-lg md:col-span-2">
//               <div className="flex items-center space-x-3">
//                 <Check className={`h-5 w-5 ${getStatusColor(kycData.bankVerification.status)}`} />
//                 <div>
//                   <p className="font-medium">Bank Account Verification</p>
//                   <p className="text-sm text-muted-foreground">
//                     Verified on {new Date(kycData.bankVerification.verifiedAt).toLocaleDateString()}
//                   </p>
//                 </div>
//               </div>
//               {getStatusBadge(kycData.bankVerification.status)}
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Compliance Information */}
//       <Card>
//         <CardHeader>
//           <CardTitle>Compliance & Risk Assessment</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
//             <div className="flex items-start space-x-3">
//               <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
//               <div className="space-y-2">
//                 <h4 className="font-medium text-blue-800">Risk Level: Low</h4>
//                 <p className="text-sm text-blue-600">
//                   Your account has been assessed as low risk based on the provided documentation and verification status.
//                 </p>
//                 <div className="flex items-center space-x-4 text-sm text-blue-600">
//                   <span>• Transaction Limit: ₦5,000,000</span>
//                   <span>• Daily Limit: ₦1,000,000</span>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <Separator />

//           <div className="space-y-2">
//             <h4 className="font-medium">Data Protection & Privacy</h4>
//             <p className="text-sm text-muted-foreground">
//               All your personal information and documents are encrypted and stored securely in compliance with
//               Nigerian Data Protection Regulation (NDPR) and international standards.
//             </p>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Modals */}
//       <BVNVerificationForm
//         open={showBVNForm}
//         onOpenChange={setShowBVNForm}
//         onSuccess={() => {
//           setKycData(prev => ({
//             ...prev,
//             bankVerification: { ...prev.bankVerification, status: 'verified' }
//           }));
//         }}
//       />

//       <DocumentUploadForm
//         open={showIdentityForm}
//         onOpenChange={setShowIdentityForm}
//         type="identity"
//         onSuccess={() => {
//           setKycData(prev => ({
//             ...prev,
//             identityVerification: { ...prev.identityVerification, status: 'pending' }
//           }));
//         }}
//       />

//       <DocumentUploadForm
//         open={showAddressForm}
//         onOpenChange={setShowAddressForm}
//         type="address"
//         onSuccess={() => {
//           setKycData(prev => ({
//             ...prev,
//             addressVerification: { ...prev.addressVerification, status: 'pending' }
//           }));
//         }}
//       />

//       <ComprehensiveKYC />
//     </div>
//   );
// };

// export default KYCVerificationTab;

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from '@/components/ui/dialog';
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

// BVN Verification Form Component
const BVNVerificationForm = ({ open, onOpenChange, onSuccess, userData }) => {
  const [bvnNumber, setBvnNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  // Function to verify BVN with Paystack
  const verifyBVNWithPaystack = async (bvn) => {
    try {
      const response = await fetch('https://api.paystack.co/bank/resolve_bvn/' + bvn, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('BVN verification failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Paystack BVN verification error:', error);
      throw error;
    }
  };

  // Function to cross-check BVN data with user's bank account
  const crossCheckBankAccount = (bvnData, userBankData) => {
    const discrepancies = [];

    // Check account name similarity
    const bvnName = `${bvnData.first_name} ${bvnData.last_name}`.toLowerCase();
    const userAccountName = userBankData.accountName.toLowerCase();

    // Simple name matching (you might want to use a more sophisticated matching algorithm)
    const nameMatch = bvnName.includes(userAccountName.split(' ')[0]) ||
      userAccountName.includes(bvnName.split(' ')[0]);

    if (!nameMatch) {
      discrepancies.push({
        field: 'Account Name',
        bvnValue: bvnName,
        userValue: userAccountName,
        severity: 'high'
      });
    }

    // Check if BVN matches the one associated with the bank account
    if (userBankData.bvn && userBankData.bvn !== bvnNumber) {
      discrepancies.push({
        field: 'BVN',
        bvnValue: bvnNumber,
        userValue: userBankData.bvn,
        severity: 'critical'
      });
    }

    // Check phone number if available
    if (bvnData.mobile && userBankData.phoneNumber) {
      const bvnPhone = bvnData.mobile.replace(/\D/g, '');
      const userPhone = userBankData.phoneNumber.replace(/\D/g, '');

      if (bvnPhone !== userPhone) {
        discrepancies.push({
          field: 'Phone Number',
          bvnValue: bvnData.mobile,
          userValue: userBankData.phoneNumber,
          severity: 'medium'
        });
      }
    }

    return {
      isValid: discrepancies.filter(d => d.severity === 'critical').length === 0,
      discrepancies,
      matchScore: discrepancies.length === 0 ? 100 : Math.max(0, 100 - (discrepancies.length * 25))
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setVerificationResult(null);

    // Validate BVN format
    if (!bvnNumber || bvnNumber.length !== 11 || !/^\d{11}$/.test(bvnNumber)) {
      setError('Please enter a valid 11-digit BVN');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Verify BVN with Paystack
      console.log('Verifying BVN with Paystack...');
      const paystackResponse = await verifyBVNWithPaystack(bvnNumber);

      if (!paystackResponse.status || !paystackResponse.data) {
        throw new Error(paystackResponse.message || 'BVN verification failed');
      }

      const bvnData = paystackResponse.data;

      // Step 2: Cross-check with user's bank account data
      console.log('Cross-checking with bank account data...');
      const crossCheckResult = crossCheckBankAccount(bvnData, userData.bankVerification);

      const result = {
        bvnData,
        crossCheckResult,
        isVerified: crossCheckResult.isValid,
        timestamp: new Date().toISOString()
      };

      setVerificationResult(result);

      if (result.isVerified) {
        // Success - BVN verified and matches bank account
        setTimeout(() => {
          onSuccess({
            status: 'verified',
            bvnData: bvnData,
            verifiedAt: new Date().toISOString(),
            matchScore: crossCheckResult.matchScore
          });
          onOpenChange(false);
          setBvnNumber('');
          setVerificationResult(null);
        }, 2000);
      } else {
        // BVN verified but has discrepancies
        setError('BVN verification completed but there are discrepancies with your account information.');
      }

    } catch (error) {
      console.error('BVN verification failed:', error);
      setError(error.message || 'Failed to verify BVN. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

          {/* Verification Result Display */}
          {verificationResult && (
            <div className="space-y-3">
              <Separator />
              <h4 className="font-medium text-sm">Verification Results:</h4>

              {/* BVN Data Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h5 className="font-medium text-blue-800 text-sm mb-2">BVN Information:</h5>
                <div className="text-xs text-blue-600 space-y-1">
                  <p>• Name: {verificationResult.bvnData.first_name} {verificationResult.bvnData.last_name}</p>
                  <p>• Phone: {verificationResult.bvnData.mobile}</p>
                  <p>• Date of Birth: {verificationResult.bvnData.date_of_birth}</p>
                </div>
              </div>

              {/* Cross-Check Results */}
              <div className={`border rounded-lg p-3 ${verificationResult.crossCheckResult.isValid
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
                }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {verificationResult.crossCheckResult.isValid ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <h5 className={`font-medium text-sm ${verificationResult.crossCheckResult.isValid
                    ? 'text-green-800'
                    : 'text-yellow-800'
                    }`}>
                    Account Match: {verificationResult.crossCheckResult.matchScore}%
                  </h5>
                </div>

                {/* Show discrepancies if any */}
                {verificationResult.crossCheckResult.discrepancies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-yellow-600 mb-2">Discrepancies found:</p>
                    {verificationResult.crossCheckResult.discrepancies.map((discrepancy, index) => (
                      <div key={index} className="text-xs">
                        <p className="font-medium text-yellow-800">{discrepancy.field}:</p>
                        <p className="text-yellow-600 ml-2">
                          BVN: {discrepancy.bvnValue} | Account: {discrepancy.userValue}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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
            {verificationResult && !verificationResult.isVerified ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Proceed with verification despite discrepancies
                  onSuccess({
                    status: 'verified',
                    bvnData: verificationResult.bvnData,
                    verifiedAt: new Date().toISOString(),
                    matchScore: verificationResult.crossCheckResult.matchScore,
                    hasDiscrepancies: true,
                    discrepancies: verificationResult.crossCheckResult.discrepancies
                  });
                  onOpenChange(false);
                  setBvnNumber('');
                  setVerificationResult(null);
                }}
                className="text-yellow-700 border-yellow-300"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Proceed Anyway
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading || (verificationResult && verificationResult.isVerified)}>
                {isLoading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : verificationResult && verificationResult.isVerified ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Verified
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Verify BVN
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Mock components for other forms (replace with your actual imports)
const DocumentUploadForm = ({ open, onOpenChange, type, onSuccess }) => null;
const ComprehensiveKYC = () => null;

const KYCVerificationTab = () => {
  const [showBVNForm, setShowBVNForm] = useState(false);
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [kycData, setKycData] = useState({
    overallStatus: 'pending', // 'pending', 'verified', 'rejected'
    completionPercentage: 75,
    bvnVerification: {
      status: PENDING,
      bvn: '123********01',
      verifiedAt: null,
      lastUpdated: '2024-01-18'
    },
    identityVerification: {
      status: REJECTED,
      documents: [
        { type: 'National ID', status: REJECTED, uploadedAt: '2024-01-15' },
        { type: 'Passport Photo', status: REJECTED, uploadedAt: '2024-01-15' }
      ]
    },
    addressVerification: {
      status: REJECTED,
      documents: [
        { type: 'Utility Bill', status: REJECTED, uploadedAt: '2024-01-16' }
      ]
    },
    phoneVerification: {
      phoneNumber: '+2341234567890',
      status: REJECTED,
      verifiedAt: '2024-01-10'
    },
    emailVerification: {
      email: '',
      status: REJECTED,
      verifiedAt: '2024-01-10'
    },
    bankVerification: {
      bankName: 'First Bank',
      accountNumber: '1234567890',
      bvn: '12345678901',
      accountName: 'John Doe',
      status: REJECTED,
      verifiedAt: '2024-01-17'
    }
  });

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
      <Card>
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

          {kycData.bvnVerification.status !== 'not_started' && (
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

              {/* Show verification details if available */}
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
            {kycData.bvnVerification.status === 'not_started' ? 'Verify BVN' : 'Update BVN'}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Your BVN is a unique 11-digit number assigned by the Central Bank of Nigeria</p>
            <p>• Dial *565*0# on your registered phone number to get your BVN</p>
            <p>• Your BVN information is encrypted and securely stored</p>
          </div>
        </CardContent>
      </Card>

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
          {kycData.identityVerification.documents.map((doc, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className={`h-5 w-5 ${getStatusColor(doc.status)}`} />
                <div>
                  <p className="font-medium">{doc.type}</p>
                  <p className="text-sm text-muted-foreground">
                    Uploaded on {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {getStatusBadge(doc.status)}
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowIdentityForm(true)}
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
          {kycData.addressVerification.documents.map((doc, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className={`h-5 w-5 ${getStatusColor(doc.status)}`} />
                <div>
                  <p className="font-medium">{doc.type}</p>
                  <p className="text-sm text-muted-foreground">
                    Uploaded on {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {getStatusBadge(doc.status)}
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAddressForm(true)}
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

      {/* <ComprehensiveKYC /> */}
    </div>
  );
};

export default KYCVerificationTab;