import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Eye,
  AlertTriangle,
  Shield,
  User,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  Camera,
  FileText,
  Info
} from 'lucide-react';

const StatusBadge = ({ status, type = 'default' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'approved':
      case 'verified':
      case 'completed':
      case 'passed':
        return { color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'rejected':
      case 'failed':
        return { color: 'bg-red-100 text-red-800', icon: XCircle };
      case 'pending':
      case 'pending_review':
      case 'in_progress':
        return { color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: Info };
    }
  };

  const { color, icon: Icon } = getStatusConfig();

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3 mr-1" />
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
};

const KYCProgressBar = ({ percentage }) => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
      style={{ width: `${percentage}%` }}
    ></div>
  </div>
);

const VerificationSection = ({ title, icon: Icon, status, children, completionRate }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className="w-6 h-6 text-gray-600" />
        </div>
        <div className="ml-3">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          {completionRate && (
            <p className="text-sm text-gray-500">{completionRate}% complete</p>
          )}
        </div>
      </div>
      <StatusBadge status={status} />
    </div>
    {children}
  </div>
);

const DocumentCard = ({ document, onReupload, onView }) => (
  <div className="border rounded-lg p-4 bg-gray-50">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <FileText className="w-5 h-5 text-gray-400 mr-3" />
        <div>
          <p className="text-sm font-medium text-gray-900">
            {document.type.replace('_', ' ').toUpperCase()}
          </p>
          <p className="text-xs text-gray-500">
            Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onView(document)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          <Eye className="w-4 h-4" />
        </button>
        {document.status === 'rejected' && (
          <button
            onClick={() => onReupload(document)}
            className="text-orange-600 hover:text-orange-800 text-sm"
          >
            <Upload className="w-4 h-4" />
          </button>
        )}
        <StatusBadge status={document.status} />
      </div>
    </div>
    {document.rejectionReason && (
      <div className="mt-3 p-3 bg-red-50 rounded-md">
        <div className="flex">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 mr-2" />
          <p className="text-sm text-red-800">{document.rejectionReason}</p>
        </div>
      </div>
    )}
  </div>
);

export default function ComprehensiveKYC() {
  // Mock data structure following comprehensive KYC requirements
  const [kycData] = useState({
    userId: 'user_123',
    overallStatus: 'in_progress', // 'pending', 'in_progress', 'approved', 'rejected', 'suspended'
    kycTier: 'tier_2', // 'tier_1', 'tier_2', 'tier_3'
    completionPercentage: 65,

    personalInfo: {
      status: 'approved',
      firstName: 'John',
      lastName: 'Doe',
      middleName: 'Michael',
      dateOfBirth: '1990-01-15',
      gender: 'male',
      nationality: 'Nigerian',
      stateOfOrigin: 'Lagos',
      lga: 'Ikeja',
      maritalStatus: 'single',
      occupation: 'Software Developer',
      employerName: 'Tech Corp Ltd',
      monthlyIncome: '500000',
      sourceOfFunds: 'salary',
      residentialAddress: '123 Main Street, Ikeja, Lagos',
      nextOfKin: {
        name: 'Jane Doe',
        relationship: 'sister',
        phoneNumber: '+2341234567891',
        email: 'jane@email.com'
      },
      updatedAt: '2024-01-10'
    },

    identityVerification: {
      status: 'pending_review',
      documents: [
        {
          id: 'doc_001',
          type: 'national_id',
          category: 'identity',
          fileName: 'national_id_front.jpg',
          status: 'uploaded',
          uploadedAt: '2024-01-15',
          expiryDate: '2030-01-15',
          documentNumber: 'A12345678',
          rejectionReason: null
        },
        {
          id: 'doc_002',
          type: 'passport_photo',
          category: 'identity',
          fileName: 'passport_photo.jpg',
          status: 'approved',
          uploadedAt: '2024-01-15'
        }
      ],
      livenessCheck: {
        status: 'completed',
        confidence: 95.2,
        completedAt: '2024-01-15'
      },
      faceMatch: {
        status: 'passed',
        confidence: 92.8,
        completedAt: '2024-01-16'
      }
    },

    addressVerification: {
      status: 'rejected',
      documents: [
        {
          id: 'doc_003',
          type: 'utility_bill',
          category: 'address',
          fileName: 'utility_bill.pdf',
          status: 'rejected',
          uploadedAt: '2024-01-16',
          rejectionReason: 'Document is older than 3 months. Please upload a recent utility bill.'
        }
      ]
    },

    phoneVerification: {
      phoneNumber: '+2341234567890',
      status: 'verified',
      verifiedAt: '2024-01-10',
      otpAttempts: 1,
      maxAttempts: 3
    },

    emailVerification: {
      email: 'john.doe@email.com',
      status: 'verified',
      verifiedAt: '2024-01-10'
    },

    governmentIdVerification: {
      nin: {
        number: '12345678901',
        status: 'verified',
        verifiedAt: '2024-01-15',
        matchScore: 98.5,
        data: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-15',
          gender: 'male'
        }
      },
      bvn: {
        number: '12345678901',
        status: 'verified',
        verifiedAt: '2024-01-15',
        matchScore: 96.2,
        data: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-15',
          phoneNumber: '+2341234567890'
        }
      }
    },

    bankVerification: {
      bankName: 'First Bank',
      accountNumber: '1234567890',
      accountName: 'John Michael Doe',
      status: 'verified',
      verifiedAt: '2024-01-17',
      matchScore: 95.0
    },

    riskAssessment: {
      overallRiskLevel: 'low',
      pep: false,
      sanctions: false,
      adverseMedia: false,
      lastScreeningDate: '2024-01-20',
      riskFactors: []
    },

    complianceChecks: {
      amlScreening: {
        status: 'passed',
        checkedAt: '2024-01-20',
        provider: 'compliance_api'
      },
      sanctionsCheck: {
        status: 'passed',
        checkedAt: '2024-01-20'
      },
      pepCheck: {
        status: 'passed',
        checkedAt: '2024-01-20'
      }
    },

    auditTrail: [
      {
        id: 'audit_001',
        action: 'kyc_initiated',
        timestamp: '2024-01-10T10:00:00Z',
        userId: 'user_123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      },
      {
        id: 'audit_002',
        action: 'document_uploaded',
        timestamp: '2024-01-15T14:30:00Z',
        documentType: 'national_id',
        userId: 'user_123',
        ipAddress: '192.168.1.1'
      }
    ],

    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z'
  });

  const handleDocumentReupload = (document) => {
    console.log('Reuploading document:', document.id);
    // Implement file upload logic
  };

  const handleDocumentView = (document) => {
    console.log('Viewing document:', document.id);
    // Implement document viewing logic
  };

  const calculatePersonalInfoCompletion = () => {
    const requiredFields = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'occupation'];
    const completedFields = requiredFields.filter(field => kycData.personalInfo[field]);
    return Math.round((completedFields.length / requiredFields.length) * 100);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">KYC Verification</h1>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Current Tier</p>
              <p className="font-semibold text-blue-600">{kycData.kycTier.replace('_', ' ').toUpperCase()}</p>
            </div>
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Overall Progress</span>
            <span>{kycData.completionPercentage}% Complete</span>
          </div>
          <KYCProgressBar percentage={kycData.completionPercentage} />
        </div>

        <div className="flex items-center justify-between mt-4">
          <StatusBadge status={kycData.overallStatus} />
          <div className="text-sm text-gray-500">
            Risk Level: <span className="font-medium capitalize">{kycData.riskAssessment.overallRiskLevel}</span>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <VerificationSection
        title="Personal Information"
        icon={User}
        status={kycData.personalInfo.status}
        completionRate={calculatePersonalInfoCompletion()}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Full Name:</span>
            <span className="ml-2 font-medium">
              {`${kycData.personalInfo.firstName} ${kycData.personalInfo.middleName} ${kycData.personalInfo.lastName}`}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Date of Birth:</span>
            <span className="ml-2 font-medium">{kycData.personalInfo.dateOfBirth}</span>
          </div>
          <div>
            <span className="text-gray-500">Nationality:</span>
            <span className="ml-2 font-medium">{kycData.personalInfo.nationality}</span>
          </div>
          <div>
            <span className="text-gray-500">Occupation:</span>
            <span className="ml-2 font-medium">{kycData.personalInfo.occupation}</span>
          </div>
        </div>
      </VerificationSection>

      {/* Identity Verification */}
      <VerificationSection
        title="Identity Verification"
        icon={Camera}
        status={kycData.identityVerification.status}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-sm">
              <span className="text-gray-500">Liveness Check:</span>
              <StatusBadge status={kycData.identityVerification.livenessCheck.status} />
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Face Match:</span>
              <StatusBadge status={kycData.identityVerification.faceMatch.status} />
            </div>
          </div>

          <div className="space-y-3">
            {kycData.identityVerification.documents.map((doc, index) => (
              <DocumentCard
                key={index}
                document={doc}
                onReupload={handleDocumentReupload}
                onView={handleDocumentView}
              />
            ))}
          </div>
        </div>
      </VerificationSection>

      {/* Address Verification */}
      <VerificationSection
        title="Address Verification"
        icon={MapPin}
        status={kycData.addressVerification.status}
      >
        <div className="space-y-3">
          {kycData.addressVerification.documents.map((doc, index) => (
            <DocumentCard
              key={index}
              document={doc}
              onReupload={handleDocumentReupload}
              onView={handleDocumentView}
            />
          ))}
        </div>
      </VerificationSection>

      {/* Government ID Verification */}
      <VerificationSection
        title="Government ID Verification"
        icon={Shield}
        status="verified"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">NIN Verification</h4>
              <StatusBadge status={kycData.governmentIdVerification.nin.status} />
            </div>
            <p className="text-sm text-gray-600">
              Match Score: {kycData.governmentIdVerification.nin.matchScore}%
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">BVN Verification</h4>
              <StatusBadge status={kycData.governmentIdVerification.bvn.status} />
            </div>
            <p className="text-sm text-gray-600">
              Match Score: {kycData.governmentIdVerification.bvn.matchScore}%
            </p>
          </div>
        </div>
      </VerificationSection>

      {/* Contact Verification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <VerificationSection
          title="Phone Verification"
          icon={Phone}
          status={kycData.phoneVerification.status}
        >
          <p className="text-sm text-gray-600">
            {kycData.phoneVerification.phoneNumber}
          </p>
        </VerificationSection>

        <VerificationSection
          title="Email Verification"
          icon={Mail}
          status={kycData.emailVerification.status}
        >
          <p className="text-sm text-gray-600">
            {kycData.emailVerification.email}
          </p>
        </VerificationSection>
      </div>

      {/* Bank Verification */}
      <VerificationSection
        title="Bank Account Verification"
        icon={CreditCard}
        status={kycData.bankVerification.status}
      >
        <div className="text-sm text-gray-600">
          <p><span className="font-medium">Bank:</span> {kycData.bankVerification.bankName}</p>
          <p><span className="font-medium">Account Name:</span> {kycData.bankVerification.accountName}</p>
          <p><span className="font-medium">Match Score:</span> {kycData.bankVerification.matchScore}%</p>
        </div>
      </VerificationSection>

      {/* Risk Assessment */}
      <VerificationSection
        title="Risk Assessment & Compliance"
        icon={Shield}
        status="passed"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="border rounded-lg p-3">
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium">AML Screening</p>
            <p className="text-xs text-gray-500">Passed</p>
          </div>
          <div className="border rounded-lg p-3">
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium">PEP Check</p>
            <p className="text-xs text-gray-500">Passed</p>
          </div>
          <div className="border rounded-lg p-3">
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium">Sanctions Check</p>
            <p className="text-xs text-gray-500">Passed</p>
          </div>
        </div>
      </VerificationSection>
    </div>
  );
}