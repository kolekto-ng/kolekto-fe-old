import React from 'react';
import { Check } from 'lucide-react';
import { StepId, STEP_LABELS } from './wizardTypes';

interface Props {
  steps: StepId[];
  currentIndex: number;
}

const WizardStepper: React.FC<Props> = ({ steps, currentIndex }) => {
  return (
    <div className="w-full">
      {/* Mobile: segmented progress bar. Each step gets an equal flex-1 share,
          so this can never overflow the viewport regardless of step count. */}
      <div className="flex gap-1 sm:hidden" role="presentation">
        {steps.map((stepId, i) => (
          <div
            key={stepId}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= currentIndex ? 'bg-green-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Desktop/tablet: circle + connector stepper. Connectors are flex-1
          (not a fixed min-width), so the row always fits its container. */}
      <div className="hidden w-full items-start sm:flex">
        {steps.map((stepId, i) => {
          const isCompleted = i < currentIndex;
          const isActive = i === currentIndex;
          const isLast = i === steps.length - 1;

          return (
            <React.Fragment key={stepId}>
              <div className="flex flex-shrink-0 flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                    isCompleted
                      ? 'border-green-600 bg-green-600 text-white'
                      : isActive
                      ? 'border-green-600 bg-white text-green-700'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`mt-1.5 max-w-[88px] truncate text-center text-[11px] leading-tight ${
                    isActive ? 'font-medium text-green-700' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}
                  title={STEP_LABELS[stepId]}
                >
                  {STEP_LABELS[stepId]}
                </span>
              </div>

              {!isLast && (
                <div
                  className={`mx-1.5 mt-4 h-0.5 flex-1 ${i < currentIndex ? 'bg-green-500' : 'bg-gray-200'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WizardStepper;
