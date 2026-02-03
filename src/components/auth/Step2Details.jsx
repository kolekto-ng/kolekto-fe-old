import React from "react";

/* Helper components — ONLY used by Step 2 */
function Field({ label, optional = false, value, onChange, placeholder, required = false }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-normal text-[#1B1F28]">
        {label}{" "}
        {optional && <span className="text-neutral-400">(Optional)</span>}
         {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-green-600/20"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-normal text-[#1B1F28]">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Step2Details({
  firstName, setFirstName,
  middleName, setMiddleName,
  surname, setSurname,
  gender, setGender,
  email, setEmail,
  phoneCode, setPhoneCode,
  phone, setPhone,
  referral, setReferral,
  onNext,
}) {
  return (
    <section>
      <h1 className="text-[100px] font-bold text-[#1B1F28] mb-6">
        Set up your account
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
        className="space-y-4"
      >
        <Field
          label="First name (as it is on your ID)"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />

        <Field
          label="Middle name"
          optional
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
        />

        <Field
          label="Surname (as it is on your ID)"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          required
        />

        <SelectField
          label="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          options={[
            { label: "Select your gender", value: "" },
            { label: "Female", value: "female" },
            { label: "Male", value: "male" },
          ]}
          required
        />

        <Field
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
         
        />

        {/* Phone row */}
        <div className="space-y-2">
          <label className="text-sm font-normal text-neutral-700">
            Phone number <span className="text-red-500"> *</span>
          </label>

          <div className="flex gap-2">
            <select
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              className="w-[96px] rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-900"
            >
              <option value="+234">+234</option>
              <option value="+233">+233</option>
              <option value="+254">+254</option>
              <option value="+27">+27</option>
            </select>

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              required
              className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900
                         focus:outline-none focus:ring-2 focus:ring-green-600/20"
            />
          </div>
        </div>

        <Field
          label="Referral code"
          optional
          value={referral}
          onChange={(e) => setReferral(e.target.value)}
        />

        <button
          type="submit"
          className="mt-2 w-full rounded-lg bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-700"
        >
          Continue
        </button>
      </form>
    </section>
  );
}

