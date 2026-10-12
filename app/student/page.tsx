"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, StatusPill, EmptyState, SkeletonRows, DataTable } from "@/components/ui";
import { getOrCreateDeviceId } from "@/lib/device";
import { ScanLine, BookOpen, CalendarDays, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

type Course = { id: string; code: string; name_en: string; name_ar: string };

export default function StudentHome() {
  const { t } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [today, setToday] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

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
    })();
  }, []);

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
                    <td className="px-4 py-2.5 text-end"><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <a href="/api/reports/export" className="mt-3 block"><Button variant="outline" className="w-full">{t.exportCsv}</Button></a>
      </section>
    </main>
  );
}
