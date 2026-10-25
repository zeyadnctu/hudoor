/**
 * Attendance math — the single source of truth for every percentage shown in
 * the product. Dependency-free so it is unit-testable and safe to import from
 * both server code and the client bundle.
 *
 * Rules (see Master Build Prompt §5):
 * - counted = present + late × late_weight (default 1)
 * - excused sessions leave the denominator entirely
 * - only sessions that have finished are counted; future ones are ignored
 * - lectures and sections are summarised separately and combined by a
 *   per-course rule: "all" (default), "worst", or "weighted"
 * - threshold comes from the course rule (`min_pct`, default 75)
 */

export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type SessionKind = "lecture" | "section" | "other";
export type CombineRule = "all" | "worst" | "weighted";
export type AttendanceVerdict = "safe" | "watch" | "at_risk" | "none";

export type CourseAttendanceRule = {
  /** Minimum passing percentage. Legacy key `min_pct` is accepted. */
  threshold?: number;
  /** How much a late counts towards the numerator. Default 1. */
  lateWeight?: number;
  /** How lecture and section percentages become the course percentage. */
  combine?: CombineRule;
  lectureWeight?: number;
  sectionWeight?: number;
};

export type AttendanceSession = {
  id: string;
  kind?: SessionKind | null;
  /** Final status. Omit or set null for a session that is not over yet. */
  status?: AttendanceStatus | null;
  /** ISO start, used only to build the heatmap in the caller. */
  startsAt?: string | null;
};

export type KindSummary = {
  kind: SessionKind;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  counted: number;
  percent: number;
};

export type AttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** present + late + absent — the denominator after excused removal */
  total: number;
  /** present + late × lateWeight */
  counted: number;
  percent: number;
  threshold: number;
  verdict: AttendanceVerdict;
  combine: CombineRule;
  byKind: KindSummary[];
  /** Absences still available before the percentage drops below threshold. */
  safeMisses: number;
};

export const DEFAULT_THRESHOLD = 75;
export const DEFAULT_LATE_WEIGHT = 1;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Coerce the free-form `courses.attendance_rule` JSON into safe values. */
export function normalizeRule(raw: unknown): Required<CourseAttendanceRule> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const rawCombine = o.combine;
  const combine: CombineRule =
    rawCombine === "worst" || rawCombine === "weighted" || rawCombine === "all" ? rawCombine : "all";
  return {
    threshold: num(o.min_pct ?? o.threshold, DEFAULT_THRESHOLD, 1, 100),
    lateWeight: num(o.late_weight ?? o.lateWeight, DEFAULT_LATE_WEIGHT, 0, 1),
    combine,
    lectureWeight: num(o.lecture_weight ?? o.lectureWeight, 1, 0, 100),
    sectionWeight: num(o.section_weight ?? o.sectionWeight, 1, 0, 100)
  };
}

/** Sessions that are over and can affect the percentage. */
function isCountable(s: AttendanceSession): boolean {
  return s.status != null && (s.status === "present" || s.status === "late" || s.status === "absent" || s.status === "excused");
}

export function emptyKind(kind: SessionKind): KindSummary {
  return { kind, present: 0, late: 0, absent: 0, excused: 0, total: 0, counted: 0, percent: 0 };
}

function tally(list: AttendanceSession[], lateWeight: number, kind: SessionKind = "other"): KindSummary {
  const out: KindSummary = { kind, present: 0, late: 0, absent: 0, excused: 0, total: 0, counted: 0, percent: 0 };
  for (const s of list) {
    if (!isCountable(s)) continue;
    if (s.status === "present") out.present++;
    else if (s.status === "late") out.late++;
    else if (s.status === "absent") out.absent++;
    else if (s.status === "excused") out.excused++;
  }
  out.total = out.present + out.late + out.absent;
  out.counted = round1(out.present + out.late * lateWeight);
  out.percent = out.total === 0 ? 0 : Math.round((out.counted / out.total) * 100);
  return out;
}

function verdictFor(percent: number, total: number, threshold: number): AttendanceVerdict {
  if (total === 0) return "none";
  if (percent >= threshold) return "safe";
  // Within ten points of the line is "watch"; below that is "at risk".
  if (percent >= threshold - 10) return "watch";
  return "at_risk";
}

/**
 * Summarise one course. Only finished sessions with a status should be passed
 * in; pending sessions are ignored defensively.
 */
export function summariseAttendance(
  sessions: AttendanceSession[],
  rawRule?: unknown
): AttendanceSummary {
  const rule = normalizeRule(rawRule);
  const finished = sessions.filter(isCountable);
  const all = tally(finished, rule.lateWeight);
  const lectures = tally(finished.filter(s => s.kind === "lecture"), rule.lateWeight, "lecture");
  const sections = tally(finished.filter(s => s.kind === "section"), rule.lateWeight, "section");
  const byKind = [lectures, sections].filter(k => k.total + k.excused > 0);

  let percent = all.percent;
  if (rule.combine === "worst" && lectures.total > 0 && sections.total > 0) {
    percent = Math.min(lectures.percent, sections.percent);
  } else if (rule.combine === "weighted" && lectures.total > 0 && sections.total > 0) {
    const lw = rule.lectureWeight;
    const sw = rule.sectionWeight;
    const denom = lw + sw;
    percent = denom > 0 ? Math.round((lectures.percent * lw + sections.percent * sw) / denom) : all.percent;
  }

  const threshold = rule.threshold;
  // Additional misses allowed: solved from counted / (total + m) ≥ threshold.
  // Counted does not grow when a future class is missed, but total does.
  const capacity = threshold > 0 ? (all.counted * 100) / threshold : Infinity;
  const safeMisses = all.total === 0 || !Number.isFinite(capacity)
    ? 0
    : Math.max(0, Math.floor(capacity - all.total));

  return {
    present: all.present,
    late: all.late,
    absent: all.absent,
    excused: all.excused,
    total: all.total,
    counted: all.counted,
    percent,
    threshold,
    verdict: verdictFor(percent, all.total, threshold),
    combine: rule.combine,
    byKind,
    safeMisses
  };
}

/**
 * Build the per-day heatmap cells. A day with several sessions takes the
 * least favourable status so a missed section cannot hide under a lecture.
 */
export function heatmapCells(
  sessions: Array<{ startsAt: string; status: AttendanceStatus }>,
  timeZone = "Africa/Cairo"
): Array<{ date: string; status: AttendanceStatus }> {
  const severity: Record<AttendanceStatus, number> = { present: 0, excused: 1, late: 2, absent: 3 };
  const byDay = new Map<string, AttendanceStatus>();
  for (const s of sessions) {
    const d = new Date(s.startsAt);
    if (Number.isNaN(+d)) continue;
    let date: string;
    try {
      date = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
      }).format(d);
    } catch {
      date = d.toISOString().slice(0, 10);
    }
    const prev = byDay.get(date);
    if (!prev || severity[s.status] > severity[prev]) byDay.set(date, s.status);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, status]) => ({ date, status }));
}

/** Label for the combined verdict. */
export function verdictLabelKey(v: AttendanceVerdict): "attSafe" | "attWatch" | "attAtRisk" | "attNoData" {
  switch (v) {
    case "safe": return "attSafe";
    case "watch": return "attWatch";
    case "at_risk": return "attAtRisk";
    default: return "attNoData";
  }
}
