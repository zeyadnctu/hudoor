"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, StatusPill, EmptyState, SkeletonRows, DataTable } from "@/components/ui";
import { getOrCreateDeviceId } from "@/lib/device";
import { ScanLine, BookOpen, CalendarDays, ClipboardList, Megaphone, FileText, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

type Course = { id: string; code: string; name_en: string; name_ar: string };

export default function StudentHome() {
  const { t } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [today, setToday] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [disputed, setDisputed] = useState<Set<string>>(new Set());
  const [excuses, setExcuses] = useState<any[]>([]);
  const [showExcuse, setShowExcuse] = useState(false);
  const [excForm, setExcForm] = useState({ course_id: "", reason: "" });
  const [flash, setFlash] = useState("");

  useEffect(() => { getOrCreateDeviceId(); }, []);
  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: enr } = await sb.from("enrollments").select("course_id, courses(id,code,name_en,name_ar)").eq("student_id", user.id);
      const cs = ((enr ?? []).map((e: any) => e.courses) as Course[]);
      setCourses(cs);
      const { data: rec } = await sb.from("attendance_records").select("id,status,scanned_at,method,attendance_sessions(course_id)").eq("student_id", user.id).order("scanned_at", { ascending: false }).limit(100);
      setRecords(rec ?? []);
      if (cs.length) {
        const ids = cs.map(c => c.id);
        const { data: sess } = await sb.from("attendance_sessions").select("id,course_id,status,starts_at,courses(code,name_ar,name_en)").in("course_id", ids).order("starts_at", { ascending: false }).limit(100);
        const counts: Record<string, number> = {};
        (sess ?? []).forEach((s: any) => { counts[s.course_id] = (counts[s.course_id] ?? 0) + 1; });
        setTotals(counts);
        const day = new Date().toISOString().slice(0, 10);
        setToday(((sess ?? []) as any[]).filter(s => s.status === "active" || (s.starts_at ?? "").slice(0, 10) === day).slice(0, 5));
      }
      setLoading(false);
      const [an, dp, ex] = await Promise.all([
        fetch("/api/console/notifications").then(r => r.json()).catch(() => ({ rows: [] })),
        fetch("/api/console/disputes").then(r => r.json()).catch(() => ({ rows: [] })),
        fetch("/api/console/excuses").then(r => r.json()).catch(() => ({ rows: [] }))
      ]);
      setNotes((an.rows ?? []).slice(0, 5));
      setDisputed(new Set(((dp.rows ?? []) as any[]).filter(d => d.status === "pending").map(d => d.record_id)));
      setExcuses(ex.rows ?? []);
    })();
  }, []);

  async function contest(recordId: string) {
    const reason = prompt(t.contestHint);
    if (!reason || reason.trim().length < 5) return;
    const r = await fetch("/api/console/disputes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: recordId, reason: reason.trim() })
    });
    if (r.ok) setDisputed(s => new Set(s).add(recordId));
    else setFlash("error");
  }
  async function sendExcuse() {
    if (!excForm.course_id || excForm.reason.trim().length < 5) return;
    const r = await fetch("/api/console/excuses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(excForm)
    });
    if (r.ok) {
      setShowExcuse(false);
      setExcForm({ course_id: "", reason: "" });
      const ex = await fetch("/api/console/excuses").then(x => x.json()).catch(() => ({ rows: [] }));
      setExcuses(ex.rows ?? []);
    }
  }
  async function requestDeviceReset() {
    const r = await fetch("/api/console/service", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "device_reset", payload: {} })
    });
    setFlash(r.ok ? `✓ ${t.createdOk}` : "error");
  }

  function pct(courseId: string) {
    const total = totals[courseId] ?? 0;
    const mine = new Set(
      records.filter(r => (r.attendance_sessions as any)?.course_id === courseId && (r.status === "present" || r.status === "late")).map(r => r.id)
    ).size;
    return { mine, total, p: total === 0 ? 0 : Math.round((mine / total) * 100) };
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-10 pt-5">
      {/* the one dominant action */}
      <Link href="/student/scan-in-app" className="mt-4 block">
        <span className="flex min-h-[72px] items-center justify-center gap-3 rounded-lg2 bg-register text-xl font-bold text-white transition-colors hover:bg-register-dark">
          <ScanLine size={28} strokeWidth={2} /> {t.scanToAttend}
        </span>
      </Link>
      <p className="mt-2 text-center text-sm text-neutral-500">{t.scanHint}</p>
      {flash && <p className="mt-2 text-center text-sm font-semibold" role="status">{flash}</p>}

      {notes.length > 0 && (
        <section className="mt-5" aria-label={t.announcementsFeed}>
          <h2 className="font-display flex items-center gap-2 text-xl font-bold"><Megaphone size={20} strokeWidth={2} /> {t.announcementsFeed}</h2>
          <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
            {notes.map((a: any) => (
              <div key={a.id} className="px-4 py-2.5">
                <p className="font-bold" dir="auto">{a.title_ar}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300" dir="auto">{a.body_ar}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* today's sessions */}
      <section className="mt-7" aria-label={t.todaySessions}>
        <h2 className="font-display flex items-center gap-2 text-xl font-bold"><CalendarDays size={20} strokeWidth={2} /> {t.todaySessions}</h2>
        <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {loading && <div className="p-4"><div className="skeleton h-5 w-2/3 rounded bg-black/10 dark:bg-white/15" /><div className="skeleton mt-2 h-5 w-1/2 rounded bg-black/10 dark:bg-white/15" /></div>}
          {!loading && today.length === 0 && (
            <div className="p-4 text-neutral-500"><p className="font-semibold">{t.noSessionsToday}</p><p className="text-sm">{t.noSessionsHint}</p></div>
          )}
          {today.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="tnum font-display font-semibold">{s.courses?.code}</div>
                <div className="text-sm text-neutral-500">{s.courses?.name_ar}</div>
              </div>
              <StatusPill status={s.status} />
            </div>
          ))}
        </div>
      </section>

      {/* courses with plain percentage bars */}
      <section className="mt-7" aria-label={t.myCourses}>
        <h2 className="font-display flex items-center gap-2 text-xl font-bold"><BookOpen size={20} strokeWidth={2} /> {t.myCourses}</h2>
        <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {loading && <div className="p-4"><div className="skeleton h-5 w-1/2 rounded bg-black/10 dark:bg-white/15" /></div>}
          {!loading && courses.length === 0 && (
            <div className="p-4 text-neutral-500"><p className="font-semibold">{t.noEnroll}</p><p className="text-sm">{t.noEnrollHint}</p></div>
          )}
          {courses.map(c => {
            const s = pct(c.id);
            const low = s.total > 0 && s.p < 75;
            return (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold">{c.name_ar} <span className="tnum text-sm font-medium text-neutral-500">{c.code}</span></div>
                  <div className={cn("tnum font-display text-lg font-bold", low ? "text-hi-dark dark:text-amber-300" : "text-stamp-dark dark:text-emerald-300")}>
                    {s.total === 0 ? "—" : `${s.p}%`}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/15" role="progressbar" aria-valuenow={s.p} aria-valuemin={0} aria-valuemax={100}>
                  <div className={cn("h-full rounded-full", low ? "bg-hi" : "bg-stamp")} style={{ width: `${s.p}%` }} />
                </div>
                <p className="tnum mt-1 text-sm text-neutral-500">
                  {s.mine}/{s.total} {t.sessionsCount}
                  {low && <span className="font-semibold text-hi-dark dark:text-amber-300"> · {t.below75}</span>}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* history */}
      <section className="mt-7" aria-label={t.recentScans}>
        <h2 className="font-display flex items-center gap-2 text-xl font-bold"><ClipboardList size={20} strokeWidth={2} /> {t.recentScans}</h2>
        <div className="mt-2 overflow-hidden rounded-md2 border border-black/10 dark:border-white/15">
          {loading ? (
            <table className="w-full"><tbody><SkeletonRows rows={4} cols={2} /></tbody></table>
          ) : records.length === 0 ? (
            <EmptyState icon={<ClipboardList size={28} strokeWidth={1.75} />} title={t.nothingYet} hint={t.nothingYetHint} />
          ) : (
            <table className="w-full border-collapse text-start text-[15px]">
              <tbody>
                {records.slice(0, 8).map(r => (
                  <tr key={r.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                    <td className="tnum px-4 py-2.5">{new Date(r.scanned_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-end">
                      <StatusPill status={r.status} />
                      {(r.status === "absent" || r.status === "late") && !disputed.has(r.id) && (
                        <button onClick={() => contest(r.id)} className="ms-2 min-h-[40px] rounded text-sm font-semibold text-register hover:underline">{t.contest}</button>
                      )}
                      {disputed.has(r.id) && <span className="ms-2 text-xs text-neutral-500">…</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <a href="/api/reports/export" className="mt-3 block"><Button variant="outline" className="w-full">{t.exportCsv}</Button></a>
      </section>

      {/* excuses */}
      <section className="mt-7" aria-label={t.myExcuses}>
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold"><FileText size={20} strokeWidth={2} /> {t.myExcuses}</h2>
          <Button variant="outline" className="!min-h-[44px]" onClick={() => setShowExcuse(s => !s)}>{t.newExcuse}</Button>
        </div>
        {showExcuse && (
          <div className="mt-2 grid gap-2 rounded-md2 border border-black/10 p-3 dark:border-white/15">
            <select value={excForm.course_id} onChange={e => setExcForm({ ...excForm, course_id: e.target.value })}
              className="min-h-[48px] w-full rounded-md2 border-2 border-black/15 bg-paper px-4 outline-none focus:border-register dark:border-white/20 dark:bg-white/5">
              <option value="">— {t.course}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
            </select>
            <textarea value={excForm.reason} onChange={e => setExcForm({ ...excForm, reason: e.target.value })} rows={3} dir="auto" placeholder={t.contestHint}
              className="min-h-[72px] w-full rounded-md2 border-2 border-black/15 bg-paper px-3 py-2 outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
            <Button onClick={sendExcuse}>{t.save}</Button>
          </div>
        )}
        <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {excuses.slice(0, 5).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="font-medium" dir="auto">{e.reason.slice(0, 60)}</span>
              <StatusPill status={e.status === "pending" ? "late" : e.status === "approved" ? "present" : "absent"} />
            </div>
          ))}
          {excuses.length === 0 && <p className="p-4 text-sm text-neutral-500">—</p>}
        </div>
        <button onClick={requestDeviceReset} className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md2 border border-black/15 text-sm font-semibold dark:border-white/20">
          <Smartphone size={17} strokeWidth={2} /> {t.requestDeviceReset}
        </button>
      </section>
    </main>
  );
}
