import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  summariseAttendance,
  normalizeRule,
  heatmapCells,
  verdictLabelKey
} from "../.testbuild/attendance.js";

const s = (status, kind = "lecture") => ({ id: `${status}-${kind}-${Math.random()}`, status, kind });

describe("attendance percentage", () => {
  it("defaults late weight to 1 (late counts fully)", () => {
    const r = summariseAttendance([s("present"), s("present"), s("late"), s("absent")]);
    assert.equal(r.total, 4);
    assert.equal(r.counted, 3);
    assert.equal(r.percent, 75);
  });

  it("removes excused sessions from the denominator", () => {
    const r = summariseAttendance([s("present"), s("present"), s("absent"), s("excused"), s("excused")]);
    assert.equal(r.total, 3);
    assert.equal(r.excused, 2);
    assert.equal(r.percent, 67);
  });

  it("honours a custom late weight", () => {
    const r = summariseAttendance([s("present"), s("late"), s("absent")], { late_weight: 0.5 });
    assert.equal(r.counted, 1.5);
    assert.equal(r.percent, 50);
  });

  it("does not let a late weight above 1 inflate the score", () => {
    const r = summarizeClamped();
    assert.equal(r.percent, 100);
  });

  it("ignores sessions that are not finished", () => {
    const r = summariseAttendance([
      { id: "a", status: "present" },
      { id: "b", status: null },
      { id: "c" }
    ]);
    assert.equal(r.total, 1);
    assert.equal(r.percent, 100);
  });

  it("returns 0/none for an empty course", () => {
    const r = summariseAttendance([]);
    assert.equal(r.total, 0);
    assert.equal(r.percent, 0);
    assert.equal(r.verdict, "none");
    assert.equal(r.safeMisses, 0);
    assert.equal(verdictLabelKey(r.verdict), "attNoData");
  });
});

describe("attendance verdicts and safe misses", () => {
  it("passes at the threshold and fails one point below", () => {
    // 3/4 = 75
    assert.equal(summariseAttendance([s("present"), s("present"), s("present"), s("absent")], { min_pct: 75 }).verdict, "safe");
    // 2/3 = 67 → within ten of 75 → watch
    assert.equal(summariseAttendance([s("present"), s("present"), s("absent")], { min_pct: 75 }).verdict, "watch");
    // 1/3 = 33 → at risk
    assert.equal(summariseAttendance([s("present"), s("absent"), s("absent")], { min_pct: 75 }).verdict, "at_risk");
  });

  it("calculates how many more absences are safe", () => {
    // 8/10 at 75%: one more absence yields 8/11 = 73% → zero safe misses
    const tight = summariseAttendance(Array(8).fill(0).map(() => s("present")).concat(Array(2).fill(0).map(() => s("absent"))));
    assert.equal(tight.percent, 80);
    assert.equal(tight.safeMisses, 0);
    // 9/10 at 75%: 9/12 = 75% → two safe misses, 9/13 = 69% is not
    const roomy = summariseAttendance(Array(9).fill(0).map(() => s("present")).concat([s("absent")]));
    assert.equal(roomy.safeMisses, 2);
  });

  it("gives an already-failing student zero safe misses", () => {
    const r = summariseAttendance([s("present"), s("absent"), s("absent"), s("absent")]);
    assert.equal(r.safeMisses, 0);
  });
});

describe("lecture and section split", () => {
  const sessions = [
    s("present", "lecture"), s("present", "lecture"), s("absent", "lecture"),
    s("present", "section"), s("absent", "section")
  ];

  it("reports each kind separately", () => {
    const r = summariseAttendance(sessions);
    const lecture = r.byKind.find(k => k.kind === "lecture");
    const section = r.byKind.find(k => k.kind === "section");
    assert.equal(lecture.percent, 67);
    assert.equal(section.percent, 50);
    // default combine = all
    assert.equal(r.percent, 60);
  });

  it("combines by the worst kind", () => {
    const r = summariseAttendance(sessions, { combine: "worst" });
    assert.equal(r.percent, 50);
  });

  it("combines with explicit weights", () => {
    const r = summariseAttendance(sessions, { combine: "weighted", lecture_weight: 2, section_weight: 1 });
    assert.equal(r.percent, 61); // (67*2 + 50)/3 = 61.33
  });

  it("falls back to the overall score when one kind is absent", () => {
    const r = summariseAttendance([s("present", "lecture"), s("absent", "lecture")], { combine: "worst" });
    assert.equal(r.percent, 50);
  });
});

describe("rule normalisation", () => {
  it("clamps bad input and accepts legacy min_pct", () => {
    assert.deepEqual(normalizeRule({ min_pct: 80, late_weight: 5, combine: "nonsense" }), {
      threshold: 80, lateWeight: 1, combine: "all", lectureWeight: 1, sectionWeight: 1
    });
    assert.equal(normalizeRule({ threshold: 0 }).threshold, 1);
    assert.equal(normalizeRule(null).threshold, 75);
  });
});

describe("heatmap", () => {
  it("keeps the least favourable status per day in Cairo time", () => {
    const cells = heatmapCells([
      { startsAt: "2026-10-10T07:00:00Z", status: "present" },
      { startsAt: "2026-10-10T09:00:00Z", status: "absent" },
      { startsAt: "2026-10-11T07:00:00Z", status: "late" }
    ]);
    assert.deepEqual(cells, [
      { date: "2026-10-10", status: "absent" },
      { date: "2026-10-11", status: "late" }
    ]);
  });
});

function summarizeClamped() {
  return summariseAttendance([s("late"), s("present")], { late_weight: 9 });
}
