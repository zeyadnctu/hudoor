"use client";
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScanLine } from "lucide-react";
import { LazyCountUp } from "@/components/hudoor/bits";

/* NextClassCard — the single bold moment on Today: the live class, pressed
   in slate (ink) against the chalk page, with the stamp-green scan action.
   Renders the upcoming-class hint when nothing is live. */
export function NextClassCard({
  live,
  courseCode,
  courseName,
  room,
  endsInSeconds,
  nextCode,
  nextInMinutes,
  scanLabel,
  endsInLabel,
  startsInLabel,
  className
}: {
  live: boolean;
  courseCode?: string;
  courseName?: string;
  room?: string;
  endsInSeconds?: number;
  nextCode?: string;
  nextInMinutes?: number;
  scanLabel: string;
  endsInLabel: string;
  startsInLabel: string;
  className?: string;
}) {
  const fmtDur = (mins: number) => (mins < 60 ? `${mins} د` : `${Math.floor(mins / 60)} س ${mins % 60 > 0 ? `${mins % 60} د` : ""}`);
  const mins = Math.max(1, Math.ceil((endsInSeconds ?? 0) / 60));
  return (
    <div className={cn("overflow-hidden rounded-card bg-foreground text-background", className)}>
      <Link href="/student/scan-in-app" className="block p-5" aria-label={scanLabel}>
        {live ? (
          <>
            <span className="flex items-center gap-2 text-[13px] font-bold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute h-full w-full animate-ping rounded-pill bg-present-fill opacity-75" />
                <span className="h-2.5 w-2.5 rounded-pill bg-present-fill" />
              </span>
              {courseCode}
            </span>
            <span className="font-display mt-1.5 block text-lg font-bold" dir="auto">
              {courseName}
            </span>
            <span className="tnum mt-1 block text-[13px] opacity-75">
              {endsInLabel} <LazyCountUp to={mins} key={mins} suffix={` د`} duration={0.4} />
              {room ? ` · ${room}` : ""}
            </span>
          </>
        ) : (
          <>
            <span className="font-display block text-lg font-bold" dir="auto">
              {courseName ?? scanLabel}
            </span>
            {nextCode && nextInMinutes != null && (
              <span className="tnum mt-1 block text-[13px] opacity-75">
                {nextCode} · {startsInLabel} {fmtDur(nextInMinutes)}
              </span>
            )}
          </>
        )}
        <span className="mt-4 flex min-h-[52px] items-center justify-center gap-2 rounded-base bg-present-fill text-base font-bold text-present-on-fill transition-transform duration-fast ease-out active:scale-[0.98]">
          <ScanLine size={22} strokeWidth={2} /> {scanLabel}
        </span>
      </Link>
    </div>
  );
}
