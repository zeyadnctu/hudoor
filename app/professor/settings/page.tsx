"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";

const KEY = "hudoor_prof_defaults";

export default function ProfSettingsPage() {
  const { t } = useApp();
  const [d, setD] = useState({ duration_min: 60, radius: 100, geofence: true, late_after_min: 20, qr_seconds: 10 });
  const [lang, setLang] = useState("ar");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setD({ ...d, ...JSON.parse(raw) });
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
      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t.duration}</Label><Input type="number" value={d.duration_min} onChange={e => setD({ ...d, duration_min: Number(e.target.value) })} /></div>
          <div><Label>{t.radius}</Label><Input type="number" value={d.radius} onChange={e => setD({ ...d, radius: Number(e.target.value) })} /></div>
          <div><Label>{t.lateMin}</Label><Input type="number" value={d.late_after_min} onChange={e => setD({ ...d, late_after_min: Number(e.target.value) })} /></div>
          <div><Label>QR seconds</Label><Input type="number" value={d.qr_seconds} onChange={e => setD({ ...d, qr_seconds: Number(e.target.value) })} /></div>
        </div>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={d.geofence} onChange={e => setD({ ...d, geofence: e.target.checked })} />
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
