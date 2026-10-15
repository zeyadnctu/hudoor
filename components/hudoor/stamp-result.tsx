"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { LazyBlurText } from "@/components/hudoor/bits";

/* StampResult — the moment attendance becomes real: the rotated bordered
   mark presses onto the page (the app's single signature motion). The
   headline below reveals with BlurText; nothing else on the screen moves. */
export function StampResult({
  stamp,
  timeLabel,
  tone = "present",
  headline,
  sub
}: {
  stamp: string;
  timeLabel: string;
  tone?: "present" | "late";
  headline?: string;
  sub?: React.ReactNode;
}) {
  const toneCls =
    tone === "late"
      ? "border-late-fill text-late-ink"
      : "border-present-fill text-present-ink";
  return (
    <div className="py-8 text-center">
      <div className="stamp-press inline-block" role="status">
        <div className={cn("rounded-frame border-4 px-8 py-4 text-center", toneCls)}>
          <div className="font-display text-4xl font-bold leading-tight">{stamp}</div>
          <div className="font-display tnum mt-1 text-lg font-semibold tracking-wide">{timeLabel}</div>
        </div>
      </div>
      {headline && (
        <p className={cn("font-display mt-5 text-lg font-bold", tone === "late" ? "text-late-ink" : "text-present-ink")}>
          <LazyBlurText text={headline} />
        </p>
      )}
      {sub && <div className="mt-2 text-[15px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
