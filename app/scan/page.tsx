"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/providers";
import { Button, Stamp } from "@/components/ui";
import { getOrCreateDeviceId } from "@/lib/device";
import {
  CheckCircle2, XCircle, WifiOff, RefreshCw, ScanLine, ClipboardList,
  MapPin, Smartphone, Clock, UserX, AlertTriangle
} from "lucide-react";

type Result = { status: string; code: string; message: string; course?: any; time?: string } | null;

function codeCopy(t: any, code: string): { title: string; fix: string; icon: React.ReactNode } {
  switch (code) {
    case "expired_code": case "bad_token":
      return { title: t.err_expired, fix: t.err_expired_fix, icon: <Clock size={40} strokeWidth={1.75} /> };
    case "not_enrolled":
      return { title: t.err_enrolled, fix: t.err_enrolled_fix, icon: <UserX size={40} strokeWidth={1.75} /> };
    case "wrong_device":
      return { title: t.err_device, fix: t.err_device_fix, icon: <Smartphone size={40} strokeWidth={1.75} /> };
    case "device_conflict":
      return { title: t.err_device_conflict, fix: t.err_device_fix, icon: <Smartphone size={40} strokeWidth={1.75} /> };
    case "outside_hall":
      return { title: t.err_hall, fix: t.err_hall_fix, icon: <MapPin size={40} strokeWidth={1.75} /> };
    case "no_location":
      return { title: t.err_location, fix: t.err_location_fix, icon: <MapPin size={40} strokeWidth={1.75} /> };
    case "mock_location":
      return { title: t.err_mock, fix: t.err_mock_fix, icon: <AlertTriangle size={40} strokeWidth={1.75} /> };
    case "low_accuracy":
      return { title: t.err_weak_gps, fix: t.err_weak_gps_fix, icon: <MapPin size={40} strokeWidth={1.75} /> };
    case "session_closed":
      return { title: t.err_closed, fix: t.err_closed_fix, icon: <Clock size={40} strokeWidth={1.75} /> };
    case "not_eligible":
      return { title: t.err_pending, fix: t.err_pending_fix, icon: <ClipboardList size={40} strokeWidth={1.75} /> };
    case "unauthenticated":
      return { title: t.err_login, fix: t.err_login_fix, icon: <UserX size={40} strokeWidth={1.75} /> };
    case "rate_limited":
      return { title: t.err_rate, fix: t.err_rate_fix, icon: <AlertTriangle size={40} strokeWidth={1.75} /> };
    default:
      return { title: code, fix: "", icon: <XCircle size={40} strokeWidth={1.75} /> };
  }
}

function ScanInner() {
  const { t } = useApp();
  const sp = useSearchParams();
  const token = sp.get("t");
  const [res, setRes] = useState<Result>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!token || !navigator.onLine) return;
    let cancelled = false;
    (async () => {
      const deviceId = getOrCreateDeviceId();
      let pos: any = {};
      try {
        pos = await new Promise((resolve) =>
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, mocked: (p.coords as any).mocked ?? false }),
            () => resolve({}), { timeout: 8000, enableHighAccuracy: true }
          )
        );
      } catch { pos = {}; }
      try {
        const r = await fetch("/api/attendance/scan", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, deviceId, ...pos })
        });
        const j = await r.json();
        if (!cancelled) setRes(j);
      } catch {
        if (!cancelled) setRes({ status: "error", code: "offline", message: "offline" });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const shell = "mx-auto min-h-screen w-full max-w-md bg-paper dark:bg-inksurface";

  if (!online) {
    return (
      <main className={shell}>
        <div className="px-5 py-16 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brick-light text-brick-dark dark:bg-brick/20 dark:text-red-300">
            <WifiOff size={32} strokeWidth={1.75} />
          </div>
          <h1 className="font-display mt-4 text-2xl font-bold">{t.err_offline}</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">{t.err_offline_fix}</p>
          <Button className="mt-6 w-full" onClick={() => location.reload()}><RefreshCw size={18} strokeWidth={2} /> {t.retry}</Button>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className={shell}>
        <div className="px-5 py-16 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-300">
            <ScanLine size={32} strokeWidth={1.75} />
          </div>
          <h1 className="font-display mt-4 text-2xl font-bold">{t.scanToAttend}</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">{t.scanHint}</p>
          <a href="/student/scan-in-app" className="mt-6 block"><Button className="w-full">{t.openScanner}</Button></a>
        </div>
      </main>
    );
  }

  if (!res) {
    return (
      <main className={shell} aria-busy="true" aria-label={t.marking}>
        <div className="ruled-tight px-5 py-8">
          <div className="skeleton h-7 w-2/3 rounded bg-black/10 dark:bg-white/15" />
          <div className="skeleton mt-2 h-5 w-1/2 rounded bg-black/10 dark:bg-white/15" />
          <div className="mx-auto mt-10 h-36 w-64 rounded-frame border-4 border-black/10 dark:border-white/15" />
          <div className="skeleton mx-auto mt-8 h-5 w-40 rounded bg-black/10 dark:bg-white/15" />
          <p className="mt-4 text-center text-sm text-neutral-500">{t.verifying}</p>
        </div>
      </main>
    );
  }

  if (res.status === "success") {
    const already = res.code === "already_marked";
    const time = res.time ? new Date(res.time) : new Date();
    const hhmmss = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) as string;
    return (
      <main className={shell}>
        {/* register page */}
        <div className="ruled px-5 py-8">
          <p className="text-sm font-semibold text-neutral-500">{t.courseName}</p>
          <h1 className="font-display text-3xl font-bold leading-snug">
            {res.course?.name_ar ?? res.course?.name_en ?? ""}
          </h1>
          <p className="tnum font-display text-lg font-semibold text-register">{res.course?.code ?? ""}</p>

          <div className="py-10 text-center">
            <Stamp
              top={already ? t.alreadyRecorded : t.presentStamp}
              bottom={hhmmss}
              tone={already ? "hi" : "stamp"}
            />
            <p className="mt-4 flex items-center justify-center gap-2 text-lg font-semibold text-stamp-dark dark:text-emerald-300">
              <CheckCircle2 size={22} strokeWidth={2} />
              {already ? t.alreadyHint : t.markedPresent}
            </p>
          </div>

          <dl className="border-t-2 border-black/15 text-[15px] dark:border-white/20">
            <div className="flex justify-between border-b border-black/10 py-2.5 dark:border-white/10">
              <dt className="text-neutral-500">{t.time}</dt>
              <dd className="tnum font-semibold">{time.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between border-b border-black/10 py-2.5 dark:border-white/10">
              <dt className="text-neutral-500">{t.method}</dt>
              <dd className="font-semibold">{t.scanMethod}</dd>
            </div>
          </dl>

          <a href="/student" className="sticky bottom-4 mt-8 block">
            <Button className="w-full !min-h-[56px] !text-lg">{t.myAttendance}</Button>
          </a>
        </div>
      </main>
    );
  }

  const c = codeCopy(t, res.code === "offline" ? "rate_limited" : res.code);
  const offline = res.code === "offline";
  return (
    <main className={shell}>
      <div className="px-5 py-12">
        <div className="rounded-lg2 border-2 border-brick/40 bg-brick-light/50 p-6 text-center dark:border-brick/50 dark:bg-brick/10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brick text-white">
            {offline ? <WifiOff size={32} strokeWidth={1.75} /> : c.icon}
          </div>
          <h1 className="font-display mt-4 text-2xl font-bold text-brick-dark dark:text-red-200">
            {offline ? t.err_offline : c.title}
          </h1>
          <p className="mt-2 text-[15px] text-neutral-700 dark:text-neutral-200">{offline ? t.err_offline_fix : c.fix}</p>
          {!offline && res.message && <p className="tnum mt-1 text-sm text-neutral-500" dir="auto">{res.message}</p>}
        </div>
        <Button className="mt-6 w-full !min-h-[56px] !text-lg" onClick={() => location.reload()}>
          <RefreshCw size={18} strokeWidth={2} /> {t.retry}
        </Button>
        <a href="/student/scan-in-app" className="mt-3 block">
          <Button variant="outline" className="w-full"><ScanLine size={18} strokeWidth={2} /> {t.openScanner}</Button>
        </a>
      </div>
    </main>
  );
}

export default function ScanPage() {
  return <Suspense><ScanInner /></Suspense>;
}
