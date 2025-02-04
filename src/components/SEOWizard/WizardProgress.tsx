import { Check } from "lucide-react";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
}

export const WizardProgress = ({ currentStep, totalSteps }: WizardProgressProps) => {
  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <div className="relative">
        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-100">
          <div
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"
          ></div>
        </div>
        <div className="flex justify-between">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;

            return (
              <div
                key={index}
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  isCompleted
                    ? "border-primary bg-primary text-white"
                    : isCurrent
                    ? "border-primary text-primary"
                    : "border-gray-300 text-gray-300"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-sm">{stepNumber}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};