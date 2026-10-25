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

/* 4) Stepper — moved to components/hudoor/stepper.tsx. It must NOT be a
   dynamic (ssr:false) import: the swap between the static fallback and the
   real component unmounted form fields mid-typing, which is what made valid
   input look "required". */

