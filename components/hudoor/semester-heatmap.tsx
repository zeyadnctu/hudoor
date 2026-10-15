import * as React from "react";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

/* SemesterHeatmap — attendance as a month-by-month grid of days.
   Intensity = fill tokens; every cell also carries its status in the
   accessible label (never color alone). Direct labels, no legend jargon. */
export type HeatCell = { date: string; status: "present" | "late" | "absent" | "excused" | "none" };

const CELL: Record<HeatCell["status"], string> = {
  present: "bg-present-fill",
  late: "bg-late-fill",
  absent: "bg-absent-fill",
  excused: "bg-excused-fill/50",
  none: "bg-muted"
};

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function SemesterHeatmap({
  cells,
  locale = "ar",
  statusLabels,
  className
}: {
  cells: HeatCell[];
  locale?: "ar" | "en";
  statusLabels?: Partial<Record<HeatCell["status"], string>>;
  className?: string;
}) {
  if (!cells.length) return null;
  // group cells into months, each month a column band of weeks (rows = weekdays)
  const byMonth = new Map<string, HeatCell[]>();
  cells.forEach((c) => {
    const key = c.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(c);
  });
  const dayLabels = locale === "ar" ? ["ح", "ن", "ث", "ر", "خ"] : ["S", "M", "T", "W", "T"];
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="flex min-w-max gap-3">
        <div className="flex flex-col gap-1 pt-5">
          {dayLabels.map((d, i) => (
            <span key={i} className="flex h-3.5 w-3.5 items-center justify-center text-[9px] font-semibold text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
        {[...byMonth.entries()].map(([month, items]) => (
          <div key={month}>
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
              {locale === "ar" ? MONTHS_AR[Number(month.slice(5, 7)) - 1] : MONTHS_EN[Number(month.slice(5, 7)) - 1]}
            </p>
            <div className="grid grid-flow-col grid-rows-7 gap-1">
              {items.map((c) => {
                const dow = new Date(c.date + "T12:00:00").getDay(); // 0=Sun
                return (
                  <span
                    key={c.date}
                    title={`${c.date} · ${statusLabels?.[c.status] ?? c.status}`}
                    className={cn("h-3.5 w-3.5 rounded-sm2", CELL[c.status])}
                    style={{ gridColumn: Math.floor((new Date(c.date + "T12:00:00").getDate() + dow) / 7) + 1, gridRow: dow + 1 }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-muted-foreground">
        {(["present", "late", "absent", "excused", "none"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-sm2", CELL[s])} aria-hidden="true" />
            {statusLabels?.[s] ?? s}
          </span>
        ))}
      </div>
      <p className="sr-only">
        <CalendarDays size={16} aria-hidden="true" /> {cells.length}
      </p>
    </div>
  );
}
