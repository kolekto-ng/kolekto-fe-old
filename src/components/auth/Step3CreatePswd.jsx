

import React, { useMemo, useState } from "react";




function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-neutral-700">{label}</label>

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 pr-12 text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-green-600/20"
        />

        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-800"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export default function Step3CreatePassword({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  marketingOptIn,
  setMarketingOptIn,
  acceptTerms,
  setAcceptTerms,
  onNext,
}) {
  const canContinue = useMemo(() => {
    return (
      password.length >= 8 &&
      confirmPassword.length >= 8 &&
      password === confirmPassword &&
      acceptTerms
    );
  }, [password, confirmPassword, acceptTerms]);
  return (
    <section>
      <h1 className="text-sm font-semibold text-neutral-900 mb-6">
        Create password
      </h1>

      <div className="space-y-4">
        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />

        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
        />

        {/* checkboxes */}
        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-green-600 focus:ring-green-600/20"
            />
            <span>
              I agree to receive product updates, announcements, and exclusive
              offers via email
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-green-600 focus:ring-green-600/20"
            />
            <span>
              I accept the{" "}
              <button
                type="button"
                className="text-green-600 font-medium hover:underline"
              >
                Terms of Use
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="text-green-600 font-medium hover:underline"
              >
                Privacy Policy
              </button>
              .
            </span>
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue}
        className={[
          "mt-6 w-full rounded-lg py-3 text-sm font-medium",
          canContinue
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-neutral-200 text-neutral-500 cursor-not-allowed",
        ].join(" ")}
      >
        Continue
      </button>
    </section>
  );
}
