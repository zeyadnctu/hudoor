"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";
import { Upload, History } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  day: string; start: string; end: string; course: string; professor: string;
  room: string; section: string; group: string; confidence: number; raw: string;
  course_id?: string; professor_id?: string; room_id?: string; semester_id?: string;
  newCourse?: string; newRoom?: string;
};
type Sug = { course: any[]; professor: any[]; room: any[] };

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAYN: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export default function ImportPage() {
  const { t } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [sugs, setSugs] = useState<Sug[]>([]);
  const [method, setMethod] = useState("");
  const [sems, setSems] = useState<any[]>([]);
  const [sem, setSem] = useState("");
  const [gen, setGen] = useState({ on: false, from: "", to: "" });
  const [versions, setVersions] = useState<any[]>([]);
  const [compare, setCompare] = useState<any>(null);
  const [rollback, setRollback] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadVersions() {
    const r = await fetch("/api/console/timetable-import?list=1");
    const j = await r.json();
    setVersions(j.rows ?? []);
    const s = await fetch("/api/console/semesters?perPage=100").then(x => x.json());
    setSems(s.rows ?? []);
    const cur = (s.rows ?? []).find((x: any) => x.is_current);
    if (cur) setSem(cur.id);
  }
  useEffect(() => { loadVersions(); }, []);

  async function upload() {
    if (!file) return;
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/console/timetable-import", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error); return; }
      setImportId(j.id);
      setRows(j.rows ?? []);
      setMethod(j.method ?? "");
      if (j.note) setMsg(j.note);
      const m = await fetch(`/api/console/timetable-import?match=1&id=${j.id}`).then(x => x.json());
      setSugs(m.suggestions ?? []);
    } finally { setBusy(false); }
  }

  function set(i: number, patch: Partial<Row>) {
    setRows(rs => rs.map((r, x) => x === i ? { ...r, ...patch } : r));
  }
  function resolve(i: number, kind: "course_id" | "professor_id" | "room_id", id: string) {
    set(i, { [kind]: id } as any);
  }

  async function commit() {
    setBusy(true); setMsg("");
    try {
      const payload = rows.map(r => ({
        day: DAYN[r.day.slice(0, 3).toLowerCase()] ?? Number(r.day),
        starts_at: r.start.slice(0, 5), ends_at: r.end.slice(0, 5),
        course_id: r.course_id, professor_id: r.professor_id || null, room_id: r.room_id || null,
        section: r.section || "A", group: r.group || "", semester_id: sem || null,
        newCourse: r.course_id ? undefined : r.newCourse || r.course,
        newRoom: r.room_id ? undefined : r.newRoom || r.room
      }));
      // create-new names first
      for (let i = 0; i < payload.length; i++) {
        const p: any = payload[i];
        if (!p.course_id && p.newCourse) {
          const code = p.newCourse.trim().split(/\s+/).slice(0, 2).join(" ").toUpperCase().slice(0, 12) || `IMP-${i}`;
          const cr = await fetch("/api/console/courses", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, name_ar: p.newCourse, name_en: p.newCourse, semester_id: sem || null, section: p.section })
          }).then(x => x.json());
          if (cr.row) { p.course_id = cr.row.id; set(i, { course_id: cr.row.id }); }
        }
        if (!p.room_id && p.newRoom) {
          const rr = await fetch("/api/console/rooms", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name_ar: p.newRoom, name_en: p.newRoom, capacity: 0, geofence_radius_m: 100 })
          }).then(x => x.json());
          if (rr.row) { p.room_id = rr.row.id; set(i, { room_id: rr.row.id }); }
        }
      }
      const missing = payload.filter((p: any) => !p.course_id || !p.semester_id);
      if (missing.length) { setMsg(`Resolve course + semester on every row (${missing.length} left)`); return; }
      const r = await fetch("/api/console/timetable-import", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: importId, rows: payload,
          generate: gen.on, from: gen.from || undefined, to: gen.to || undefined
        })
      });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error); return; }
      setMsg(`✓ slots ${j.slots}, clashes ${j.clashes.length}, sessions ${j.generated}`);
      loadVersions();
    } finally { setBusy(false); }
  }

  async function doRollback() {
    if (!rollback) return;
    await fetch(`/api/console/timetable-import?id=${rollback.id}`, { method: "DELETE" });
    setRollback(null);
    loadVersions();
  }
  async function diff(v: any) {
    const r = await fetch(`/api/console/timetable-import?id=${v.id}`).then(x => x.json());
    setCompare(r.row);
  }

  const low = rows.filter(r => r.confidence < 0.6).length;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.importPdf}</h1>

      <div className="mt-3 rounded-md2 border border-black/10 p-4 dark:border-white/15">
        <Label>{t.uploadPdf} (PDF, ≤15MB)</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          <Input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <Button disabled={!file || busy} onClick={upload}><Upload size={18} strokeWidth={2} /> {t.extractFirst}</Button>
        </div>
        {method && <p className="tnum mt-2 text-sm text-neutral-500" dir="auto">method: {method} · rows: {rows.length} · uncertain: {low}</p>}
        {msg && <p className="mt-2 text-sm font-semibold" role="status" dir="auto">{msg}</p>}
      </div>

      {rows.length > 0 && (
        <div className="mt-4">
          <h2 className="font-display text-xl font-bold">{t.reviewScreen}</h2>
          <p className="text-sm text-neutral-500">Nothing is saved until you press {t.commitSlots}.</p>
          <div className="mt-2 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
            <table className="w-full min-w-[900px] border-collapse text-start text-sm">
              <thead className="sticky top-0 bg-chalk dark:bg-ink">
                <tr className="border-b-2 border-black/15 dark:border-white/20">
                  {["day", "start", "end", "course", "professor", "room", "sec", "grp", "conf"].map(h => (
                    <th key={h} className="px-2 py-2 text-start font-display text-xs font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const bad = r.confidence < 0.6;
                  return (
                    <tr key={i} className={cn("border-b border-black/10 align-top last:border-0 dark:border-white/10", bad && "bg-hi-light/40 dark:bg-hi/10")}>
                      <td className="px-2 py-1.5">
                        <Select value={r.day} onChange={e => set(i, { day: e.target.value })}>
                          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </Select>
                      </td>
                      <td className="px-2 py-1.5"><Input type="time" value={r.start} onChange={e => set(i, { start: e.target.value })} /></td>
                      <td className="px-2 py-1.5"><Input type="time" value={r.end} onChange={e => set(i, { end: e.target.value })} /></td>
                      <td className="px-2 py-1.5">
                        <Select value={r.course_id ?? ""} onChange={e => resolve(i, "course_id", e.target.value)}>
                          <option value="">— {r.course.slice(0, 24)}</option>
                          {(sugs[i]?.course ?? []).map((c: any) => <option key={c.item.id} value={c.item.id}>✓ {c.item.code} ({Math.round(c.score * 100)}%)</option>)}
                        </Select>
                        {!r.course_id && <Input value={r.newCourse ?? ""} onChange={e => set(i, { newCourse: e.target.value })} placeholder="create new…" dir="auto" />}
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={r.professor_id ?? ""} onChange={e => resolve(i, "professor_id", e.target.value)}>
                          <option value="">— {r.professor.slice(0, 20)}</option>
                          {(sugs[i]?.professor ?? []).map((c: any) => <option key={c.item.id} value={c.item.id}>✓ {(c.item.email ?? "").slice(0, 22)} ({Math.round(c.score * 100)}%)</option>)}
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={r.room_id ?? ""} onChange={e => resolve(i, "room_id", e.target.value)}>
                          <option value="">— {r.room.slice(0, 20)}</option>
                          {(sugs[i]?.room ?? []).map((c: any) => <option key={c.item.id} value={c.item.id}>✓ {c.item.name_ar} ({Math.round(c.score * 100)}%)</option>)}
                        </Select>
                        {!r.room_id && <Input value={r.newRoom ?? ""} onChange={e => set(i, { newRoom: e.target.value })} placeholder="create new…" dir="auto" />}
                      </td>
                      <td className="px-2 py-1.5"><Input value={r.section} onChange={e => set(i, { section: e.target.value })} /></td>
                      <td className="px-2 py-1.5"><Input value={r.group} onChange={e => set(i, { group: e.target.value })} /></td>
                      <td className={cn("tnum px-2 py-1.5 font-bold", bad ? "text-hi-dark dark:text-amber-300" : "text-stamp-dark dark:text-emerald-300")}>
                        {Math.round(r.confidence * 100)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-2 rounded-md2 border border-black/10 p-3 sm:grid-cols-4 dark:border-white/15">
            <div><Label>{t.semesters}</Label>
              <Select value={sem} onChange={e => setSem(e.target.value)}>
                <option value="">—</option>{sems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <label className="flex min-h-[48px] items-end gap-2 pb-2">
              <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={gen.on} onChange={e => setGen({ ...gen, on: e.target.checked })} />
              <span className="font-semibold">{t.generateSessions}</span>
            </label>
            <div><Label>{t.from}</Label><Input type="date" value={gen.from} onChange={e => setGen({ ...gen, from: e.target.value })} /></div>
            <div><Label>{t.to}</Label><Input type="date" value={gen.to} onChange={e => setGen({ ...gen, to: e.target.value })} /></div>
          </div>
          <Button className="mt-3 w-full !min-h-[56px] !text-lg" disabled={busy || !sem} onClick={commit}>{t.commitSlots}</Button>
        </div>
      )}

      <div className="mt-8 border-t-2 border-ink/15 pt-4 dark:border-white/20">
        <h2 className="font-display flex items-center gap-2 text-xl font-bold"><History size={20} strokeWidth={2} /> {t.versions}</h2>
        <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {versions.map((v: any) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span dir="auto" className="font-medium">{v.filename}</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold dark:bg-white/10">{v.status}</span>
                <span className="tnum text-xs text-neutral-500">{new Date(v.created_at).toLocaleString()}</span>
                <button onClick={() => diff(v)} className="min-h-[40px] rounded px-2 font-bold text-register hover:underline">diff</button>
                {v.status === "committed" && <button onClick={() => setRollback(v)} className="min-h-[40px] rounded px-2 font-bold text-brick hover:underline">{t.rollback}</button>}
              </span>
            </div>
          ))}
          {versions.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        </div>
        {compare && (
          <pre className="tnum mt-2 max-h-64 overflow-auto rounded-md2 border border-black/10 p-3 text-xs dark:border-white/15" dir="auto">
            {JSON.stringify(compare.report ?? compare, null, 2)}
          </pre>
        )}
      </div>

      <ConfirmDialog
        open={!!rollback}
        title={`${t.rollback}?`}
        impact={`Slots created by ${rollback?.filename} will be moved to Trash.`}
        confirmLabel={t.rollback}
        onCancel={() => setRollback(null)}
        onConfirm={doRollback}
      />
    </div>
  );
}
