import { type ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

type StepperProps = ComponentProps<"ol"> & {
  steps: { id: string; label: string }[];
  currentStep: number;
};

/** currentStep is zero based; steps.length means every step is complete. */
export function Stepper({ steps, currentStep, className, ...props }: StepperProps) {
  const current = Number.isFinite(currentStep) ? Math.max(0, Math.min(steps.length, Math.floor(currentStep))) : 0;
  return <ol aria-label="진행 단계" data-slot="stepper" className={cn("teum-stepper", className)} {...props}>
    {steps.map((step, i) => <li key={step.id} data-state={i < current ? "complete" : i === current ? "current" : "upcoming"} aria-current={i === current ? "step" : undefined}>
      <span className="stepper-point" aria-hidden="true">{i < current ? <Check size={16} /> : String(i + 1).padStart(2, "0")}</span>
      <span className="stepper-label">{step.label}<span className="sr-only"> · {i < current ? "완료" : i === current ? "현재 단계" : "예정"}</span></span>
    </li>)}
  </ol>;
}
