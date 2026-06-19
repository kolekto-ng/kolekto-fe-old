import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useProfileStore } from '@/store/useProfileStore';
import PersonalInfoSection from '@/components/profile/PersonalInfoSection';
import LoginSecuritySection from '@/components/profile/LoginSecuritySection';
import KYCSection from '@/components/profile/KYCSection';
import BankDetailsSection from '@/components/profile/BankDetailsSection';
import PushNotificationSettings from '@/components/profile/PushNotificationSettings';
import {
  ArrowLeft,
  ChevronRight,
  Lock,
  Shield,
  Building2,
  LogOut,
  Loader2,
} from 'lucide-react';

const sections = [
  {
    id: 'security',
    label: 'Login & Security',
    description: 'Password, access, and account protection',
    icon: Lock,
  },
  {
    id: 'kyc',
    label: 'KYC Verification',
    description: 'Identity verification and compliance status',
    icon: Shield,
  },
  {
    id: 'bank',
    label: 'Bank Details',
    description: 'Withdrawal bank account information',
    icon: Building2,
  },
];

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore() as any;
  const { activeSection, setActiveSection, fetchKYCStatus } = useProfileStore();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchKYCStatus(user.id);
    }
  }, [user?.id, fetchKYCStatus]);

  const renderSection = () => {
    switch (activeSection) {
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

  const currentSection = sections.find((section) => section.id === activeSection);
  const isPersonalView = !currentSection;

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      await signOut();
      setActiveSection('personal');
      navigate('/login', { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {isPersonalView ? (
        <div className="space-y-5">
          <PersonalInfoSection />
          <PushNotificationSettings />

          <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
            <div className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-gray-50 active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#1B5E20]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900">{section.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{section.description}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:hidden rounded-2xl border border-red-100 bg-white p-3 shadow-sm">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl p-3 text-left text-red-600 transition-all hover:bg-red-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Log out of Kolekto"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                {isSigningOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {isSigningOut ? 'Logging out...' : 'Log out'}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-red-500/80">
                  Sign out of this device
                </span>
              </span>
            </button>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs leading-relaxed text-gray-500">
              Need help with your account? Contact our{' '}
              <a
                href="https://wa.me/2348012345678"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#1B5E20] hover:underline"
              >
                support team
              </a>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSection('personal')}
              aria-label="Back to profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition-all hover:border-green-200 hover:bg-green-50 hover:text-green-800 active:scale-[0.96]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="min-w-0 text-xl font-bold leading-tight text-gray-900">
              {currentSection?.label}
            </h1>
          </div>

          <div className="min-w-0 flex-1 transition-opacity duration-200">
            {renderSection()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
