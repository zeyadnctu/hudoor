"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { getOrCreateDeviceId } from "@/lib/device";
import { StampResult } from "@/components/hudoor/stamp-result";
import { EmptyState } from "@/components/hudoor/empty-state";
import { ManualCodeEntry } from "@/components/hudoor/manual-code-entry";
import { CardSkeleton } from "@/components/hudoor/skeletons";
import {
  WifiOff, RefreshCw, ScanLine, ClipboardList, Copy,
  MapPin, Smartphone, Clock, UserX, AlertTriangle, Shield, ExternalLink as LinkIcon
} from "lucide-react";

type Result = { status: string; code: string; message: string; course?: any; time?: string } | null;

/**
 * One key per token attempt. A reload or a retry of the same code reuses it,
 * so the server can return the first confirmed result instead of inserting
 * again. Cleared as soon as the server answers.
 */
function idempotencyFor(token: string): { storageKey: string; key: string } {
  const storageKey = `hudoor_scan_idem:${token}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return { storageKey, key: existing };
    const fresh = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(storageKey, fresh);
    return { storageKey, key: fresh };
  } catch {
    return {
      storageKey: "",
      key: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    };
  }
}
function clearIdempotency(storageKey: string) {
  if (!storageKey) return;
  try { sessionStorage.removeItem(storageKey); } catch {}
}

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return /whatsapp|instagram|fbav|fb_iab|line|wechat|telegram/i.test(ua);
}
function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isSecureContext(): boolean {
  return !!window.isSecureContext || location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function codeCopy(t: any, code: string): { title: string; fix: string; icon: React.ReactNode } {
  switch (code) {
    case "expired_code": case "token_expired":
      return { title: t.err_expired, fix: t.err_expired_fix, icon: <Clock size={28} strokeWidth={2} /> };
    case "bad_token": case "invalid_input":
      return { title: t.err_invalid_code, fix: t.err_invalid_code_fix, icon: <AlertTriangle size={28} strokeWidth={2} /> };
    case "replay_code":
      return { title: t.err_reuse, fix: t.err_reuse_fix, icon: <Shield size={28} strokeWidth={2} /> };
    case "not_enrolled":
      return { title: t.err_enrolled, fix: t.err_enrolled_fix, icon: <UserX size={28} strokeWidth={2} /> };
    case "wrong_device":
      return { title: t.err_device, fix: t.err_device_changed, icon: <Smartphone size={28} strokeWidth={2} /> };
    case "device_conflict":
      return { title: t.err_device_conflict, fix: t.err_device_changed, icon: <Smartphone size={28} strokeWidth={2} /> };
    case "outside_hall":
      return { title: t.err_hall, fix: t.err_hall_fix, icon: <MapPin size={28} strokeWidth={2} /> };
    case "no_location":
      return { title: t.err_location, fix: t.err_location_fix, icon: <MapPin size={28} strokeWidth={2} /> };
    case "mock_location":
      return { title: t.err_mock, fix: t.err_mock_fix, icon: <AlertTriangle size={28} strokeWidth={2} /> };
    case "low_accuracy":
      return { title: t.err_weak_gps, fix: t.err_weak_gps_fix, icon: <MapPin size={28} strokeWidth={2} /> };
    case "session_closed":
      return { title: t.err_closed, fix: t.err_closed_fix, icon: <Clock size={28} strokeWidth={2} /> };
    case "session_paused":
      return { title: t.err_closed, fix: t.err_closed_fix, icon: <Clock size={28} strokeWidth={2} /> };
    case "too_late":
      return { title: t.err_late, fix: t.err_late_fix, icon: <Clock size={28} strokeWidth={2} /> };
    case "outside_campus":
      return { title: t.err_hall, fix: t.err_hall_fix, icon: <MapPin size={28} strokeWidth={2} /> };
    case "not_eligible":
      return { title: t.err_pending, fix: t.err_pending_fix, icon: <ClipboardList size={28} strokeWidth={2} /> };
    case "unauthenticated":
      return { title: t.err_login, fix: t.err_login_fix, icon: <UserX size={28} strokeWidth={2} /> };
    case "rate_limited":
      return { title: t.err_rate, fix: t.err_rate_fix, icon: <AlertTriangle size={28} strokeWidth={2} /> };
    case "in_app_browser":
      return { title: t.err_in_app, fix: t.err_in_app_fix, icon: <LinkIcon size={28} strokeWidth={2} /> };
    default:
      return { title: code, fix: "", icon: <AlertTriangle size={28} strokeWidth={2} /> };
  }
}

function ScanInner() {
  const { t } = useApp();
  const sp = useSearchParams();
  const token = sp.get("t");
  const [res, setRes] = useState<Result>(null);
  const [online, setOnline] = useState(true);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => { doneRef.current = false; }, [token]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const inApp = isInAppBrowser();

  useEffect(() => {
    if (!token || !navigator.onLine || doneRef.current) return;
    let cancelled = false;
    (async () => {
      const deviceId = getOrCreateDeviceId();
      const { storageKey, key } = idempotencyFor(token);
      let pos: any = {};
      try {
        pos = await new Promise((resolve) =>
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, mocked: (p.coords as any).mocked ?? false }),
            () => resolve({}), { timeout: 8000, enableHighAccuracy: true }
          )
        );
      } catch { pos = {}; }

      const body = JSON.stringify({ token, deviceId, idempotencyKey: key, ...pos });
      // Bad network: retry twice with the SAME key. Success is only shown
      // after the server confirms; otherwise the offline state is explicit.
      for (let i = 0; i < 3; i++) {
        try {
          const r = await fetch("/api/attendance/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body
          });
          const j = await r.json();
          doneRef.current = true;
          clearIdempotency(storageKey);
          if (!cancelled) setRes(j);
          return;
        } catch {
          if (cancelled) return;
          if (i < 2 && navigator.onLine) {
            await new Promise(resolve => setTimeout(resolve, 700 * (i + 1)));
            continue;
          }
          if (!cancelled) setRes({ status: "error", code: "offline", message: "offline" });
          return;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, attempt, online]);

  if (!online) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<WifiOff size={28} />}
          title={t.err_offline}
          hint={t.err_offline_fix}
          withGrid
          action={<Button onClick={() => location.reload()}><RefreshCw size={18} strokeWidth={2} /> {t.retry}</Button>}
        />
      </main>
    );
  }

  if (inApp) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<LinkIcon size={28} />}
          title={t.err_in_app}
          hint={t.err_in_app_fix}
          withGrid
          action={
            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={copied}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(location.href);
                    setCopied(true);
                  } catch {
                    // Clipboard may be blocked inside a webview; the text
                    // remains selectable in the address bar.
                  }
                }}
              >
                <Copy size={18} strokeWidth={2} /> {copied ? t.copied : t.copyLink}
              </Button>
              <Button className="w-full" variant="outline" onClick={() => location.reload()}>
                <LinkIcon size={18} strokeWidth={2} /> {t.openInBrowser}
              </Button>
            </div>
          }
        />
      </main>
    );
  }

  // iPhone requires HTTPS for camera access (localhost is exempt for dev)
  if (isIOS() && !isSecureContext()) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<Shield size={28} strokeWidth={2} />}
          title={t.err_iphone_https}
          hint={t.err_iphone_https_fix}
          withGrid
          action={<Button onClick={() => location.reload()}><RefreshCw size={18} strokeWidth={2} /> {t.retry}</Button>}
        />
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<ScanLine size={28} />}
          title={t.scanToAttend}
          hint={t.scanHint}
          withGrid
          action={<Link href="/student/scan-in-app" className="block"><Button className="min-h-[44px] w-full">{t.openScanner}</Button></Link>}
        />
        <div className="mt-6 rounded-card border border-border bg-card p-4">
          <ManualCodeEntry />
        </div>
      </main>
    );
  }

  if (!res) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-8" aria-busy="true" aria-label={t.marking}>
        <CardSkeleton rows={2} />
        <p className="mt-4 text-center text-sm text-muted-foreground">{t.verifying}</p>
      </main>
    );
  }

  if (res.status === "success") {
    const already = res.code === "already_marked";
    const late = res.code === "marked_late";
    const time = res.time ? new Date(res.time) : new Date();
    const hhmmss = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) as string;
    return (
      <main className="mx-auto w-full max-w-md px-4 py-8">
        {/* the register page: ruled paper, one stamp, one headline */}
        <div className="ruled rounded-card border border-border bg-card px-5 py-6">
          <p className="text-sm font-semibold text-muted-foreground">{t.courseName}</p>
          <h1 className="font-display text-3xl font-bold leading-snug" dir="auto">
            {res.course?.name_ar ?? res.course?.name_en ?? ""}
          </h1>
          <p className="tnum font-display text-lg font-semibold text-primary">{res.course?.code ?? ""}</p>

          <StampResult
            stamp={already ? t.alreadyRecorded : late ? t.lateStamp : t.presentStamp}
            timeLabel={hhmmss}
            tone={already || late ? "late" : "present"}
            headline={already ? t.alreadyHint : late ? t.markedLate : t.markedPresent}
          />

          <dl className="border-t border-border text-[15px]">
            <div className="flex justify-between border-b border-border py-2.5">
              <dt className="text-muted-foreground">{t.time}</dt>
              <dd className="tnum font-semibold">{time.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between border-b border-border py-2.5">
              <dt className="text-muted-foreground">{t.method}</dt>
              <dd className="font-semibold">{t.scanMethod}</dd>
            </div>
          </dl>

          <Link href="/student" className="sticky bottom-4 mt-8 block">
            <Button className="w-full !min-h-[56px] !text-lg">{t.myAttendance}</Button>
          </Link>
        </div>
      </main>
    );
  }

  const c = codeCopy(t, res.code === "offline" ? "rate_limited" : res.code);
  const offline = res.code === "offline";
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <EmptyState
        icon={offline ? <WifiOff size={28} /> : c.icon}
        title={offline ? t.err_offline : c.title}
        hint={offline ? t.err_offline_fix : c.fix}
        action={
          <div className="space-y-2">
            {res.message && !offline && <p className="tnum text-sm text-muted-foreground" dir="auto">{res.message}</p>}
            {res.code === "unauthenticated" && token && (
              <Link href={`/login?next=${encodeURIComponent(`/scan?t=${encodeURIComponent(token)}`)}`} className="block">
                <Button className="w-full">{t.goLogin}</Button>
              </Link>
            )}
            <Button className="w-full" onClick={() => { doneRef.current = false; setRes(null); setAttempt(a => a + 1); }}>
              <RefreshCw size={18} strokeWidth={2} /> {t.retry}
            </Button>
            <Link href="/student/scan-in-app" className="block">
              <Button variant="outline" className="w-full"><ScanLine size={18} strokeWidth={2} /> {t.openScanner}</Button>
            </Link>
          </div>
        }
      />
      <div className="mt-6 rounded-card border border-border bg-card p-4">
        <ManualCodeEntry />
      </div>
    </main>
  );
}

export default function ScanPage() {
  return <Suspense><ScanInner /></Suspense>;
}
