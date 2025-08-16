
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from 'react-router-dom';

import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
import { useAuthStore } from '@/store';

const RegisterForm: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignupComplete, setIsSignupComplete] = useState(false);

  const { signUp } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const isValidE164 = (phone: string) => /^\+[1-9]\d{1,14}$/.test(phone);

    if (!isValidE164(phoneNumber)) {
      setError("Phone number must be in international format, e.g. +2348012345678");
      return;
    }

    if (phoneNumber && phoneNumber.replace(/\D/g, '').length < 10) {
      setError('Phone number must be at least 10 digits');
      return;
    }

    setIsLoading(true);

    try {
      const { user, error } = await signUp(email, password, firstName, lastName, phoneNumber);

      if (error) {
        setError(error.message);
        toast.error('Registration failed');
      } else {
        setIsSignupComplete(true);
        toast.success('Registration successful! Check your email to confirm your account.');
        // If user is returned, they might be auto-signed in, so redirect to dashboard
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      toast.error('Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSignupComplete) {
    return (
      <div className="text-center space-y-4">
        <div className="bg-green-50 text-green-700 p-4 rounded-md">
          <h3 className="font-medium">Registration successful!</h3>
          <p className="text-sm mt-1">
            Please check your email to confirm your account.
          </p>
        </div>
        <p className="text-sm text-gray-600">
          A confirmation link has been sent to <strong>{email}</strong>
        </p>
        <div className="mt-4">
          <Link to="/login" className="text-kolekto hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      {error && (
        <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input
          id="firstName"
          type="text"
          placeholder="John Doe"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Last Name</Label>
        <Input
          id="lastName"
          type="text"
          placeholder="John Doe"
          required
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number (WhatsApp preferred)</Label>
        <Input
          id="phoneNumber"
          type="tel"
          placeholder="+234 123 456 7890"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full"
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-kolekto hover:bg-kolekto/90"
        disabled={isLoading}
      >
        {isLoading ? "Creating Account..." : "Create Account"}
      </Button>

      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-kolekto hover:underline">
          Sign in
        </Link>
      </div>
    </form>
  );
};

export default RegisterForm;
