
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PersonalInfoTab from '@/components/profile/PersonalInfoTab';
import KYCVerificationTab from '@/components/profile/KYCVerificationTab';
import SecuritySettingsTab from '@/components/profile/SecuritySettingsTab';

const ProfilePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Account Profile</h1>
        <p className="text-muted-foreground">Manage your account information, verification status, and security settings</p>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="kyc">KYC Verification</TabsTrigger>
          {/* <TabsTrigger value="security">Security</TabsTrigger> */}
        </TabsList>

        <TabsContent value="personal">
          <PersonalInfoTab />
        </TabsContent>

        <TabsContent value="kyc">
          <KYCVerificationTab />
        </TabsContent>

        {/* <TabsContent value="security">
          <SecuritySettingsTab />
        </TabsContent> */}
      </Tabs>
    </div>
  );
};

export default ProfilePage;
