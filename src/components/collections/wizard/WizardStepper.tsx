import React from 'react';
import { Check } from 'lucide-react';
import { StepId, STEP_LABELS } from './wizardTypes';

interface Props {
  steps: StepId[];
  currentIndex: number;
}

const WizardStepper: React.FC<Props> = ({ steps, currentIndex }) => {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-max mx-auto px-2">
        {steps.map((stepId, i) => {
          const isCompleted = i < currentIndex;
          const isActive = i === currentIndex;
          const isLast = i === steps.length - 1;

          return (
            <React.Fragment key={stepId}>
              {/* Step node */}
              <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    isCompleted
                      ? 'bg-green-600 border-green-600 text-white'
                      : isActive
                      ? 'bg-white border-green-600 text-green-700'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={`mt-1 text-center leading-tight max-w-[64px] ${
                    isActive
                      ? 'text-green-700 font-medium text-xs'
                      : isCompleted
                      ? 'text-green-600 text-xs'
                      : 'text-gray-400 text-xs'
                  }`}
                  style={{ fontSize: '0.65rem', wordBreak: 'break-word' }}
                >
                  {STEP_LABELS[stepId]}
                </span>
              </div>

              {/* Connector */}
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-1 mt-[-14px] ${
                    i < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                  style={{ minWidth: 16 }}
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
