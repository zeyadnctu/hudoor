"use client";
import * as React from "react";
import Stepper, { Step } from "@/components/Stepper";
import { cn } from "@/lib/utils";

/* Stepper for forms (onboarding, excuses, disputes).
 *
 * It is imported STATICALLY on purpose. This used to be a next/dynamic
 * (ssr:false) wrapper that first painted a static fallback and then swapped in
 * the animated component when its chunk arrived. On a slow connection the user
 * could start typing into the fallback fields and the swap unmounted them —
 * react-hook-form kept values that were never in the DOM, and "next" then said
 * the name was required even though it was on screen. A form must never be
 * replaced after it becomes editable, so the only fallback left is the
 * permanent one for prefers-reduced-motion (resolved before the form shows).
 */

function StaticStepper({
  step,
  onStepChange,
  onCompleted,
  steps,
  labels
}: {
  step: number;
  onStepChange: (s: number) => void;
  onCompleted?: () => void;
  steps: { title: string; content: React.ReactNode }[];
  labels: { back: string; next: string; complete?: string };
}) {
  return (
    <div>
      <ol className="flex items-center gap-2" aria-label={`${step + 1}/${steps.length}`}>
        {steps.map((s, i) => (
          <li key={s.title} className={cn("h-2 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} aria-hidden="true" />
        ))}
      </ol>
      <p className="tnum mt-2 text-sm font-semibold text-muted-foreground">
        {step + 1}/{steps.length} · {steps[step]?.title}
      </p>
      <div className="mt-4">{steps[step]?.content}</div>
      <div className="mt-4 flex gap-2">
        {step > 0 && (
          <button type="button" className="rounded-base border border-border px-4 py-2.5 text-sm font-semibold" onClick={() => onStepChange(step - 1)}>
            {labels.back}
          </button>
        )}
        <button
          type="button"
          className="rounded-base bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={() => (step === steps.length - 1 ? onCompleted?.() : onStepChange(step + 1))}
        >
          {step === steps.length - 1 ? (labels.complete ?? labels.next) : labels.next}
        </button>
      </div>
    </div>
  );
}

export function LazyStepper({
  step,
  onStepChange,
  onCompleted,
  steps,
  labels
}: {
  step: number;
  onStepChange: (s: number) => void;
  onCompleted?: () => void;
  steps: { title: string; content: React.ReactNode }[];
  labels: { back: string; next: string; complete?: string };
}) {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    setReduced(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);
  if (reduced) return <StaticStepper step={step} onStepChange={onStepChange} onCompleted={onCompleted} steps={steps} labels={labels} />;
  return (
    <Stepper
      step={step + 1}
      onStepChange={(s) => onStepChange(s - 1)}
      onFinalStepCompleted={onCompleted}
      indicator="bars"
      transition="slide"
      linear
      backButtonText={labels.back}
      nextButtonText={labels.next}
      completeButtonText={labels.complete ?? labels.next}
      className="w-full"
      accentColor="var(--primary)"
    >
      {steps.map((s) => (
        <Step key={s.title} title={s.title}>
          {s.content}
        </Step>
      ))}
    </Stepper>
  );
}
