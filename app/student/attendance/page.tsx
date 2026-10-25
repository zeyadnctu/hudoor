"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/hudoor/empty-state";
import { StatusPill } from "@/components/hudoor/status-pill";
import { BottomSheet } from "@/components/hudoor/bottom-sheet";
import { SegmentedControl } from "@/components/hudoor/segmented-control";
import { SemesterHeatmap, type HeatCell } from "@/components/hudoor/semester-heatmap";
import { CardSkeleton, TimelineSkeleton } from "@/components/hudoor/skeletons";
import { toast } from "@/components/hudoor/toast";
import { cn } from "@/lib/utils";
import {
  summariseAttendance,
  normalizeRule,
  heatmapCells,
  verdictLabelKey,
  type AttendanceSession,
  type AttendanceStatus,
  type AttendanceSummary,
  type AttendanceVerdict,
  type SessionKind
} from "@/lib/attendance";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  Info,
  MinusCircle,
  RefreshCw,
  Scale
} from "lucide-react";

type Course = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  attendance_rule: unknown;
};
type SessionRow = {
  id: string;
  course_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  timetable_slots?: { session_type: string | null } | null;
};
type RecordRow = {
  id: string;
  session_id: string;
  status: AttendanceStatus;
  scanned_at: string;
  method: string | null;
};
type RequestRow = {
  id: string;
  status: string;
  reason: string;
  comment: string | null;
  created_at: string;
  courses?: { code: string; name_ar: string } | null;
};

type FilterStatus = "all" | AttendanceStatus;

const TONE: Record<
  AttendanceVerdict,
  { chip: string; bar: string; icon: typeof CheckCircle2; rail: string }
> = {
  safe: { chip: "bg-present-soft text-present-ink", bar: "bg-present-fill", icon: CheckCircle2, rail: "border-s-present-fill" },
  watch: { chip: "bg-late-soft text-late-ink", bar: "bg-late-fill", icon: AlertTriangle, rail: "border-s-late-fill" },
  at_risk: { chip: "bg-absent-soft text-absent-ink", bar: "bg-absent-fill", icon: AlertOctagon, rail: "border-s-absent-fill" },
  none: { chip: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/25", icon: MinusCircle, rail: "border-s-border" }
};

function timeZone() {
  return "Africa/Cairo";
}
function fmtDay(iso: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    timeZone: timeZone(), weekday: "short", day: "numeric", month: "short"
  }).format(new Date(iso));
}
function fmtTime(iso: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    timeZone: timeZone(), hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}
function kindOf(s: SessionRow): SessionKind {
  const k = s.timetable_slots?.session_type;
  return k === "lecture" || k === "section" ? k : "other";
}
function statusOf(s: SessionRow, rec: RecordRow | undefined, now: number): AttendanceStatus | null {
  if (s.status === "cancelled") return null;
  if (rec) return rec.status;
  const over = s.status === "ended" || +new Date(s.ends_at) <= now;
  return over ? "absent" : null;
}
function classesToRecover(counted: number, total: number, threshold: number): number {
  if (total === 0) return 0;
  if (counted / total >= threshold / 100) return 0;
  if (threshold >= 100) return Infinity;
  const t = threshold / 100;
  return Math.max(0, Math.ceil((t * total - counted) / (1 - t)));
}

export default function StudentAttendancePage() {
  const { t, locale } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [semesterName, setSemesterName] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [visibleRows, setVisibleRows] = useState(40);

  const [excuses, setExcuses] = useState<RequestRow[]>([]);
  const [disputes, setDisputes] = useState<RequestRow[]>([]);
  const [pendingDisputes, setPendingDisputes] = useState<Set<string>>(new Set());

  const [excuseOpen, setExcuseOpen] = useState(false);
  const [excuseForm, setExcuseForm] = useState({ course_id: "", session_id: "", reason: "" });
  const [excuseSaving, setExcuseSaving] = useState(false);

  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeRecord, setDisputeRecord] = useState<RecordRow | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSaving, setDisputeSaving] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loadRequests = useCallback(async () => {
    const [ex, dp] = await Promise.all([
      fetch("/api/console/excuses").then(r => (r.ok ? r.json() : { rows: [] })).catch(() => ({ rows: [] })),
      fetch("/api/console/disputes").then(r => (r.ok ? r.json() : { rows: [] })).catch(() => ({ rows: [] }))
    ]);
    setExcuses((ex.rows ?? []) as RequestRow[]);
    setDisputes((dp.rows ?? []) as RequestRow[]);
    setPendingDisputes(
      new Set(((dp.rows ?? []) as RequestRow[]).filter(d => d.status === "pending").map((d: any) => d.record_id))
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        setError(true);
        setLoading(false);
        return;
      }

      const [enrRes, semRes] = await Promise.all([
        sb.from("enrollments").select("course_id,courses(id,code,name_ar,name_en,attendance_rule)").eq("student_id", user.id),
        sb.from("semesters").select("id,name,starts_at,ends_at,is_current").order("starts_at", { ascending: false }).limit(6)
      ]);

      if (enrRes.error) throw enrRes.error;
      const cs = ((enrRes.data ?? []) as any[])
        .map(e => e.courses)
        .filter(Boolean) as Course[];
      setCourses(cs);

      const sem = (semRes.data ?? []).find((s: any) => s.is_current) ?? (semRes.data ?? [])[0] ?? null;
      setSemesterName(sem ? String(sem.name) : "");

      const ids = cs.map(c => c.id);
      if (ids.length) {
        let sq = sb
          .from("attendance_sessions")
          .select("id,course_id,starts_at,ends_at,status,timetable_slots(session_type)")
          .in("course_id", ids)
          .order("starts_at", { ascending: false })
          .limit(2000);
        if (sem?.starts_at) sq = sq.gte("starts_at", `${sem.starts_at}T00:00:00Z`);
        if (sem?.ends_at) sq = sq.lte("starts_at", `${sem.ends_at}T23:59:59Z`);
        const { data: sess, error: se } = await sq;
        if (se) throw se;
        setSessions((sess ?? []) as unknown as SessionRow[]);
      } else {
        setSessions([]);
      }

      const { data: rec, error: re } = await sb
        .from("attendance_records")
        .select("id,session_id,status,scanned_at,method")
        .eq("student_id", user.id)
        .order("scanned_at", { ascending: false })
        .limit(2000);
      if (re) throw re;
      setRecords((rec ?? []) as RecordRow[]);

      await loadRequests();
      setUpdatedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loadRequests]);

  useEffect(() => { load(); }, [load]);

  const recBySession = useMemo(() => {
    const m = new Map<string, RecordRow>();
    records.forEach(r => { if (r.session_id && !m.has(r.session_id)) m.set(r.session_id, r); });
    return m;
  }, [records]);

  const courseSessions = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    sessions.forEach(s => {
      if (!m.has(s.course_id)) m.set(s.course_id, []);
      m.get(s.course_id)!.push(s);
    });
    return m;
  }, [sessions]);

  const perCourse = useMemo(() => {
    const out: Array<{
      course: Course;
      summary: AttendanceSummary;
      sessions: Array<SessionRow & { finalStatus: AttendanceStatus | null; kind: SessionKind; record?: RecordRow }>;
      recover: number;
    }> = [];
    for (const course of courses) {
      const list = (courseSessions.get(course.id) ?? []).map(s => {
        const rec = recBySession.get(s.id);
        return { ...s, kind: kindOf(s), record: rec, finalStatus: statusOf(s, rec, now) };
      });
      const attendance: AttendanceSession[] = list.map(s => ({ id: s.id, kind: s.kind, status: s.finalStatus }));
      const summary = summariseAttendance(attendance, course.attendance_rule);
      out.push({
        course,
        summary,
        sessions: list.sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at)),
        recover: classesToRecover(summary.counted, summary.total, summary.threshold)
      });
    }
    return out.sort((a, b) => a.course.code.localeCompare(b.course.code));
  }, [courses, courseSessions, recBySession, now]);

  const overall = useMemo(() => {
    const present = perCourse.reduce((n, c) => n + c.summary.present, 0);
    const late = perCourse.reduce((n, c) => n + c.summary.late, 0);
    const absent = perCourse.reduce((n, c) => n + c.summary.absent, 0);
    const excused = perCourse.reduce((n, c) => n + c.summary.excused, 0);
    const total = present + late + absent;
    const counted = perCourse.reduce((n, c) => n + c.summary.counted, 0);
    const percent = total === 0 ? 0 : Math.round((counted / total) * 100);
    const thresholds = [...new Set(perCourse.map(c => c.summary.threshold))];
    const threshold = thresholds.length === 1 ? thresholds[0] : 75;
    const weights = [...new Set(perCourse.map(c => normalizeRule(c.course.attendance_rule).lateWeight))];
    // With mixed course thresholds there is no single line, so the overall
    // verdict follows the least favourable course instead of a default.
    const verdict: AttendanceVerdict =
      total === 0
        ? "none"
        : perCourse.some(c => c.summary.verdict === "at_risk")
          ? "at_risk"
          : perCourse.some(c => c.summary.verdict === "watch")
            ? "watch"
            : "safe";
    const margins = perCourse.filter(c => c.summary.total > 0).map(c => c.summary.safeMisses);
    const safeMisses = margins.length ? Math.min(...margins) : 0;
    return { present, late, absent, excused, total, counted, percent, threshold, thresholds, weights, verdict, safeMisses };
  }, [perCourse]);

  const attention = useMemo(
    () => perCourse.filter(c => c.summary.verdict === "at_risk" || c.summary.verdict === "watch"),
    [perCourse]
  );

  const ledger = useMemo(() => {
    const rows: Array<{
      session: SessionRow;
      course: Course | undefined;
      finalStatus: AttendanceStatus;
      kind: SessionKind;
      record?: RecordRow;
    }> = [];
    for (const [courseId, list] of courseSessions) {
      const course = courses.find(c => c.id === courseId);
      for (const s of list) {
        const rec = recBySession.get(s.id);
        const st = statusOf(s, rec, now);
        if (!st) continue;
        rows.push({ session: s, course, finalStatus: st, kind: kindOf(s), record: rec });
      }
    }
    return rows
      .filter(r => filterStatus === "all" || r.finalStatus === filterStatus)
      .filter(r => filterCourse === "all" || r.session.course_id === filterCourse)
      .sort((a, b) => +new Date(b.session.starts_at) - +new Date(a.session.starts_at));
  }, [courseSessions, courses, recBySession, now, filterStatus, filterCourse]);

  const heatCells: HeatCell[] = useMemo(
    () =>
      heatmapCells(
        [...courseSessions.values()]
          .flat()
          .map(s => {
            const rec = recBySession.get(s.id);
            const st = statusOf(s, rec, now);
            return st ? { startsAt: s.starts_at, status: st } : null;
          })
          .filter(Boolean) as Array<{ startsAt: string; status: AttendanceStatus }>
      ),
    [courseSessions, recBySession, now]
  );

  function openExcuse(courseId = "", sessionId = "") {
    setExcuseForm({ course_id: courseId, session_id: sessionId, reason: "" });
    setExcuseOpen(true);
  }
  async function sendExcuse() {
    if (!excuseForm.course_id) { toast.error(t.attNeedCourse); return; }
    if (excuseForm.reason.trim().length < 5) { toast.error(t.attReasonShort); return; }
    setExcuseSaving(true);
    const r = await fetch("/api/console/excuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(excuseForm)
    });
    setExcuseSaving(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error((j as any).error ?? t.attLoadError);
      return;
    }
    setExcuseOpen(false);
    setExcuseForm({ course_id: "", session_id: "", reason: "" });
    await loadRequests();
    toast.success(t.attExcuseSent);
  }

  function openDispute(rec: RecordRow) {
    if (pendingDisputes.has(rec.id)) return;
    setDisputeRecord(rec);
    setDisputeReason("");
    setDisputeOpen(true);
  }
  async function sendDispute() {
    if (!disputeRecord) return;
    if (disputeReason.trim().length < 5) { toast.error(t.attReasonShort); return; }
    setDisputeSaving(true);
    const r = await fetch("/api/console/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: disputeRecord.id, reason: disputeReason.trim() })
    });
    setDisputeSaving(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error((j as any).error ?? t.attLoadError);
      return;
    }
    setDisputeOpen(false);
    setDisputeRecord(null);
    setDisputeReason("");
    await loadRequests();
    toast.success(t.attDisputeSent);
  }

  const excuseCourses = courses;
  const excuseSessions = useMemo(
    () => sessions.filter(s => s.course_id === excuseForm.course_id).sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at)).slice(0, 24),
    [sessions, excuseForm.course_id]
  );

  const MainTone = TONE[overall.verdict];
  const MainIcon = MainTone.icon;

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pb-32 pt-6" aria-busy="true">
        <div className="h-7 w-40 rounded-base bg-muted" />
        <div className="mt-2 h-4 w-64 rounded-base bg-muted" />
        <div className="mt-5 rounded-card border border-border bg-card p-5">
          <div className="h-14 w-28 rounded-base bg-muted" />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-10 rounded-base bg-muted" />)}
          </div>
        </div>
        <div className="mt-6"><CardSkeleton rows={3} /></div>
        <div className="mt-6"><TimelineSkeleton rows={4} /></div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          icon={<RefreshCw size={26} strokeWidth={2} />}
          title={t.attLoadError}
          hint={t.attLoadError}
          withGrid
          action={<Button className="min-h-[44px]" onClick={() => load()}><RefreshCw size={18} strokeWidth={2} /> {t.attRetry}</Button>}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-32 pt-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[26px] font-bold leading-tight">{t.attTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.attIntro}</p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            aria-label={t.attRetry}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-pill border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw size={17} strokeWidth={2} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground">
          {semesterName && <span>{t.attSemester}: {semesterName}</span>}
          {updatedAt && <span className="tnum">{t.attUpdated}: {fmtTime(updatedAt.toISOString(), locale)}</span>}
        </div>
      </header>

      {/* The register head — one bold number, counts as a ledger line. */}
      <section className="ruled mt-4 rounded-card border border-border bg-card" aria-label={t.attOverall}>
        <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground">{t.attOverall}</p>
            <p className="font-display tnum mt-0.5 text-[56px] font-bold leading-none">
              {overall.total === 0 ? "—" : `${overall.percent}%`}
            </p>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-bold", MainTone.chip)}>
            <MainIcon size={14} strokeWidth={2.4} aria-hidden="true" />
            {t[verdictLabelKey(overall.verdict)]}
          </span>
        </div>

        <dl className="grid grid-cols-4 border-t border-border text-center">
          {(
            [
              ["present", overall.present, "bg-present-fill"],
              ["late", overall.late, "bg-late-fill"],
              ["absent", overall.absent, "bg-absent-fill"],
              ["excused", overall.excused, "bg-excused-fill"]
            ] as const
          ).map(([key, value, dot]) => (
            <div key={key} className="border-e border-border py-2.5 last:border-e-0">
              <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-pill", dot)} aria-hidden="true" />
                {key === "present" ? t.stPresent : key === "late" ? t.stLate : key === "absent" ? t.stAbsent : t.stExcused}
              </dt>
              <dd className="tnum font-display mt-0.5 text-lg font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex items-start gap-2 border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            {`${t.attThreshold} ${overall.thresholds.length > 1 ? overall.thresholds.join(" / ") : overall.threshold}% · ${t.attLateWeight} ${overall.weights.length ? overall.weights.map(w => `×${w}`).join(" / ") : "×1"} · ${t.attExcusedRule}`}
          </p>
        </div>
      </section>

      {overall.total > 0 && (
        <div className="mt-3 rounded-base border border-border bg-muted/50 px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Scale size={16} strokeWidth={2} className="text-primary" aria-hidden="true" />
            {overall.verdict === "safe"
              ? `${t.attSafeMisses} ${overall.safeMisses} ${t.attClasses}`
              : overall.verdict === "none"
                ? t.attNoSessions
                : `${t.attRecover} ${classesToRecover(overall.counted, overall.total, overall.threshold)} ${t.attRecoverTail}`}
          </p>
        </div>
      )}

      {attention.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-base border border-absent-fill/35 bg-absent-soft px-4 py-3 text-absent-ink">
          <AlertTriangle size={17} strokeWidth={2.2} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold">
              {t.attAttention} · {t.attAttentionCount.replace("{n}", String(attention.length))}
            </p>
            <p className="mt-0.5 text-[12px] font-medium" dir="auto">
              {attention.slice(0, 3).map(c => locale === "ar" ? c.course.name_ar : c.course.name_en).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<ClipboardList size={26} strokeWidth={1.75} />}
            title={t.noEnroll}
            hint={t.noEnrollHint}
            action={<Link href="/student"><Button variant="outline" className="min-h-[44px]">{t.back}</Button></Link>}
          />
        </div>
      ) : (
        <>
          <section className="mt-6" aria-label={t.myCourses}>
            <h2 className="font-display text-lg font-bold">{t.myCourses}</h2>
            <div className="mt-2 overflow-hidden rounded-card border border-border bg-card">
              {perCourse.map(({ course, summary, sessions: list, recover }) => {
                const tone = TONE[summary.verdict];
                const Icon = tone.icon;
                const open = expanded === course.id;
                const name = locale === "ar" ? course.name_ar : course.name_en;
                return (
                  <div key={course.id} className={cn("border-s-[3px]", tone.rail)}>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : course.id)}
                      aria-expanded={open}
                      aria-controls={`course-${course.id}`}
                      className="w-full px-4 py-3 text-start transition-colors duration-fast hover:bg-accent/40"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="tnum block text-[11px] font-bold text-muted-foreground">{course.code}</span>
                          <span className="block truncate text-[15px] font-semibold" dir="auto">{name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="font-display tnum text-xl font-bold">
                            {summary.total === 0 ? "—" : `${summary.percent}%`}
                          </span>
                          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform duration-fast", open && "rotate-180")} aria-hidden="true" />
                        </span>
                      </span>

                      <span className="mt-2 flex items-center gap-2">
                        <span className="relative block h-1.5 flex-1 overflow-hidden rounded-pill bg-muted" role="progressbar" aria-valuenow={summary.percent} aria-valuemin={0} aria-valuemax={100} aria-label={name}>
                          <span className={cn("absolute inset-y-0 start-0 rounded-pill transition-[width] duration-base ease-out", tone.bar)} style={{ width: `${summary.percent}%` }} />
                          <span className="absolute inset-y-0 w-px bg-foreground/30" style={{ insetInlineStart: `${summary.threshold}%` }} aria-hidden="true" />
                        </span>
                        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold", tone.chip)}>
                          <Icon size={11} strokeWidth={2.4} aria-hidden="true" />
                          {t[verdictLabelKey(summary.verdict)]}
                        </span>
                      </span>

                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-muted-foreground">
                        <span className="tnum">{summary.present + summary.late}/{summary.total}</span>
                        {summary.byKind.map(k => (
                          <span key={k.kind} className="tnum">
                            {k.kind === "lecture" ? t.attLectures : t.attSections} {k.percent}%
                          </span>
                        ))}
                        {summary.excused > 0 && <span className="tnum">{t.stExcused} {summary.excused}</span>}
                      </span>
                    </button>

                    {open && (
                      <div id={`course-${course.id}`} className="border-t border-border bg-muted/25 px-4 py-3">
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {t.attRuleLine.replace("{pct}", String(summary.threshold)).replace("{w}", String((course.attendance_rule as any)?.late_weight ?? 1))}
                          {" · "}
                          {summary.combine === "worst" ? t.attCombineWorst : summary.combine === "weighted" ? t.attCombineWeighted : t.attCombineAll}
                        </p>

                        {summary.total > 0 && (
                          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold">
                            <Scale size={14} strokeWidth={2} className="text-primary" aria-hidden="true" />
                            {summary.percent >= summary.threshold
                              ? summary.safeMisses > 0
                                ? `${t.attSafeMisses} ${summary.safeMisses} ${t.attClasses}`
                                : t.attSafeMissesNone
                              : `${t.attRecover} ${recover === Infinity ? "—" : recover} ${t.attRecoverTail}`}
                          </p>
                        )}

                        {summary.byKind.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-1.5">
                            {summary.byKind.map(k => (
                              <div key={k.kind} className="rounded-base border border-border bg-card px-2.5 py-2">
                                <p className="text-[10px] font-semibold text-muted-foreground">
                                  {k.kind === "lecture" ? t.attLectures : t.attSections}
                                </p>
                                <p className="tnum font-display text-base font-bold">{k.percent}%</p>
                                <p className="tnum text-[10px] text-muted-foreground">{k.present + k.late}/{k.total}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 divide-y divide-border/70">
                          {list.filter(s => s.finalStatus).slice(0, 6).map(s => (
                            <div key={s.id} className="flex items-center justify-between gap-2 py-2 text-[12px]">
                              <span className="min-w-0">
                                <span className="tnum block font-semibold">{fmtDay(s.starts_at, locale)} · {fmtTime(s.starts_at, locale)}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {s.kind === "lecture" ? t.attKindLecture : s.kind === "section" ? t.attKindSection : t.attKindOther}
                                  {!s.record && ` · ${t.attImpliedAbsent}`}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                {s.record && s.finalStatus !== "present" && !pendingDisputes.has(s.record.id) && (
                                  <button
                                    type="button"
                                    onClick={() => openDispute(s.record!)}
                                    className="min-h-[44px] rounded px-1.5 text-[11px] font-semibold text-primary hover:underline"
                                  >
                                    {t.attDispute}
                                  </button>
                                )}
                                <StatusPill status={s.finalStatus ?? "absent"} />
                              </span>
                            </div>
                          ))}
                          {!list.some(s => s.finalStatus) && (
                            <p className="py-2 text-[12px] text-muted-foreground">{t.attNoSessions}</p>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => openExcuse(course.id)}>
                            <FileText size={15} strokeWidth={2} /> {t.attFileExcuse}
                          </Button>
                          <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => openExcuse(course.id, list.find(s => s.finalStatus === "absent")?.id ?? "")}>
                            {t.attSession}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {heatCells.length > 0 && (
            <section className="mt-6" aria-label={t.attHeatmap}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-bold">{t.attHeatmap}</h2>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t.attHeatmapHint}</p>
              <div className="mt-2 rounded-card border border-border bg-card p-3">
                <SemesterHeatmap
                  cells={heatCells.map(c => ({ date: c.date, status: c.status }))}
                  locale={locale}
                  statusLabels={{ present: t.stPresent, late: t.stLate, absent: t.stAbsent, excused: t.stExcused, none: t.attNoData }}
                />
              </div>
            </section>
          )}

          {/* the ledger */}
          <section className="mt-6" aria-label={t.attLedger}>
            <h2 className="font-display text-lg font-bold">{t.attLedger}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="att-course-filter" className="sr-only">{t.attFilterCourse}</label>
                <select
                  id="att-course-filter"
                  value={filterCourse}
                  onChange={e => { setFilterCourse(e.target.value); setVisibleRows(40); }}
                  className="min-h-[44px] w-full rounded-base border border-border bg-card px-3 text-[13px] font-semibold"
                >
                  <option value="all">{t.attAll} · {t.attFilterCourse}</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} · {locale === "ar" ? c.name_ar : c.name_en}</option>
                  ))}
                </select>
              </div>
              <SegmentedControl
                value={filterStatus}
                onValueChange={v => { setFilterStatus(v); setVisibleRows(40); }}
                ariaLabel={t.attFilterStatus}
                options={[
                  { value: "all", label: t.attAll },
                  { value: "present", label: t.stPresent },
                  { value: "late", label: t.stLate },
                  { value: "absent", label: t.stAbsent },
                  { value: "excused", label: t.stExcused }
                ]}
              />
            </div>

            {ledger.length === 0 ? (
              <div className="mt-2">
                <EmptyState
                  icon={<ClipboardList size={24} strokeWidth={1.75} />}
                  title={courseSessions.size === 0 ? t.attNoSessions : t.attNoMatches}
                  hint={courseSessions.size === 0 ? t.attNoSessionsHint : t.attNoMatchesHint}
                  className="border-dashed"
                />
              </div>
            ) : (
              <div className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
                {ledger.slice(0, visibleRows).map(({ session, course, finalStatus, kind, record }) => (
                  <div key={session.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="tnum text-[13px] font-semibold">
                        {fmtDay(session.starts_at, locale)} · {fmtTime(session.starts_at, locale)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground" dir="auto">
                        <span className="tnum font-semibold">{course?.code}</span>
                        {" · "}
                        {course ? (locale === "ar" ? course.name_ar : course.name_en) : ""}
                        {" · "}
                        {kind === "lecture" ? t.attKindLecture : kind === "section" ? t.attKindSection : t.attKindOther}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {record && finalStatus !== "present" && !pendingDisputes.has(record.id) && (
                        <button
                          type="button"
                          onClick={() => openDispute(record)}
                          className="min-h-[44px] rounded px-1.5 text-[11px] font-semibold text-primary hover:underline"
                        >
                          {t.attDispute}
                        </button>
                      )}
                      {record && pendingDisputes.has(record.id) && (
                        <span className="text-[10px] font-semibold text-muted-foreground">{t.attPending}</span>
                      )}
                      <StatusPill status={finalStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ledger.length > visibleRows && (
              <Button variant="outline" className="mt-2 min-h-[44px] w-full" onClick={() => setVisibleRows(v => v + 40)}>
                {t.attShowMore} · {ledger.length - visibleRows}
              </Button>
            )}
          </section>
        </>
      )}

      {/* requests: excuses and disputes */}
      <section className="mt-6" aria-label={t.attExcuses}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">{t.attExcuses}</h2>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => openExcuse()}>
            <FileText size={15} strokeWidth={2} /> {t.attFileExcuse}
          </Button>
        </div>
        <div className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
          {excuses.length === 0 && <p className="px-4 py-4 text-[13px] text-muted-foreground">{t.attNoExcuses}</p>}
          {excuses.slice(0, 6).map(e => (
            <div key={e.id} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold" dir="auto">
                  {e.courses?.code ? `${e.courses.code} · ` : ""}{e.reason}
                </p>
                <RequestPill status={e.status} />
              </div>
              <p className="tnum mt-0.5 text-[10px] text-muted-foreground">
                {fmtDay(e.created_at, locale)}
                {e.comment ? ` · ${t.attDecisionNote}: ${e.comment}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-label={t.attDisputes}>
        <h2 className="font-display text-lg font-bold">{t.attDisputes}</h2>
        <div className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
          {disputes.length === 0 && <p className="px-4 py-4 text-[13px] text-muted-foreground">{t.attNoDisputes}</p>}
          {disputes.slice(0, 6).map(d => (
            <div key={d.id} className="flex items-start justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold" dir="auto">{d.reason}</p>
                <p className="tnum mt-0.5 text-[10px] text-muted-foreground">{fmtDay(d.created_at, locale)}</p>
              </div>
              <RequestPill status={d.status} />
            </div>
          ))}
        </div>
      </section>

      <BottomSheet
        open={excuseOpen}
        onOpenChange={setExcuseOpen}
        title={t.attExcuseTitle}
        description={t.attIntro}
        footer={
          <Button className="min-h-[44px] w-full" onClick={sendExcuse} disabled={excuseSaving || !excuseForm.course_id || excuseForm.reason.trim().length < 5}>
            {excuseSaving ? "…" : t.save}
          </Button>
        }
      >
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="att-excuse-course">{t.attExcuseCourse}</Label>
            <select
              id="att-excuse-course"
              value={excuseForm.course_id}
              onChange={e => setExcuseForm({ ...excuseForm, course_id: e.target.value, session_id: "" })}
              className="flex min-h-[44px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— {t.attExcuseCourse}</option>
              {excuseCourses.map(c => (
                <option key={c.id} value={c.id}>{c.code} · {locale === "ar" ? c.name_ar : c.name_en}</option>
              ))}
            </select>
          </div>
          {excuseForm.course_id && (
            <div className="space-y-1.5">
              <Label htmlFor="att-excuse-session">{t.attExcuseSession}</Label>
              <select
                id="att-excuse-session"
                value={excuseForm.session_id}
                onChange={e => setExcuseForm({ ...excuseForm, session_id: e.target.value })}
                className="flex min-h-[44px] w-full rounded-base border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">— {t.attExcuseSession}</option>
                {excuseSessions.map(s => (
                  <option key={s.id} value={s.id}>{fmtDay(s.starts_at, locale)} · {fmtTime(s.starts_at, locale)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="att-excuse-reason">{t.attExcuseReason}</Label>
            <Textarea
              id="att-excuse-reason"
              rows={4}
              dir="auto"
              value={excuseForm.reason}
              onChange={e => setExcuseForm({ ...excuseForm, reason: e.target.value })}
              placeholder={t.attDisputeReason}
            />
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        title={t.attDisputeTitle}
        description={
          disputeRecord
            ? `${fmtDay(disputeRecord.scanned_at, locale)} · ${fmtTime(disputeRecord.scanned_at, locale)} · ${disputeRecord.status}`
            : undefined
        }
        footer={
          <Button className="min-h-[44px] w-full" onClick={sendDispute} disabled={disputeSaving || disputeReason.trim().length < 5}>
            {disputeSaving ? "…" : t.attDispute}
          </Button>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="att-dispute-reason">{t.attDisputeReason}</Label>
          <Textarea
            id="att-dispute-reason"
            rows={4}
            dir="auto"
            value={disputeReason}
            onChange={e => setDisputeReason(e.target.value)}
            placeholder={t.attDisputeReason}
          />
          <p className="text-[11px] text-muted-foreground">{t.attReasonShort}</p>
        </div>
      </BottomSheet>
    </main>
  );
}

function RequestPill({ status }: { status: string }) {
  const { t } = useApp();
  if (status === "approved") return <StatusPill status="present" label={t.attApproved} />;
  if (status === "rejected") return <StatusPill status="absent" label={t.attRejected} />;
  return <StatusPill status="scheduled" label={t.attPending} />;
}
