export default function AuthNavbar({ country, setCountry, onNext }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-neutral-900">
        What country do you live in?
      </h1>

      <div className="mt-6">
        <label className="text-sm font-medium text-neutral-700">Country</label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="mt-2 w-full rounded-lg border border-neutral-200 px-4 py-3 text-sm mb-3"
        >
          <option>Nigeria</option>
          <option>Ghana</option>
          <option>Kenya</option>
          <option>South Africa</option>
        </select>
      </div>

      <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 w-[436px] h-[79.4px]text-[#00BA16]">
        <div className="flex flex-row gap-2 mb-2 text-[#00BA16]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            
          >
            <path
              d="M13.511 7.20963L12.665 6.2195C12.5084 6.0315 12.3768 5.68056 12.3768 5.4299V4.36456C12.3768 3.7003 11.8316 3.1551 11.1673 3.1551H10.102C9.85133 3.1551 9.49413 3.0235 9.30612 2.86683L8.31599 2.02083C7.88359 1.6511 7.17546 1.6511 6.74306 2.02083L5.74039 2.86683C5.55239 3.0235 5.20146 3.1551 4.95079 3.1551H3.86666C3.20239 3.1551 2.65719 3.7003 2.65719 4.36456V5.4299C2.65719 5.6743 2.53186 6.02523 2.37519 6.21323L1.52919 7.20963C1.16572 7.6483 1.16572 8.35016 1.52919 8.7763L2.37519 9.7727C2.53186 9.95446 2.65719 10.3117 2.65719 10.5561V11.6277C2.65719 12.2919 3.20239 12.8371 3.86666 12.8371H4.95706C5.20146 12.8371 5.55866 12.9687 5.74666 13.1254L6.73679 13.9714C7.16919 14.3411 7.87733 14.3411 8.30972 13.9714L9.29986 13.1254C9.48783 12.9687 9.83882 12.8371 10.0894 12.8371H11.1548C11.819 12.8371 12.3642 12.2919 12.3642 11.6277V10.5623C12.3642 10.3117 12.4958 9.96066 12.6525 9.7727L13.4985 8.78256C13.8808 8.35643 13.8808 7.6483 13.511 7.20963ZM7.05012 5.57403C7.05012 5.3171 7.26319 5.10403 7.52012 5.10403C7.77706 5.10403 7.99012 5.3171 7.99012 5.57403V8.60083C7.99012 8.85776 7.77706 9.07083 7.52012 9.07083C7.26319 9.07083 7.05012 8.85776 7.05012 8.60083V5.57403ZM7.52012 11.0511C7.17546 11.0511 6.89346 10.7691 6.89346 10.4245C6.89346 10.0798 7.16919 9.79776 7.52012 9.79776C7.86479 9.79776 8.14679 10.0798 8.14679 10.4245C8.14679 10.7691 7.87106 11.0511 7.52012 11.0511Z"
              fill="#00BA16"
            />
          </svg>
          <p className="text-md font-bold text-[#00BA16] pl-2 pb-1 leading-none">Notice</p>
        </div>

        <p className="mt-1 text-xs text-green-800">
          We’ll show eligible verification documents based on your selected
          country of residence. Please make sure you chose the correct one.
        </p>
      </div>

      <button
        onClick={onNext}
        className="mt-6 w-full rounded-lg bg-green-600 py-3 text-white font-medium hover:bg-green-700"
      >
        Continue
      </button>
    </section>
  );
}
