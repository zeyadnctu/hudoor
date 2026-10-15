"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/hudoor/status-pill";
import { ChevronDown } from "lucide-react";

/* CourseAttendanceCard — one enrolled course: attendance at a glance
   (progress bar + tabular percent) and an expandable session ledger. */
export function CourseAttendanceCard({
  courseName,
  courseCode,
  attended,
  total,
  percent,
  noSessionsLabel,
  expanded,
  onToggle,
  sessions
}: {
  courseName: string;
  courseCode?: string;
  attended: number;
  total: number;
  percent: number;
  noSessionsLabel: string;
  expanded: boolean;
  onToggle: () => void;
  sessions?: { id: string; dateLabel: string; timeLabel: string; status: string; statusLabel?: string }[];
}) {
  const low = total > 0 && percent < 75;
  const barTone = low ? "bg-late-fill" : "bg-present-fill";
  const pctTone = total === 0 ? "text-muted-foreground" : low ? "text-late-ink" : "text-present-ink";
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start transition-colors duration-fast hover:bg-accent/60"
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">
            <span dir="auto">{courseName}</span>{" "}
            {courseCode && <span className="tnum text-[13px] font-medium text-muted-foreground">{courseCode}</span>}
          </span>
          <span
            className="mt-1.5 block h-1.5 w-32 overflow-hidden rounded-pill bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className={cn("block h-full rounded-pill transition-[width] duration-base ease-out", barTone)} style={{ width: `${percent}%` }} />
          </span>
          <span className="tnum mt-1 block text-[11px] text-muted-foreground">
            {attended}/{total}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={cn("font-display tnum text-base font-bold", pctTone)}>
            {total === 0 ? "—" : `${percent}%`}
          </span>
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform duration-fast", expanded && "rotate-180")} />
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border bg-muted/40 px-4 py-2">
          {!sessions?.length && <p className="py-2 text-[13px] text-muted-foreground">{noSessionsLabel}</p>}
          {sessions?.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 border-b border-border/60 py-2 text-[13px] last:border-0">
              <span className="tnum text-muted-foreground">
                {s.dateLabel} · {s.timeLabel}
              </span>
              <StatusPill status={s.status} label={s.statusLabel} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
