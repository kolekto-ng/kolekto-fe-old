import React, { useState } from "react";
import { Link } from "react-router-dom";
import StepTracker from "@/components/auth/StepTracker";
import Step1Country from "@/components/auth/Step1Country";
import Step2Details from "@/components/auth/Step2Details";
import Step3CreatePswd from "@/components/auth/Step3CreatePswd";
import Step4VerifyEmail from "@/components/auth/Step4VerifyEmail";
import { toast } from "../ui/sonner";
import accountImg from "/src/assets/accountImg.png";

const TOTAL_STEPS = 4;

export default function RegisterStep() {
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState("Nigeria");
  const [language, setLanguage] = useState("English (US)");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState("+234");
  const [phone, setPhone] = useState("");
  const [referral, setReferral] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);


  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

 
  
const handleStep3Submit = async () => {
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!acceptTerms) {
      toast.error("Please accept the terms");
      return;
    }

    setIsLoading(true);
    try {
    
      console.log("Creating account for:", email);
      next(); // Move to Step 4
    } catch (err) {
      toast.error("Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
  <div className="min-h-screen bg-white ">
    <div className="mx-auto min-h-screen max-w-auto px-2 ">
      {/* 2-column layout */}
      <div className="grid min-h-screen lg:grid-cols-[3fr_1fr] overflow-y-hidden">
        {/* LEFT */}
        <div className="flex flex-col">
          <header className="flex items-center justify-between py-6 px-6">
            <img
              src="/kelekto_logo-removebg-preview.png"
              alt="logo image"
              className="h-[20.53px] w-[70px]"
            />

            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm bg-transparent outline-none border border-neutral-200 rounded-lg px-8 py-2"
            >
              <option>English (US)</option>
              <option>English (UK)</option>
            </select>
          </header>

          <main className="flex flex-1 items-start sm:items-center justify-center px-4 sm:px-0 pt-6 sm:pt-0">
            <div className="w-full max-w-[440px]">
              {/* step header */}
          {/* MOBILE-FIRST: tracker on top, moving text + arrow below */}
<div className="mb-10 w-full">
  {/* TOP: Tracker */}
  <div className="relative w-full">
    {/* Base line */}
    <div className="absolute left-0 right-0 top-[14px] h-[3px] rounded-full bg-neutral-200" />

    {/* Progress line */}
    <div
      className="absolute left-0 top-[14px] h-[3px] rounded-full bg-green-600 transition-all duration-300"
      style={{
        width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%`,
      }}
    />

    {/* Dots */}
    <div className="relative flex justify-between">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const s = i + 1;
        const done = step > s;
        const active = step === s;

        return (
          <div
            key={s}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-300 pt-2 ${
              done || active ? "bg-green-600" : "bg-neutral-200"
            }`}
          >
            {done ? (
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <path
                  d="M10.2 3.2L5.1 8.3L1.8 5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : active ? (
              <div className="h-2.5 w-2.5 rounded-full bg-white" />
            ) : null}
          </div>
        );
      })}
    </div>
  </div>

  {/* BOTTOM: Arrow + moving STEP text */}
  <div className="relative mt-6">
   
    <button
      type="button"
      onClick={back}
      aria-label="Back"
      className={`${step === 1 ? "invisible" : ""} absolute left-0 top-0 text-neutral-700`}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <div
      className="absolute top-0 transition-all duration-300"
      style={{
  left: `${
    window.innerWidth < 360
      ? Math.min(88, Math.max(12, ((step - 1) / (TOTAL_STEPS - 1)) * 100))
      : Math.min(92, Math.max(8, ((step - 1) / (TOTAL_STEPS - 1)) * 100))
  }%`,
  transform: "translateX(-50%)",
}}

    >
<div className="text-center">
  {/* Always show STEP on mobile */}
  <p className="text-[10px] sm:text-[11px] tracking-[0.20em] text-neutral-500 uppercase leading-none whitespace-nowrap">
    STEP {step}
  </p>

  
  <p className="hidden sm:block mt-1 text-sm sm:text-base font-semibold text-neutral-900 leading-none whitespace-nowrap">
    {step === 1
      ? "Country of residence"
      : step === 2
      ? "Basic information"
      : step === 3
      ? "Create password"
      : "Verify email"}
  </p>
</div>



    </div>

    
    <div className="h-10" />
  </div>
</div>


              {/* step */}
              {step === 1 && (
                <Step1Country country={country} setCountry={setCountry} onNext={next} />
              )}

              {step === 2 && (
                <Step2Details
                  firstName={firstName} setFirstName={setFirstName}
                  middleName={middleName} setMiddleName={setMiddleName}
                  surname={surname} setSurname={setSurname}
                  gender={gender} setGender={setGender}
                  email={email} setEmail={setEmail}
                  phoneCode={phoneCode} setPhoneCode={setPhoneCode}
                  phone={phone} setPhone={setPhone}
                  referral={referral} setReferral={setReferral}
                  onNext={next}
                />
              )}

              {step === 3 && (
                <Step3CreatePswd
                  password={password} setPassword={setPassword}
                  isLoading={isLoading}
                  confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                  marketingOptIn={marketingOptIn} setMarketingOptIn={setMarketingOptIn}
                  acceptTerms={acceptTerms} setAcceptTerms={setAcceptTerms}
                  onNext={handleStep3Submit}
                />
              )}

              {step === 4 && (
                <Step4VerifyEmail
                  otp={otp}
                  setOtp={setOtp}
                  onVerify={() => console.log("OTP:", otp)}
                  onResend={() => console.log("Resend OTP")}
                />
              )}

              {step === 1 && (
                <div className="mt-8 text-center text-sm text-neutral-600">
                  Got an account?{" "}
                  <Link to="/login" className="text-green-600 font-medium hover:underline">
                    Sign in
                  </Link>
                </div>
              )}
            </div>
          </main>
        </div>
<div className="hidden lg:flex pl-1" >
   <aside className="hidden lg:flex h-full flex-col overflow-hidden bg-[#1a1a14]">
      {/* TOP — The Image section */}
      <div className="flex-[6.5] w-full">
        <img
         src={accountImg}
          alt="Man using phone"
          className="h-full w-full object-cover"
        />
      </div>

      {/* BOTTOM — The Content section */}
      <div className="flex-[3.5] flex flex-col justify-between p-8">
        <h2 className="text-3xl font-medium text-white tracking-tight leading-[1.1] mb-4">
          Collect and manage <br />
          group contributions <br />
          seamlessly
        </h2>

        <div className=" text-[8px] uppercase tracking-widest text-gray-400">
          <span>© Kolekto. 2026</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white transition-colors">Help Center</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </aside>
  </div>
        
      </div>
    </div>
  </div>
);

}
