import React from "react";
import { Check } from "lucide-react"; 

export default function StepTracker({ step, total }) {
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }).map((_, i) => {
        const s = i + 1;
        const isCompleted = step > s;
        const isActive = step === s;

        return (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300 ${
                isCompleted || isActive
                  ? "bg-[#4CAF50]" 
                  : "bg-neutral-200"
              }`}
            >
              {isCompleted ? (
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              ) : isActive ? (
                <div className="h-2 w-2 rounded-full bg-white" />
              ) : null}
            </div>
            {s !== total && (
              <div
                className={`h-[2px] w-12 transition-colors duration-300 ${
                  isCompleted ? "bg-[#4CAF50]" : "bg-neutral-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}