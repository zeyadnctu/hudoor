// NTG grid timetable parser (NCTU PDFs: days-as-columns, 40-min period grid).
// Dependency-light (pdfjs only inside extractPositioned via dynamic import)
// so unit tests can compile this file with plain tsc.
//
// Verified against NTG V3 (1)(1).pdf — see tests/ntg-pdf.test.mjs fixture.

export type GridPeriod = { start: string; end: string };
export type PositionedItem = { x: number; y: number; str: string };
export type PositionedPage = { width: number; items: PositionedItem[] };

export type NtgCell = {
  day: string; dayNum: number;
  start: string; end: string;
  startPeriod: number; endPeriod: number;
  spanAmbiguous: boolean;
  course: string; person: string; personNorm: string;
  role: "lecturer" | "section" | "";
  sessionType: "lecture" | "section" | "";
  room: string;
  levelText: string; groupText: string;
  confidence: number; raw: string;
  warnings: string[];
};

export type NtgBlock = { levelText: string; groupText: string; rows: NtgCell[] };
export type NtgParse = {
  blocks: NtgBlock[];
  meta: { college: string; titleYear: string };
  method: string; pages: number;
};

export const DEFAULT_GRID: GridPeriod[] = [
  { start: "09:00", end: "09:40" }, { start: "09:40", end: "10:20" },
  { start: "10:30", end: "11:10" }, { start: "11:10", end: "11:50" },
  { start: "12:00", end: "12:40" }, { start: "12:40", end: "13:20" },
  { start: "13:30", end: "14:10" }, { start: "15:00", end: "15:40" },
  { start: "15:40", end: "16:20" }
];

export const DEFAULT_PREFIXES = {
  lecturer: ["dr", "dr.", "dr:", "د/", "أ.د/", "أ.د.", "د."],
  section: ["eng", "eng.", "م/", "م."]
};

const DAY_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_AR: Record<string, number> = {
  "الأحد": 0, "الاثنين": 1, "الثلاثاء": 2, "الأربعاء": 3,
  "الخميس": 4, "الجمعة": 5, "السبت": 6
};
const DAY_NUM: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

const FOOTER_KEYS = ["عميد", "وكيل", "منسق", "اعداد الجدول", "إعداد الجدول", "التعليم والطلاب",
  "dean", "vice", "coordinator", "preparer", "schedule preparer"];
const TITLE_KEYS = ["university", "faculty of", "time table", "timetable", "كلية", "جامعة", "جدول"];

/** Fold Arabic presentation forms (U+FB50–FEFF, as emitted by custom PDF
 *  fonts) to standard letters so keyword matching works on raw PDF text. */
export function foldAr(s: string): string {
  try { return (s ?? "").normalize("NFKC"); } catch { return s ?? ""; }
}

export function isFooterLine(s: string): boolean {
  const t = foldAr(s).toLowerCase();
  return FOOTER_KEYS.some(k => t.includes(k.toLowerCase()));
}
export function isTitleLine(s: string): boolean {
  const t = foldAr(s).toLowerCase();
  return TITLE_KEYS.some(k => t.includes(k)) || /\b20\d{2}\s*-\s*20?\d{2}\b/.test(s);
}

/** Day label match (full EN/AR, or fragment len>=4 of an English name).
 *  Ambiguous fragments (e.g. "nday" = sunday AND monday) return null —
 *  page-continuation strips then attach to the nearest day positionally. */
export function parseDayLabel(s: string): number | null {
  const t = foldAr(s).trim().toLowerCase();
  if (!t) return null;
  if (DAY_AR[t] !== undefined) return DAY_AR[t];
  for (const n of DAY_EN) if (t === n || t === n.slice(0, 3)) return DAY_NUM[n.slice(0, 3)];
  const hits = DAY_EN.filter(n => t.length >= 4 && (n.startsWith(t) || n.endsWith(t)));
  const uniq = [...new Set(hits.map(n => DAY_NUM[n.slice(0, 3)]))];
  return uniq.length === 1 ? uniq[0] : null;
}

function normTimePart(p: string): string | null {
  const m = p.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

/** "9-9:40" | "12:00- 12:40" | "3:40 - 4:20" -> [start,end] or null. */
export function parseTimeRange(s: string): [string, string] | null {
  const parts = s.split(/[-–—]/);
  if (parts.length < 2) return null;
  const a = normTimePart(parts[0]);
  const b = normTimePart(parts[parts.length - 1]);
  if (!a || !b || a >= b) return null;
  return [a, b];
}

const TIMEY = /(\d{1,2}\s*[:.]\s*\d{2})|^\s*\d{1,2}\s*-\s*\d/;

/** Person normalization for fuzzy matching across spellings. */
export function normalizePerson(s: string): string {
  return foldAr(s ?? "").toLowerCase()
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/\b(dr|eng|م|د|أ\.د)\b\.?/gi, " ")
    .replace(/[.]/g, " ")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .trim().replace(/\s+/g, " ");
}

export type TitlePrefixes = { lecturer: string[]; section: string[] };

function tokenIs(tok: string, list: string[]): boolean {
  const t = foldAr(tok).toLowerCase();
  return list.some(p => t === foldAr(p).toLowerCase());
}

export type CellParse = {
  course: string; person: string; personNorm: string;
  role: "lecturer" | "section" | ""; sessionType: "lecture" | "section" | "";
  room: string; secHint: boolean; hasTitle: boolean;
};

export type CellLine = { y: number; str: string };

/** Parse one cell from its text lines (order-independent).
 *  Room = last [A-Z]000 token anywhere; title = first title token;
 *  person = after-title text + the room line's remainder (when separate);
 *  course = everything else (y-ascending) + before-title text. */
export function parseCellLines(lines: CellLine[], prefixes: TitlePrefixes = DEFAULT_PREFIXES): CellParse {
  const norm = lines.map(l => ({ y: l.y, str: l.str.trim().replace(/\s+/g, " ") })).filter(l => l.str);
  // room: last room-like token across the cell (record its line first)
  let room = "";
  let roomLineIdx = -1;
  norm.forEach((l, i) => {
    const ms = [...l.str.matchAll(/([A-Z]\d{3})/g)];
    if (ms.length) { room = ms[ms.length - 1][1]; roomLineIdx = i; }
  });
  const stripped = norm.map(l => {
    if (!room) return { ...l };
    const cut = l.str.lastIndexOf(room);
    if (cut < 0) return { ...l };
    return { ...l, str: (l.str.slice(0, cut) + " " + l.str.slice(cut + room.length)).trim().replace(/\s+/g, " ") };
  });
  const titleIdx = (s: string) => {
    const toks = s.split(" ").filter(Boolean);
    for (let i = 0; i < toks.length; i++) {
      if (tokenIs(toks[i], prefixes.lecturer)) return { i, role: "lecturer" as const, toks };
      if (tokenIs(toks[i], prefixes.section)) return { i, role: "section" as const, toks };
    }
    return null;
  };
  const byY = [...stripped].sort((a, b) => b.y - a.y);
  const tline = byY.find(l => titleIdx(l.str));
  if (!tline) {
    const joined = byY.map(l => l.str).join(" ");
    const toks = joined.split(" ").filter(Boolean);
    const si = toks.findIndex(x => x.toLowerCase() === "sec");
    if (si >= 0) {
      return {
        course: toks.slice(0, si).join(" ").trim(), person: toks.slice(si + 1).join(" ").trim(),
        personNorm: "", role: "section", sessionType: "section",
        room, secHint: true, hasTitle: false
      };
    }
    return { course: joined.trim(), person: "", personNorm: "", role: "", sessionType: "", room, secHint: false, hasTitle: false };
  }
  const found = titleIdx(tline.str)!;
  const role = found.role;
  const before = found.toks.slice(0, found.i);
  if (before.length && before[before.length - 1].toLowerCase() === "sec") before.pop();
  const after = found.toks.slice(found.i + 1);
  // room-line remainder completes the person ONLY when the room stands apart
  // (e.g. "Medhat" under "Dr: Sara"); pure-room lines contribute nothing
  let person = after.join(" ").trim();
  const titleLineIdx = stripped.indexOf(tline);
  if (roomLineIdx >= 0 && roomLineIdx !== titleLineIdx) {
    const rem = stripped[roomLineIdx].str;
    const rw = rem.split(" ").filter(Boolean).filter(w => !tokenIs(w, prefixes.lecturer) && !tokenIs(w, prefixes.section));
    if (rem && rw.length >= 1 && rw.length <= 3) person = `${person} ${rem}`.trim();
  }
  const courseLines = stripped
    .map((l, i) => ({ l, i }))
    .filter(({ i }) => i !== stripped.indexOf(tline) && i !== roomLineIdx)
    .sort((a, b) => a.l.y - b.l.y)
    .map(({ l }) => l.str)
    .filter(Boolean);
  const course = [...courseLines, before.join(" ")].filter(Boolean).join(" ").trim();
  return {
    course, person: person.trim(),
    personNorm: normalizePerson(person),
    role, sessionType: role === "lecturer" ? "lecture" : "section",
    room, secHint: false, hasTitle: true
  };
}

/** Single-string wrapper (kept for compatibility). */
export function parseNTGCell(text: string, prefixes: TitlePrefixes = DEFAULT_PREFIXES): CellParse {
  return parseCellLines([{ y: 0, str: text }], prefixes);
}

/** Raw positioned text extraction (geometry preserved). Pages merged by width offset by caller. */
export async function extractPositioned(buffer: Buffer, maxPages = 50): Promise<PositionedPage[]> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true
  }).promise;
  const pages: PositionedPage[] = [];
  const n = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items: PositionedItem[] = [];
    for (const it of tc.items as any[]) {
      const s = String(it.str ?? "");
      if (!s.trim()) continue;
      items.push({ x: Math.round(it.transform[4] * 100) / 100, y: Math.round(it.transform[5] * 100) / 100, str: s });
    }
    pages.push({ width: Math.round(vp.width), items });
  }
  await doc.destroy().catch(() => {});
  return pages;
}

type Header = { x: number; start: string; end: string };
type DayBlock = { dayNum: number; day: string; cx: number; startX: number; endX: number; headers: Header[] };

const DAY_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const CLUSTER_GAP = 14;

/** Main NTG grid parse. Returns empty blocks when the layout is not detected. */
export function parseNTGGrid(
  pages: PositionedPage[],
  prefixes: TitlePrefixes = DEFAULT_PREFIXES,
  grid: GridPeriod[] = DEFAULT_GRID
): NtgParse {
  // merge pages with x-offset (continuation strips share the scale)
  let off = 0;
  const all: PositionedItem[] = [];
  for (const pg of pages) {
    for (const it of pg.items) all.push({ x: it.x + off, y: it.y, str: it.str });
    off += pg.width;
  }
  // meta: title lines
  const titleLines = all.filter(i => isTitleLine(i.str)).map(i => i.str.trim());
  const college = titleLines.find(l => /faculty of|كلية/i.test(l)) ?? "";
  const yearM = titleLines.join(" ").match(/\b(20\d{2}\s*-\s*20?\d{2})\b/);
  const meta = { college, titleYear: yearM ? yearM[1] : "" };

  // day labels (top band + anywhere; fragments allowed)
  const dayHits = all.filter(i => !isTitleLine(i.str) && parseDayLabel(i.str) !== null);
  if (!dayHits.length) return { blocks: [], meta, method: "ntg-grid", pages: pages.length };
  const byDay = new Map<number, number[]>();
  for (const h of dayHits) {
    const d = parseDayLabel(h.str)!;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(h.x);
  }
  const days = [...byDay.entries()]
    .map(([dayNum, xs]) => ({ dayNum, day: DAY_SHORT[dayNum], cx: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => a.cx - b.cx);

  // period headers: time-pattern items, stacked same-x merged
  const timeItems = all.filter(i => !isTitleLine(i.str) && TIMEY.test(i.str));
  const groups: { x: number; parts: { y: number; s: string }[] }[] = [];
  for (const it of timeItems.sort((a, b) => a.x - b.x || b.y - a.y)) {
    const g = groups.find(g => Math.abs(g.x - it.x) <= 4);
    if (g) g.parts.push({ y: it.y, s: it.str });
    else groups.push({ x: it.x, parts: [{ y: it.y, s: it.str }] });
  }
  // grid-aware time resolution: bare "1:30" means the grid's 13:30, not 01:30
  const gridTimes = new Set<string>();
  for (const g of grid) { gridTimes.add(g.start); gridTimes.add(g.end); }
  const resolveT = (t: string): string => {
    if (gridTimes.has(t)) return t;
    const m = t.match(/^(\d{2}):(\d{2})$/);
    if (m) {
      const h = Number(m[1]);
      if (h < 8) {
        const pm = `${String(h + 12).padStart(2, "0")}:${m[2]}`;
        if (gridTimes.has(pm)) return pm;
      }
    }
    return t;
  };
  const headers = groups
    .map(g => ({ x: g.x, range: parseTimeRange(g.parts.sort((a, b) => b.y - a.y).map(p => p.s).join(" ")) }))
    .filter(h => h.range)
    .map(h => ({ x: h.x, range: [resolveT((h.range as [string, string])[0]), resolveT((h.range as [string, string])[1])] as [string, string] }));

  // assign headers to day blocks SEQUENTIALLY (9 period columns per day in
  // x-order). Nearest-center assignment misfires at block edges (a header 90px
  // past its label loses to the next label 75px away), so days are consumed
  // left-to-right: group i belongs to the i-th day label. Short final blocks
  // (page-continuation strips) keep whatever headers they have.
  const sortedLabels = [...days].sort((a, b) => a.cx - b.cx);
  const sortedHeaders = [...headers].sort((a, b) => a.x - b.x);
  const PER_DAY = Math.max(1, grid.length);
  const blocks: (DayBlock & { minX: number })[] = sortedLabels.map(d => ({ ...d, startX: 0, endX: 0, headers: [], minX: Infinity }));
  sortedHeaders.forEach((h, idx) => {
    const bi = Math.min(Math.floor(idx / PER_DAY), blocks.length - 1);
    blocks[bi].headers.push({ x: h.x, start: h.range[0], end: h.range[1] });
    blocks[bi].minX = Math.min(blocks[bi].minX, h.x);
  });
  // block x-ranges
  const maxX = Math.max(...all.map(i => i.x), 0);
  blocks.forEach((b, i) => {
    b.headers.sort((a, z) => a.x - z.x);
    b.startX = (b.headers[0]?.x ?? b.cx) - 12;
    b.endX = i + 1 < blocks.length ? blocks[i + 1].headers[0]?.x ?? maxX + 40 : maxX + 40;
  });
  // left-edge columns per block
  const cols = blocks.map(b => {
    const xs = b.headers.map(h => h.x);
    return xs.map((x, i) => ({
      start: x, end: i + 1 < xs.length ? xs[i + 1] : b.endX,
      tStart: b.headers[i].start, tEnd: b.headers[i].end
    }));
  });

  // footer cut: below max footer-keyword y
  const footY = all.filter(i => isFooterLine(i.str)).map(i => i.y);
  const footCut = footY.length ? Math.max(...footY) + 8 : -Infinity;

  // row blocks: level/sec labels in left margin (exact header words excluded)
  const marginX = Math.min(...blocks.map(b => b.startX));
  const isMarginHeaderWord = (s: string) => /^(class|section|day|اليوم)$/i.test(s.trim());
  const labels = all.filter(i => {
    if (i.x >= marginX || isTitleLine(i.str) || isMarginHeaderWord(i.str)) return false;
    const t = foldAr(i.str);
    return /(\d)\s*(st|nd|rd|th)?\s*year/i.test(t) || /sec\s*\d*/i.test(t) || /سنة|شعبة|مجموعة/.test(t);
  }).sort((a, b) => b.y - a.y);
  const rowBlocks: { levelText: string; groupText: string; top: number; bottom: number }[] = [];
  {
    let lvl = "", grp = "";
    const sorted = [...labels];
    // level label = topmost year-like; group = sec-like below it (same region)
    const yearL = sorted.find(l => /year/i.test(foldAr(l.str)) || /سنة|مستوى/.test(foldAr(l.str)));
    const secL = sorted.find(l => /sec/i.test(foldAr(l.str)) || /شعبة|مجموعة/.test(foldAr(l.str)));
    lvl = yearL?.str.trim() ?? "";
    grp = secL?.str.trim() ?? "";
    const top = (yearL ? yearL.y : 720) + 30;
    rowBlocks.push({ levelText: lvl, groupText: grp, top, bottom: footCut });
  }

  // candidate cell lines: in a row band, right of margin, not header/label/title
  const headerSet = new Set(timeItems.map(i => `${Math.round(i.x)}:${Math.round(i.y)}:${i.str}`));
  const rows: NtgCell[] = [];
  const rowInfos: { rb: typeof rowBlocks[0]; items: PositionedItem[] }[] =
    rowBlocks.map(rb => ({ rb, items: [] }));
  for (const it of all) {
    if (isTitleLine(it.str) || isFooterLine(it.str)) continue;
    if (it.y < footCut) continue;
    if (headerSet.has(`${Math.round(it.x)}:${Math.round(it.y)}:${it.str}`)) continue;
    if (TIMEY.test(it.str)) continue; // stray time fragment
    if (it.x < marginX) continue; // row labels / margin noise
    const rb = rowBlocks.find(r => it.y <= r.top && it.y >= r.bottom);
    if (!rb) continue;
    rowInfos.find(r => r.rb === rb)!.items.push(it);
  }

  for (const { rb, items } of rowInfos) {
    // assign day by nearest block center, then cluster by x-start gap
    const perDay = new Map<number, PositionedItem[]>();
    for (const it of items) {
      let bi = 0, bd = Infinity;
      blocks.forEach((b, i) => { const dd = Math.abs(it.x - b.cx); if (dd < bd) { bd = dd; bi = i; } });
      const arr = perDay.get(bi) ?? [];
      arr.push(it);
      perDay.set(bi, arr);
    }
    for (const [bi, arr] of perDay) {
      const cc = cols[bi];
      if (!cc.length) continue;
      arr.sort((a, b) => a.x - b.x);
      const clusters: PositionedItem[][] = [];
      for (const it of arr) {
        const last = clusters[clusters.length - 1];
        const lastMax = last ? Math.max(...last.map(l => l.x)) : -Infinity;
        if (last && it.x - lastMax <= CLUSTER_GAP) last.push(it);
        else clusters.push([it]);
      }
      const colOf = (x: number) => {
        for (let i = 0; i < cc.length; i++) if (x >= cc[i].start - 1 && x < cc[i].end) return i;
        return -1;
      };
      const startsInBlock = arr.map(i => colOf(i.x)).filter(i => i >= 0);
      for (const cl of clusters) {
        const minX = Math.min(...cl.map(l => l.x));
        const sp = colOf(minX);
        const warnings: string[] = [];
        if (sp < 0) continue;
        const textPeriods = [...new Set(cl.map(l => colOf(l.x)).filter(i => i >= 0))].sort((a, b) => a - b);
        let ep = textPeriods[textPeriods.length - 1] ?? sp;
        let spanAmbiguous = false;
        // Sessions are 1-2 periods here: extend a single-period text span through
        // ONE trailing empty period (flagged for manual confirmation). Wider spans
        // always need the review screen.
        const next = ep + 1;
        if (textPeriods.length === 1 && next < cc.length &&
            !startsInBlock.includes(next) && cc[next].start < blocks[bi].endX) {
          ep = next;
          spanAmbiguous = true;
          warnings.push("span-extended");
        }
        const parsed = parseCellLines(cl.map(l => ({ y: l.y, str: l.str })), prefixes);
        const text = cl.sort((a, b) => b.y - a.y).map(l => l.str).join(" ");
        const conf = Math.max(0.2, 1 - 0.15 * warnings.length
          - (parsed.hasTitle ? 0 : 0.25) - (parsed.room ? 0 : 0.15) - (parsed.person ? 0 : 0.2));
        rows.push({
          day: blocks[bi].day, dayNum: blocks[bi].dayNum,
          start: cc[sp].tStart, end: cc[ep].tEnd,
          startPeriod: sp, endPeriod: ep, spanAmbiguous,
          course: parsed.course, person: parsed.person, personNorm: parsed.personNorm,
          role: parsed.role, sessionType: parsed.sessionType,
          room: parsed.room, levelText: rb.levelText, groupText: rb.groupText,
          confidence: Math.round(conf * 100) / 100,
          raw: text, warnings
        });
      }
    }
  }

  // cross-page dedupe: identical (day + normalized text) cells merge spans
  const merged: NtgCell[] = [];
  for (const r of rows.sort((a, b) => a.dayNum - b.dayNum || a.start.localeCompare(b.start))) {
    const key = `${r.dayNum}|${normalizePerson(r.course)}|${r.personNorm}|${r.room}`;
    const ex = merged.find(m => `${m.dayNum}|${normalizePerson(m.course)}|${m.personNorm}|${m.room}` === key);
    if (ex) {
      if (r.start < ex.start) { ex.start = r.start; ex.startPeriod = r.startPeriod; }
      if (r.end > ex.end) { ex.end = r.end; ex.endPeriod = r.endPeriod; }
      ex.spanAmbiguous = ex.spanAmbiguous || r.spanAmbiguous;
      ex.warnings = [...new Set([...ex.warnings, ...r.warnings])];
    } else merged.push(r);
  }
  return {
    blocks: [{ levelText: rowBlocks[0]?.levelText ?? "", groupText: rowBlocks[0]?.groupText ?? "", rows: merged }],
    meta, method: "ntg-grid", pages: pages.length
  };
}

/** Full extract: positioned text -> NTG grid parse (empty blocks when not detected). */
export async function extractNTG(
  buffer: Buffer,
  opts: { maxPages?: number; grid?: GridPeriod[]; prefixes?: TitlePrefixes } = {}
): Promise<NtgParse> {
  const pages = await extractPositioned(buffer, opts.maxPages ?? 50);
  return parseNTGGrid(pages, opts.prefixes, opts.grid);
}
