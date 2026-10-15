import * as React from "react";
import { cn } from "@/lib/utils";

/* Skeletons — blocks that match the real layout (never whole-page spinners). */

function Block({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-base bg-muted", className)} />;
}

/* stats row: three equal columns */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-card border border-border bg-card py-4">
          <Block className="mx-auto h-7 w-14" />
          <Block className="mx-auto mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/* timeline rows: time block + two text lines */
export function TimelineSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-card border border-border bg-card" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Block className="h-8 w-[76px]" />
          <div className="min-w-0 flex-1">
            <Block className="h-4 w-2/3" />
            <Block className="mt-1.5 h-3 w-1/3" />
          </div>
          <Block className="h-5 w-14 rounded-pill" />
        </div>
      ))}
    </div>
  );
}

/* card rows: title + progress */
export function CardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-card border border-border bg-card" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5">
          <Block className="h-4 w-3/5" />
          <Block className="mt-2 h-1.5 w-32 rounded-pill" />
        </div>
      ))}
    </div>
  );
}
