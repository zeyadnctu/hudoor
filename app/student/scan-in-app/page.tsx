"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Scanner, type IScannerError } from "@yudiel/react-qr-scanner";
import "@/lib/scanner-wasm";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { PermissionPrimer } from "@/components/hudoor/permission-primer";
import { EmptyState } from "@/components/hudoor/empty-state";
import { ManualCodeEntry } from "@/components/hudoor/manual-code-entry";
import { extractScanToken } from "@/lib/scan-input";
import { CameraOff, Camera, RefreshCw, ExternalLink } from "lucide-react";

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /whatsapp|instagram|fbav|fb_iab|fban|messenger|line|wechat|telegram|snapchat|pinterest|bytedance|tiktok/i.test(
    ua
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

function isSecureContext(): boolean {
  if (typeof window === "undefined") return true;
  return (
    !!window.isSecureContext ||
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "[::1]"
  );
}

/* In-app scanner — the quiet route: no React Bits, no motion beyond the
   scan frame. Camera is requested only after the primer says why.

   Error triage: the scanner library reports structured errors and several
   kinds are transient — notably `aborted` (StrictMode double-mount, tab
   switch, quick unmount) and `in-use` (another app holding the camera for
   a moment). Only a persistent, confirmed permission problem should send
   the user to the "denied" screen; anything else must not dead-end. */
type Phase = "primer" | "scanning" | "denied" | "busy" | "nocam" | "error";

export default function InAppScan() {
  const { t } = useApp();
  const r = useRouter();
  const [phase, setPhase] = useState<Phase>("primer");
  const [errMsg, setErrMsg] = useState("");
  // bump to remount the Scanner and re-request the camera on retry
  const [scanKey, setScanKey] = useState(0);
  const busyRetries = useRef(0);
  const routed = useRef(false);
  const inApp = typeof window !== "undefined" ? isInAppBrowser() : false;
  const ios = typeof window !== "undefined" ? isIOS() : false;
  const secure = typeof window !== "undefined" ? isSecureContext() : true;

  const retry = useCallback(() => {
    busyRetries.current = 0;
    routed.current = false;
    setErrMsg("");
    setPhase("scanning");
    setScanKey((k) => k + 1);
  }, []);

  const handleError = useCallback((err: IScannerError) => {
    const kind = err?.kind ?? "unknown";

    // Transient aborts (unmount/remount, tab switch) must never dead-end
    // the user on the denied screen — just keep the current view.
    if (kind === "aborted") return;

    if (kind === "permission-denied" || kind === "security") {
      // Confirm with the Permissions API: a dismissed prompt ("prompt") or
      // an already-granted permission ("granted") means this was a race —
      // e.g. StrictMode double-mount — not a real denial. Retry instead of
      // showing the denied screen.
      if (typeof navigator !== "undefined" && navigator.permissions?.query) {
        navigator.permissions
          .query({ name: "camera" as PermissionName })
          .then((status) => {
            if (status.state === "denied") setPhase("denied");
            else retry();
          })
          .catch(() => setPhase("denied"));
      } else {
        setPhase("denied");
      }
      return;
    }

    if (kind === "in-use") {
      // Camera temporarily held elsewhere (another tab/app, a releasing
      // stream) — auto-retry with a longer backoff; each retry remounts the
      // Scanner after the previous instance has had time to release the cam.
      if (busyRetries.current < 5) {
        busyRetries.current += 1;
        setTimeout(() => setScanKey((k) => k + 1), 1000);
      } else {
        setPhase("busy");
      }
      return;
    }

    if (kind === "no-camera" || kind === "unsupported") {
      setPhase("nocam");
      return;
    }

    if (kind === "insecure-context") {
      setErrMsg(err?.message ?? "");
      setPhase("error");
      return;
    }

    setErrMsg(err?.message ?? "");
    setPhase("error");
  }, [retry]);

  // If permission is already denied before we even start, say so upfront.
  useEffect(() => {
    if (phase !== "primer") return;
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((s) => { if (s.state === "denied") setPhase("denied"); })
      .catch(() => {});
  }, [phase]);

  if (inApp) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<CameraOff size={28} />}
          title={t.err_in_app}
          hint={t.err_in_app_fix}
          withGrid
          action={
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => {
                  try {
                    window.open(location.href, "_blank", "noopener,noreferrer");
                  } catch {}
                }}
              >
                <ExternalLink size={18} strokeWidth={2} /> {t.openInBrowser}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => r.push("/student")}>
                {t.back}
              </Button>
            </div>
          }
        />
      </main>
    );
  }

  if (ios && !secure) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<CameraOff size={28} />}
          title={t.err_iphone_https}
          hint={(t as any).err_iphone_https_fix || (t as any).err_camera_fix || ""}
          withGrid
          action={
            <Button className="w-full" onClick={() => location.reload()}>
              <RefreshCw size={18} strokeWidth={2} /> {t.retry}
            </Button>
          }
        />
      </main>
    );
  }

  if (phase === "denied") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<CameraOff size={28} />}
          title={(t as any).err_camera_denied || t.err_camera}
          hint={(t as any).err_camera_denied_fix || (t as any).err_camera_fix}
          withGrid
          action={<Button onClick={retry}><RefreshCw size={18} strokeWidth={2} /> {t.retry}</Button>}
        />
        <div className="mt-6 rounded-card border border-border bg-card p-4">
          <ManualCodeEntry />
        </div>
      </main>
    );
  }

  if (phase === "busy") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<Camera size={28} />}
          title={(t as any).err_camera_busy || t.err_camera}
          hint={(t as any).err_camera_busy_fix || (t as any).err_camera_fix}
          withGrid
          action={<Button onClick={retry}><RefreshCw size={18} strokeWidth={2} /> {t.retry}</Button>}
        />
        <div className="mt-6 rounded-card border border-border bg-card p-4">
          <ManualCodeEntry />
        </div>
      </main>
    );
  }

  if (phase === "nocam") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<CameraOff size={28} />}
          title={(t as any).err_no_camera || t.err_camera}
          hint={(t as any).err_no_camera_fix || (t as any).err_camera_fix}
          withGrid
          action={<Button onClick={() => r.push("/student")}>{t.back}</Button>}
        />
        <div className="mt-6 rounded-card border border-border bg-card p-4">
          <ManualCodeEntry />
        </div>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<CameraOff size={28} />}
          title={(t as any).err_camera_generic || t.err_camera}
          hint={errMsg || (t as any).err_camera_generic_fix || (t as any).err_camera_fix}
          withGrid
          action={<Button onClick={retry}><RefreshCw size={18} strokeWidth={2} /> {t.retry}</Button>}
        />
        <div className="mt-6 rounded-card border border-border bg-card p-4">
          <ManualCodeEntry />
        </div>
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
          key={scanKey}
          onScan={(codes) => {
            if (routed.current) return;
            const text = codes?.[0]?.rawValue ?? "";
            const token = extractScanToken(text);
            if (!token) return; // unrelated QR — keep scanning
            routed.current = true;
            r.push(`/scan?t=${encodeURIComponent(token)}`);
          }}
          onError={handleError}
        />
      </div>
      <div className="mt-4 rounded-card border border-border bg-card p-4">
        <ManualCodeEntry />
      </div>
    </main>
  );
}
