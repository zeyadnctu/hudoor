import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/hudoor/status-pill";
import { MapPin, User } from "lucide-react";

/* WeekGrid — the week as day groups on phone, columns from md up.
   Today's group is marked with a ring, never a color wash. */
export type WeekSlot = {
  id: string;
  start: string;
  end: string;
  code?: string;
  name: string;
  room?: string;
  instructor?: string;
  type?: string;
};
export type WeekDay = { key: number; label: string; slots: WeekSlot[] };

export function WeekGrid({
  days,
  todayKey,
  emptyHint,
  locale = "ar"
}: {
  days: WeekDay[];
  todayKey?: number;
  emptyHint?: string;
  locale?: "ar" | "en";
}) {
  const visible = days.filter((d) => d.slots.length > 0);
  if (!visible.length) {
    return emptyHint ? <p className="py-8 text-center text-[15px] text-muted-foreground">{emptyHint}</p> : null;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((day) => (
        <section
          key={day.key}
          aria-label={day.label}
          className={cn(
            "rounded-card border border-border bg-card p-3",
            todayKey === day.key && "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
        >
          <h2 className="mb-2 flex items-baseline gap-2 text-sm font-bold text-muted-foreground">
            {day.label}
            <span className="tnum text-xs font-medium">({day.slots.length})</span>
          </h2>
          <ul className="space-y-1.5">
            {day.slots.map((s) => (
              <li key={s.id} className="rounded-base border border-border bg-background p-2.5">
                <p className="tnum text-[13px] font-bold text-primary" dir="ltr">
                  {s.start}–{s.end}
                </p>
                <p className="mt-0.5 truncate text-[15px] font-semibold" dir="auto">
                  {s.code && <span className="tnum text-muted-foreground">{s.code} · </span>}
                  {s.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {s.instructor && (
                    <span className="flex items-center gap-1">
                      <User size={12} /> {s.instructor}
                    </span>
                  )}
                  {s.room && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {s.room}
                    </span>
                  )}
                  {s.type && (
                    <span className="rounded-pill bg-muted px-2 py-0.5 font-semibold">
                      {s.type === "lecture" ? (locale === "ar" ? "محاضرة" : "Lecture") : s.type === "section" ? (locale === "ar" ? "مجموعة" : "Section") : s.type}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function WeekGridSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-36 rounded-card bg-muted" />
      ))}
    </div>
  );
}

export { StatusPill };
