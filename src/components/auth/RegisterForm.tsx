import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store";
import { useRecaptcher } from "@/hooks/useRecaptcher";
import ReCAPTCHA from "react-google-recaptcha";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  User,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

interface RegisterFormProps {
  redirectTo?: string;
}

const AuthSectionHeader = ({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) => (
  <div className="flex items-center gap-4">
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-kolekto">
      <Icon className="h-6 w-6" />
    </span>
    <div>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="text-sm leading-6 text-slate-500">{description}</p>
    </div>
  </div>
);

const RegisterForm: React.FC<RegisterFormProps> = ({ redirectTo = "/dashboard" }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignupComplete, setIsSignupComplete] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { execute, ready } = useRecaptcher();
  const [showV2, setShowV2] = useState(false);
  const { signUp } = useAuthStore();
  const navigate = useNavigate();

  const { executeRecaptcha } = useGoogleReCaptcha();
  const resolvedRedirect = redirectTo === "/create-collection"
    ? "/create-collection?resumePublish=1"
    : redirectTo;

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js";
    script.async = true;
    script.defer = true;

    document.body.appendChild(script);
    const script2 = document.createElement("script");

    script2.src = "https://www.google.com/recaptcha/api.js?render=6LeWENorAAAAALS4O9P-c-x1e65yu-U5bt8XGp-t";
    script2.async = true;
    script2.defer = true;
    document.body.appendChild(script2);

    return () => {
      document.body.removeChild(script);
    };
  }, []);
  // const handleSubmit = async (e) => {
  //   e.preventDefault();

  //   if (showV2) {
  //     alert("Please complete the reCAPTCHA checkbox first.");
  //     return;
  //   }

  //   if (!ready) return alert("reCAPTCHA not ready");

  //   // Run v3
  //   const token = await execute("signup");

  //   const res = await fetch("/api/signup", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ email, token, type: "v3" }),
  //   });

  //   const data = await res.json();

  //   if (data.requireV2) {
  //     // backend says v3 score too low → fallback
  //     setShowV2(true);
  //   } else {
  //     console.log("✅ Signup success:", data);
  //   }
  // };

  const handleV2Change = async (token) => {
    if (!token) return;
    let recaptchaType = "v2"
    let recaptcherToken = token

    try {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      const isValidE164 = (phone: string) => /^\+[1-9]\d{1,14}$/.test(phone);

      if (!isValidE164(phoneNumber)) {
        setError(
          "Phone number must be in international format, e.g. +2348012345678"
        );
        return;
      }

      if (phoneNumber && phoneNumber.replace(/\D/g, "").length < 10) {
        setError("Phone number must be at least 10 digits");
        return;
      }

      setIsLoading(true);
      let { user, error } = await signUp(
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        recaptcherToken,
        recaptchaType,
        `${window.location.origin}${resolvedRedirect}`
      );

      if (error) {
        const message = toFriendlyErrorMessage(error, "Registration failed. Please try again.");
        setError(message);
        toast.error(message);
      } else {
        setIsSignupComplete(true);
        toast.success("Account created");
      }
    } catch (error: any) {
      console.log(error, 'error');
      const message = toFriendlyErrorMessage(error, "Registration failed. Please try again.");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }

  };

  // Validation helpers
  const isValidE164 = (phone: string) => /^\+[1-9]\d{1,14}$/.test(phone);
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent, recaptchaType = 'v3') => {
    e.preventDefault();
    setError("");

    // Checks for required fields
    if (!firstName.trim()) {
      setError("First Name is required.");
      return;
    }
    if (!lastName.trim()) {
      setError("Last Name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!isValidE164(phoneNumber)) {
      setError(
        "Phone number must be in international format, e.g. +2348012345678"
      );
      return;
    }
    if (phoneNumber.replace(/\D/g, "").length < 10) {
      setError("Phone number must be at least 10 digits.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!confirmPassword) {
      setError("Please confirm your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setIsLoading(true);

    if (showV2) {
      toast.error("Please complete the security check");
      setIsLoading(false);
      return;
    }

    // Allow account creation even if reCAPTCHA isn't ready
    let recaptcherToken = "";
    if (executeRecaptcha) {
      // request token with an "action"
      recaptcherToken = await executeRecaptcha("signup");
      console.log(recaptcherToken, 'capther');
    } else {
      // recaptcha not ready, continue without token
      console.warn("reCAPTCHA not ready, proceeding without token.");
    }

    try {
      let { user, session, verificationRequired, error } = await signUp(
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        recaptcherToken,
        recaptchaType,
        `${window.location.origin}${resolvedRedirect}`
      );
      console.log(user, 'user');

      if (user.requireV2) {
        // backend says v3 score too low → fallback
        setShowV2(true);
        error = { message: 'solve recaptcha' }
        return
      } else {
        console.log("✅ Signup success:", user);
      }

      if (error) {
        const message = toFriendlyErrorMessage(error, "Registration failed. Please try again.");
        setError(message);
        toast.error(message);
      } else {
        if (session?.access_token) {
          toast.success("Account created");
          navigate(resolvedRedirect);
        } else if (verificationRequired) {
          setIsSignupComplete(true);
          toast.success("Check your email");
        } else {
          setIsSignupComplete(true);
          toast.success("Registration successful");
        }
      }
    } catch (err: any) {
      const message = toFriendlyErrorMessage(err, "Registration failed. Please try again.");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length < 6) return "Weak";
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) return "Strong";
    if (/[A-Z]/.test(pwd) || /[0-9]/.test(pwd)) return "Medium";
    return "Weak";
  };

  if (isSignupComplete) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-kolekto">
          <Mail className="h-6 w-6" />
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-emerald-800">
          <h3 className="font-medium">Registration successful!</h3>
          <p className="mt-1 text-sm leading-6">
            Your account has been created. Check your email, verify your account, and we will resume your saved collection publishing flow when you return.
          </p>
        </div>
        <div className="pt-1">
          <Link to={`/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectTo)}${redirectTo === '/create-collection' ? '&publish=1' : ''}`} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-kolekto hover:bg-emerald-50">
            Continue to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <p className="text-xs font-medium text-slate-500">
        Fields marked <span className="text-red-500">*</span> are required.
      </p>

      {error && (
        <Alert
          variant="destructive"
          className="rounded-2xl border-red-200 bg-red-50 text-red-800"
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-5">
        <AuthSectionHeader
          icon={User}
          title="Personal Information"
          description="Tell us about yourself"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="font-medium text-slate-900">
              First Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-kolekto" />
              <Input
                id="firstName"
                type="text"
                placeholder="Enter your first name"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-14 rounded-2xl border-slate-200 bg-white pl-14 text-base shadow-sm focus-visible:ring-emerald-500/40"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="font-medium text-slate-900">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-kolekto" />
              <Input
                id="lastName"
                type="text"
                placeholder="Enter your last name"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-14 rounded-2xl border-slate-200 bg-white pl-14 text-base shadow-sm focus-visible:ring-emerald-500/40"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-dashed border-slate-200" />

      <section className="space-y-5">
        <AuthSectionHeader
          icon={Mail}
          title="Account Information"
          description="We'll use this to secure your account"
        />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-medium text-slate-900">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-kolekto" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 rounded-2xl border-slate-200 bg-white pl-14 text-base shadow-sm focus-visible:ring-emerald-500/40"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber" className="font-medium text-slate-900">
              Phone Number (WhatsApp preferred) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-kolekto" />
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+2348012345678"
                required
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-14 rounded-2xl border-slate-200 bg-white pl-14 text-base shadow-sm focus-visible:ring-emerald-500/40"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-dashed border-slate-200" />

      <section className="space-y-5">
        <AuthSectionHeader
          icon={LockKeyhole}
          title="Security"
          description="Create a strong password to protect your account"
        />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="font-medium text-slate-900">
              Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-kolekto" />
              <Input
                id="password"
                placeholder="Create a password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={!!error && error.toLowerCase().includes("password")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordStrength(getPasswordStrength(e.target.value));
                }}
                className="h-14 rounded-2xl border-slate-200 bg-white pl-14 pr-14 text-base shadow-sm focus-visible:ring-emerald-500/40"
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
            {password && (
              <p className={`text-sm font-medium ${passwordStrength === "Weak" ? "text-red-600" :
                passwordStrength === "Medium" ? "text-yellow-600" :
                  "text-green-600"
                }`}>
                Password Strength: {passwordStrength}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="font-medium text-slate-900">
              Confirm Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-kolekto" />
              <Input
                id="confirmPassword"
                placeholder="Confirm your password"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-14 rounded-2xl border-slate-200 bg-white pl-14 pr-14 text-base shadow-sm focus-visible:ring-emerald-500/40"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="terms"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-slate-300 accent-kolekto"
          required
        />
        <label htmlFor="terms" className="text-sm leading-6 text-slate-700">
          I agree to the{" "}
          <a href="/terms" target="_blank" className="font-medium text-kolekto underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" className="font-medium text-kolekto underline">
            Privacy Policy
          </a>
        </label>
      </div>

      <Button
        type="submit"
        className="h-14 w-full rounded-2xl bg-gradient-to-r from-kolekto to-emerald-500 text-base font-semibold shadow-lg shadow-emerald-900/15 hover:from-kolekto hover:to-emerald-600"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Creating Account...
          </>
        ) : (
          <>
            <UserPlus className="h-5 w-5" />
            Create Account
          </>
        )}
      </Button>

      <div className="pt-1 text-center text-base text-slate-700">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-kolekto hover:underline">
          Sign in
        </Link>
      </div>
      {showV2 && (
        <div className="mt-4 overflow-x-auto -mx-4 px-4 flex justify-center">
          <ReCAPTCHA
            sitekey="6Lf9PdorAAAAAJgpPjIMXm8go5stcmatHVUHPUEh"
            onChange={handleV2Change}
          />
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
          <div className="flex max-w-[calc(100vw-2rem)] items-center rounded-2xl bg-white p-4 shadow-lg">
            <Loader2 className="mr-3 h-5 w-5 animate-spin text-kolekto" />
            <span className="font-medium text-kolekto">Creating Account...</span>
          </div>
        </div>
      )}
    </form>
  );
};

export default RegisterForm;
