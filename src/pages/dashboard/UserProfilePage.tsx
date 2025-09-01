import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PersonalInfoTab from '@/components/profile/PersonalInfoTab';
import KYCVerificationTab from '@/components/profile/KYCVerificationTab';
import { useAuthStore } from '@/store';

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore() as any;
  const kycStatus = user?.verification_status || 'not_started';
  const kycComplete = kycStatus === 'verified';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Account Profile</h1>
        <p className="text-muted-foreground">Manage your account information, verification status, and security settings</p>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          {/* <TabsTrigger value="personal">Personal Info</TabsTrigger> */}
          {/* {!kycComplete && (
            <TabsTrigger value="kyc">KYC Verification</TabsTrigger>
          )} */}
        </TabsList>

        <TabsContent value="personal">
          <PersonalInfoTab kycStatus={kycStatus} />
        </TabsContent>

        {/* {!kycComplete && (
          <TabsContent value="kyc">
            <KYCVerificationTab />
          </TabsContent>
        )} */}
      </Tabs>
    </div>
  );
};

export default ProfilePage;