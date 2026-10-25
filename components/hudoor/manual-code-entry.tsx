"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractScanToken } from "@/lib/scan-input";
import { cn } from "@/lib/utils";
import { ClipboardPaste } from "lucide-react";

/**
 * Manual fallback for a camera that will not start, or for a scan link copied
 * from a class group. It only accepts a real signed token / scan URL; the
 * server still checks expiry, enrollment, device and geofence.
 */
export function ManualCodeEntry({
  className,
  autoFocus,
  onDone
}: {
  className?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const { t } = useApp();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = extractScanToken(value);
    if (!token) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onDone?.();
    router.push(`/scan?t=${encodeURIComponent(token)}`);
  }

  return (
    <form onSubmit={submit} className={cn("w-full text-start", className)} noValidate>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        <ClipboardPaste size={15} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />
        {t.scanManualTitle}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{t.scanManualHint}</p>
      <div className="mt-2 flex gap-2">
        <Input
          value={value}
          onChange={e => {
            setValue(e.target.value);
            if (invalid) setInvalid(false);
          }}
          placeholder={t.scanManualPlaceholder}
          aria-label={t.scanManualPlaceholder}
          aria-invalid={invalid}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          dir="ltr"
          className="min-h-[44px] flex-1 text-[12px]"
        />
        <Button type="submit" className="min-h-[44px] shrink-0" disabled={!value.trim()}>
          {t.scanManualSubmit}
        </Button>
      </div>
      {invalid && (
        <p role="alert" className="mt-1.5 text-[11px] font-medium text-destructive">
          {t.scanManualInvalid}
        </p>
      )}
    </form>
  );
}
