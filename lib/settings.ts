// Scoped settings with inheritance: session > course > program > department > faculty > global.
// Dependency-free (values are JSON), so it is unit-testable.

export type ScopeType = "global" | "faculty" | "department" | "program" | "course" | "session";
export type SettingRow = { scope_type: ScopeType; scope_id: string | null; key: string; value: unknown };

const SCOPE_RANK: Record<ScopeType, number> = {
  global: 0, faculty: 1, department: 2, program: 3, course: 4, session: 5
};

/** Narrowest scope wins. */
export function effective<T>(rows: SettingRow[], key: string, fallback: T): T {
  let best: SettingRow | null = null;
  for (const r of rows) {
    if (r.key !== key) continue;
    if (!best || SCOPE_RANK[r.scope_type] > SCOPE_RANK[best.scope_type]) best = r;
  }
  if (!best) return fallback;
  return best.value as T;
}

/** Parse helpers: settings are stored as JSON (numbers may arrive as strings). */
export function asNum(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}
export function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return fallback;
}

/** Attendance verdict from scan timing. All inputs are server-measured. */
export function verdict(
  scannedAtMs: number, startsAtMs: number,
  opts: { presentWithinMin: number; lateAfterMin: number; graceMin: number; allowLate: boolean }
): "present" | "late" | "absent" {
  const mins = (scannedAtMs - startsAtMs) / 60000;
  if (mins <= opts.presentWithinMin + opts.graceMin) return "present";
  if (opts.allowLate && mins <= opts.lateAfterMin + opts.graceMin) return "late";
  return "absent";
}

/** Participation score 0..100 from present/late/total with configurable weights.
 *  Late counts fully by default (Master Build Prompt §5). */
export function participation(
  present: number, late: number, total: number,
  formula: { lateWeight?: number } = {}
): number {
  if (total <= 0) return 0;
  const w = Math.min(1, Math.max(0, formula.lateWeight ?? 1));
  return Math.max(0, Math.min(100, Math.round(((present + late * w) / total) * 100)));
}
