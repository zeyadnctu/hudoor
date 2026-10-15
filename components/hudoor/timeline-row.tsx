import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/hudoor/status-pill";

/* TimelineRow — one row of the register's day: time block, course, status.
   Times are tabular and pinned in a fixed-width gutter so rows align. */
export function TimelineRow({
  startTime,
  endTime,
  courseCode,
  courseName,
  room,
  status,
  statusLabel,
  live = false,
  trailing
}: {
  startTime: string;
  endTime: string;
  courseCode?: string;
  courseName: string;
  room?: string;
  status?: string;
  statusLabel?: string;
  live?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-4 py-3",
        live && "bg-present-soft/50"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="tnum flex w-[84px] shrink-0 flex-col text-[13px] font-bold" dir="ltr">
          <span>{startTime}</span>
          <span className="font-medium text-muted-foreground">{endTime}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">
            {courseCode && <span className="tnum text-muted-foreground">{courseCode} · </span>}
            <span dir="auto">{courseName}</span>
          </p>
          {room && <p className="truncate text-xs text-muted-foreground">{room}</p>}
        </div>
      </div>
      {trailing ?? (status ? <StatusPill status={status} label={statusLabel} /> : null)}
    </div>
  );
}
