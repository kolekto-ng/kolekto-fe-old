import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { useProfileStore } from '@/store/useProfileStore';

const PasswordStrengthBar: React.FC<{ password: string }> = ({ password }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: level <= strength ? colors[strength] : '#e5e7eb',
            }}
          />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: colors[strength] }}>
        {labels[strength]}
      </p>
    </div>
  );
};

const LoginSecuritySection: React.FC = () => {
  const { passwordStep, passwordError, otpEmail, requestPasswordOTP, verifyOTPAndChangePassword, resetPasswordState } = useProfileStore();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset local state when passwordStep resets
  useEffect(() => {
    if (passwordStep === 'idle') {
      setOtp(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setLocalError('');
    }
  }, [passwordStep]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    paste.split('').forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    const focusIndex = Math.min(paste.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleRequestOTP = async () => {
    await requestPasswordOTP();
  };

  const handleVerifyAndChange = async () => {
    setLocalError('');
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setLocalError('Please enter the complete 6-digit OTP');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    await verifyOTPAndChangePassword(otpString, newPassword, confirmPassword);
  };

  const handleReset = () => {
    resetPasswordState();
    setOtp(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
    setLocalError('');
  };

  const currentError = localError || passwordError;

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#1B5E20]" />
            Login & Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#E8F5E9]/50 border border-[#E8F5E9]">
            <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-[#1B5E20]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Password Protection</p>
              <p className="text-xs text-gray-500">Your account is secured with a password. Change it regularly for better security.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#1B5E20]" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
              {[
              { label: 'Request OTP', step: 1 },
              { label: 'Enter OTP', step: 2 },
              { label: 'New Password', step: 3 },
            ].map(({ label, step: s }, i) => {
              const isActive =
                (s === 1 && (passwordStep === 'idle' || passwordStep === 'requesting')) ||
                (s === 2 && passwordStep === 'otp-sent') ||
                (s === 3 && (passwordStep === 'verifying' || passwordStep === 'success'));
              const isComplete =
                (s === 1 && passwordStep !== 'idle' && passwordStep !== 'requesting') ||
                (s === 2 && (passwordStep === 'verifying' || passwordStep === 'success')) ||
                (s === 3 && passwordStep === 'success');

              return (
                <React.Fragment key={s}>
                  {i > 0 && (
                    <div className={`flex-1 h-0.5 rounded-full transition-colors ${isComplete ? 'bg-[#1B5E20]' : 'bg-gray-200'}`} />
                  )}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isComplete
                          ? 'bg-[#1B5E20] text-white'
                          : isActive
                          ? 'bg-[#1B5E20] text-white ring-4 ring-[#E8F5E9]'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isComplete ? '✓' : s}
                    </div>
                    <span className={`text-xs hidden sm:inline ${isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Error Display */}
          {currentError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{currentError}</p>
            </div>
          )}

          {/* Step 1: Request OTP */}
          {(passwordStep === 'idle' || passwordStep === 'requesting' || passwordStep === 'error') && passwordStep !== 'otp-sent' && passwordStep !== 'verifying' && passwordStep !== 'success' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm text-gray-600">
                  To change your password, we'll send a one-time verification code to your registered email address.
                </p>
              </div>
              <Button
                onClick={handleRequestOTP}
                disabled={passwordStep === 'requesting'}
                className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white h-11"
              >
                {passwordStep === 'requesting' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                {passwordStep === 'requesting' ? 'Sending OTP...' : 'Send Verification Code'}
              </Button>
            </div>
          )}

          {/* Step 2: Enter OTP + New Password */}
          {passwordStep === 'otp-sent' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#E8F5E9]/50 border border-[#E8F5E9]">
                <p className="text-sm text-gray-600">
                  A 6-digit code has been sent to <span className="font-semibold text-gray-900">{otpEmail}</span>. Check your inbox and enter it below.
                </p>
              </div>

              {/* OTP Input */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Verification Code</Label>
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200 rounded-lg focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/20 outline-none transition-all"
                    />
                  ))}
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">New Password</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="border-gray-200 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthBar password={newPassword} />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Confirm Password</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={`border-gray-200 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20 pr-10 ${
                      confirmPassword && newPassword !== confirmPassword ? 'border-red-300' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1 border-gray-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleVerifyAndChange}
                  disabled={passwordStep === 'verifying' || otp.join('').length !== 6 || !newPassword || !confirmPassword}
                  className="flex-1 bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                >
                  {passwordStep === 'verifying' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  Change Password
                </Button>
              </div>

              <button
                onClick={handleRequestOTP}
                className="text-xs text-[#1B5E20] hover:underline w-full text-center"
              >
                Didn't receive the code? Resend OTP
              </button>
            </div>
          )}

          {/* Success State */}
          {passwordStep === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-[#1B5E20]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Password Changed!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Your password has been updated successfully. Use your new password for future logins.
                </p>
              </div>
              <Button
                onClick={handleReset}
                variant="outline"
                className="border-gray-200"
              >
                Done
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginSecuritySection;
