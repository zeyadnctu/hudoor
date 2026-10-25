"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/hudoor/segmented-control";
import { BottomSheet } from "@/components/hudoor/bottom-sheet";
import { EmptyState } from "@/components/hudoor/empty-state";
import { CardSkeleton } from "@/components/hudoor/skeletons";
import { toast } from "@/components/hudoor/toast";
import { cn } from "@/lib/utils";
import {
  Bell,
  BookOpen,
  Check,
  Download,
  Fingerprint,
  GraduationCap,
  Hash,
  Info,
  Languages,
  Layers,
  LogOut,
  Mail,
  Moon,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserRound
} from "lucide-react";

type Profile = { id: string; email: string; role: string; status: string; custom_role: string | null; created_at: string };
type Details = {
  full_name_ar: string;
  full_name_en: string;
  university_id: string;
  level_year: number | null;
  section_group: string | null;
  phone: string | null;
  program_id: string | null;
  level_id: string | null;
  section_id: string | null;
};
type DeviceRow = { device_id: string; ua_hint: string | null; bound_at: string };
type Prefs = {
  class_soon: boolean;
  window_closing: boolean;
  timetable_change: boolean;
  decisions: boolean;
  at_risk: boolean;
  quiet_hours: boolean;
  quiet_from: string;
  quiet_to: string;
};
const DEFAULT_PREFS: Prefs = {
  class_soon: true,
  window_closing: true,
  timetable_change: true,
  decisions: true,
  at_risk: true,
  quiet_hours: false,
  quiet_from: "22:00",
  quiet_to: "07:00"
};
const PREFS_KEY = "hudoor_notification_prefs";
const TEXT_KEY = "hudoor_text_size";
const MOTION_KEY = "hudoor_reduce_motion";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function StudentMePage() {
  const { t, locale, setLocale, theme, setTheme } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [program, setProgram] = useState<{ name_ar: string; name_en: string; code: string } | null>(null);
  const [device, setDevice] = useState<DeviceRow | null>(null);
  const [localDevice, setLocalDevice] = useState("");
  const [pendingDevice, setPendingDevice] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [passkeys, setPasskeys] = useState<Array<{ name: string; created_at: string }>>([]);

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [prefsRemote, setPrefsRemote] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const [textSize, setTextSize] = useState<"normal" | "large">("normal");
  const [reduceMotion, setReduceMotion] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(TEXT_KEY);
      if (s === "large") {
        setTextSize("large");
        document.documentElement.style.fontSize = "18px";
      }
      const m = localStorage.getItem(MOTION_KEY) === "1";
      setReduceMotion(m);
      document.documentElement.classList.toggle("reduce-motion", m);
    } catch {}
    try {
      const d = localStorage.getItem("hudoor_device_id") ?? "";
      setLocalDevice(d);
    } catch {}

    const ua = navigator.userAgent;
    setIsIOS(/iphone|ipad|ipod/i.test(ua));
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setError(true); return; }
      const [pRes, dRes, devRes, reqRes, pkRes, prefRes] = await Promise.all([
        sb.from("profiles").select("id,email,role,status,custom_role,created_at").eq("id", user.id).single(),
        sb.from("student_details").select("full_name_ar,full_name_en,university_id,level_year,section_group,phone,program_id,level_id,section_id").eq("user_id", user.id).maybeSingle(),
        sb.from("devices").select("device_id,ua_hint,bound_at").eq("student_id", user.id).maybeSingle(),
        sb.from("service_requests").select("type,status").eq("student_id", user.id).eq("status", "pending"),
        sb.from("passkeys").select("name,created_at").eq("user_id", user.id),
        sb.from("notification_prefs").select("*").eq("user_id", user.id).maybeSingle()
      ]);
      if (pRes.error) throw pRes.error;
      setProfile(pRes.data as Profile);
      setDetails((dRes.data ?? null) as Details | null);
      setDevice((devRes.data ?? null) as DeviceRow | null);
      const pending = (reqRes.data ?? []) as Array<{ type: string }>;
      setPendingDevice(pending.some(r => r.type === "device_reset"));
      setPendingDelete(pending.some(r => r.type === "data_change"));
      setPasskeys(((pkRes.data ?? []) as Array<{ name: string; created_at: string }>));

      if (dRes.data?.program_id) {
        const { data: prog } = await sb.from("programs").select("name_ar,name_en,code").eq("id", dRes.data.program_id).maybeSingle();
        setProgram(prog as any);
      }

      if (prefRes.error) {
        setPrefsRemote(false);
        try {
          const raw = localStorage.getItem(PREFS_KEY);
          if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
        } catch {}
      } else if (prefRes.data) {
        const p = prefRes.data as any;
        setPrefs({
          class_soon: p.class_soon !== false,
          window_closing: p.window_closing !== false,
          timetable_change: p.timetable_change !== false,
          decisions: p.decisions !== false,
          at_risk: p.at_risk !== false,
          quiet_hours: !!p.quiet_hours,
          quiet_from: String(p.quiet_from ?? "22:00").slice(0, 5),
          quiet_to: String(p.quiet_to ?? "07:00").slice(0, 5)
        });
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    setPrefsSaving(true);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
    if (prefsRemote && profile) {
      const sb = browserSupabase();
      const { error } = await sb.from("notification_prefs").upsert({
        user_id: profile.id,
        ...next,
        quiet_from: `${next.quiet_from}:00`,
        quiet_to: `${next.quiet_to}:00`,
        updated_at: new Date().toISOString()
      });
      if (error) {
        setPrefsRemote(false);
        toast.info(t.meNotifyLocal);
      } else {
        toast.success(t.meNotifySaved);
      }
    } else {
      toast.success(t.meNotifyLocal);
    }
    setPrefsSaving(false);
  }

  function changeTextSize(v: "normal" | "large") {
    setTextSize(v);
    try { localStorage.setItem(TEXT_KEY, v); } catch {}
    document.documentElement.style.fontSize = v === "large" ? "18px" : "";
  }
  function changeMotion(v: boolean) {
    setReduceMotion(v);
    try { localStorage.setItem(MOTION_KEY, v ? "1" : "0"); } catch {}
    document.documentElement.classList.toggle("reduce-motion", v);
  }

  async function requestDeviceChange() {
    const r = await fetch("/api/console/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "device_reset", payload: {} })
    });
    if (r.ok) {
      setPendingDevice(true);
      toast.success(t.meDevicePending);
    } else {
      const j = await r.json().catch(() => ({}));
      toast.error((j as any).error === "already_pending" ? t.meDevicePending : t.meSaveError);
    }
  }

  async function requestDelete() {
    if (!deleteAck) return;
    setDeleteSaving(true);
    const r = await fetch("/api/console/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "data_change", payload: { kind: "delete_account", note: deleteReason.trim() } })
    });
    setDeleteSaving(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error((j as any).error === "already_pending" ? t.meDeleteHint : t.meSaveError);
      return;
    }
    setDeleteOpen(false);
    setPendingDelete(true);
    setDeleteReason("");
    setDeleteAck(false);
    toast.success(t.meDeleteSent);
  }

  async function signOut() {
    const sb = browserSupabase();
    await sb.auth.signOut();
    try {
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_CACHE" });
    } catch {}
    router.replace("/login");
  }

  const displayName = useMemo(
    () => details?.full_name_ar || details?.full_name_en || profile?.email || "",
    [details, profile]
  );
  const maskedDevice = useMemo(() => {
    const id = device?.device_id || localDevice;
    if (!id) return "";
    return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  }, [device, localDevice]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pb-32 pt-6" aria-busy="true">
        <div className="h-8 w-32 rounded-base bg-muted" />
        <div className="mt-4 rounded-card border border-border bg-card p-5">
          <div className="h-12 w-12 rounded-pill bg-muted" />
          <div className="mt-3 h-5 w-40 rounded-base bg-muted" />
          <div className="mt-2 h-4 w-24 rounded-base bg-muted" />
        </div>
        <div className="mt-6"><CardSkeleton rows={3} /></div>
        <div className="mt-6"><CardSkeleton rows={4} /></div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<UserRound size={26} strokeWidth={2} />}
          title={t.meLoadError}
          hint={t.meLoadError}
          withGrid
          action={<Button className="min-h-[44px]" onClick={() => load()}>{t.meRetry}</Button>}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-32 pt-6">
      <header className="flex items-start justify-between gap-3">
        <h1 className="font-display text-[26px] font-bold leading-tight">{t.profileTitle}</h1>
        <span className={cn(
          "rounded-pill px-2.5 py-1 text-[11px] font-bold",
          profile.status === "approved" ? "bg-present-soft text-present-ink" : "bg-late-soft text-late-ink"
        )}>
          {profile.status === "approved" ? t.attApproved : profile.status}
        </span>
      </header>

      <section className="mt-4 rounded-card border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-pill bg-primary/10 font-display text-xl font-bold text-primary">
            {(displayName || "?").trim().charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold" dir="auto">{displayName}</p>
            <p className="truncate text-[12px] text-muted-foreground" dir="ltr">{profile.email}</p>
            {program && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {locale === "ar" ? program.name_ar : program.name_en} · {program.code}
              </span>
            )}
          </div>
        </div>
        <Link
          href="/profile"
          className="mt-4 flex min-h-[44px] items-center justify-between gap-2 rounded-base border border-border px-3 text-[13px] font-semibold transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-2"><ShieldCheck size={16} strokeWidth={2} /> {t.meFullProfile}</span>
          <span aria-hidden="true" className="text-muted-foreground">‹</span>
        </Link>
      </section>

      <Section title={t.meStudy} icon={<GraduationCap size={17} strokeWidth={2} />}>
        <InfoRow icon={<Hash size={16} strokeWidth={2} />} label={t.universityId} value={details?.university_id ?? "—"} ltr tnum />
        <InfoRow icon={<BookOpen size={16} strokeWidth={2} />} label={t.program} value={program ? (locale === "ar" ? program.name_ar : program.name_en) : "—"} />
        <InfoRow icon={<Layers size={16} strokeWidth={2} />} label={t.levelName} value={details?.level_year != null ? String(details.level_year) : "—"} />
        <InfoRow icon={<UserRound size={16} strokeWidth={2} />} label={t.group} value={details?.section_group ?? "—"} />
        <InfoRow icon={<Mail size={16} strokeWidth={2} />} label={t.email} value={profile.email} ltr />
      </Section>

      <Section title={t.meDevice} icon={<Smartphone size={17} strokeWidth={2} />}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground">{t.meDevice}</p>
              <p className="tnum truncate text-[14px] font-semibold" dir="ltr">
                {device ? maskedDevice : t.meDeviceNone}
              </p>
              {device?.bound_at && (
                <p className="tnum mt-0.5 text-[10px] text-muted-foreground">
                  {t.meDeviceBoundAt} {new Date(device.bound_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                </p>
              )}
              {!device && <p className="mt-0.5 text-[11px] text-muted-foreground">{t.meDeviceNoneHint}</p>}
            </div>
            <span className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold",
              device ? "bg-present-soft text-present-ink" : "bg-muted text-muted-foreground"
            )}>
              {device ? <Check size={11} strokeWidth={2.6} /> : <Info size={11} strokeWidth={2.4} />}
              {device ? t.deviceBound : "—"}
            </span>
          </div>
          {device && (
            <Button
              variant="outline"
              className="mt-3 min-h-[44px] w-full"
              onClick={requestDeviceChange}
              disabled={pendingDevice}
            >
              <MonitorSmartphone size={16} strokeWidth={2} />
              {pendingDevice ? t.meDevicePending : t.meDeviceChange}
            </Button>
          )}
          {pendingDevice && <p className="mt-2 text-[11px] text-muted-foreground">{t.meDeviceChangeHint}</p>}
        </div>
      </Section>

      <Section title={t.meAppearance} icon={<Palette size={17} strokeWidth={2} />}>
        <SettingRow label={t.meLanguage} icon={<Languages size={16} strokeWidth={2} />}>
          <SegmentedControl
            value={locale}
            onValueChange={v => setLocale(v)}
            ariaLabel={t.meLanguage}
            options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]}
          />
        </SettingRow>
        <SettingRow label={t.meTheme} icon={theme === "dark" ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}>
          <SegmentedControl
            value={theme === "dark" ? "dark" : "light"}
            onValueChange={v => setTheme(v)}
            ariaLabel={t.meTheme}
            options={[
              { value: "light", label: t.meThemeLight, icon: <Sun size={14} strokeWidth={2} /> },
              { value: "dark", label: t.meThemeDark, icon: <Moon size={14} strokeWidth={2} /> }
            ]}
          />
        </SettingRow>
        <SettingRow label={t.meTextSize} icon={<span className="font-display text-[15px] font-bold">A</span>}>
          <SegmentedControl
            value={textSize}
            onValueChange={changeTextSize}
            ariaLabel={t.meTextSize}
            options={[{ value: "normal", label: t.meTextNormal }, { value: "large", label: t.meTextLarge }]}
          />
        </SettingRow>
        <label className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex items-start gap-2">
            <MonitorSmartphone size={16} strokeWidth={2} className="mt-0.5 text-muted-foreground" aria-hidden="true" />
            <span>
              <span className="block text-[13px] font-semibold">{t.meReduceMotion}</span>
              <span className="block text-[11px] text-muted-foreground">{t.meReduceMotionHint}</span>
            </span>
          </span>
          <Switch checked={reduceMotion} onCheckedChange={changeMotion} aria-label={t.meReduceMotion} />
        </label>
      </Section>

      <Section title={t.meNotifications} icon={<Bell size={17} strokeWidth={2} />} hint={t.meNotifyHint}>
        <ToggleRow label={t.meNotifyClassSoon} checked={prefs.class_soon} onChange={v => savePrefs({ ...prefs, class_soon: v })} />
        <ToggleRow label={t.meNotifyWindow} checked={prefs.window_closing} onChange={v => savePrefs({ ...prefs, window_closing: v })} />
        <ToggleRow label={t.meNotifyTimetable} checked={prefs.timetable_change} onChange={v => savePrefs({ ...prefs, timetable_change: v })} />
        <ToggleRow label={t.meNotifyDecisions} checked={prefs.decisions} onChange={v => savePrefs({ ...prefs, decisions: v })} />
        <ToggleRow label={t.meNotifyAtRisk} checked={prefs.at_risk} onChange={v => savePrefs({ ...prefs, at_risk: v })} />
        <ToggleRow label={t.meNotifyQuiet} checked={prefs.quiet_hours} onChange={v => savePrefs({ ...prefs, quiet_hours: v })} />
        {prefs.quiet_hours && (
          <div className="flex flex-wrap items-end gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Label htmlFor="quiet-from">{t.meNotifyQuietFrom}</Label>
              <input
                id="quiet-from"
                type="time"
                dir="ltr"
                value={prefs.quiet_from}
                onChange={e => savePrefs({ ...prefs, quiet_from: e.target.value || "22:00" })}
                className="min-h-[44px] w-full rounded-base border border-border bg-background px-3 text-sm"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Label htmlFor="quiet-to">{t.meNotifyQuietTo}</Label>
              <input
                id="quiet-to"
                type="time"
                dir="ltr"
                value={prefs.quiet_to}
                onChange={e => savePrefs({ ...prefs, quiet_to: e.target.value || "07:00" })}
                className="min-h-[44px] w-full rounded-base border border-border bg-background px-3 text-sm"
              />
            </div>
            {!prefsRemote && <p className="w-full text-[10px] text-muted-foreground">{t.meNotifyLocal}</p>}
            {prefsSaving && <p className="w-full text-[10px] text-muted-foreground">…</p>}
          </div>
        )}
      </Section>

      <Section title={t.mePrivacy} icon={<ShieldCheck size={17} strokeWidth={2} />} hint={t.mePrivacyHint}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <a
            href="/api/student/export"
            download
            className="inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-base border border-border px-4 text-[13px] font-semibold transition-colors hover:bg-accent"
          >
            <Download size={16} strokeWidth={2} /> {t.meExport}
          </a>
          <Link
            href="/privacy"
            className="inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-base px-4 text-[13px] font-semibold text-primary transition-colors hover:bg-accent"
          >
            {t.mePrivacyPolicy}
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-base px-4 text-[13px] font-semibold text-primary transition-colors hover:bg-accent"
          >
            {t.meTerms}
          </Link>
        </div>
        <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">{t.meExportHint}</p>
        <div className="border-t border-border px-4 py-3">
          <Button
            variant="destructive"
            className="min-h-[44px] w-full"
            onClick={() => setDeleteOpen(true)}
            disabled={pendingDelete}
          >
            <Trash2 size={16} strokeWidth={2} />
            {pendingDelete ? t.meDevicePending.replace(t.meDevice, t.meDelete) : t.meDelete}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">{t.meDeleteHint}</p>
        </div>
      </Section>

      <Section title={t.meInstall} icon={<MonitorSmartphone size={17} strokeWidth={2} />} hint={t.meInstallHint}>
        <div className="px-4 py-3">
          {installed ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-present-ink">
              <Check size={16} strokeWidth={2.4} /> {t.meInstalled}
            </p>
          ) : (
            <>
              {installEvent && (
                <Button
                  className="min-h-[44px] w-full"
                  onClick={async () => {
                    try {
                      await installEvent.prompt();
                      const choice = await installEvent.userChoice;
                      if (choice.outcome === "accepted") setInstalled(true);
                      setInstallEvent(null);
                    } catch {}
                  }}
                >
                  <Download size={16} strokeWidth={2} /> {t.meInstallButton}
                </Button>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">{isIOS ? t.meInstallIOS : t.meInstallHint}</p>
            </>
          )}
        </div>
      </Section>

      {passkeys.length > 0 && (
        <Section title={t.meSecurity} icon={<Fingerprint size={17} strokeWidth={2} />}>
          {passkeys.map(p => (
            <InfoRow
              key={p.created_at}
              icon={<Fingerprint size={16} strokeWidth={2} />}
              label={p.name || t.mePasskey}
              value={new Date(p.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
              tnum
            />
          ))}
        </Section>
      )}

      <div className="mt-6">
        <Button variant="ghost" className="min-h-[44px] w-full" onClick={signOut}>
          <LogOut size={16} strokeWidth={2} /> {t.meSignOut}
        </Button>
        <p className="mt-3 text-center text-[10px] text-muted-foreground">{t.app} · {t.meVersion} 1.0.0</p>
      </div>

      <BottomSheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.meDeleteTitle}
        description={t.meDeleteHint}
        footer={
          <Button
            variant="destructive"
            className="min-h-[44px] w-full"
            onClick={requestDelete}
            disabled={!deleteAck || deleteSaving}
          >
            <Trash2 size={16} strokeWidth={2} /> {deleteSaving ? "…" : t.meDelete}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="rounded-base border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[12px] leading-relaxed text-destructive">
            {t.meDeleteWarning}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="delete-reason">{t.meDeleteReason}</Label>
            <Textarea
              id="delete-reason"
              rows={3}
              dir="auto"
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
            />
          </div>
          <label className="flex min-h-[44px] items-start gap-2.5">
            <input
              type="checkbox"
              checked={deleteAck}
              onChange={e => setDeleteAck(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--destructive)]"
            />
            <span className="text-[12px] font-medium leading-relaxed">{t.meDeleteConfirm}</span>
          </label>
        </div>
      </BottomSheet>
    </main>
  );
}

function Section({
  title,
  icon,
  hint,
  children
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
      <div className="mt-2 divide-y divide-border overflow-hidden rounded-card border border-border bg-card">{children}</div>
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
  ltr,
  tnum
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
  tnum?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
        <p className={cn("truncate text-[13px] font-semibold", tnum && "tnum")} dir={ltr ? "ltr" : undefined}>{value}</p>
      </div>
    </div>
  );
}

function SettingRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5">
      <span className="flex items-center gap-2 text-[13px] font-semibold">
        <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}
