import React from "react";

export default function RightImagePanel() {
  return (
    <aside className="hidden lg:flex h-full flex-col overflow-hidden bg-[#1a1a14]">
      {/* TOP — The Image section */}
      <div className="flex-[6.5] w-full">
        <img
          src="/accountImg.png"
          alt="Man using phone"
          className="h-full w-full object-cover"
        />
      </div>

      {/* BOTTOM — The Content section */}
      <div className="flex-[3.5] flex flex-col justify-between p-10">
        <h2 className="text-4xl font-medium text-white tracking-tight leading-[1.1]">
          Collect and manage <br />
          group contributions <br />
          seamlessly
        </h2>

        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-gray-400">
          <span>© Kolekto. 2026</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white transition-colors">Help Center</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </aside>
  );
}