"use client";
import dynamic from "next/dynamic";
import * as React from "react";
import { cn } from "@/lib/utils";

/* The 4 React Bits components live behind lazy wrappers with static
   fallbacks and prefers-reduced-motion handling. Count: 4 (documented in
   README). Nothing here runs on the scanner route. */

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* 1) CountUp — rolling numbers: attendance %, counters, countdowns. */
const CountUpRaw = dynamic(() => import("@/components/CountUp"), { ssr: false });

export function LazyCountUp({
  to,
  suffix = "",
  className,
  duration = 1.2
}: {
  to: number;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const [reduced, setReduced] = React.useState<boolean | null>(null);
  React.useEffect(() => setReduced(reducedMotion()), []);
  if (reduced !== false) {
    // static fallback (also shown before mount and under reduced motion)
    return (
      <span className={cn("tnum", className)}>
        {to}
        {suffix}
      </span>
    );
  }
  return (
    <span className={cn("tnum inline-flex items-baseline", className)}>
      <CountUpRaw to={to} duration={duration} />
      {suffix}
    </span>
  );
}

/* 2) BlurText — the one headline reveal (onboarding intro, Present result). */
const BlurTextRaw = dynamic(() => import("@/components/BlurText"), { ssr: false });

export function LazyBlurText({
  text,
  className
}: {
  text: string;
  className?: string;
}) {
  const [reduced, setReduced] = React.useState<boolean | null>(null);
  React.useEffect(() => setReduced(reducedMotion()), []);
  if (reduced !== false) {
    return <p className={className}>{text}</p>;
  }
  return <BlurTextRaw text={text} className={className} delay={45} stepDuration={0.28} />;
}

/* 3) AnimatedList — live feeds: new items enter, nothing else moves. */
const AnimatedListRaw = dynamic(() => import("@/components/AnimatedList"), { ssr: false });

export function LazyAnimatedList<T>({
  items,
  renderItem,
  className,
  maxHeight = 320
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  maxHeight?: number | string;
}) {
  const [reduced, setReduced] = React.useState<boolean | null>(null);
  React.useEffect(() => setReduced(reducedMotion()), []);
  if (reduced !== false) {
    // static list fallback: same content, no motion (also before mount)
    return (
      <div className={cn("divide-y divide-border", className)}>
        {items.map((item, i) => (
          <div key={i} className="px-3 py-2.5">
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <AnimatedListRaw
      items={items.map((item, i) => ({ id: i, title: renderItem(item, i) as React.ReactNode }))}
      frame={false}
      animation="fade"
      showGradients={false}
      displayScrollbar={false}
      selectOnHover={false}
      enableArrowNavigation={false}
      maxHeight={maxHeight}
      className={className}
    />
  );
}

/* 4) Stepper — the onboarding / excuse / dispute wizard pattern. */
const StepperRaw = dynamic(() => import("@/components/Stepper"), { ssr: false });
const StepRaw = dynamic(() => import("@/components/Stepper").then((m) => m.Step), { ssr: false });

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
  const [reduced, setReduced] = React.useState<boolean | null>(null);
  React.useEffect(() => setReduced(reducedMotion()), []);
  if (reduced !== false) {
    // static fallback: numbered progress, current step content only (also pre-mount)
    return (
      <div>
        <ol className="flex items-center gap-2" aria-label={`${step + 1}/${steps.length}`}>
          {steps.map((s, i) => (
            <li
              key={s.title}
              className={cn(
                "h-2 flex-1 rounded-full",
                i <= step ? "bg-primary" : "bg-muted"
              )}
              aria-hidden="true"
            />
          ))}
        </ol>
        <p className="tnum mt-2 text-sm font-semibold text-muted-foreground">
          {step + 1}/{steps.length} · {steps[step]?.title}
        </p>
        <div className="mt-4">{steps[step]?.content}</div>
        <div className="mt-4 flex gap-2">
          {step > 0 && (
            <button
              type="button"
              className="rounded-base border border-border px-4 py-2.5 text-sm font-semibold"
              onClick={() => onStepChange(step - 1)}
            >
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
  return (
    <StepperRaw
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
        <StepRaw key={s.title} title={s.title}>
          {s.content}
        </StepRaw>
      ))}
    </StepperRaw>
  );
}
