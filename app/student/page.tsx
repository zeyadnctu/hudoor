"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getOrCreateDeviceId } from "@/lib/device";
import { tickSessions } from "@/lib/session-tick";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Megaphone,
  FileText,
  Smartphone,
  Flame,
  GraduationCap,
  Check
} from "lucide-react";
import { NextClassCard } from "@/components/hudoor/next-class-card";
import { NumberStat } from "@/components/hudoor/number-stat";
import { TimelineRow } from "@/components/hudoor/timeline-row";
import { CourseAttendanceCard } from "@/components/hudoor/course-attendance-card";
import { StatusPill } from "@/components/hudoor/status-pill";
import { EmptyState } from "@/components/hudoor/empty-state";
import { TimelineSkeleton, CardSkeleton } from "@/components/hudoor/skeletons";
import { LazyAnimatedList } from "@/components/hudoor/bits";
import { BottomSheet } from "@/components/hudoor/bottom-sheet";
import { toast } from "@/components/hudoor/toast";
import { CommandPalette } from "@/components/hudoor/command-palette";
import {
  summariseAttendance,
  type AttendanceSession,
  type AttendanceStatus,
  type AttendanceSummary,
  type SessionKind
} from "@/lib/attendance";

type Course = { id: string; code: string; name_en: string; name_ar: string; attendance_rule?: unknown };
type Sess = {
  id: string;
  course_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  room_id: string | null;
  timetable_slots?: { session_type: string | null } | null;
  courses?: any;
};

function kindOf(s: Sess): SessionKind {
  const k = s.timetable_slots?.session_type;
  return k === "lecture" || k === "section" ? k : "other";
}
/** What the session counts as right now: record wins, otherwise a finished session is absent. */
function finalStatus(s: Sess, rec: any, now: number): AttendanceStatus | null {
  if (s.status === "cancelled") return null;
  if (rec) return rec.status;
  return s.status === "ended" || +new Date(s.ends_at) <= now ? "absent" : null;
}

function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });
}
function fmtDur(mins: number, t: any) {
  if (mins < 60) return `${mins} ${t.minShort}`;
  return `${Math.floor(mins / 60)} ${t.hourShort} ${mins % 60 > 0 ? `${mins % 60} ${t.minShort}` : ""}`;
}

export default function StudentHome() {
  const { t, locale } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [rooms, setRooms] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<any>(null);
  const [programName, setProgramName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [disputed, setDisputed] = useState<Set<string>>(new Set());
  const [excuses, setExcuses] = useState<any[]>([]);
  const [showExcuse, setShowExcuse] = useState(false);
  const [excForm, setExcForm] = useState({ course_id: "", session_id: "", reason: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [userId, setUserId] = useState("");
  const [programCourses, setProgramCourses] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => { getOrCreateDeviceId(); tickSessions(); }, []);

  useEffect(() => {
    fetch("/api/student/courses").then(r => r.json()).then(j => {
      setProgramCourses(j.rows ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: det } = await sb.from("student_details").select("*").eq("user_id", user.id).maybeSingle();
      setDetails(det ?? null);
      if (det?.program_id) {
        const { data: prog } = await sb.from("programs").select("name_ar,name_en").eq("id", det.program_id).maybeSingle();
        if (prog) setProgramName(locale === "ar" ? prog.name_ar : prog.name_en);
      }
      const { data: enr } = await sb.from("enrollments").select("course_id, courses(id,code,name_en,name_ar,attendance_rule)").eq("student_id", user.id);
      const cs = ((enr ?? []).map((e: any) => e.courses) as Course[]);
      setCourses(cs);
      const { data: rec } = await sb.from("attendance_records").select("id,session_id,status,scanned_at,method,attendance_sessions(course_id)").eq("student_id", user.id).order("scanned_at", { ascending: false }).limit(200);
      setRecords(rec ?? []);
      if (cs.length) {
        const ids = cs.map(c => c.id);
        const { data: sess } = await sb.from("attendance_sessions").select("id,course_id,status,starts_at,ends_at,room_id,timetable_slots(session_type),courses(code,name_ar,name_en)").in("course_id", ids).order("starts_at", { ascending: false }).limit(200);
        setSessions(((sess ?? []) as unknown as Sess[]));
        try {
          const { data: rms } = await sb.from("rooms").select("id,name_ar,name_en");
          const m: Record<string, string> = {};
          (rms ?? []).forEach((rm: any) => { m[rm.id] = locale === "ar" ? rm.name_ar : rm.name_en; });
          setRooms(m);
        } catch { /* rooms table may not exist on older DBs */ }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recBySession = useMemo(() => {
    const m = new Map<string, any>();
    records.forEach(r => { if (r.session_id && !m.has(r.session_id)) m.set(r.session_id, r); });
    return m;
  }, [records]);
  const courseById = useMemo(() => {
    const m = new Map<string, Course>();
    courses.forEach(c => m.set(c.id, c));
    return m;
  }, [courses]);

  const dayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const todayKey = useMemo(() => {
    const d = new Date(now);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }, [now]);

  const live = useMemo(
    () => sessions.filter(s => s.status === "active").sort((a, b) => +new Date(a.ends_at) - +new Date(b.ends_at))[0] ?? null,
    [sessions]
  );
  const upcoming = useMemo(
    () => sessions.filter(s => s.status !== "active" && s.status !== "ended" && +new Date(s.starts_at) > now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0] ?? null,
    [sessions, now]
  );
  const todayList = useMemo(
    () => sessions.filter(s => dayKey(s.starts_at) === todayKey).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [sessions, todayKey]
  );

  const courseSummaries = useMemo(() => {
    const m = new Map<string, { summary: AttendanceSummary; list: Sess[] }>();
    for (const c of courses) {
      const list = sessions.filter(s => s.course_id === c.id);
      const attendance: AttendanceSession[] = list.map(s => ({
        id: s.id,
        kind: kindOf(s),
        status: finalStatus(s, recBySession.get(s.id), now)
      }));
      m.set(c.id, { summary: summariseAttendance(attendance, c.attendance_rule), list });
    }
    return m;
  }, [courses, sessions, recBySession, now]);

  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let counted = 0;
    for (const { summary } of courseSummaries.values()) {
      present += summary.present;
      late += summary.late;
      absent += summary.absent;
      counted += summary.counted;
    }
    const total = present + late + absent;
    const desc = sessions
      .filter(s => finalStatus(s, recBySession.get(s.id), now) != null)
      .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
    let streak = 0;
    for (const s of desc) {
      const st = finalStatus(s, recBySession.get(s.id), now);
      if (st === "present" || st === "late") streak++;
      else if (st === "excused") continue;
      else break;
    }
    return {
      total,
      mine: present + late,
      p: total === 0 ? 0 : Math.round((counted / total) * 100),
      streak
    };
  }, [courseSummaries, sessions, recBySession, now]);

  function pct(courseId: string) {
    const entry = courseSummaries.get(courseId);
    if (!entry) return { mine: 0, total: 0, p: 0, threshold: 75, list: [] as Sess[] };
    return {
      mine: entry.summary.present + entry.summary.late,
      total: entry.summary.total,
      p: entry.summary.percent,
      threshold: entry.summary.threshold,
      list: entry.list
    };
  }

  const firstName = useMemo(() => {
    const full = locale === "ar" ? details?.full_name_ar : details?.full_name_en;
    return (full ?? "").split(" ")[0] || "";
  }, [details, locale]);
  const hour = new Date(now).getHours();
  const greet = hour < 12 ? t.greetMorning : hour < 18 ? t.greetAfternoon : t.greetEvening;

  async function contest(recordId: string) {
    const reason = prompt(t.contestHint);
    if (!reason || reason.trim().length < 5) return;
    const r = await fetch("/api/console/disputes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: recordId, reason: reason.trim() })
    });
    if (r.ok) {
      setDisputed(s => new Set(s).add(recordId));
      toast.info(t.contest);
    } else {
      toast.error("error");
    }
  }
  async function sendExcuse() {
    if (!excForm.course_id || excForm.reason.trim().length < 5) return;
    const r = await fetch("/api/console/excuses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(excForm)
    });
    if (r.ok) {
      setShowExcuse(false);
      setExcForm({ course_id: "", session_id: "", reason: "" });
      const ex = await fetch("/api/console/excuses").then(x => x.json()).catch(() => ({ rows: [] }));
      setExcuses(ex.rows ?? []);
      toast.success(t.createdOk);
    }
  }
  async function enrollCourse(courseId: string) {
    setEnrolling(courseId);
    const r = await fetch("/api/student/enroll", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId })
    });
    const j = await r.json().catch(() => ({}));
    setEnrolling(null);
    if (r.ok) {
      toast.success(t.createdOk);
      fetch("/api/student/courses").then(r => r.json()).then(j2 => setProgramCourses(j2.rows ?? [])).catch(() => {});
      const sb = browserSupabase();
      const { data: enr } = await sb.from("enrollments").select("course_id, courses(id,code,name_en,name_ar,attendance_rule)").eq("student_id", userId);
      setCourses(((enr ?? []).map((e: any) => e.courses) as Course[]));
    } else {
      toast.error(j.error ?? "error");
    }
  }

  async function requestDeviceReset() {
    const r = await fetch("/api/console/service", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "device_reset", payload: {} })
    });
    if (r.ok) toast.success(t.createdOk);
    else toast.error("error");
  }

  const liveEndsIn = live ? Math.max(1, Math.ceil((+new Date(live.ends_at) - now) / 60000)) : 0;

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-32 pt-6">
      {/* header — greeting + program badge */}
      <header>
        <p className="text-sm font-medium text-muted-foreground">{greet}{firstName ? `، ${firstName}` : ""}</p>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="font-display text-[26px] font-bold leading-tight">{t.scanToAttend}</h1>
          {programName && (
            <span className="shrink-0 rounded-pill bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              {programName}
            </span>
          )}
        </div>
      </header>

      {/* hero — the one bold moment: live class or the quiet scan CTA */}
      <NextClassCard
        live={!!live}
        courseCode={live?.courses?.code}
        courseName={live ? (locale === "ar" ? live.courses?.name_ar : live.courses?.name_en) : upcoming ? (locale === "ar" ? upcoming.courses?.name_ar : upcoming.courses?.name_en) : t.scanToAttend}
        room={live?.room_id ? rooms[live.room_id] : undefined}
        endsInSeconds={live ? (+new Date(live.ends_at) - now) / 1000 : undefined}
        nextCode={upcoming?.courses?.code}
        nextInMinutes={upcoming ? Math.max(1, Math.ceil((+new Date(upcoming.starts_at) - now) / 60000)) : undefined}
        scanLabel={t.scanNow}
        endsInLabel={t.endsIn}
        startsInLabel={t.startsIn}
        className="mt-5"
      />

      {/* stats — 3 quiet numbers */}
      <section className="mt-6 grid grid-cols-3 gap-2.5" aria-label={t.overallRate}>
        <div className="rounded-card border border-border bg-card">
          <NumberStat value={stats.p} suffix="%" label={t.overallRate} tone={stats.p >= 75 ? "present" : stats.p >= 50 ? "late" : "absent"} />
        </div>
        <div className="rounded-card border border-border bg-card">
          <NumberStat value={stats.mine} label={`${t.sessionsPresent} / ${stats.total}`} />
        </div>
        <div className="rounded-card border border-border bg-card">
          <NumberStat value={stats.streak} label={t.dayStreak} tone={stats.streak > 0 ? "late" : "default"} icon={<Flame size={14} strokeWidth={2} className="me-1 inline" />} />
        </div>
      </section>

      {/* today's schedule */}
      <section className="mt-7" aria-label={t.todaySchedule}>
        <h2 className="font-display flex items-center gap-2 text-lg font-bold"><CalendarDays size={18} strokeWidth={2} /> {t.todaySchedule}</h2>
        <div className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
          {loading && <div className="p-4"><TimelineSkeleton rows={3} /></div>}
          {!loading && todayList.length === 0 && (
            <div className="p-4 text-muted-foreground"><p className="font-semibold">{t.noSessionsToday}</p><p className="text-[13px]">{t.noSessionsHint}</p></div>
          )}
          {todayList.map(s => {
            const st = finalStatus(s, recBySession.get(s.id), now);
            return (
              <TimelineRow
                key={s.id}
                startTime={fmtTime(s.starts_at, locale)}
                endTime={fmtTime(s.ends_at, locale)}
                courseCode={s.courses?.code}
                courseName={locale === "ar" ? s.courses?.name_ar : s.courses?.name_en}
                room={s.room_id ? rooms[s.room_id] : undefined}
                status={st ?? (s.status === "cancelled" ? "ended" : s.status)}
                live={s.status === "active"}
              />
            );
          })}
        </div>
      </section>

      {/* my courses — attendance at a glance */}
      <section className="mt-7" aria-label={t.myCourses}>
        <h2 className="font-display flex items-center gap-2 text-lg font-bold"><BookOpen size={18} strokeWidth={2} /> {t.myCourses}</h2>
        <div className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
          {loading && <div className="p-4"><CardSkeleton rows={1} /></div>}
          {!loading && courses.length === 0 && (
            <div className="p-4 text-muted-foreground"><p className="font-semibold">{t.noEnroll}</p><p className="text-[13px]">{t.noEnrollHint}</p></div>
          )}
          {courses.map(c => {
            const s = pct(c.id);
            return (
              <CourseAttendanceCard
                key={c.id}
                courseCode={c.code}
                courseName={locale === "ar" ? c.name_ar : c.name_en}
                attended={s.mine}
                total={s.total}
                percent={s.p}
                threshold={s.threshold}
                noSessionsLabel={t.noSessionsYet}
                expanded={expanded === c.id}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                sessions={s.list
                  .slice()
                  .filter(sess => finalStatus(sess, recBySession.get(sess.id), now) != null)
                  .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))
                  .map(sess => {
                    const st = finalStatus(sess, recBySession.get(sess.id), now) as AttendanceStatus;
                    return {
                      id: sess.id,
                      dateLabel: new Date(sess.starts_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { weekday: "short", day: "numeric", month: "numeric" }),
                      timeLabel: fmtTime(sess.starts_at, locale),
                      status: st,
                      statusLabel: undefined
                    };
                  })}
              />
            );
          })}
        </div>
      </section>

      {/* program courses — enroll from your program */}
      {programCourses.length > 0 && (
        <section className="mt-7" aria-label={t.myProgramCourses}>
          <h2 className="font-display flex items-center gap-2 text-lg font-bold"><GraduationCap size={18} strokeWidth={2} /> {t.myProgramCourses}</h2>
          <div className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
            {programCourses.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold" dir="auto">
                    {locale === "ar" ? c.name_ar : c.name_en}
                    <span className="tnum ms-2 text-[13px] font-medium text-muted-foreground">{c.code}</span>
                  </p>
                  {c.credit_hours != null && (
                    <p className="tnum text-[11px] text-muted-foreground">{c.credit_hours} {t.creditHours}</p>
                  )}
                </div>
                {c.enrolled ? (
                  <span className="shrink-0" aria-label={t.present}>
                    <StatusPill status="present" label="" className="px-1.5" />
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={enrolling === c.id}
                    onClick={() => enrollCourse(c.id)}
                  >
                    {enrolling === c.id ? "…" : t.enroll}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* announcements — animated feed */}
      {notes.length > 0 && (
        <section className="mt-7" aria-label={t.announcementsFeed}>
          <h2 className="font-display flex items-center gap-2 text-lg font-bold"><Megaphone size={18} strokeWidth={2} /> {t.announcementsFeed}</h2>
          <div className="mt-2 overflow-hidden rounded-card border border-border bg-card">
            <LazyAnimatedList
              items={notes}
              maxHeight={320}
              renderItem={(a: any) => {
                const isNew = Date.now() - +new Date(a.created_at) < 3 * 864e5;
                return (
                  <span className="block" dir="auto">
                    <span className="flex items-center gap-2 text-[15px] font-bold">
                      {isNew && <span className="h-2 w-2 shrink-0 rounded-pill bg-primary" aria-label="new" />}
                      {locale === "ar" ? a.title_ar : a.title_en ?? a.title_ar}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{locale === "ar" ? a.body_ar : a.body_en ?? a.body_ar}</span>
                  </span>
                );
              }}
            />
          </div>
        </section>
      )}

      {/* recent scans */}
      <section className="mt-7" aria-label={t.recentScans}>
        <h2 className="font-display flex items-center gap-2 text-lg font-bold"><ClipboardList size={18} strokeWidth={2} /> {t.recentScans}</h2>
        <div className="mt-2 overflow-hidden rounded-card border border-border bg-card">
          {loading ? (
            <div className="p-4"><TimelineSkeleton rows={4} /></div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={24} strokeWidth={1.75} />}
              title={t.nothingYet}
              hint={t.nothingYetHint}
              className="border-0"
            />
          ) : (
            <div className="divide-y divide-border">
              {records.slice(0, 8).map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="tnum text-[15px] font-semibold">
                      {courseById.get(r.attendance_sessions?.course_id)?.code ?? ""}
                    </p>
                    <p className="tnum text-[11px] text-muted-foreground">
                      {new Date(r.scanned_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={r.status} />
                    {(r.status === "absent" || r.status === "late") && !disputed.has(r.id) && (
                      <button onClick={() => contest(r.id)} className="min-h-[36px] rounded text-[13px] font-semibold text-primary hover:underline">{t.contest}</button>
                    )}
                    {disputed.has(r.id) && <span className="text-[11px] text-muted-foreground" aria-label={t.contest}><Check size={14} /></span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <a href="/api/reports/export" className="mt-3 block"><Button variant="outline" className="w-full">{t.exportCsv}</Button></a>
      </section>

      {/* excuses */}
      <section className="mt-7" aria-label={t.myExcuses}>
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold"><FileText size={18} strokeWidth={2} /> {t.myExcuses}</h2>
          <BottomSheet
            title={t.newExcuse}
            description={t.contestHint}
            trigger={<Button variant="outline" size="sm">{t.newExcuse}</Button>}
            footer={<Button className="w-full" onClick={sendExcuse} disabled={!excForm.course_id || excForm.reason.trim().length < 5}>{t.save}</Button>}
          >
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exc-course">{t.course}</Label>
                <select
                  id="exc-course"
                  value={excForm.course_id}
                  onChange={e => setExcForm({ ...excForm, course_id: e.target.value, session_id: "" })}
                  className="flex min-h-[40px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— {t.course}</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
                </select>
              </div>
              {excForm.course_id && (
                <div className="space-y-1.5">
                  <Label htmlFor="exc-session">{t.sessionType}</Label>
                  <select
                    id="exc-session"
                    value={excForm.session_id}
                    onChange={e => setExcForm({ ...excForm, session_id: e.target.value })}
                    className="flex min-h-[40px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— {t.sessionType}</option>
                    {sessions
                      .filter(s => s.course_id === excForm.course_id)
                      .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))
                      .slice(0, 30)
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {new Date(s.starts_at).toLocaleDateString()} · {fmtTime(s.starts_at, locale)}
                        </option>
                      ))}
                  </select>
                  <p className="text-[12px] text-muted-foreground">{t.excuseFor}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="exc-reason">{t.comment}</Label>
                <Textarea id="exc-reason" value={excForm.reason} onChange={e => setExcForm({ ...excForm, reason: e.target.value })} rows={3} dir="auto" placeholder={t.contestHint} />
              </div>
            </div>
          </BottomSheet>
        </div>
        <div className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
          {excuses.slice(0, 5).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
              <span className="truncate font-medium" dir="auto">{e.reason.slice(0, 60)}</span>
              <StatusPill status={e.status === "pending" ? "scheduled" : e.status === "approved" ? "present" : "absent"} />
            </div>
          ))}
          {excuses.length === 0 && <p className="p-4 text-[13px] text-muted-foreground">—</p>}
        </div>
        <button onClick={requestDeviceReset} className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-base border border-border text-[13px] font-semibold transition-colors hover:bg-muted">
          <Smartphone size={16} strokeWidth={2} /> {t.requestDeviceReset}
        </button>
      </section>

      <CommandPalette />
    </main>
  );
}
