import React from "react";

export default function AuthNavbar({ language, setLanguage }) {
  return (
    <header className="w-full h-16 flex items-center justify-between px-10 border-b border-neutral-100 bg-white">
      {/* Left Logo */}
      <img src="./kelekto_logo-removebg-preview.png" alt="kolekto logo" className="w-18 h-8"/>

      {/* Right Language selector */}
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="border border-neutral-200 rounded-lg px-4 py-2 text-sm text-neutral-700 bg-white focus:outline-none focus:ring-2 focus:ring-kolekto/30"
      >
        <option>English (US)</option>
        <option>English (UK)</option>
        <option>French</option>
      </select>
    </header>
  );
}




