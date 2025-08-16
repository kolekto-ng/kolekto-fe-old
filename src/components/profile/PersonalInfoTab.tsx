import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit2, Camera, Check, Key, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store';
import PaymentAccounts from './PaymentAccount';
import ProfilePictureUpload from '../settings/profile-picture-upload';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import KYCVerificationTab from './KYCVerificationTab';

const PersonalInfoTab: React.FC<{ kycStatus?: string }> = ({ kycStatus }) => {
  const { user } = useAuthStore() as any;

  const kycComplete = kycStatus === 'verified';
  const kycNotStarted = kycStatus === 'not_started';
  const kycPending = kycStatus === 'pending';

  const profile = {
    kyc_status: kycStatus || 'pending',
    bvn: '',
    nin: '',
  };

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [securityData] = useState({
    lastPasswordChange: '',
    loginAttempts: [
      {
        id: 1,
        timestamp: '2024-01-20 09:30 AM',
        location: 'Lagos, Nigeria',
        device: 'Chrome on Windows',
        ipAddress: '197.149.xxx.xxx',
        status: 'successful'
      },
      {
        id: 2,
        timestamp: '2024-01-19 02:15 PM',
        location: 'Lagos, Nigeria',
        device: 'Safari on iPhone',
        ipAddress: '197.149.xxx.xxx',
        status: 'successful'
      },
      {
        id: 3,
        timestamp: '2024-01-18 11:45 AM',
        location: 'Abuja, Nigeria',
        device: 'Chrome on Android',
        ipAddress: '105.112.xxx.xxx',
        status: 'failed'
      }
    ],
    activeSessions: [
      {
        id: 1,
        device: 'Chrome on Windows',
        location: 'Lagos, Nigeria',
        lastActive: '2024-01-20 09:30 AM',
        current: true
      },
      {
        id: 2,
        device: 'Mobile App on iPhone',
        location: 'Lagos, Nigeria',
        lastActive: '2024-01-19 08:20 PM',
        current: false
      }
    ]
  });

  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user.user_metadata?.full_name || 'John Doe',
    email: user.email || '',
    phone: user.user_metadata?.phone || '+234',
    dateOfBirth: user.user_metadata?.dob || '',
    address: user.user_metadata?.address || '',
  });

  console.log(user, 'user');


  const handleSave = () => {
    setIsEditing(false);
    toast({
      title: "Profile Updated",
      description: "Your personal information has been updated successfully.",
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = () => {
    toast({
      title: "Password Updated",
      description: "Your password has been changed successfully.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-6">
            <div className="relative">
              {/* <ProfilePictureUpload /> */}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{formData.fullName}</h2>
              <p className="text-muted-foreground">{formData.email}</p>

              {/* {!kycComplete && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="link" className="p-0 h-auto text-blue-600">
                      {kycNotStarted ? 'Start KYC Verification' : 'Complete KYC Verification'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <KYCVerificationTab />
                  </DialogContent>
                </Dialog>
              )} */}

              {kycComplete && (
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Verified Account
                  </Badge>
                </div>
              )}
            </div>
            {/* <Button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              variant={isEditing ? "default" : "outline"}
            >
              {isEditing ? <Check className="h-4 w-4 mr-2" /> : <Edit2 className="h-4 w-4 mr-2" />}
              {isEditing ? 'Save Changes' : 'Edit Profile'}
            </Button> */}
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              {isEditing ? (
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                />
              ) : (
                <p className="text-foreground font-medium">{formData.fullName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <p className="text-foreground font-medium">{formData.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              ) : (
                <p className="text-foreground font-medium">{formData.phone}</p>
              )}
            </div>
            {/* <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              {isEditing ? (
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                />
              ) : (
                <p className="text-foreground font-medium">{new Date(formData.dateOfBirth).toLocaleDateString()}</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              {isEditing ? (
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                />
              ) : (
                <p className="text-foreground font-medium">{formData.address}</p>
              )}
            </div> */}
          </div>
        </CardContent>
      </Card>

      {/* Password & Authentication */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="h-5 w-5 mr-2" />
            Password & Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Last password change</p>
              <p className="text-sm text-muted-foreground">
                {new Date(securityData.lastPasswordChange).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline">Change Password</Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button onClick={handlePasswordChange} className="w-full">
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card> */}

      {/* Government IDs */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Government Identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bvn">Bank Verification Number (BVN)</Label>
              <p className="text-foreground font-medium">{profile.bvn || 'Not Provided'}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nin">National Identification Number (NIN)</Label>
              <p className="text-foreground font-medium">{profile.nin || 'Not Provided'}</p>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* <PaymentAccounts /> */}
    </div>
  );
};

export default PersonalInfoTab;
