"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers";
import { Check, Clock, FileText, Minus, Radio, CalendarClock, X, type LucideIcon } from "lucide-react";

/* StatusPill — status is NEVER color alone: icon + label + color, always.
   Chip grounds are the token soft tints; text is the AA-verified ink. */

export type StatusKind =
  | "present"
  | "late"
  | "absent"
  | "excused"
  | "active"
  | "scheduled"
  | "ended";

const CONFIG: Record<StatusKind, { icon: LucideIcon; cls: string; labelKey: "stPresent" | "stLate" | "stAbsent" | "stExcused" | "stActive" | "stScheduled" | "stEnded" }> = {
  present: { icon: Check, cls: "bg-present-soft text-present-ink", labelKey: "stPresent" },
  late: { icon: Clock, cls: "bg-late-soft text-late-ink", labelKey: "stLate" },
  absent: { icon: X, cls: "bg-absent-soft text-absent-ink", labelKey: "stAbsent" },
  excused: { icon: FileText, cls: "bg-excused-soft text-excused-ink", labelKey: "stExcused" },
  active: { icon: Radio, cls: "bg-present-soft text-present-ink", labelKey: "stActive" },
  scheduled: { icon: CalendarClock, cls: "bg-late-soft text-late-ink", labelKey: "stScheduled" },
  ended: { icon: Minus, cls: "bg-muted text-muted-foreground", labelKey: "stEnded" }
};

export function StatusPill({
  status,
  label,
  className
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const { t } = useApp();
  const kind = (status in CONFIG ? status : "ended") as StatusKind;
  const { icon: Icon, cls, labelKey } = CONFIG[kind];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold",
        cls,
        className
      )}
    >
      <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
      {label ?? t[labelKey]}
    </span>
  );
}
