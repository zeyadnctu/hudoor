"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { LazyCountUp } from "@/components/hudoor/bits";

/* NumberStat — big tabular number + one small label. Quiet by design;
   the number is the content, not decoration. */
export function NumberStat({
  value,
  label,
  suffix,
  icon,
  tone = "default",
  className
}: {
  value: number;
  label: string;
  suffix?: string;
  icon?: React.ReactNode;
  tone?: "default" | "present" | "late" | "absent";
  className?: string;
}) {
  const toneCls =
    tone === "present"
      ? "text-present-ink"
      : tone === "late"
        ? "text-late-ink"
        : tone === "absent"
          ? "text-absent-ink"
          : "text-foreground";
  return (
    <div className={cn("flex flex-col items-center px-2 py-3.5", className)}>
      <span
        className={cn(
          "font-display text-[22px] font-bold leading-none",
          toneCls
        )}
      >
        {icon}
        <LazyCountUp to={value} suffix={suffix} />
      </span>
      <span className="mt-1.5 text-center text-[11px] font-semibold text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
