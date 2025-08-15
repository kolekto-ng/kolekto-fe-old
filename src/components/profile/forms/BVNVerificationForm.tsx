import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BVNVerificationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const BVNVerificationForm: React.FC<BVNVerificationFormProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [bvn, setBvn] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const handleSubmitBVN = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setStep(2);
      toast({
        title: "BVN Details Retrieved",
        description: "Please verify your phone number to continue.",
      });
    }, 2000);
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setStep(3);
    }, 1500);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
      onOpenChange(false);
      toast({
        title: "BVN Verification Complete",
        description: "Your BVN has been successfully verified.",
      });
    }, 1500);
  };

  const progress = (step / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>BVN Verification</DialogTitle>
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
            <form onSubmit={handleSubmitBVN} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bvn">Bank Verification Number (BVN)</Label>
                <Input
                  id="bvn"
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value)}
                  placeholder="Enter your 11-digit BVN"
                  maxLength={11}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Dial *565*0# from your registered phone number to get your BVN
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying BVN...
                  </>
                ) : (
                  'Verify BVN'
                )}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyPhone} className="space-y-4">
              <div className="flex items-center space-x-2 p-4 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">BVN Details Retrieved</p>
                  <p className="text-sm text-green-600">Name: John Doe</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your phone number"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This should match the phone number registered with your BVN
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">Verification Code Sent</p>
                  <p className="text-sm text-blue-600">Check your SMS for the 6-digit code</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Complete Verification'
                )}
              </Button>
              
              <Button type="button" variant="outline" className="w-full">
                Resend Code
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};