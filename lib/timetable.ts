// Timetable clash detection + session generation (dependency-free, unit-tested).

export type Slot = {
  id?: string;
  day: number; // 0=Sun..6=Sat
  starts_at: string; // "HH:MM"
  ends_at: string;
  room_id?: string | null;
  professor_id?: string | null;
  section?: string;
  group_name?: string;
  course_id?: string;
};

export function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function overlaps(a: Slot, b: Slot): boolean {
  if (a.day !== b.day) return false;
  return toMin(a.starts_at) < toMin(b.ends_at) && toMin(b.starts_at) < toMin(a.ends_at);
}

export type Clash = { type: "room" | "professor" | "section"; slotA: Slot; slotB: Slot };

/** Pairwise clash report across room / professor / section dimensions. */
export function detectClashes(slots: Slot[]): Clash[] {
  const out: Clash[] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const A = slots[i], B = slots[j];
      if (!overlaps(A, B)) continue;
      if (A.room_id && B.room_id && A.room_id === B.room_id)
        out.push({ type: "room", slotA: A, slotB: B });
      if (A.professor_id && B.professor_id && A.professor_id === B.professor_id)
        out.push({ type: "professor", slotA: A, slotB: B });
      const sameSection = (A.course_id && A.course_id === B.course_id) ||
        ((A.section || "A") === (B.section || "A") && (A.group_name || "") === (B.group_name || ""));
      if (sameSection) out.push({ type: "section", slotA: A, slotB: B });
    }
  }
  return out;
}

export type Block = { starts_at: string; ends_at: string }; // YYYY-MM-DD

function inBlock(dateISO: string, blocks: Block[]): boolean {
  return blocks.some(b => dateISO >= b.starts_at && dateISO <= b.ends_at);
}

/**
 * Expand weekly slots into concrete session datetimes for a date range,
 * skipping holidays/exam blocks. Returns {date, slot} pairs.
 */
export function expandSemester(
  slots: Slot[], fromISO: string, toISO: string, blocks: Block[] = []
): { date: string; slot: Slot }[] {
  const out: { date: string; slot: Slot }[] = [];
  const start = new Date(fromISO + "T00:00:00");
  const end = new Date(toISO + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // local calendar date (never UTC-shifted): weekday and iso must agree
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (inBlock(iso, blocks)) continue;
    const day = d.getDay();
    for (const s of slots) {
      if (s.day === day) out.push({ date: iso, slot: s });
    }
  }
  return out;
}
