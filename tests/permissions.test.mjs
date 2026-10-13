import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { can, ownsCourse, COURSE_SCOPED } from "../.testbuild/permissions.js";
import { effective, verdict, participation, asNum, asBool } from "../.testbuild/settings.js";
import { similarity, bestMatches, normalize } from "../.testbuild/match.js";
import { overlaps, detectClashes, expandSemester } from "../.testbuild/timetable.js";

// ---- permission boundaries ----
describe("permission matrix", () => {
  const admin = { id: "a", role: "admin", status: "approved" };
  const prof = { id: "p1", role: "professor", status: "approved" };
  const prof2 = { id: "p2", role: "professor", status: "approved" };
  const ta = { id: "t1", role: "student", custom_role: "ta", status: "approved" };
  const student = { id: "s1", role: "student", status: "approved" };
  const suspended = { id: "x", role: "admin", status: "suspended" };

  it("admin holds everything via wildcard", () => {
    assert.equal(can(admin, "settings", "edit"), true);
    assert.equal(can(admin, "users", "impersonate"), true);
    assert.equal(can(admin, "trash", "delete"), true);
  });
  it("student can never reach admin resources or APIs", () => {
    for (const r of ["users", "settings", "audit", "trash", "timetable", "rooms", "requests"])
      assert.equal(can(student, r, "manage"), false, r);
    assert.equal(can(student, "attendance", "view"), true);
    assert.equal(can(student, "disputes", "create"), true);
    assert.equal(can(student, "sessions", "create"), false);
  });
  it("suspended accounts lose everything", () => {
    assert.equal(can(suspended, "users", "view"), false);
  });
  it("custom role grants augment the system role", () => {
    assert.equal(can(ta, "attendance", "edit"), true); // TA grant
    assert.equal(can(ta, "sessions", "manage"), false); // professor-only
    assert.equal(can(student, "attendance", "edit"), false);
  });
  it("extra role_permissions rows grant custom roles", () => {
    const deptAdmin = { id: "d", role: "student", custom_role: "department_admin", status: "approved" };
    assert.equal(can(deptAdmin, "courses", "edit"), false);
    assert.equal(can(deptAdmin, "courses", "edit", [{ resource: "courses", action: "edit" }]), true);
  });
  it("instructor course ownership is scoped", () => {
    const ctx = { taught: ["c1"], assisted: [] };
    assert.equal(ownsCourse(prof, "c1", ctx), true);
    assert.equal(ownsCourse(prof, "c2", ctx), false); // another instructor's course
    assert.equal(ownsCourse(prof2, "c1", { taught: [], assisted: [] }), false);
    assert.equal(ownsCourse(admin, "anything", { taught: [], assisted: [] }), true);
    assert.equal(ownsCourse(ta, "c9", { taught: [], assisted: ["c9"] }), true);
    assert.equal(ownsCourse(ta, "c9", { taught: [], assisted: [] }), false);
  });
  it("course-scoped resources are declared", () => {
    for (const r of ["sessions", "attendance", "enrollments", "excuses", "disputes"])
      assert.ok(COURSE_SCOPED.includes(r), r);
  });
});

// ---- settings inheritance ----
describe("settings", () => {
  const rows = [
    { scope_type: "global", scope_id: null, key: "late_after_min", value: 10 },
    { scope_type: "course", scope_id: "c1", key: "late_after_min", value: 20 }
  ];
  it("narrower scope overrides wider", () => {
    assert.equal(effective(rows, "late_after_min", 0), 20);
    assert.equal(effective(rows, "missing", 7), 7);
  });
  it("verdict uses server timing", () => {
    const t0 = 1_000_000;
    assert.equal(verdict(t0 + 5 * 60_000, t0, { presentWithinMin: 10, lateAfterMin: 20, graceMin: 0, allowLate: true }), "present");
    assert.equal(verdict(t0 + 15 * 60_000, t0, { presentWithinMin: 10, lateAfterMin: 20, graceMin: 0, allowLate: true }), "late");
    assert.equal(verdict(t0 + 25 * 60_000, t0, { presentWithinMin: 10, lateAfterMin: 20, graceMin: 0, allowLate: true }), "absent");
    assert.equal(verdict(t0 + 15 * 60_000, t0, { presentWithinMin: 10, lateAfterMin: 20, graceMin: 0, allowLate: false }), "absent");
  });
  it("participation formula is bounded", () => {
    assert.equal(participation(8, 2, 10), 90);
    assert.equal(participation(0, 0, 0), 0);
    assert.equal(participation(10, 0, 10), 100);
  });
  it("lenient parsing", () => {
    assert.equal(asNum("15", 0), 15);
    assert.equal(asNum("x", 4), 4);
    assert.equal(asBool("true", false), true);
  });
});

// ---- fuzzy matching ----
describe("fuzzy match", () => {
  it("arabic normalization unifies alef/hamza forms", () => {
    assert.equal(normalize("أحمد"), normalize("احمد"));
    assert.ok(similarity("قواعد البيانات", "قواعد البيانات") === 1);
    assert.ok(similarity("قواعد البيانات", "فيزياء") < 0.4);
  });
  it("bestMatches ranks and thresholds", () => {
    const pool = [{ n: "CE201 Databases" }, { n: "CE302 Networks" }];
    const m = bestMatches("database ce201", pool, p => p.n);
    assert.equal(m[0].item.n, "CE201 Databases");
    assert.equal(bestMatches("zzz-nope", pool, p => p.n).length, 0);
  });
});

// ---- timetable ----
describe("timetable", () => {
  const a = { day: 1, starts_at: "09:00", ends_at: "10:00", room_id: "r1", professor_id: "p1", course_id: "c1" };
  const b = { day: 1, starts_at: "09:30", ends_at: "10:30", room_id: "r1", professor_id: "p2", course_id: "c2" };
  const c = { day: 2, starts_at: "09:30", ends_at: "10:30", room_id: "r1", professor_id: "p1", course_id: "c1" };
  it("overlap is day + time intersection", () => {
    assert.equal(overlaps(a, b), true);
    assert.equal(overlaps(a, c), false);
  });
  it("clash report names the dimension", () => {
    const types = detectClashes([a, b, c]).map(x => x.type).sort();
    assert.deepEqual(types, ["room", "section"]);
  });
  it("semester expansion skips blocks", () => {
    // 2026-09-07 is a Monday
    const out = expandSemester(
      [{ day: 1, starts_at: "09:00", ends_at: "10:00" }],
      "2026-09-07", "2026-09-14",
      [{ starts_at: "2026-09-14", ends_at: "2026-09-14" }]
    );
    assert.deepEqual(out.map(o => o.date), ["2026-09-07"]);
  });
});
