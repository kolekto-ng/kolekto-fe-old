import React, { useEffect } from 'react';
import { useAuthStore } from '@/store';
import { useProfileStore } from '@/store/useProfileStore';
import PersonalInfoSection from '@/components/profile/PersonalInfoSection';
import LoginSecuritySection from '@/components/profile/LoginSecuritySection';
import KYCSection from '@/components/profile/KYCSection';
import BankDetailsSection from '@/components/profile/BankDetailsSection';
import {
  User,
  Lock,
  Shield,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const sections = [
  { id: 'personal', label: 'Personal Info', icon: User, mobileLabel: 'Personal' },
  { id: 'security', label: 'Login & Security', icon: Lock, mobileLabel: 'Security' },
  { id: 'kyc', label: 'KYC Verification', icon: Shield, mobileLabel: 'KYC' },
  { id: 'bank', label: 'Bank Details', icon: Building2, mobileLabel: 'Bank' },
];

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore() as any;
  const { activeSection, setActiveSection, kycData, fetchKYCStatus } = useProfileStore();

  const kycStatus = user?.verification_status || kycData?.overallStatus || 'not_started';
  const isVerified = kycStatus === 'verified';

  useEffect(() => {
    if (user?.id) {
      fetchKYCStatus(user.id);
    }
  }, [user?.id]);

  const renderSection = () => {
    switch (activeSection) {
      case 'personal':
        return <PersonalInfoSection />;
      case 'security':
        return <LoginSecuritySection />;
      case 'kyc':
        return <KYCSection />;
      case 'bank':
        return <BankDetailsSection />;
      default:
        return <PersonalInfoSection />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* Page Header with Verification Status */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your profile, security, and verification settings
            </p>
          </div>
          {/* Global Verification Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
              isVerified
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isVerified ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {isVerified ? 'Verified Account' : 'Unverified Account'}
          </div>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto no-scrollbar">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                  isActive
                    ? 'bg-white text-[#1B5E20] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {section.mobileLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Layout: Sidebar + Content */}
      <div className="flex gap-6">
        {/* Desktop Sidebar Navigation */}
        <div className="hidden md:block w-56 flex-shrink-0">
          <nav className="sticky top-6 space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                    isActive
                      ? 'bg-[#E8F5E9] text-[#1B5E20] shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#1B5E20]' : 'text-gray-400'}`} />
                  {section.label}
                </button>
              );
            })}

            {/* Sidebar footer card */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Need help with your account? Contact our{' '}
                  <a
                    href="https://wa.me/2348012345678"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1B5E20] font-medium hover:underline"
                  >
                    support team
                  </a>
                </p>
              </div>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {renderSection()}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;