"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";

const KEY = "hudoor_prof_defaults";

export default function ProfSettingsPage() {
  const { t } = useApp();
  const [d, setD] = useState({ duration_min: 60, geofence_radius_m: 100, geofence_enabled: true, late_after_min: 20, qr_interval_sec: 10 });
  const [lang, setLang] = useState("ar");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // accept the older key names (radius / geofence / qr_seconds) too
        setD(prev => ({
          ...prev,
          ...saved,
          geofence_radius_m: Number(saved.geofence_radius_m ?? saved.radius) || prev.geofence_radius_m,
          geofence_enabled: typeof saved.geofence_enabled === "boolean" ? saved.geofence_enabled
            : typeof saved.geofence === "boolean" ? saved.geofence : prev.geofence_enabled,
          qr_interval_sec: Number(saved.qr_interval_sec ?? saved.qr_seconds) || prev.qr_interval_sec
        }));
      }
      setLang(localStorage.getItem("hudoor_locale") ?? "ar");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
    setMsg(`✓ ${t.createdOk}`);
  }
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6">
      <h1 className="font-display text-3xl font-bold">{t.mySettings}</h1>
      <p className="text-neutral-500">{t.defaults}</p>
      <p className="mt-1 text-sm text-neutral-500">{t.defaultsHint}</p>
      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t.duration}</Label><Input type="number" value={d.duration_min} onChange={e => setD({ ...d, duration_min: Number(e.target.value) })} /></div>
          <div><Label>{t.radius}</Label><Input type="number" value={d.geofence_radius_m} onChange={e => setD({ ...d, geofence_radius_m: Number(e.target.value) })} /></div>
          <div><Label>{t.lateMin}</Label><Input type="number" value={d.late_after_min} onChange={e => setD({ ...d, late_after_min: Number(e.target.value) })} /></div>
          <div><Label>QR seconds</Label><Input type="number" value={d.qr_interval_sec} onChange={e => setD({ ...d, qr_interval_sec: Number(e.target.value) })} /></div>
        </div>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={d.geofence_enabled} onChange={e => setD({ ...d, geofence_enabled: e.target.checked })} />
          <span className="font-medium">{t.useGeofence}</span>
        </label>
        <div><Label>{t.defaultLang}</Label>
          <Select value={lang} onChange={e => { setLang(e.target.value); localStorage.setItem("hudoor_locale", e.target.value); location.reload(); }}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </Select>
        </div>
        {msg && <p className="text-sm font-semibold" role="status">{msg}</p>}
        <Button onClick={save}>{t.save}</Button>
      </div>
    </main>
  );
}
