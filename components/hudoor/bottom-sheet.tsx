"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "@/components/ui/drawer";

/* BottomSheet — vaul drawer with Hudoor tokens: sheet radius, border-top
   elevation, soft shadow. RTL-safe (no directional offsets). */
export function BottomSheet({
  trigger,
  title,
  description,
  children,
  footer,
  className
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Drawer>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent className="rounded-t-sheet border-border shadow-sheet">
        <DrawerHeader>
          <DrawerTitle className="font-display text-lg font-bold">{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className={cn("px-4 pb-2", className)}>{children}</div>
        <DrawerFooter>
          {footer}
          <DrawerClose asChild>
            <button type="button" className="rounded-base border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted">
              ✕
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
