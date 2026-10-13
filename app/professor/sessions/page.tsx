"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label, StatusPill } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase";
import { Plus } from "lucide-react";

export default function ProfSessionsPage() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    course_id: "", mode: "now", starts_at: "", duration_min: 60,
    recurring: false, recurring_until: "", room_id: "",
    geofence_radius_m: 100, geofence_enabled: true,
    late_after_min: "", qr_interval_sec: ""
  });

  async function load() {
    const sb = browserSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: cp } = await sb.from("course_professors").select("course_id,courses(id,code,name_ar)").eq("professor_id", user.id);
    const cs = ((cp ?? []) as any[]).map(x => x.courses);
    setCourses(cs);
    if (cs[0] && !form.course_id) setForm(f => ({ ...f, course_id: cs[0].id }));
    const { data: s } = await sb.from("attendance_sessions")
      .select("id,status,starts_at,ends_at,course_id,source,courses(code)").eq("professor_id", user.id)
      .order("starts_at", { ascending: false }).limit(60);
    setSessions((s ?? []) as any[]);
    const { data: r } = await sb.from("rooms").select("id,name_ar").limit(200);
    setRooms((r ?? []) as any[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function submit() {
    setMsg("");
    if (!form.course_id) { setMsg(t.course); return; }
    let geo: any = {};
    try {
      const p: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      geo = { geofence_lat: p.coords.latitude, geofence_lng: p.coords.longitude };
    } catch {}
    const body: any = {
      course_id: form.course_id,
      duration_min: Number(form.duration_min) || 60,
      geofence_radius_m: Number(form.geofence_radius_m) || 100,
      geofence_enabled: form.geofence_enabled,
      room_id: form.room_id || null,
      late_after_min: form.late_after_min === "" ? null : Number(form.late_after_min),
      qr_interval_sec: form.qr_interval_sec === "" ? null : Number(form.qr_interval_sec),
      ...geo
    };
    if (form.mode === "schedule" && form.starts_at) body.starts_at = new Date(form.starts_at).toISOString();
    if (form.mode === "recurring") {
      body.recurring = true;
      body.starts_at = form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString();
      if (form.recurring_until) body.recurring_until = new Date(form.recurring_until).toISOString();
    }
    const r = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    if (j.series) { setMsg(`✓ ${j.series}`); load(); setShow(false); }
    else location.href = `/professor/session/${j.id}`;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">{t.mySessions}</h1>
        <Button onClick={() => setShow(s => !s)}><Plus size={18} strokeWidth={2} /> {t.newSession}</Button>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}

      {show && (
        <div className="mt-3 rounded-md2 border border-black/10 p-4 dark:border-white/15">
          <div className="grid gap-2">
            <div><Label>{t.course}</Label>
              <Select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}>
                <option value="">—</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
              </Select>
            </div>
            <div><Label>Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {([["now", t.startSession], ["schedule", "Schedule"], ["recurring", t.recurringWeekly]] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setForm({ ...form, mode: v })}
                    className={`min-h-[48px] rounded-md2 border-2 font-semibold ${form.mode === v ? "border-register bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200" : "border-black/15 dark:border-white/20"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {(form.mode === "schedule" || form.mode === "recurring") && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Starts</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
                {form.mode === "recurring" && <div><Label>Until</Label><Input type="date" value={form.recurring_until} onChange={e => setForm({ ...form, recurring_until: e.target.value })} /></div>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t.duration}</Label><Input type="number" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: Number(e.target.value) })} /></div>
              <div><Label>{t.radius}</Label><Input type="number" value={form.geofence_radius_m} onChange={e => setForm({ ...form, geofence_radius_m: Number(e.target.value) })} /></div>
              <div><Label>{t.rooms}</Label>
                <Select value={form.room_id} onChange={e => setForm({ ...form, room_id: e.target.value })}>
                  <option value="">—</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                </Select>
              </div>
              <div><Label>{t.lateMin}</Label><Input type="number" value={form.late_after_min} onChange={e => setForm({ ...form, late_after_min: e.target.value })} placeholder="20" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>QR seconds</Label><Input type="number" value={form.qr_interval_sec} onChange={e => setForm({ ...form, qr_interval_sec: e.target.value })} placeholder="10" /></div>
              <label className="flex min-h-[48px] cursor-pointer items-center gap-2">
                <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={form.geofence_enabled} onChange={e => setForm({ ...form, geofence_enabled: e.target.checked })} />
                <span className="text-sm font-medium">{t.useGeofence}</span>
              </label>
            </div>
            <Button className="!min-h-[52px]" onClick={submit}>{form.mode === "now" ? t.startSession : t.save}</Button>
          </div>
        </div>
      )}

      <div className="mt-4 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
        {sessions.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        {sessions.map(s => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <Link href={`/professor/session/${s.id}`} className="tnum font-display font-semibold text-register hover:underline">
                {s.courses?.code}
              </Link>
              <span className="tnum ms-2 text-sm text-neutral-500">{new Date(s.starts_at).toLocaleString()}{s.source !== "manual" ? ` · ${s.source}` : ""}</span>
            </div>
            <StatusPill status={s.status} />
          </div>
        ))}
      </div>
    </main>
  );
}
