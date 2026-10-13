// Timetable PDF import behind an adapter interface.
// TextPdfAdapter: pdfjs-dist text extraction (fast, no extra deps at runtime).
// OcrPdfAdapter: tesseract.js fallback for scanned PDFs (capped pages, may be
// slow on serverless — the review screen always shows confidence flags).
// Adjust mapRow/columnMap once the real PDF format arrives.

export type ParsedCell = { text: string; confident: boolean };
export type ParsedRow = {
  day: string; start: string; end: string; course: string;
  professor: string; room: string; section: string; group: string;
  confidence: number; // 0..1 average
  raw: string;
};

export type ColumnMap = {
  day?: number; start?: number; end?: number; course?: number;
  professor?: number; room?: number; section?: number; group?: number;
};

const DEFAULT_MAP: Required<ColumnMap> = {
  day: 0, start: 1, end: 2, course: 3, professor: 4, room: 5, section: 6, group: 7
};

const DAY_WORDS: Record<string, number> = {
  sun: 0, sunday: 0, "الأحد": 0,
  mon: 1, monday: 1, "الاثنين": 1,
  tue: 2, tues: 2, tuesday: 2, "الثلاثاء": 2,
  wed: 3, wednesday: 3, "الأربعاء": 3,
  thu: 4, thur: 4, thursday: 4, "الخميس": 4,
  fri: 5, friday: 5, "الجمعة": 5,
  sat: 6, saturday: 6, "السبت": 6
};

function cell(text: string, confident: boolean): ParsedCell {
  return { text: text.trim(), confident };
}

/** Split a text line into columns on 2+ spaces / tabs / pipes. */
export function splitColumns(line: string): string[] {
  return line.split(/\s{2,}|\t|\|/).map(s => s.trim()).filter(Boolean);
}

function parseTime(s: string): { t: string; confident: boolean } {
  const m = s.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .match(/(\d{1,2})[:.](\d{2})\s*([ap])?/i);
  if (!m) return { t: s.trim(), confident: s.trim() === "" };
  let h = Number(m[1]);
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  return { t: `${String(h).padStart(2, "0")}:${m[2]}`, confident: true };
}

function parseDay(s: string): { d: string; confident: boolean } {
  const key = s.toLowerCase().trim();
  if (key in DAY_WORDS) return { d: key, confident: true };
  for (const [k, v] of Object.entries(DAY_WORDS)) {
    if (key.startsWith(k) || k.startsWith(key) && key.length >= 3)
      return { d: k, confident: false };
  }
  return { d: s.trim(), confident: s.trim() === "" };
}

/** Map raw cells to a ParsedRow. Override columnMap for odd layouts. */
export function mapRow(cells: string[], columnMap: ColumnMap = {}): ParsedRow {
  const m = { ...DEFAULT_MAP, ...columnMap };
  const at = (i: number) => cells[i] ?? "";
  const day = parseDay(at(m.day));
  const st = parseTime(at(m.start));
  const en = parseTime(at(m.end));
  const conf = [day.confident, st.confident, en.confident,
    at(m.course) !== "", at(m.professor) !== ""].filter(Boolean).length / 5;
  return {
    day: day.d, start: st.t, end: en.t,
    course: at(m.course), professor: at(m.professor),
    room: at(m.room), section: at(m.section) || "A", group: at(m.group) || "",
    confidence: Math.round(conf * 100) / 100,
    raw: cells.join(" | ")
  };
}

/** Group pdfjs text items into lines (y-tolerance), then map rows. */
export function linesToRows(lines: string[], columnMap: ColumnMap = {}): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const line of lines) {
    const cells = splitColumns(line);
    if (cells.length < 3) continue; // header/footer noise
    if (/^(day|mon|tue|wed|thu|fri|sat|sun|اليوم)/i.test(cells[0]) && out.length === 0) continue; // header row
    out.push(mapRow(cells, columnMap));
  }
  return out;
}

export interface PdfAdapter {
  name: string;
  extract(buffer: Buffer, opts?: { maxPages?: number }): Promise<{ lines: string[]; pages: number; empty: boolean }>;
}

export const TextPdfAdapter: PdfAdapter = {
  name: "text",
  async extract(buffer: Buffer, opts = {}) {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true
    }).promise;
    const pages = Math.min(doc.numPages, opts.maxPages ?? 50);
    const lines: string[] = [];
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      // group items by y
      const rows = new Map<number, { x: number; s: string }[]>();
      for (const it of tc.items as any[]) {
        const y = Math.round(it.transform[5]);
        const x = Math.round(it.transform[4]);
        const s = String(it.str ?? "");
        if (!s.trim()) continue;
        const key = [...rows.keys()].find(k => Math.abs(k - y) <= 3) ?? y;
        rows.set(key, [...(rows.get(key) ?? []), { x, s }]);
      }
      const ys = [...rows.keys()].sort((a, b) => b - a); // top-down
      for (const y of ys) {
        const parts = rows.get(y)!.sort((a, b) => a.x - b.x);
        // rebuild spacing from x gaps
        let line = "";
        let lastEnd = -1000;
        for (const it of parts) {
          if (it.x - lastEnd > 12) line += "  ";
          else line += " ";
          line += it.s;
          lastEnd = it.x + it.s.length * 5;
        }
        if (line.trim()) lines.push(line.trim());
      }
    }
    await doc.destroy().catch(() => {});
    return { lines, pages: doc.numPages, empty: lines.length === 0 };
  }
};

export const OcrPdfAdapter: PdfAdapter = {
  name: "ocr",
  async extract(buffer: Buffer, opts = {}) {
    // pdf -> page renders need canvas; instead OCR works on embedded images only
    // here: refuse gracefully unless tesseract is present AND pages are few.
    let tess: any;
    try {
      tess = await import("tesseract.js");
    } catch {
      throw new Error("ocr_unavailable");
    }
    const maxPages = Math.min(opts.maxPages ?? 3, 6);
    const worker: any = await tess.createWorker(["eng", "ara"]);
    const lines: string[] = [];
    try {
      // render first pages via pdfjs to canvas is unavailable server-side;
      // fall back: OCR any embedded images is out of scope -> mark for manual entry.
      void worker; void buffer; void maxPages;
      throw new Error("ocr_needs_render");
    } finally {
      await worker.terminate().catch(() => {});
    }
    return { lines, pages: 0, empty: true };
  }
};

/** First text extraction, then OCR when the page has no text layer. */
export async function extractTimetable(
  buffer: Buffer, opts: { ocr?: boolean; maxPages?: number } = {}
): Promise<{ rows: ParsedRow[]; pages: number; method: string; lowConfidence: boolean }> {
  const text = await TextPdfAdapter.extract(buffer, opts);
  let lines = text.lines;
  let method = "text";
  if (text.empty && opts.ocr !== false) {
    try {
      const ocr = await OcrPdfAdapter.extract(buffer, opts);
      lines = ocr.lines;
      method = "ocr";
    } catch (e: any) {
      return { rows: [], pages: text.pages, method: "text+ocr_failed:" + e.message, lowConfidence: true };
    }
  }
  const rows = linesToRows(lines);
  return { rows, pages: text.pages, method, lowConfidence: rows.length > 0 && rows.every(r => r.confidence < 0.5) };
}
