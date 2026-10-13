"use strict";
// Scoped settings with inheritance: session > course > department > faculty > global.
// Dependency-free (values are JSON), so it is unit-testable.
Object.defineProperty(exports, "__esModule", { value: true });
exports.effective = effective;
exports.asNum = asNum;
exports.asBool = asBool;
exports.verdict = verdict;
exports.participation = participation;
const SCOPE_RANK = {
    global: 0, faculty: 1, department: 2, course: 3, session: 4
};
/** Narrowest scope wins. */
function effective(rows, key, fallback) {
    let best = null;
    for (const r of rows) {
        if (r.key !== key)
            continue;
        if (!best || SCOPE_RANK[r.scope_type] > SCOPE_RANK[best.scope_type])
            best = r;
    }
    if (!best)
        return fallback;
    return best.value;
}
/** Parse helpers: settings are stored as JSON (numbers may arrive as strings). */
function asNum(v, fallback) {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : fallback;
}
function asBool(v, fallback) {
    if (typeof v === "boolean")
        return v;
    if (typeof v === "string")
        return v === "true" || v === "1";
    return fallback;
}
/** Attendance verdict from scan timing. All inputs are server-measured. */
function verdict(scannedAtMs, startsAtMs, opts) {
    const mins = (scannedAtMs - startsAtMs) / 60000;
    if (mins <= opts.presentWithinMin + opts.graceMin)
        return "present";
    if (opts.allowLate && mins <= opts.lateAfterMin + opts.graceMin)
        return "late";
    return "absent";
}
/** Participation score 0..100 from present/late/total with configurable weights. */
function participation(present, late, total, formula = {}) {
    if (total <= 0)
        return 0;
    const w = formula.lateWeight ?? 0.5;
    return Math.max(0, Math.min(100, Math.round(((present + late * w) / total) * 100)));
}
