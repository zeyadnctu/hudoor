"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label, StatusPill, FieldError, SkeletonRows, DataTable } from "@/components/ui";
import { Play, FileBarChart } from "lucide-react";

export default function ProfHome() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ course_id: "", duration_min: 60, geofence_radius_m: 100, geofence_enabled: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const sb = browserSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: cp } = await sb.from("course_professors").select("course_id, courses(id,code,name_ar,name_en)").eq("professor_id", user.id);
    const cs = (cp ?? []).map((x: any) => x.courses);
    setCourses(cs);
    const { data: s } = await sb.from("attendance_sessions").select("id,status,starts_at,ends_at,course_id,courses(code,name_ar)").eq("professor_id", user.id).order("created_at", { ascending: false }).limit(20);
    setSessions(s ?? []);
    if (cp?.[0] && !form.course_id) setForm(f => ({ ...f, course_id: (cp[0] as any).course_id }));
    setLoading(false);
  }

  async function start() {
    setErr("");
    if (!form.course_id) { setErr(t.course); return; }
    setBusy(true);
    try {
      let geo: any = {};
      try {
        const p: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
        geo = { geofence_lat: p.coords.latitude, geofence_lng: p.coords.longitude };
      } catch { /* location optional: session starts without it */ }
      const r = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...geo }) });
      let j: any = null;
      try { j = await r.json(); } catch { throw new Error(`bad_response_${r.status}`); }
      if (!r.ok) throw new Error(j?.error ? String(j.error) : `http_${r.status}`);
      if (!j.id) throw new Error("no_session_id");
      location.href = `/professor/session/${j.id}`;
    } catch (e: any) {
      console.error("start session failed", e);
      setErr(e?.message ?? "error");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">{t.professor}</h1>
        <Link href="/professor/reports"><Button variant="outline"><FileBarChart size={18} strokeWidth={2} /> {t.reports}</Button></Link>
      </div>

      <section className="mt-5 border-t-2 border-ink/15 pt-5 dark:border-white/20" aria-label={t.startSession}>
        <h2 className="font-display text-xl font-bold">{t.startSession}</h2>
        <div className="mt-3 grid gap-3">
          <div><Label>{t.course}</Label>
            <Select value={form.course_id} onChange={e => { setErr(""); setForm({ ...form, course_id: e.target.value }); }}>
              <option value="">—</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t.duration}</Label><Input type="number" min={5} max={480} value={form.duration_min} onChange={e => setForm({ ...form, duration_min: Number(e.target.value) })} /></div>
            <div><Label>{t.radius}</Label><Input type="number" min={0} max={5000} value={form.geofence_radius_m} onChange={e => setForm({ ...form, geofence_radius_m: Number(e.target.value) })} /></div>
          </div>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={form.geofence_enabled} onChange={e => setForm({ ...form, geofence_enabled: e.target.checked })} />
            <span className="font-medium">{t.useGeofence}</span>
          </label>
          <FieldError msg={err} />
          <Button className="!min-h-[56px] !text-lg" onClick={start} disabled={busy}><Play size={20} strokeWidth={2} /> {busy ? "…" : t.startSession}</Button>
        </div>
      </section>

      <section className="mt-8" aria-label={t.recentSessions}>
        <h2 className="font-display text-xl font-bold">{t.recentSessions}</h2>
        <div className="mt-3">
          {loading ? <DataTable><tbody><SkeletonRows rows={4} cols={3} /></tbody></DataTable> : (
            <DataTable>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                    <td className="px-4 py-3">
                      <Link href={`/professor/session/${s.id}`} className="tnum font-display font-semibold text-register underline-offset-4 hover:underline">
                        {s.courses?.code}
                      </Link>
                      <div className="text-sm text-neutral-500">{s.courses?.name_ar}</div>
                    </td>
                    <td className="tnum px-4 py-3 text-neutral-500">{new Date(s.starts_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-end"><StatusPill status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      </section>
    </main>
  );
}
