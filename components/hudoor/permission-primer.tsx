import * as React from "react";
import { Camera, MapPin } from "lucide-react";

/* PermissionPrimer — ask for a permission only after saying why, in the
   user's language. Shown before the scanner or location check. */
export function PermissionPrimer({
  kind,
  title,
  reason,
  actionLabel,
  skipLabel,
  onAllow,
  onSkip
}: {
  kind: "camera" | "location";
  title: string;
  reason: string;
  actionLabel: string;
  skipLabel?: string;
  onAllow: () => void;
  onSkip?: () => void;
}) {
  const Icon = kind === "camera" ? Camera : MapPin;
  return (
    <div className="dot-grid rounded-card border border-border bg-card px-5 py-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-pill bg-accent text-primary">
        <Icon size={26} strokeWidth={2} />
      </div>
      <h2 className="font-display mt-3 text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[15px] text-muted-foreground">{reason}</p>
      <button
        type="button"
        onClick={onAllow}
        className="mt-5 min-h-[48px] w-full rounded-base bg-primary px-5 text-base font-semibold text-primary-foreground transition-colors duration-fast hover:opacity-90"
      >
        {actionLabel}
      </button>
      {onSkip && skipLabel && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 min-h-[44px] w-full rounded-base text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {skipLabel}
        </button>
      )}
    </div>
  );
}
