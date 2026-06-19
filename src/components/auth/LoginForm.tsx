import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useAuthStore } from '@/store';
import { toFriendlyErrorMessage } from '@/utils/errorMessages';

interface LoginFormProps {
  redirectTo?: string;
  prefillEmail?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ redirectTo = '/dashboard', prefillEmail = '' }) => {
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, sendMagicLink } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    setEmail(prefillEmail);
  }, [prefillEmail]);

  const resolvedRedirect = redirectTo === '/create-collection'
    ? '/create-collection?resumePublish=1'
    : redirectTo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { user, error } = await signIn(email, password);
      if (error) {
        const message =
          error.message === 'Email not confirmed'
            ? 'Please check your email and verify your account before signing in.'
            : toFriendlyErrorMessage(error, 'Sign in failed. Please check your details and try again.');
        setError(message);
        toast.error(message);
      } else {
        toast.success('Login successful');
        navigate(resolvedRedirect);
      }
    } catch (err: any) {
      const message = toFriendlyErrorMessage(err, 'Sign in failed. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address first');
      return;
    }

    setIsMagicLinkLoading(true);

    try {
      const { error } = await sendMagicLink(email);
      if (error) {
        const message = toFriendlyErrorMessage(error, 'Could not send magic link. Please try again.');
        setError(message);
        toast.error(message);
      } else {
        setIsMagicLinkSent(true);
        toast.success('Magic link sent');
      }
    } catch (err: any) {
      setError(toFriendlyErrorMessage(err, 'Could not send magic link. Please try again.'));
      toast.error('Could not send magic link');
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  if (isMagicLinkSent) {
    return (
      <div className="text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-kolekto">
          <Mail className="h-6 w-6" />
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-emerald-800">
          <h3 className="font-medium">Check your email</h3>
          <p className="mt-1 text-sm leading-6">
            We've sent a magic link to <strong>{email}</strong>
          </p>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          Click the link in your email to sign in to your account.
        </p>
        <button
          type="button"
          onClick={() => setIsMagicLinkSent(false)}
          className="min-h-11 rounded-full px-4 text-sm font-medium text-kolekto transition hover:bg-emerald-50"
        >
          Try another method
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 text-red-800">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-kolekto">
            <Mail className="h-5 w-5" />
          </span>
          <Label htmlFor="email" className="text-base font-medium text-slate-900">
            Email
          </Label>
        </div>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 rounded-2xl border-slate-200 bg-white pl-14 pr-4 text-base text-slate-900 shadow-sm transition focus-visible:ring-emerald-500/40"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-kolekto">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <Label htmlFor="password" className="text-base font-medium text-slate-900">
              Password
            </Label>
          </div>
          <Link to="/forgot-password" className="min-h-11 rounded-full px-2 py-3 text-sm font-medium text-kolekto hover:bg-emerald-50">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-2xl border-slate-200 bg-white pl-14 pr-14 text-base text-slate-900 shadow-sm transition focus-visible:ring-emerald-500/40"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="h-14 w-full rounded-2xl bg-gradient-to-r from-kolekto to-emerald-500 text-base font-semibold shadow-lg shadow-emerald-900/15 hover:from-kolekto hover:to-emerald-600"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            <LockKeyhole className="h-5 w-5" />
            Sign in to Kolekto
          </>
        )}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-500">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-14 w-full rounded-2xl border-slate-200 bg-white text-base font-medium text-slate-950 shadow-sm hover:bg-slate-50"
        onClick={handleMagicLink}
        disabled={isMagicLinkLoading}
      >
        {isMagicLinkLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5 text-kolekto" />}
        {isMagicLinkLoading ? "Sending..." : "Email me a sign-in link"}
      </Button>

      <div className="pt-1 text-center text-base text-slate-700">
        Don't have an account?{" "}
        <Link
          to={`/register?redirect=${encodeURIComponent(redirectTo)}${redirectTo === '/create-collection' ? '&publish=1' : ''}`}
          className="font-medium text-kolekto hover:underline"
        >
          Sign up
        </Link>
      </div>
    </form>
  );
};

export default LoginForm;
