import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Smartphone,
  Key,
  AlertTriangle,
  Clock,
  MapPin,
  Monitor,
  Mail,
  Bell,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Setup2FAForm } from './forms/Setup2FAForm';

const SecuritySettingsTab: React.FC = () => {
  const { toast } = useToast();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [show2FASetup, setShow2FASetup] = useState(false);

  const [securityData] = useState({
    lastPasswordChange: '2024-01-15',
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

  const handlePasswordChange = () => {
    toast({
      title: "Password Updated",
      description: "Your password has been changed successfully.",
    });
  };

  const handleEnable2FA = () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    toast({
      title: twoFactorEnabled ? "2FA Disabled" : "2FA Enabled",
      description: twoFactorEnabled
        ? "Two-factor authentication has been disabled."
        : "Two-factor authentication has been enabled.",
    });
  };

  const handleTerminateSession = (sessionId: number) => {
    toast({
      title: "Session Terminated",
      description: "The selected session has been terminated successfully.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Security Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-green-600">95%</div>
              <p className="text-sm text-muted-foreground">Excellent Security</p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Shield className="h-3 w-3 mr-1" />
              Highly Secure
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center text-green-600">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
              Two-factor authentication enabled
            </div>
            <div className="flex items-center text-green-600">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
              Strong password policy
            </div>
            <div className="flex items-center text-green-600">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
              Regular security monitoring
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
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
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button onClick={handlePasswordChange} className="w-full">
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="h-5 w-5 mr-2" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Authenticator App</p>
              <p className="text-sm text-muted-foreground">
                Use an authenticator app to generate verification codes
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={twoFactorEnabled} onCheckedChange={handleEnable2FA} />
              {!twoFactorEnabled && (
                <Button size="sm" onClick={() => setShow2FASetup(true)}>
                  Setup 2FA
                </Button>
              )}
            </div>
          </div>
          
          {twoFactorEnabled && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700">
                  Two-factor authentication is active and protecting your account
                </p>
              </div>
            </div>
          )}
          
          <Separator />
          
          <div className="space-y-4">
            <h4 className="font-medium">Backup Options</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">SMS Verification</p>
                  <p className="text-xs text-muted-foreground">+234 801 234 5678</p>
                </div>
                <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Biometric Authentication</p>
                  <p className="text-xs text-muted-foreground">Fingerprint or Face ID</p>
                </div>
                <Switch checked={biometricEnabled} onCheckedChange={setBiometricEnabled} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Login History */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Recent Login Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {securityData.loginAttempts.map((attempt) => (
              <div key={attempt.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    attempt.status === 'successful' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{attempt.device}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {attempt.location}
                      </span>
                      <span>{attempt.timestamp}</span>
                      <span>{attempt.ipAddress}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={attempt.status === 'successful' ? 'default' : 'destructive'}>
                  {attempt.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}

      {/* Active Sessions */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Monitor className="h-5 w-5 mr-2" />
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {securityData.activeSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="flex items-center space-x-2">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{session.device}</span>
                    {session.current && (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {session.location}
                    </span>
                    <span>Last active: {session.lastActive}</span>
                  </div>
                </div>
                {!session.current && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleTerminateSession(session.id)}
                  >
                    Terminate
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}

      {/* Notification Preferences */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Security Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive security alerts via email
              </p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">SMS Alerts</p>
              <p className="text-sm text-muted-foreground">
                Receive critical security alerts via SMS
              </p>
            </div>
            <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
          </div>
          
          <Separator />
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Security Recommendations</h4>
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  <li>• Enable SMS notifications for critical security events</li>
                  <li>• Review your login activity regularly</li>
                  <li>• Use a unique, strong password for your account</li>
                  <li>• Keep your recovery information up to date</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* 2FA Setup Modal */}
      {/* <Setup2FAForm
        open={show2FASetup}
        onOpenChange={setShow2FASetup}
        onSuccess={() => setTwoFactorEnabled(true)}
      /> */}
    </div>
  );
};

export default SecuritySettingsTab;