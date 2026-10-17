"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { PermissionPrimer } from "@/components/hudoor/permission-primer";
import { EmptyState } from "@/components/hudoor/empty-state";
import { CameraOff } from "lucide-react";

/* In-app scanner — the quiet route: no React Bits, no motion beyond the
   scan frame. Camera is requested only after the primer says why. */
type Phase = "primer" | "scanning" | "denied";

export default function InAppScan() {
  const { t } = useApp();
  const r = useRouter();
  const [phase, setPhase] = useState<Phase>("primer");

  if (phase === "denied") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<CameraOff size={28} />}
          title={t.err_camera_denied}
          hint={t.err_camera_denied_fix}
          withGrid
          action={<Button onClick={() => location.reload()}>{t.retry}</Button>}
        />
      </main>
    );
  }

  if (phase === "primer") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <PermissionPrimer
          kind="camera"
          title={t.scanToAttend}
          reason={t.scanHint}
          actionLabel={t.openScanner}
          skipLabel={t.back}
          onAllow={() => setPhase("scanning")}
          onSkip={() => r.push("/student")}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="font-display text-2xl font-bold">{t.scanToAttend}</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">{t.scanHint}</p>
      <div className="mt-4 overflow-hidden rounded-card border border-border">
        <Scanner
          onScan={(codes) => {
            const text = codes?.[0]?.rawValue ?? "";
            if (!text) return;
            try {
              const u = new URL(text);
              r.push(`/scan?t=${encodeURIComponent(u.searchParams.get("t") ?? text)}`);
            } catch {
              r.push(`/scan?t=${encodeURIComponent(text)}`);
            }
          }}
          onError={() => setPhase("denied")}
        />
      </div>
    </main>
  );
}
