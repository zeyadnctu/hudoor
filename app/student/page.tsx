"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, StatusPill, EmptyState, SkeletonRows } from "@/components/ui";
import { getOrCreateDeviceId } from "@/lib/device";
import { tickSessions } from "@/lib/session-tick";
import { ScanLine, BookOpen, CalendarDays, ClipboardList, Megaphone, FileText, Smartphone, Flame, ChevronDown, MapPin, Sparkles, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

type Course = { id: string; code: string; name_en: string; name_ar: string };
type Sess = { id: string; course_id: string; status: string; starts_at: string; ends_at: string; room_id: string | null; courses?: any };

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
  const [excForm, setExcForm] = useState({ course_id: "", reason: "" });
  const [flash, setFlash] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [userId, setUserId] = useState("");
  const [programCourses, setProgramCourses] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => { getOrCreateDeviceId(); tickSessions(); }, []);

  // Load all courses in the student's program
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
      const { data: enr } = await sb.from("enrollments").select("course_id, courses(id,code,name_en,name_ar)").eq("student_id", user.id);
      const cs = ((enr ?? []).map((e: any) => e.courses) as Course[]);
      setCourses(cs);
      const { data: rec } = await sb.from("attendance_records").select("id,session_id,status,scanned_at,method,attendance_sessions(course_id)").eq("student_id", user.id).order("scanned_at", { ascending: false }).limit(200);
      setRecords(rec ?? []);
      if (cs.length) {
        const ids = cs.map(c => c.id);
        const { data: sess } = await sb.from("attendance_sessions").select("id,course_id,status,starts_at,ends_at,room_id,courses(code,name_ar,name_en)").in("course_id", ids).order("starts_at", { ascending: false }).limit(200);
        setSessions(((sess ?? []) as Sess[]));
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

  const stats = useMemo(() => {
    const ended = sessions.filter(s => s.status === "ended" || +new Date(s.ends_at) <= now);
    let mine = 0;
    ended.forEach(s => {
      const r = recBySession.get(s.id);
      if (r && (r.status === "present" || r.status === "late")) mine++;
    });
    // streak: consecutive attended from most recent ended session
    const desc = [...ended].sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
    let streak = 0;
    for (const s of desc) {
      const r = recBySession.get(s.id);
      if (!r) break;
      if (r.status === "present" || r.status === "late") streak++;
      else if (r.status === "excused") continue;
      else break;
    }
    return { total: ended.length, mine, p: ended.length === 0 ? 0 : Math.round((mine / ended.length) * 100), streak };
  }, [sessions, recBySession, now]);

  function pct(courseId: string) {
    const list = sessions.filter(s => s.course_id === courseId && (s.status === "ended" || +new Date(s.ends_at) <= now));
    let mine = 0;
    list.forEach(s => {
      const r = recBySession.get(s.id);
      if (r && (r.status === "present" || r.status === "late")) mine++;
    });
    return { mine, total: list.length, p: list.length === 0 ? 0 : Math.round((mine / list.length) * 100), list };
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
  async function enrollCourse(courseId: string) {
    setEnrolling(courseId);
    const r = await fetch("/api/student/enroll", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId })
    });
    const j = await r.json().catch(() => ({}));
    setEnrolling(null);
    if (r.ok) {
      setFlash("✓");
      setTimeout(() => setFlash(""), 2000);
      // Refresh both lists
      fetch("/api/student/courses").then(r => r.json()).then(j2 => setProgramCourses(j2.rows ?? [])).catch(() => {});
      const sb = browserSupabase();
      const { data: enr } = await sb.from("enrollments").select("course_id, courses(id,code,name_en,name_ar)").eq("student_id", userId);
      setCourses(((enr ?? []).map((e: any) => e.courses) as Course[]));
    } else {
      setFlash(j.error ?? "error");
    }
  }

  async function requestDeviceReset() {
    const r = await fetch("/api/console/service", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "device_reset", payload: {} })
    });
    setFlash(r.ok ? `✓ ${t.createdOk}` : "error");
  }

  const ringC = 2 * Math.PI * 26;
  const ringColor = stats.p >= 75 ? "#2E9B5F" : stats.p >= 50 ? "#D9A21B" : "#B5432E";

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-5">
      {/* header */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{greet}{firstName ? `، ${firstName}` : ""}</p>
          <h1 className="font-display text-2xl font-bold leading-tight">{t.scanToAttend}</h1>
        </div>
        {programName && (
          <span className="shrink-0 rounded-full bg-register-light px-3 py-1.5 text-xs font-bold text-register-dark dark:bg-register/25 dark:text-sky-200">{programName}</span>
        )}
      </header>

      {/* LIVE hero */}
      {live ? (
        <Link href="/student/scan-in-app" className="mt-4 block overflow-hidden rounded-lg2 bg-ink text-white shadow-lg dark:bg-white dark:text-ink" aria-label={t.tapToScan}>
          <span className="block p-5">
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="relative flex h-3 w-3">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
              </span>
              {t.liveNow} · {live.courses?.code}
            </span>
            <span className="font-display mt-1 block text-xl font-bold" dir="auto">{locale === "ar" ? live.courses?.name_ar : live.courses?.name_en}</span>
            <span className="mt-1 block text-sm opacity-80">
              {t.endsIn} {fmtDur(Math.max(1, Math.ceil((+new Date(live.ends_at) - now) / 60000)), t)}
              {live.room_id && rooms[live.room_id] ? ` · ${rooms[live.room_id]}` : ""}
            </span>
            <span className="mt-4 flex min-h-[60px] items-center justify-center gap-2 rounded-md2 bg-emerald-500 text-lg font-bold text-white">
              <ScanLine size={24} strokeWidth={2} /> {t.scanNow}
            </span>
          </span>
        </Link>
      ) : (
        <Link href="/student/scan-in-app" className="mt-4 block">
          <span className="flex min-h-[72px] items-center justify-center gap-3 rounded-lg2 bg-register text-xl font-bold text-white transition-colors hover:bg-register-dark">
            <ScanLine size={28} strokeWidth={2} /> {t.scanToAttend}
          </span>
        </Link>
      )}
      {!live && upcoming && (
        <div className="mt-2 flex items-center gap-2 rounded-md2 border border-black/10 px-4 py-2.5 text-sm dark:border-white/15">
          <Sparkles size={17} strokeWidth={2} className="shrink-0 text-register" />
          <span dir="auto">
            {t.nextUp}: <b>{upcoming.courses?.code}</b> · {t.startsIn} {fmtDur(Math.max(1, Math.ceil((+new Date(upcoming.starts_at) - now) / 60000)), t)}
          </span>
        </div>
      )}
      <p className="mt-2 text-center text-sm text-neutral-500">{t.scanHint}</p>
      {flash && <p className="mt-2 text-center text-sm font-semibold" role="status">{flash}</p>}

      {/* stats */}
      <section className="mt-5 grid grid-cols-3 gap-2" aria-label={t.overallRate}>
        <div className="flex flex-col items-center rounded-md2 border border-black/10 px-2 py-3 dark:border-white/15">
          <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${stats.p}%`}>
            <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" className="stroke-black/10 dark:stroke-white/15" />
            <circle cx="32" cy="32" r="26" fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={ringC} strokeDashoffset={ringC - (ringC * stats.p) / 100}
              transform="rotate(-90 32 32)" />
            <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="800" className="fill-ink dark:fill-white">{stats.p}%</text>
          </svg>
          <span className="mt-1 text-xs font-semibold text-neutral-500">{t.overallRate}</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-md2 border border-black/10 px-2 py-3 dark:border-white/15">
          <span className="tnum font-display text-2xl font-bold">{stats.mine}<span className="text-base text-neutral-400">/{stats.total}</span></span>
          <span className="mt-1 text-xs font-semibold text-neutral-500">{t.sessionsPresent}</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-md2 border border-black/10 px-2 py-3 dark:border-white/15">
          <span className="flex items-center gap-1 font-display text-2xl font-bold">
            <Flame size={22} strokeWidth={2} className={stats.streak > 0 ? "text-orange-500" : "text-neutral-300"} />
            {stats.streak}
          </span>
          <span className="mt-1 text-xs font-semibold text-neutral-500">{t.dayStreak}</span>
        </div>
      </section>

      {/* today's schedule */}
      <section className="mt-7" aria-label={t.todaySchedule}>
        <h2 className="font-display flex items-center gap-2 text-xl font-bold"><CalendarDays size={20} strokeWidth={2} /> {t.todaySchedule}</h2>
        <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {loading && <div className="p-4"><div className="skeleton h-5 w-2/3 rounded bg-black/10 dark:bg-white/15" /><div className="skeleton mt-2 h-5 w-1/2 rounded bg-black/10 dark:bg-white/15" /></div>}
          {!loading && todayList.length === 0 && (
            <div className="p-4 text-neutral-500"><p className="font-semibold">{t.noSessionsToday}</p><p className="text-sm">{t.noSessionsHint}</p></div>
          )}
          {todayList.map(s => {
            const r = recBySession.get(s.id);
            const ended = s.status === "ended" || +new Date(s.ends_at) <= now;
            return (
              <div key={s.id} className={cn("flex items-center justify-between gap-2 px-4 py-3", s.status === "active" && "bg-emerald-500/[0.07]")}>
                <div className="flex gap-3">
                  <div className="tnum flex w-24 shrink-0 flex-col text-sm font-bold" dir="ltr">
                    <span>{fmtTime(s.starts_at, locale)}</span>
                    <span className="font-medium text-neutral-400">{fmtTime(s.ends_at, locale)}</span>
                  </div>
                  <div>
                    <div className="tnum font-display font-semibold">{s.courses?.code}</div>
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      {s.room_id && rooms[s.room_id] && <span className="flex items-center gap-0.5"><MapPin size={12} />{rooms[s.room_id]}</span>}
                      <span dir="auto">{locale === "ar" ? s.courses?.name_ar : s.courses?.name_en}</span>
                    </div>
                  </div>
                </div>
                {r ? <StatusPill status={r.status} /> : ended ? <StatusPill status="absent" /> : <StatusPill status={s.status} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* courses accordion */}
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
            const open = expanded === c.id;
            return (
              <div key={c.id}>
                <button onClick={() => setExpanded(open ? null : c.id)} aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start">
                  <span>
                    <span className="block font-semibold">{locale === "ar" ? c.name_ar : c.name_en} <span className="tnum text-sm font-medium text-neutral-500">{c.code}</span></span>
                    <span className="mt-1.5 block h-2 w-36 overflow-hidden rounded-full bg-black/10 dark:bg-white/15" role="progressbar" aria-valuenow={s.p} aria-valuemin={0} aria-valuemax={100}>
                      <span className={cn("block h-full rounded-full", low ? "bg-hi" : "bg-stamp")} style={{ width: `${s.p}%` }} />
                    </span>
                    <span className="tnum mt-1 block text-xs text-neutral-500">
                      {s.mine}/{s.total} {t.sessionsCount}
                      {low && <span className="font-semibold text-hi-dark dark:text-amber-300"> · {t.below75}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className={cn("tnum font-display text-lg font-bold", s.total === 0 ? "text-neutral-400" : low ? "text-hi-dark dark:text-amber-300" : "text-stamp-dark dark:text-emerald-300")}>
                      {s.total === 0 ? "—" : `${s.p}%`}
                    </span>
                    <ChevronDown size={18} className={cn("text-neutral-400 transition-transform", open && "rotate-180")} />
                  </span>
                </button>
                {open && (
                  <div className="border-t border-black/10 bg-black/[0.02] px-4 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                    {s.list.length === 0 && <p className="py-2 text-sm text-neutral-500">{t.noSessionsYet}</p>}
                    {[...s.list].sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at)).map(sess => {
                      const r = recBySession.get(sess.id);
                      const ended = sess.status === "ended" || +new Date(sess.ends_at) <= now;
                      return (
                        <div key={sess.id} className="flex items-center justify-between gap-2 border-b border-black/5 py-2 text-sm last:border-0 dark:border-white/5">
                          <span className="tnum text-neutral-600 dark:text-neutral-300">
                            {new Date(sess.starts_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { weekday: "short", day: "numeric", month: "numeric" })}
                            {" · "}{fmtTime(sess.starts_at, locale)}
                          </span>
                          {r ? <StatusPill status={r.status} /> : ended ? <StatusPill status="absent" /> : <StatusPill status={sess.status} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* program courses — enroll in any course from your program */}
      {programCourses.length > 0 && (
        <section className="mt-7" aria-label={t.myProgramCourses}>
          <h2 className="font-display flex items-center gap-2 text-xl font-bold"><GraduationCap size={20} strokeWidth={2} /> {t.myProgramCourses}</h2>
          <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
            {programCourses.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold" dir="auto">
                    {locale === "ar" ? c.name_ar : c.name_en}
                    <span className="tnum ms-2 text-sm font-medium text-neutral-500">{c.code}</span>
                  </p>
                  {c.credit_hours != null && (
                    <p className="tnum text-xs text-neutral-500">{c.credit_hours} {t.creditHours}</p>
                  )}
                </div>
                {c.enrolled ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓</span>
                ) : (
                  <Button
                    variant="outline"
                    className="!min-h-[40px] shrink-0"
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

      {/* announcements */}
      {notes.length > 0 && (
        <section className="mt-7" aria-label={t.announcementsFeed}>
          <h2 className="font-display flex items-center gap-2 text-xl font-bold"><Megaphone size={20} strokeWidth={2} /> {t.announcementsFeed}</h2>
          <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
            {notes.map((a: any) => {
              const isNew = Date.now() - +new Date(a.created_at) < 3 * 864e5;
              return (
                <div key={a.id} className="px-4 py-2.5">
                  <p className="flex items-center gap-2 font-bold" dir="auto">
                    {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-register" aria-label="new" />}
                    {locale === "ar" ? a.title_ar : a.title_en ?? a.title_ar}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300" dir="auto">{locale === "ar" ? a.body_ar : a.body_en ?? a.body_ar}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
                    <td className="px-4 py-2.5">
                      <span className="tnum font-semibold">{courseById.get(r.attendance_sessions?.course_id)?.code ?? ""}</span>
                      <span className="tnum block text-xs text-neutral-500">{new Date(r.scanned_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</span>
                    </td>
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
