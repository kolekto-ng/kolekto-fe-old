import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuthStore } from "@/store";
import { useRecaptcher } from "@/hooks/useRecaptcher";
import ReCAPTCHA from "react-google-recaptcha";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { Eye, EyeOff } from "lucide-react"; // Add this import for icons

const RegisterForm: React.FC = () => {
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
        recaptchaType
      );

      if (error) {
        setError(error?.message);
        toast.error("Registration failed");
      } else {
        setIsSignupComplete(true);
        toast.success(
          "Registration successful! Check your email to confirm your account."
        );
        // If user is returned, they might be auto-signed in, so redirect to dashboard
      }
    } catch (error: any) {
      console.log(error, 'error');
      setError(error.message || "An unexpected error occurred");
      toast.error("Registration failed");
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
      alert("Please complete the reCAPTCHA checkbox first.");
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
      let { user, error } = await signUp(
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        recaptcherToken,
        recaptchaType
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
        setError(error?.message);
        toast.error("Registration failed");
      } else {
        setIsSignupComplete(true);
        toast.success(
          "Registration successful! Check your email to confirm your account."
        );
        // If user is returned, they might be auto-signed in, so redirect to dashboard
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      toast.error("Registration failed");
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
      <div className="text-center space-y-4">
        <div className="bg-green-50 text-green-700 p-4 rounded-md">
          <h3 className="font-medium">Registration successful!</h3>
          <p className="text-sm mt-1">
            Please check your email inbox or <span className="font-semibold">spam</span> folder to confirm your
            account.
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
      {/* Add required fields note */}
      <p className="text-xs text-neutral-500 mb-2">
        Fields marked <span className="text-red-600">*</span> are required.
      </p>

      {error && (
        <Alert
          variant="destructive"
          className="bg-red-50 text-red-800 border-red-200"
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="firstName">
          First Name <span className="text-red-600">*</span>
        </Label>
        <Input
          id="firstName"
          type="text"
          placeholder="Enter your first name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">
          Last Name <span className="text-red-600">*</span>
        </Label>
        <Input
          id="lastName"
          type="text"
          placeholder="Enter your last name"
          required
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          Email <span className="text-red-600">*</span>
        </Label>
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
        <Label htmlFor="phoneNumber">
          Phone Number (WhatsApp preferred) <span className="text-red-600">*</span>
        </Label>
        <Input
          id="phoneNumber"
          type="tel"
          placeholder="+2348012345678"
          required
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          Password <span className="text-red-600">*</span>
        </Label>
        <div className="relative">
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
            className="w-full pr-10"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-2 text-neutral-500 hover:text-neutral-700"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {password && (
          <p className={`text-sm mt-1 ${passwordStrength === "Weak" ? "text-red-600" :
            passwordStrength === "Medium" ? "text-yellow-600" :
              "text-green-600"
            }`}>
            Password Strength: {passwordStrength}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">
          Confirm Password <span className="text-red-600">*</span>
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            placeholder="Re-enter your password"
            type={showConfirmPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pr-10"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-2 text-neutral-500 hover:text-neutral-700"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="terms"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="accent-kolekto"
          required
        />
        <label htmlFor="terms" className="text-sm text-neutral-700">
          I agree to the{" "}
          <a href="/terms" target="_blank" className="text-kolekto underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" className="text-kolekto underline">
            Privacy Policy
          </a>
          <span className="text-red-600">*</span>
        </label>
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
      {showV2 && (
        <div className="mt-4">
          <ReCAPTCHA
            sitekey="6Lf9PdorAAAAAJgpPjIMXm8go5stcmatHVUHPUEh"
            onChange={handleV2Change}
          />
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 shadow-lg flex items-center">
            <span className="loader mr-2"></span>
            <span className="text-kolekto font-semibold">Creating Account...</span>
          </div>
        </div>
      )}
    </form>
  );
};

export default RegisterForm;
