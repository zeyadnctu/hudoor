"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/* SegmentedControl — a small set of mutually exclusive views (weekly/list,
   theme choices…). Built on toggle-group; selection is a filled card step,
   not a color wash. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={ariaLabel}
      className={cn("gap-0.5 rounded-base border border-border bg-muted p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            "min-h-[36px] gap-1.5 rounded-base px-3 text-[13px] font-semibold text-muted-foreground",
            "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-none"
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
