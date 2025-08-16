import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrCode, Smartphone, CheckCircle, Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Setup2FAFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const Setup2FAForm: React.FC<Setup2FAFormProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes] = useState([
    'ABCD-1234-EFGH', 'IJKL-5678-MNOP', 'QRST-9012-UVWX', 'YZAB-3456-CDEF',
    'GHIJ-7890-KLMN', 'OPQR-1234-STUV', 'WXYZ-5678-ABCD', 'EFGH-9012-IJKL'
  ]);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const secretKey = "JBSWY3DPEHPK3PXP";
  const qrCodeUrl = `otpauth://totp/Kolekto:user@example.com?secret=${secretKey}&issuer=Kolekto&algorithm=SHA1&digits=6&period=30`;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secretKey);
    toast({
      title: "Secret Key Copied",
      description: "The secret key has been copied to your clipboard.",
    });
  };

  const handleCopyBackupCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Backup Code Copied",
      description: "The backup code has been copied to your clipboard.",
    });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    
    // Simulate verification
    setTimeout(() => {
      setIsVerifying(false);
      if (verificationCode === '123456') {
        setStep(3);
      } else {
        toast({
          title: "Invalid Code",
          description: "Please check your authenticator app and try again.",
          variant: "destructive"
        });
      }
    }, 1500);
  };

  const handleComplete = () => {
    onSuccess();
    onOpenChange(false);
    toast({
      title: "2FA Setup Complete",
      description: "Two-factor authentication has been successfully enabled.",
    });
  };

  const progress = (step / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{step}/3</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <Smartphone className="h-12 w-12 mx-auto text-blue-600" />
                <h3 className="font-medium">Install Authenticator App</h3>
                <p className="text-sm text-muted-foreground">
                  Download and install an authenticator app on your mobile device.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="p-0">
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium">Google Authenticator</p>
                      <Badge variant="secondary" className="text-xs">Recommended</Badge>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="p-0">
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-green-600" />
                      </div>
                      <p className="text-sm font-medium">Microsoft Authenticator</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Why use 2FA?</h4>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• Adds an extra layer of security to your account</li>
                  <li>• Protects against unauthorized access</li>
                  <li>• Required for higher transaction limits</li>
                  <li>• Industry standard security practice</li>
                </ul>
              </div>

              <Button onClick={() => setStep(2)} className="w-full">
                I've Installed an App
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <QrCode className="h-12 w-12 mx-auto text-blue-600" />
                <h3 className="font-medium">Scan QR Code</h3>
                <p className="text-sm text-muted-foreground">
                  Scan this QR code with your authenticator app, or enter the secret key manually.
                </p>
              </div>

              <div className="bg-white border rounded-lg p-6 text-center">
                <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  <QrCode className="h-24 w-24 text-gray-400" />
                  <span className="text-xs text-gray-500 absolute">QR Code</span>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Can't scan? Enter this key manually:</p>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                      {secretKey}
                    </code>
                    <Button variant="outline" size="sm" onClick={handleCopySecret}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Enter Verification Code</Label>
                  <Input
                    id="code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code from your app"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div className="flex space-x-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isVerifying}>
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Continue'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
                <h3 className="font-medium">2FA Setup Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  Save these backup codes in a secure location. You can use them to access your account if you lose your phone.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Backup Codes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                        {code}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleCopyBackupCode(code)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Important</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Store these codes in a safe place</li>
                  <li>• Each code can only be used once</li>
                  <li>• Don't share these codes with anyone</li>
                  <li>• You can generate new codes anytime</li>
                </ul>
              </div>

              <Button onClick={handleComplete} className="w-full">
                Complete Setup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};