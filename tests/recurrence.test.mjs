import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slotTimes, expandSlotOccurrences, isRegenerable } from "../.testbuild/recurrence.js";

const GRID = [
  { start: "09:00", end: "09:40" }, { start: "09:40", end: "10:20" },
  { start: "10:30", end: "11:10" }, { start: "11:10", end: "11:50" },
  { start: "12:00", end: "12:40" }, { start: "12:40", end: "13:20" },
  { start: "13:30", end: "14:10" }, { start: "15:00", end: "15:40" },
  { start: "15:40", end: "16:20" }
];

describe("recurrence", () => {
  it("merged cells become ONE session from first start to last end", () => {
    assert.deepEqual(
      slotTimes({ id: "x", day: 6, start_period: 0, period_count: 2, starts_at: "09:00", ends_at: "10:20" }, GRID),
      { start: "09:00", end: "10:20" }
    );
    assert.deepEqual(
      slotTimes({ id: "x", day: 1, start_period: 6, period_count: 2, starts_at: "13:30", ends_at: "15:40" }, GRID),
      { start: "13:30", end: "15:40" }
    );
  });
  it("falls back to stored times without a period model", () => {
    assert.deepEqual(
      slotTimes({ id: "x", day: 1, start_period: null, starts_at: "10:30:00", ends_at: "11:50:00" }, []),
      { start: "10:30", end: "11:50" }
    );
  });
  it("expands weekly occurrences until term end, skipping blocks", () => {
    const slot = { id: "s", day: 6, start_period: 0, period_count: 2, starts_at: "09:00", ends_at: "10:20" };
    // 2026-09-05 is a Saturday
    const out = expandSlotOccurrences(slot, "2026-09-05", "2026-09-19", GRID, [
      { starts_at: "2026-09-12", ends_at: "2026-09-12" }
    ]);
    assert.deepEqual(out.map(o => o.date), ["2026-09-05", "2026-09-19"]);
    assert.equal(out[0].starts_at, "09:00");
    assert.equal(out[0].ends_at, "10:20");
  });
  it("only future unstarted record-free sessions regenerate", () => {
    assert.equal(isRegenerable({ starts_at: "2099-01-01T09:00", status: "scheduled", recordCount: 0 }, "2026-01-01T00:00"), true);
    assert.equal(isRegenerable({ starts_at: "2099-01-01T09:00", status: "scheduled", recordCount: 2 }, "2026-01-01T00:00"), false);
    assert.equal(isRegenerable({ starts_at: "2020-01-01T09:00", status: "scheduled", recordCount: 0 }, "2026-01-01T00:00"), false);
    assert.equal(isRegenerable({ starts_at: "2099-01-01T09:00", status: "active", recordCount: 0 }, "2026-01-01T00:00"), false);
  });
});
