"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui";
import { CameraOff, ScanLine } from "lucide-react";

export default function InAppScan() {
  const { t } = useApp();
  const r = useRouter();
  const [denied, setDenied] = useState(false);
  if (denied) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-14 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brick-light text-brick-dark dark:bg-brick/20 dark:text-red-300">
          <CameraOff size={32} strokeWidth={1.75} />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold">{t.err_camera}</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">{t.err_camera_fix}</p>
        <Button className="mt-6 w-full" onClick={() => location.reload()}>{t.retry}</Button>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-md px-5 py-6">
      <h1 className="font-display flex items-center gap-2 text-2xl font-bold"><ScanLine size={24} strokeWidth={2} /> {t.scanToAttend}</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-300">{t.scanHint}</p>
      <div className="mt-4 overflow-hidden rounded-md2 border-2 border-ink/20 dark:border-white/20">
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
          onError={() => setDenied(true)}
        />
      </div>
    </main>
  );
}
