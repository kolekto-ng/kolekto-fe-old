import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from 'react-router-dom';
import { toast } from "@/lib/toast";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useAuthStore } from '@/store';
import AuthErrorBanner from '@/components/auth/AuthErrorBanner';
import { useAuthError } from '@/hooks/useAuthError';

interface LoginFormProps {
  redirectTo?: string;
  prefillEmail?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ redirectTo = '/dashboard', prefillEmail = '' }) => {
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  // Shared banner state: classification, auto-scroll and the screen-reader
  // announcement all come from one place (hooks/useAuthError).
  const { error, scrollKey, raise, raiseValidation, clear } = useAuthError('signin');

  const { signIn, resendVerification } = useAuthStore() as any;
  const navigate = useNavigate();

  useEffect(() => {
    setEmail(prefillEmail);
  }, [prefillEmail]);

  const resolvedRedirect = redirectTo === '/create-collection'
    ? '/create-collection?resumePublish=1'
    : redirectTo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
    setIsLoading(true);

    try {
      const { user, error: signInError } = await signIn(email, password);
      if (signInError) {
        // Classified from the backend's stable `code`, NOT from message text.
        // The previous check compared error.message to the literal
        // 'Email not confirmed' — but the auth store had already rewritten the
        // message before it got here, so that branch never once ran, and
        // toFriendlyErrorMessage mapped "email not confirmed" and "invalid
        // credentials" onto the SAME sentence. Unverified users were therefore
        // told their password was wrong and sent to reset a password that had
        // never been the problem.
        raise(signInError);
      } else {
        // Fires exactly once, only on a fresh, user-initiated successful
        // login — never on session rehydration (that lives entirely in
        // useAuthStore/checkAuth and never toasts) and never duplicated by
        // the store (signIn() itself shows no toast).
        toast.success('Welcome back');
        navigate(resolvedRedirect);
      }
    } catch (err: any) {
      raise(err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Banner actions. The important one is resending verification straight from
   * the "verify your email" error — the user is already here, with their email
   * typed in, at the exact moment they discover they need it.
   */
  const handleBannerAction = async (intent?: string) => {
    if (intent === 'retry') {
      clear();
      return;
    }
    if (intent !== 'resend-verification') return;

    if (!email.trim()) {
      raiseValidation('Please enter your email address first.');
      return;
    }

    setResendPending(true);
    try {
      const { data, error: resendError } = await resendVerification(
        email,
        `${window.location.origin}/auth/verify?redirect=${encodeURIComponent(resolvedRedirect)}`
      );
      if (resendError) {
        raise(resendError);
        return;
      }
      toast.success(data?.message || 'Verification email sent. Please check your inbox.');
      clear();
    } finally {
      setResendPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AuthErrorBanner
        error={error}
        scrollKey={scrollKey}
        onAction={handleBannerAction}
        actionPending={resendPending}
      />

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
