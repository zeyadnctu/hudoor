"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Label } from "@/components/ui";

export type Period = { start: string; end: string };
const DAY_KEYS = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"] as const;
// JS getDay() convention used by timetable_slots.day
const DAY_NUMS = [6, 0, 1, 2, 3, 4, 5];

const DEFAULT_GRID: Period[] = [
  { start: "09:00", end: "09:40" }, { start: "09:40", end: "10:20" },
  { start: "10:30", end: "11:10" }, { start: "11:10", end: "11:50" },
  { start: "12:00", end: "12:40" }, { start: "12:40", end: "13:20" },
  { start: "13:30", end: "14:10" }, { start: "15:00", end: "15:40" },
  { start: "15:40", end: "16:20" }
];

/** Editable 40-min period grid + working days + college label + title prefixes.
 *  Stored in app_settings (global scope or per-program override). */
export function PeriodGridEditor({ scope, scopeId }: { scope: string; scopeId: string }) {
  const { t } = useApp();
  const [grid, setGrid] = useState<Period[]>(DEFAULT_GRID);
  const [days, setDays] = useState<number[]>([6, 0, 1]);
  const [college, setCollege] = useState("Faculty of Industry");
  const [prefixes, setPrefixes] = useState("");
  const [prefixErr, setPrefixErr] = useState("");
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const q = new URLSearchParams({ scope, ...(scopeId ? { scope_id: scopeId } : {}) });
      const r = await fetch(`/api/console/settings?${q}`).then(x => x.json()).catch(() => ({ rows: [] }));
      const m: Record<string, any> = {};
      for (const row of (r.rows ?? []) as any[]) m[row.key] = row.value;
      if (Array.isArray(m.period_grid) && m.period_grid.length) setGrid(m.period_grid);
      if (Array.isArray(m.working_days)) setDays(m.working_days);
      if (typeof m.college_label === "string") setCollege(m.college_label);
      setPrefixes(m.title_prefixes ? JSON.stringify(m.title_prefixes, null, 2) : "");
      setDirty(false); setMsg("");
    })();
  }, [scope, scopeId]);

  function setCell(i: number, k: "start" | "end", v: string) {
    setGrid(g => g.map((p, x) => (x === i ? { ...p, [k]: v } : p)));
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= grid.length) return;
    setGrid(g => {
      const n = [...g];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  }

  async function save() {
    setMsg(""); setPrefixErr("");
    if (!grid.length) { setMsg("empty grid"); return; }
    const tm = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const [i, p] of grid.entries()) {
      if (!tm.test(p.start) || !tm.test(p.end) || !(p.start < p.end)) {
        setMsg(`row ${i + 1}: bad time range`);
        return;
      }
    }
    let pref: any = undefined;
    if (prefixes.trim()) {
      try {
        pref = JSON.parse(prefixes);
        if (!pref || typeof pref !== "object" || !Array.isArray(pref.lecturer) || !Array.isArray(pref.section))
          throw new Error("bad shape");
      } catch { setPrefixErr("title_prefixes must be JSON {lecturer:[], section:[]}"); return; }
    }
    const payload = [
      { key: "period_grid", value: grid },
      { key: "working_days", value: days },
      ...(college.trim() ? [{ key: "college_label", value: college }] : []),
      ...(pref ? [{ key: "title_prefixes", value: pref }] : [])
    ];
    for (const p of payload) {
      const r = await fetch("/api/console/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope_type: scope, scope_id: scopeId || null, key: p.key, value: p.value })
      });
      if (!r.ok) { setMsg("save failed"); return; }
    }
    setDirty(false);
    setMsg(`✓ ${t.createdOk}`);
  }

  async function resetAll() {
    for (const k of ["period_grid", "working_days", "college_label", "title_prefixes"]) {
      const q = new URLSearchParams({ scope_type: scope, key: k });
      if (scopeId) q.set("scope_id", scopeId);
      await fetch(`/api/console/settings?${q}`, { method: "DELETE" });
    }
    setGrid(DEFAULT_GRID); setDays([6, 0, 1]); setCollege("Faculty of Industry"); setPrefixes(""); setDirty(false);
  }

  return (
    <div className="mt-3 rounded-md2 border border-black/10 p-4 dark:border-white/15">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-display font-bold">{t.periodGrid}</h3>
          <div className="mt-2 space-y-1.5" role="list" aria-label={t.periodGrid}>
            {grid.map((p, i) => (
              <div key={i} role="listitem" className="flex items-center gap-1.5">
                <span className="tnum w-6 shrink-0 text-sm font-bold text-neutral-500">{i + 1}</span>
                <Input type="time" value={p.start} onChange={e => setCell(i, "start", e.target.value)} aria-label={`period ${i + 1} start`} />
                <span className="text-neutral-400">–</span>
                <Input type="time" value={p.end} onChange={e => setCell(i, "end", e.target.value)} aria-label={`period ${i + 1} end`} />
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="move up" className="grid h-11 w-9 shrink-0 place-items-center rounded-md2 border border-black/15 disabled:opacity-30 dark:border-white/20">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === grid.length - 1} aria-label="move down" className="grid h-11 w-9 shrink-0 place-items-center rounded-md2 border border-black/15 disabled:opacity-30 dark:border-white/20">↓</button>
                <button onClick={() => { setGrid(g => g.filter((_, x) => x !== i)); setDirty(true); }} aria-label="delete period" className="grid h-11 w-9 shrink-0 place-items-center rounded-md2 border border-brick/40 font-bold text-brick">×</button>
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-2" onClick={() => { setGrid(g => [...g, { start: "16:20", end: "17:00" }]); setDirty(true); }}>+ period</Button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>{t.workingDays}</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_KEYS.map((k, i) => {
                const n = DAY_NUMS[i];
                const on = days.includes(n);
                return (
                  <button key={k} type="button" aria-pressed={on}
                    onClick={() => { setDays(d => (on ? d.filter(x => x !== n) : [...d, n].sort((a, b) => a - b))); setDirty(true); }}
                    className={`min-h-[44px] rounded-full border-2 px-3 text-sm font-semibold ${on ? "border-register bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200" : "border-black/15 dark:border-white/20"}`}>
                    {(t as any)[k] ?? k}
                  </button>
                );
              })}
            </div>
          </div>
          <div><Label>{t.collegeLabel}</Label>
            <Input value={college} onChange={e => { setCollege(e.target.value); setDirty(true); }} dir="auto" placeholder="Faculty of Industry" />
          </div>
          <div><Label>title_prefixes (JSON)</Label>
            <textarea value={prefixes} onChange={e => { setPrefixes(e.target.value); setDirty(true); }} rows={4} dir="ltr"
              placeholder='{"lecturer":[...],"section":[...]}'
              className="w-full rounded-md2 border-2 border-black/15 bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
            {prefixErr && <p className="mt-1 text-sm font-semibold text-brick" role="alert">{prefixErr}</p>}
          </div>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={save} disabled={!dirty}>{t.save}</Button>
        {scope !== "global" && scopeId && <Button variant="outline" onClick={resetAll}>{t.resetToGlobal}</Button>}
      </div>
    </div>
  );
}
