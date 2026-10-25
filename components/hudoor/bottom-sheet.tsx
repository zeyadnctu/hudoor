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
import { X } from "lucide-react";

/* BottomSheet — vaul drawer with Hudoor tokens: sheet radius, border-top
   elevation, soft shadow. RTL-safe (no directional offsets). Controlled mode
   is available for wizards that start from a row action. */
export function BottomSheet({
  trigger,
  title,
  description,
  children,
  footer,
  className,
  open,
  onOpenChange
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
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
            <button
              type="button"
              aria-label="Close"
              className="mx-auto grid h-11 w-11 place-items-center rounded-pill border border-border text-muted-foreground transition-colors hover:bg-muted"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
