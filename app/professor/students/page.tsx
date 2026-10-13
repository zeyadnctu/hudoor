"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase";
import { Megaphone } from "lucide-react";

export default function ProfStudentsPage() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [course, setCourse] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sel, setSel] = useState<any>(null);
  const [hist, setHist] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [note, setNote] = useState({ kind: "note", text: "" });
  const [msg, setMsg] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");

  async function loadCourses() {
    const sb = browserSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: cp } = await sb.from("course_professors").select("course_id,courses(id,code,name_ar)").eq("professor_id", user.id);
    const cs = ((cp ?? []) as any[]).map(x => x.courses);
    setCourses(cs);
    if (cs[0] && !course) setCourse(cs[0].id);
  }
  useEffect(() => { loadCourses(); /* eslint-disable-next-line */ }, []);

  async function loadRoster(cid: string) {
    const sb = browserSupabase();
    const { data: enr } = await sb.from("enrollments").select("student_id,section").eq("course_id", cid);
    const sids = ((enr ?? []) as any[]).map(e => e.student_id);
    let det: Record<string, any> = {};
    if (sids.length) {
      const { data: d } = await sb.from("student_details").select("user_id,full_name_ar,university_id").in("user_id", sids);
      for (const r of (d ?? []) as any[]) det[r.user_id] = r;
    }
    const { data: sess } = await sb.from("attendance_sessions").select("id").eq("course_id", cid);
    const sids2 = ((sess ?? []) as any[]).map(s => s.id);
    setTotalSessions(sids2.length);
    let rec: Record<string, { p: number; l: number; a: number }> = {};
    if (sids2.length) {
      const { data: r } = await sb.from("attendance_records").select("student_id,status").in("session_id", sids2);
      for (const x of (r ?? []) as any[]) {
        const e = rec[x.student_id] ?? { p: 0, l: 0, a: 0 };
        if (x.status === "present") e.p++;
        else if (x.status === "late") e.l++;
        else e.a++;
        rec[x.student_id] = e;
      }
    }
    setRows(((enr ?? []) as any[]).map(e => {
      const r = rec[e.student_id] ?? { p: 0, l: 0, a: 0 };
      const pct = sids2.length ? Math.round(((r.p + r.l * 0.5) / sids2.length) * 100) : 0;
      return { ...e, d: det[e.student_id], ...r, pct };
    }).sort((a, b) => a.pct - b.pct));
  }
  useEffect(() => { if (course) loadRoster(course); /* eslint-disable-next-line */ }, [course]);

  async function openStudent(r: any) {
    setSel(r); setHist([]); setNotes([]);
    const sb = browserSupabase();
    const { data: sess } = await sb.from("attendance_sessions").select("id,starts_at").eq("course_id", course);
    const ids = ((sess ?? []) as any[]).map(s => s.id);
    if (ids.length) {
      const { data: h } = await sb.from("attendance_records").select("status,scanned_at,method,session_id").eq("student_id", r.student_id).in("session_id", ids).order("scanned_at", { ascending: false });
      setHist((h ?? []) as any[]);
    }
    const { data: n } = await sb.from("instructor_notes").select("*").eq("student_id", r.student_id).eq("course_id", course).order("created_at", { ascending: false });
    setNotes((n ?? []) as any[]);
  }
  async function addNote() {
    if (note.text.trim().length < 2 || !sel) return;
    const sb = browserSupabase();
    const { data: { user } } = await sb.auth.getUser();
    await sb.from("instructor_notes").insert({ professor_id: user!.id, student_id: sel.student_id, course_id: course, kind: note.kind, note: note.text.trim() });
    setNote({ kind: "note", text: "" });
    openStudent(sel);
  }
  async function warn() {
    if (!sel) return;
    const r = await fetch("/api/console/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title_ar: "تنبيه حضور", title_en: "Attendance warning",
        body_ar: `نسبة حضورك ${sel.pct}%. راجع الأستاذ.`, body_en: `Your attendance is ${sel.pct}%. See your instructor.`,
        audience: { roles: [], course_ids: [course], department_ids: [], sections: [] }
      })
    });
    setMsg(r.ok ? `✓ ${t.createdOk}` : "error");
    if (r.ok) {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      await sb.from("instructor_notes").insert({ professor_id: user!.id, student_id: sel.student_id, course_id: course, kind: "warning", note: `warned at ${sel.pct}%` });
      openStudent(sel);
    }
  }
  async function messageAbsent() {
    if (!bulkMsg.trim()) return;
    const r = await fetch("/api/console/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title_ar: "تنبيه غياب", title_en: "Absence notice", body_ar: bulkMsg, body_en: bulkMsg,
        audience: { roles: [], course_ids: [course], department_ids: [], sections: [] }
      })
    });
    setMsg(r.ok ? `✓ ${t.createdOk}` : "error");
    if (r.ok) setBulkMsg("");
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-6">
      <h1 className="font-display text-3xl font-bold">{t.myStudents}</h1>
      <div className="mt-3 max-w-sm"><Label>{t.course}</Label>
        <Select value={course} onChange={e => setCourse(e.target.value)}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
        </Select>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}

      <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
        {rows.map(r => (
          <button key={r.student_id} onClick={() => openStudent(r)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-start text-[15px] hover:bg-black/[0.03] dark:hover:bg-white/5">
            <span className="font-medium" dir="auto">{r.d?.full_name_ar ?? r.student_id.slice(0, 8)} <span className="tnum text-sm text-neutral-500">{r.d?.university_id}</span></span>
            <span className={`tnum font-display text-lg font-bold ${r.pct < 75 && totalSessions >= 3 ? "text-hi-dark dark:text-amber-300" : "text-stamp-dark dark:text-emerald-300"}`}>{r.pct}%</span>
          </button>
        ))}
        {rows.length === 0 && <p className="p-4 text-neutral-500">—</p>}
      </div>

      <div className="mt-4 rounded-md2 border border-black/10 p-3 dark:border-white/15">
        <h2 className="font-display flex items-center gap-2 font-bold"><Megaphone size={18} strokeWidth={2} /> {t.messageAbsent}</h2>
        <div className="mt-2 flex gap-2">
          <Input value={bulkMsg} onChange={e => setBulkMsg(e.target.value)} placeholder="…" dir="auto" />
          <Button onClick={messageAbsent}>{t.postUpdate}</Button>
        </div>
      </div>

      {sel && (
        <div className="fixed inset-y-0 end-0 z-40 w-full max-w-md overflow-auto border-s-2 border-ink/15 bg-paper p-5 shadow-2xl dark:border-white/20 dark:bg-inksurface" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold" dir="auto">{sel.d?.full_name_ar}</h2>
            <button onClick={() => setSel(null)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-md2 hover:bg-black/5">✕</button>
          </div>
          <p className="tnum text-5xl font-bold font-display mt-2">{sel.pct}<span className="text-xl">%</span></p>
          <p className="text-sm text-neutral-500">{sel.p} present · {sel.l} late · {sel.a} other / {totalSessions}</p>
          <div className="mt-3">
            <p className="font-bold">{t.recentScans}</p>
            {hist.slice(0, 10).map((h: any, i: number) => (
              <p key={i} className="tnum border-b border-black/10 py-1.5 text-sm last:border-0 dark:border-white/10" dir="auto">
                {new Date(h.scanned_at).toLocaleString()} — {h.status} ({h.method})
              </p>
            ))}
            {hist.length === 0 && <p className="text-sm text-neutral-500">—</p>}
          </div>
          <div className="mt-3">
            <p className="font-bold">{t.notes} ({t.privateNote})</p>
            {notes.map((n: any) => (
              <p key={n.id} className="border-b border-black/10 py-1.5 text-sm last:border-0 dark:border-white/10" dir="auto">
                <b>[{n.kind}]</b> {n.note}
              </p>
            ))}
            <div className="mt-2 grid gap-2">
              <Select value={note.kind} onChange={e => setNote({ ...note, kind: e.target.value })}>
                <option value="note">note</option>
                <option value="warning">warning</option>
              </Select>
              <Input value={note.text} onChange={e => setNote({ ...note, text: e.target.value })} dir="auto" />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={addNote}>{t.save}</Button>
                <Button variant="outline" className="flex-1" onClick={warn}>{t.warnStudent}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
