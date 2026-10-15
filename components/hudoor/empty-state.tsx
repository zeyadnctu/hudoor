import * as React from "react";
import { cn } from "@/lib/utils";

/* EmptyState — an empty screen is an invitation to act: what happened,
   what to do next, optional action. Quiet dot-grid behind large empties. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  withGrid = false,
  className
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: React.ReactNode;
  withGrid?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-border bg-card px-4 py-10 text-center",
        withGrid && "dot-grid",
        className
      )}
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-pill bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="font-display mt-3 text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[15px] text-muted-foreground">{hint}</p>
      {action && <div className="relative mt-4">{action}</div>}
    </div>
  );
}
