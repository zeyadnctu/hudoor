const fs = require("fs");
(async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buf = fs.readFileSync("D:/Zeyad/Attendance/NTG V3 (1)(1).pdf");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  for (const it of tc.items) {
    const s = String(it.str ?? "");
    if (!s.trim() || !/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s)) continue;
    const cps = [...s].map(c => "U+" + c.codePointAt(0).toString(16)).join(" ");
    console.log(JSON.stringify(s) + "  // " + cps.slice(0, 120));
  }
  await doc.destroy().catch(() => {});
})().catch(e => { console.error("FAIL " + e.message); process.exit(1); });
