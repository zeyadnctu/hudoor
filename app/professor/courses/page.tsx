"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Label } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase";
import { participation } from "@/lib/settings";

export default function ProfCoursesPage() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [sel, setSel] = useState("");
  const [roster, setRoster] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [rules, setRules] = useState<any>({});
  const [post, setPost] = useState({ title_ar: "", body_ar: "" });
  const [msg, setMsg] = useState("");

  async function loadCourses() {
    const sb = browserSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: cp } = await sb.from("course_professors").select("course_id,courses(id,code,name_ar,name_en,section,attendance_rule)").eq("professor_id", user.id);
    const cs = ((cp ?? []) as any[]).map(x => x.courses);
    setCourses(cs);
    if (cs[0] && !sel) setSel(cs[0].id);
  }
  useEffect(() => { loadCourses(); /* eslint-disable-next-line */ }, []);

  async function loadRoster(courseId: string) {
    const sb = browserSupabase();
    const { data: enr } = await sb.from("enrollments").select("student_id,section").eq("course_id", courseId);
    const sids = ((enr ?? []) as any[]).map(e => e.student_id);
    let det: Record<string, any> = {};
    if (sids.length) {
      const { data: d } = await sb.from("student_details").select("user_id,full_name_ar,university_id,section_group").in("user_id", sids);
      for (const r of (d ?? []) as any[]) det[r.user_id] = r;
    }
    const { data: sess } = await sb.from("attendance_sessions").select("id").eq("course_id", courseId);
    const sessIds = ((sess ?? []) as any[]).map(s => s.id);
    let rec: Record<string, { p: number; l: number }> = {};
    if (sessIds.length) {
      const { data: r } = await sb.from("attendance_records").select("student_id,status").in("session_id", sessIds);
      for (const x of (r ?? []) as any[]) {
        const e = rec[x.student_id] ?? { p: 0, l: 0 };
        if (x.status === "present") e.p++;
        if (x.status === "late") e.l++;
        rec[x.student_id] = e;
      }
    }
    const course = courses.find(c => c.id === courseId);
    const minPct = Number(course?.attendance_rule?.min_pct ?? 75);
    const rows = ((enr ?? []) as any[]).map(e => {
      const r = rec[e.student_id] ?? { p: 0, l: 0 };
      const pct = sessIds.length ? Math.round(((r.p + r.l * 0.5) / sessIds.length) * 100) : 0;
      return { ...e, d: det[e.student_id], pct, low: sessIds.length >= 3 && pct < minPct };
    });
    setRoster(rows);
    const bySec: Record<string, { n: number; sum: number }> = {};
    for (const r of rows) {
      const k = r.section || r.d?.section_group || "A";
      bySec[k] = bySec[k] ?? { n: 0, sum: 0 };
      bySec[k].n++; bySec[k].sum += r.pct;
    }
    setStats({ total: rows.length, sessions: sessIds.length, bySec, participation: rows.map(r => ({ id: r.student_id, score: participation(r.pct, 0, 100) })) });
    setRules(course?.attendance_rule ?? {});
  }
  useEffect(() => { if (sel) loadRoster(sel); /* eslint-disable-next-line */ }, [sel, courses]);

  async function saveRules() {
    const r = await fetch("/api/console/course-staff", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: sel, attendance_rule: rules })
    });
    setMsg(r.ok ? `✓ ${t.createdOk}` : "error");
    if (r.ok) loadCourses();
  }
  async function sendPost() {
    if (!post.title_ar || !post.body_ar) return;
    const r = await fetch("/api/console/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...post, title_en: post.title_ar, body_en: post.body_ar, audience: { roles: [], course_ids: [sel], department_ids: [], sections: [] } })
    });
    if (r.ok) { setPost({ title_ar: "", body_ar: "" }); setMsg(`✓ ${t.createdOk}`); }
    else setMsg("error");
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-6">
      <h1 className="font-display text-3xl font-bold">{t.myCourses}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {courses.map(c => (
          <button key={c.id} onClick={() => setSel(c.id)}
            className={`tnum min-h-[48px] rounded-md2 border-2 px-4 font-bold ${sel === c.id ? "border-register bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200" : "border-black/15 dark:border-white/20"}`}>
            {c.code}
          </button>
        ))}
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}

      <section className="mt-5" aria-label={t.roster}>
        <h2 className="font-display text-xl font-bold">{t.roster} ({roster.length})</h2>
        {stats && (
          <p className="tnum mt-1 text-sm text-neutral-500">
            {t.bySection}: {Object.entries(stats.bySec).map(([k, v]: any) => `${k}: ${v.n} (${Math.round(v.sum / Math.max(1, v.n))}%)`).join(" · ")}
          </p>
        )}
        <div className="mt-2 max-h-[40vh] divide-y divide-black/10 overflow-auto rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {roster.map(r => (
            <div key={r.student_id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[15px]">
              <span className="font-medium" dir="auto">{r.d?.full_name_ar ?? r.student_id.slice(0, 8)} <span className="tnum text-sm text-neutral-500">{r.d?.university_id} · {r.section}</span></span>
              <span className={`tnum font-display text-lg font-bold ${r.low ? "text-hi-dark dark:text-amber-300" : "text-stamp-dark dark:text-emerald-300"}`}>{r.pct}%</span>
            </div>
          ))}
          {roster.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        </div>
      </section>

      <section className="mt-6 border-t-2 border-ink/15 pt-4 dark:border-white/20" aria-label={t.rules}>
        <h2 className="font-display text-xl font-bold">{t.rules}</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div><Label>{t.minPct}</Label><Input type="number" value={rules.min_pct ?? ""} onChange={e => setRules({ ...rules, min_pct: Number(e.target.value) })} placeholder="75" /></div>
          <div><Label>{t.lateMin}</Label><Input type="number" value={rules.late_after_min ?? ""} onChange={e => setRules({ ...rules, late_after_min: Number(e.target.value) })} placeholder="20" /></div>
        </div>
        <label className="mt-2 flex min-h-[48px] cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={rules.allow_late_scanning !== false} onChange={e => setRules({ ...rules, allow_late_scanning: e.target.checked })} />
          <span className="font-medium">{t.allowLate}</span>
        </label>
        <Button className="mt-2" onClick={saveRules}>{t.save}</Button>
      </section>

      <section className="mt-6 border-t-2 border-ink/15 pt-4 dark:border-white/20" aria-label={t.materials}>
        <h2 className="font-display text-xl font-bold">{t.materials}</h2>
        <div className="mt-2 grid gap-2">
          <div><Label>{t.announceTitle}</Label><Input value={post.title_ar} onChange={e => setPost({ ...post, title_ar: e.target.value })} dir="auto" /></div>
          <div><Label>{t.announceBody}</Label>
            <textarea value={post.body_ar} onChange={e => setPost({ ...post, body_ar: e.target.value })} rows={3} dir="auto"
              className="min-h-[72px] w-full rounded-md2 border-2 border-black/15 bg-paper px-3 py-2 outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
          </div>
          <Button onClick={sendPost}>{t.postUpdate}</Button>
        </div>
      </section>
    </main>
  );
}
