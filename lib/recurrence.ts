// Recurrence: expand period-model slots into dated occurrences, regenerate
// future unstarted ones when a slot changes. Dependency-light (pure helpers
// unit-tested; DB writes live in the timetable API route).

export type GridPeriod = { start: string; end: string };
export type OccSlot = {
  id: string;
  day: number; // JS getDay(): 0=Sun..6=Sat
  start_period: number | null;
  period_count?: number | null;
  starts_at: string; // "HH:MM" fallback
  ends_at: string; // "HH:MM" fallback
};

export type Occurrence = { date: string; starts_at: string; ends_at: string };

/** Times for a slot: grid span when period model present, else stored times. */
export function slotTimes(slot: OccSlot, grid: GridPeriod[]): { start: string; end: string } {
  if (
    slot.start_period !== null && slot.start_period !== undefined &&
    grid[slot.start_period] && grid[slot.start_period + Math.max(1, slot.period_count ?? 1) - 1]
  ) {
    const last = slot.start_period + Math.max(1, slot.period_count ?? 1) - 1;
    return { start: grid[slot.start_period].start, end: grid[last].end };
  }
  return { start: slot.starts_at.slice(0, 5), end: slot.ends_at.slice(0, 5) };
}

function inBlock(dateISO: string, blocks: { starts_at: string; ends_at: string }[]): boolean {
  return blocks.some(b => dateISO >= b.starts_at.slice(0, 10) && dateISO <= b.ends_at.slice(0, 10));
}

/**
 * Weekly occurrences of one slot between two dates (inclusive), skipping
 * holiday/exam blocks. Merged cells are ONE occurrence: first start → last end.
 */
export function expandSlotOccurrences(
  slot: OccSlot,
  fromISO: string,
  toISO: string,
  grid: GridPeriod[],
  blocks: { starts_at: string; ends_at: string }[] = []
): Occurrence[] {
  const { start: tStart, end: tEnd } = slotTimes(slot, grid);
  const out: Occurrence[] = [];
  const startD = new Date(fromISO + "T00:00:00");
  const endD = new Date(toISO + "T00:00:00");
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (d.getDay() !== slot.day) continue;
    if (inBlock(iso, blocks)) continue;
    out.push({ date: iso, starts_at: tStart, ends_at: tEnd });
  }
  return out;
}

/** A session is regenerable only if future, unstarted, and record-free. */
export function isRegenerable(s: { starts_at: string; status: string; recordCount: number }, nowISO: string): boolean {
  return s.starts_at > nowISO && (s.status === "scheduled" || s.status === "cancelled") && s.recordCount === 0;
}
