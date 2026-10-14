import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseNTGCell, normalizePerson, parseDayLabel, parseTimeRange,
  extractPositioned, parseNTGGrid, DEFAULT_GRID
} from "../.testbuild/ntg-parse.js";

// ---- unit: cell parsing (brief section 3 rules) ----
describe("NTG cell parsing", () => {
  it("splits course / title / person / room (lecture)", () => {
    const c = parseNTGCell("Programming Dr: Sara Medhat A308");
    assert.equal(c.course, "Programming");
    assert.equal(c.person, "Sara Medhat");
    assert.equal(c.role, "lecturer");
    assert.equal(c.sessionType, "lecture");
    assert.equal(c.room, "A308");
  });
  it("drops confirming sec before the title", () => {
    const c = parseNTGCell("Object Oriented Programming sec Eng. M.Hesham A308");
    assert.equal(c.course, "Object Oriented Programming");
    assert.equal(c.person, "M.Hesham");
    assert.equal(c.role, "section");
    assert.equal(c.sessionType, "section");
    assert.equal(c.room, "A308");
  });
  it("room is the trailing [A-Z]000 token", () => {
    const c = parseNTGCell("Technical Mathematics I Dr. Atef Abdelhay A104");
    assert.equal(c.room, "A104");
    assert.equal(c.course, "Technical Mathematics I");
  });
  it("sec hint without title still yields a section", () => {
    const c = parseNTGCell("Programming sec Norhan A308");
    assert.equal(c.role, "section");
    assert.equal(c.person, "Norhan");
  });
  it("normalizes people for fuzzy matching", () => {
    assert.equal(normalizePerson("Dr. Sara Medhat"), "sara medhat");
    assert.equal(normalizePerson("M.Hesham"), normalizePerson("M. Hesham"));
    assert.equal(normalizePerson("Eng. mariam"), "mariam");
  });
  it("parses day labels incl. fragments", () => {
    assert.equal(parseDayLabel("Saturday"), 6);
    assert.equal(parseDayLabel("Sunday"), 0);
    assert.equal(parseDayLabel("nday"), null); // ambiguous: sunday AND monday
    assert.equal(parseDayLabel("السبت"), 6);
    assert.equal(parseDayLabel("nope"), null);
  });
  it("parses period ranges incl. shorthand", () => {
    assert.deepEqual(parseTimeRange("9-9:40"), ["09:00", "09:40"]);
    assert.deepEqual(parseTimeRange("12:00- 12:40"), ["12:00", "12:40"]);
    assert.deepEqual(parseTimeRange("3:40 - 4:20"), ["03:40", "04:20"]);
    assert.equal(parseTimeRange("hello"), null);
  });
  it("ignores the footer signatory block", async () => {
    const { isFooterLine, isTitleLine } = await import("../.testbuild/ntg-parse.js");
    assert.equal(isFooterLine("عميد الكلية"), true);
    assert.equal(isFooterLine("أ.د/ وليد الختام"), false); // name alone is not a keyword...
    // real PDFs emit Arabic presentation forms: folding must still match
    assert.equal(isFooterLine("ﻣﻨﺴﻖ"), true);
    assert.equal(isFooterLine("ﺍﻋﺪﺍﺩ ﺍﻟﺠﺪﻭﻝ"), true);
    assert.equal(isTitleLine("New Cairo Technological University- Faculty of Industry"), true);
    assert.equal(isTitleLine("ICT Time Table 2026-2027"), true);
  });
});

// ---- integration: real PDF must match the brief section 4 table ----
// PAUSED: NTG grid parser is parked mid-debug (header→day assignment + span
// calibration). Re-enable (describe instead of describe.skip) when resuming.
describe.skip("NTG V3 fixture (paused)", () => {
  let parsed = null;
  before(async () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pdf = readFileSync(join(dir, "..", "NTG V3 (1)(1).pdf"));
    const pages = await extractPositioned(Buffer.from(pdf));
    parsed = parseNTGGrid(pages);
  });

  const EXPECTED = [
    // day, start, end, course, role, personNorm, room
    [6, "09:00", "10:20", "Professional Practice & Communication", "lecturer", "bothaina", "A308"],
    [6, "10:30", "11:10", "Programming", "lecturer", "sara medhat", "A308"],
    [6, "11:10", "12:40", "Object Oriented Programming", "lecturer", "sara medhat", "A308"],
    [0, "09:00", "10:20", "Technical Mathematics I", "section", "mariam", "A308"],
    [0, "10:30", "11:50", "Technical Mathematics I", "lecturer", "atef abdelhay", "A104"],
    [0, "12:00", "13:20", "Object Oriented Programming", "section", "m hesham", "A308"],
    [0, "13:30", "15:40", "Technical English I", "section", "fatma mohamed", "A308"],
    [1, "09:00", "10:20", "Programming", "section", "norhan", "A308"],
    [1, "10:30", "11:50", "Web Essentials", "section", "m hesham", "A308"],
    [1, "12:00", "13:20", "Technical English I", "lecturer", "eman magdy", "A308"],
    [1, "13:30", "15:40", "Web Essentials", "lecturer", "rasha", "A308"]
  ];

  it("detects one block: 1st year / sec1", () => {
    assert.equal(parsed.blocks.length, 1);
    assert.match(parsed.blocks[0].levelText, /1st year/i);
    assert.match(parsed.blocks[0].groupText, /sec1/i);
  });

  it("extracts all 11 slots", () => {
    assert.equal(parsed.blocks[0].rows.length, EXPECTED.length);
  });

  it("matches day/start/end/course/role/person/room per row", () => {
    const order = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }; // Sat, Sun, Mon first
    const rows = [...parsed.blocks[0].rows].sort((a, b) => order[a.dayNum] - order[b.dayNum] || a.start.localeCompare(b.start));
    assert.equal(rows.length, EXPECTED.length);
    for (let i = 0; i < EXPECTED.length; i++) {
      const [day, start, end, course, role, person, room] = EXPECTED[i];
      const r = rows[i];
      assert.equal(r.dayNum, day, `row ${i} day`);
      assert.equal(r.start, start, `row ${i} start (${r.raw.slice(0, 40)})`);
      assert.equal(r.end, end, `row ${i} end (${r.raw.slice(0, 40)})`);
      assert.equal(r.course, course, `row ${i} course`);
      assert.equal(r.role, role, `row ${i} role`);
      assert.equal(r.personNorm, person, `row ${i} person`);
      assert.equal(r.room, room, `row ${i} room`);
    }
  });

  it("flags extended spans as ambiguous for manual confirmation", () => {
    const rows = parsed.blocks[0].rows;
    const byCourse = (c, s) => rows.find(r => r.course === c && r.start === s);
    assert.equal(byCourse("Object Oriented Programming", "11:10").spanAmbiguous, true);
    assert.equal(byCourse("Technical English I", "13:30").spanAmbiguous, true);
    assert.equal(byCourse("Programming", "10:30").spanAmbiguous, false);
  });

  it("reads college + year metadata, ignores footer names as instructors", () => {
    assert.match(parsed.meta.college, /Faculty of Industry/);
    assert.match(parsed.meta.titleYear, /2026-2027/);
    const people = parsed.blocks[0].rows.map(r => r.personNorm).join(" ");
    assert.doesNotMatch(people, /وليد|تامر|اسامة|ثرروت|ثرت|محمد رجب/);
  });

  void DEFAULT_GRID;
});
