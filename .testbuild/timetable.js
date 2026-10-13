"use strict";
// Timetable clash detection + session generation (dependency-free, unit-tested).
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMin = toMin;
exports.overlaps = overlaps;
exports.detectClashes = detectClashes;
exports.expandSemester = expandSemester;
function toMin(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
}
function overlaps(a, b) {
    if (a.day !== b.day)
        return false;
    return toMin(a.starts_at) < toMin(b.ends_at) && toMin(b.starts_at) < toMin(a.ends_at);
}
/** Pairwise clash report across room / professor / section dimensions. */
function detectClashes(slots) {
    const out = [];
    for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
            const A = slots[i], B = slots[j];
            if (!overlaps(A, B))
                continue;
            if (A.room_id && B.room_id && A.room_id === B.room_id)
                out.push({ type: "room", slotA: A, slotB: B });
            if (A.professor_id && B.professor_id && A.professor_id === B.professor_id)
                out.push({ type: "professor", slotA: A, slotB: B });
            const sameSection = (A.course_id && A.course_id === B.course_id) ||
                ((A.section || "A") === (B.section || "A") && (A.group_name || "") === (B.group_name || ""));
            if (sameSection)
                out.push({ type: "section", slotA: A, slotB: B });
        }
    }
    return out;
}
function inBlock(dateISO, blocks) {
    return blocks.some(b => dateISO >= b.starts_at && dateISO <= b.ends_at);
}
/**
 * Expand weekly slots into concrete session datetimes for a date range,
 * skipping holidays/exam blocks. Returns {date, slot} pairs.
 */
function expandSemester(slots, fromISO, toISO, blocks = []) {
    const out = [];
    const start = new Date(fromISO + "T00:00:00");
    const end = new Date(toISO + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // local calendar date (never UTC-shifted): weekday and iso must agree
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (inBlock(iso, blocks))
            continue;
        const day = d.getDay();
        for (const s of slots) {
            if (s.day === day)
                out.push({ date: iso, slot: s });
        }
    }
    return out;
}
