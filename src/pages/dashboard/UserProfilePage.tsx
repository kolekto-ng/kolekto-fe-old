
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { supabase } from '@/integrations/supabase/client';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import { toast } from 'sonner';
import { useWithdrawalStore } from '@/store/useWithdrawalStore';
import { useAuthStore } from '@/store';

interface UserProfile {
  full_name: string;
  email: string;
  phone_number: string | null;
}

const UserProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editProfile, setEditProfile] = useState({
    fullName: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const { createWithdrawal } = useWithdrawalStore();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name,email,phone_number')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data) {
        setProfile(data);
        setEditProfile({
          fullName: data.full_name || '',
          email: data.email || '',
          phone: data.phone_number || ''
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editProfile.fullName,
          phone_number: editProfile.phone
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editProfile.fullName,
        phone_number: editProfile.phone
      });
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error('Failed to update profile: ' + error.message);
    }
  };

  const onWithdrawComplete = async (data: {
    amount: number;
    accountName: string;
    accountNumber: string;
    bankName: string;
  }) => {
    if (!user?.id) {
      toast.error('Unable to process withdrawal. Please try again.');
      return;
    }

    try {
      await createWithdrawal({
        organizer_id: user.id,
        amount: data.amount,
        account_name: data.accountName,
        account_number: data.accountNumber,
        bank_name: data.bankName
      });

      setIsWithdrawDialogOpen(false);
      toast.success('Withdrawal request submitted successfully!');
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error(error.message || 'Failed to submit withdrawal request');
      setIsWithdrawDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile & Settings</h1>

      {loading ? (
        <div className="text-center text-muted-foreground py-10">Loading profile...</div>
      ) : profile ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  value={editProfile.fullName}
                  onChange={(e) => setEditProfile({ ...editProfile, fullName: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Your email address"
                  value={editProfile.email}
                  disabled={true}
                />
                <p className="text-sm text-gray-500">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Your phone number"
                  value={editProfile.phone}
                  onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <Separator />
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSave}>
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setEditProfile({
                        fullName: profile.full_name || '',
                        email: profile.email || '',
                        phone: profile.phone_number || ''
                      });
                    }}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setIsWithdrawDialogOpen(true)}
                className="bg-kolekto hover:bg-kolekto/90"
              >
                Withdraw Funds
              </Button>
            </CardContent>
          </Card> */}
          {/* 
          <WithdrawFundsDialog 
            open={isWithdrawDialogOpen}
            onOpenChange={setIsWithdrawDialogOpen}
            onComplete={onWithdrawComplete}
            availableBalance={0}
            collectionId=""
            collectionTitle=""
          /> */}
        </>
      ) : (
        <div className="text-center text-destructive py-10">Profile not found.</div>
      )}
    </div>
  );
};

export default UserProfilePage;
