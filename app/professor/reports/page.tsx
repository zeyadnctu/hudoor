"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label, StatusPill } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase";
import { participation } from "@/lib/settings";
import { FileDown, Printer, BookmarkPlus } from "lucide-react";

export default function ProfReportsPage() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [f, setF] = useState({ course_id: "", from: "", to: "", status: "" });
  const [rows, setRows] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [presetName, setPresetName] = useState("");
  const [lateW, setLateW] = useState(0.5);

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: cp } = await sb.from("course_professors").select("course_id,courses(id,code,name_ar)").eq("professor_id", user.id);
      const cs = ((cp ?? []) as any[]).map(x => x.courses);
      setCourses(cs);
      if (cs[0]) setF(s => ({ ...s, course_id: s.course_id || cs[0].id }));
      const { data: pr } = await sb.from("report_presets").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      setPresets((pr ?? []) as any[]);
    })();
  }, []);

  async function load() {
    const q = new URLSearchParams({ perPage: "500", ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
    const r = await fetch(`/api/console/attendance?${q}`);
    const j = await r.json();
    if (r.ok) setRows(j.rows ?? []);
  }
  useEffect(() => { if (f.course_id) load(); /* eslint-disable-next-line */ }, [f.course_id, f.status, f.from, f.to]);

  async function savePreset() {
    if (!presetName.trim()) return;
    const sb = browserSupabase();
    const { data: { user } } = await sb.auth.getUser();
    await sb.from("report_presets").insert({ owner_id: user!.id, name: presetName.trim(), filters: f });
    setPresetName("");
    const { data: pr } = await sb.from("report_presets").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
    setPresets((pr ?? []) as any[]);
  }

  const byStudent = new Map<string, { p: number; l: number; name: string }>();
  for (const r of rows) {
    const e = byStudent.get(r.student_id) ?? { p: 0, l: 0, name: r.who?.full_name_ar ?? r.student_id.slice(0, 8) };
    if (r.status === "present") e.p++;
    else if (r.status === "late") e.l++;
    byStudent.set(r.student_id, e);
  }
  const sessions = new Set(rows.map(r => r.session_id)).size || 1;
  const table = [...byStudent.entries()].map(([id, v]) => ({
    id, ...v, score: participation(v.p, v.l, sessions, { lateWeight: lateW })
  })).sort((a, b) => b.score - a.score);

  const csvUrl = `/api/reports/export?course_id=${f.course_id}&from=${f.from}&to=${f.to}&status=${f.status}`;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-6 print:max-w-none">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <h1 className="font-display text-3xl font-bold">{t.myReports}</h1>
        <div className="flex gap-2">
          <a href={csvUrl}><Button variant="outline"><FileDown size={18} strokeWidth={2} /> CSV</Button></a>
          <Button variant="outline" onClick={() => window.print()}><Printer size={18} strokeWidth={2} /> PDF</Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 print:hidden">
        <div><Label>{t.course}</Label>
          <Select value={f.course_id} onChange={e => setF({ ...f, course_id: e.target.value })}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </Select>
        </div>
        <div><Label>{t.from}</Label><Input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
        <div><Label>{t.to}</Label><Input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
        <div><Label>{t.status}</Label>
          <Select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
            <option value="">{t.all}</option>
            <option value="present">present</option><option value="late">late</option>
            <option value="absent">absent</option><option value="excused">excused</option>
          </Select>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button key={p.id} onClick={() => setF({ course_id: "", from: "", to: "", status: "", ...(p.filters ?? {}) })}
              className="min-h-[40px] rounded-full border border-black/15 px-3 text-sm font-semibold dark:border-white/20">
              {(p as any).name}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2">
          <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder={t.presets} />
          <Button variant="outline" onClick={savePreset}><BookmarkPlus size={18} strokeWidth={2} /> {t.savePreset}</Button>
        </div>
      </div>

      <h2 className="font-display mt-5 text-xl font-bold">{t.participationScore} (late × {lateW})</h2>
      <div className="mt-1 flex max-w-xs items-center gap-2 print:hidden">
        <Label>late weight</Label>
        <Input type="number" min={0} max={1} step={0.1} value={lateW} onChange={e => setLateW(Number(e.target.value))} />
      </div>
      <div className="mt-2 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
        <table className="w-full border-collapse text-start text-[15px]">
          <thead className="sticky top-0 bg-chalk dark:bg-ink">
            <tr className="border-b-2 border-black/15 dark:border-white/20">
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.name}</th>
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">P / L</th>
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.participationScore}</th>
            </tr>
          </thead>
          <tbody>
            {table.map(r => (
              <tr key={r.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                <td className="px-4 py-2.5 font-medium" dir="auto">{r.name}</td>
                <td className="tnum px-4 py-2.5">{r.p} / {r.l} / {sessions}</td>
                <td className="tnum px-4 py-2.5 font-display text-lg font-bold">{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {table.length === 0 && <p className="p-6 text-center text-neutral-500">—</p>}
      </div>

      <h2 className="font-display mt-5 text-xl font-bold">{t.recentScans}</h2>
      <div className="mt-2 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
        <table className="w-full border-collapse text-start text-[15px]">
          <tbody>
            {rows.slice(0, 100).map(r => (
              <tr key={r.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                <td className="px-4 py-2.5 font-medium" dir="auto">{r.who?.full_name_ar ?? r.student_id.slice(0, 8)}</td>
                <td className="tnum whitespace-nowrap px-4 py-2.5">{new Date(r.scanned_at).toLocaleString()}</td>
                <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
