

import React, { useEffect, useRef } from "react";

function OtpBox({ value, onChange, index, inputRefs }) {
  return (
    <input
      ref={(el) => (inputRefs.current[index] = el)}
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(-1);
        onChange(index, v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Backspace" && !value && index > 0) {
          inputRefs.current[index - 1]?.focus();
        }
      }}
      inputMode="numeric"
      maxLength={1}
      className="h-11 w-11 rounded-md border border-neutral-200 bg-white text-center text-sm text-neutral-900
                 focus:outline-none focus:ring-2 focus:ring-green-600/20"
    />
  );
}

export default function Step4VerifyEmail({
  otp,
  setOtp,
  onVerify,
  onResend,
}) {
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const setDigit = (idx, digit) => {
    const next = otp.split("");
    next[idx] = digit;
    const joined = next.join("");
    setOtp(joined);

    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const canVerify = otp.replace(/\D/g, "").length === 6;

  return (
    <section className="text-center">
      <h1 className="text-sm font-semibold text-neutral-900">
        Verify your email address
      </h1>

      <p className="mt-2 text-xs text-neutral-500 leading-5 max-w-[320px] mx-auto">
        Please enter the OTP sent to the email address you provided to verify
        your email address
      </p>

      {/* OTP boxes */}
      <div className="mt-6 flex items-center justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <OtpBox
            key={i}
            index={i}
            value={otp[i] || ""}
            onChange={setDigit}
            inputRefs={inputRefs}
          />
        ))}
      </div>

      {/* Verify button */}
      <button
        type="button"
        onClick={onVerify}
        disabled={!canVerify}
        className={[
          "mt-6 w-full rounded-lg py-3 text-sm font-medium",
          canVerify
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-neutral-200 text-neutral-500 cursor-not-allowed",
        ].join(" ")}
      >
        Verify your account
      </button>

      {/* Resend */}
      <button
        type="button"
        onClick={onResend}
        className="mt-6 inline-flex items-center gap-2 text-xs text-neutral-600 hover:text-neutral-900"
      >
        <span className="inline-block h-3 w-3 rounded-full border border-neutral-400" />
        Resend code
      </button>
    </section>
  );
}
