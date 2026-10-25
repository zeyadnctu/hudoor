"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";
import { useMyProgram, orderPrograms } from "@/lib/programs";
import { detectClashes } from "@/lib/timetable";
import { Plus, Upload, CalendarPlus, Printer, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_NUMS = [0, 1, 2, 3, 4, 5, 6];

type Period = { start: string; end: string };

export default function TimetablePage() {
  const { t } = useApp();
  const { programId, isAdmin } = useMyProgram();
  const [prog, setProg] = useState("");
  const [levels, setLevels] = useState<any[]>([]);
  const [level, setLevel] = useState("");
  const [groups, setGroups] = useState<any[]>([]);
  const [group, setGroup] = useState("");
  const [sems, setSems] = useState<any[]>([]);
  const [sem, setSem] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [grid, setGrid] = useState<Period[]>([]);
  const [days, setDays] = useState<number[]>([6, 0, 1]);
  const [college, setCollege] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [flip, setFlip] = useState(false);
  const [msg, setMsg] = useState("");
  // popup state
  const [pop, setPop] = useState<null | {
    mode: "create" | "edit"; day: number; start: number; count: number; slot?: any;
  }>(null);
  const [form, setForm] = useState<any>({ course_id: "", newCourse: "", session_type: "lecture", instructor_id: "", instructor_name: "", newInstructor: "", room_id: "" });
  const [clashWarn, setClashWarn] = useState<any[]>([]);
  const [dragSel, setDragSel] = useState<{ day: number; start: number } | null>(null);
  const [regenAsk, setRegenAsk] = useState<string[] | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyMode, setCopyMode] = useState<"slot" | "timetable">("slot");
  const [copyForm, setCopyForm] = useState({ group_id: "", program_id: "" });
  const [gen, setGen] = useState({ open: false, from: "", to: "", course_id: "" });

  useEffect(() => { if (programId && !isAdmin) setProg(programId); }, [programId, isAdmin]);

  async function loadLists() {
    const [s, c, r, p, pr] = await Promise.all([
      fetch("/api/console/semesters?perPage=100").then(r => r.json()),
      fetch("/api/console/courses?perPage=500").then(r => r.json()),
      fetch("/api/console/rooms?perPage=500").then(r => r.json()),
      fetch("/api/console/users-manage?role=professor&perPage=300").then(r => r.json()).catch(() => ({ rows: [] })),
      fetch("/api/console/programs?perPage=200").then(r => r.json()).catch(() => ({ rows: [] }))
    ]);
    setSems(s.rows ?? []);
    const cur = (s.rows ?? []).find((x: any) => x.is_current) ?? (s.rows ?? [])[0];
    if (cur) setSem(cur.id);
    setCourses(c.rows ?? []); setRooms(r.rows ?? []); setProfs(p.rows ?? []);
    setAllPrograms(orderPrograms(pr.rows ?? []));
  }
  async function loadLevels(pid: string) {
    if (!pid) { setLevels([]); return; }
    const r = await fetch(`/api/console/levels?perPage=200&f_program_id=${pid}`).then(x => x.json()).catch(() => ({ rows: [] }));
    setLevels(r.rows ?? []);
  }
  async function loadGroups(lid: string) {
    if (!lid) { setGroups([]); return; }
    const r = await fetch(`/api/console/section_groups?perPage=200&f_level_id=${lid}`).then(x => x.json()).catch(() => ({ rows: [] }));
    setGroups(r.rows ?? []);
  }
  async function getGlobal(key: string) {
    const g = await fetch("/api/console/settings?scope=global").then(x => x.json()).catch(() => ({ rows: [] }));
    return ((g.rows ?? []) as any[]).find(x => x.key === key)?.value;
  }
  async function loadGrid(pid: string) {
    const q = new URLSearchParams({ scope: pid ? "program" : "global", ...(pid ? { scope_id: pid } : {}) });
    const r = await fetch(`/api/console/settings?${q}`).then(x => x.json()).catch(() => ({ rows: [] }));
    const m: Record<string, any> = {};
    for (const row of (r.rows ?? []) as any[]) m[row.key] = row.value;
    if (Array.isArray(m.period_grid) && m.period_grid.length) setGrid(m.period_grid);
    else {
      const gg = await getGlobal("period_grid");
      if (Array.isArray(gg) && gg.length) setGrid(gg);
    }
    const d = Array.isArray(m.working_days) ? m.working_days : await getGlobal("working_days");
    if (Array.isArray(d) && d.length) setDays(d);
    const c = typeof m.college_label === "string" ? m.college_label : await getGlobal("college_label");
    if (typeof c === "string") setCollege(c);
  }
  async function loadSlots() {
    const q = new URLSearchParams({ perPage: "500" });
    if (sem) q.set("semester_id", sem);
    if (prog) q.set("program_id", prog);
    if (level) q.set("level_id", level);
    if (group) q.set("group_id", group);
    const r = await fetch(`/api/console/timetable?${q}`).then(x => x.json()).catch(() => ({ rows: [] }));
    setSlots(r.rows ?? []);
  }

  useEffect(() => { loadLists(); loadGrid(""); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadLevels(prog); loadGrid(prog); setLevel(""); setGroup(""); /* eslint-disable-next-line */ }, [prog]);
  useEffect(() => { loadGroups(level); setGroup(""); /* eslint-disable-next-line */ }, [level]);
  useEffect(() => { loadSlots(); /* eslint-disable-next-line */ }, [sem, prog, level, group]);

  const coursesInProg = prog ? courses.filter(c => (c as any).program_id === prog) : courses;
  const dayNums = days.filter(d => d >= 0 && d <= 6);

  // map slot -> period span (period model first, time fallback)
  function spanOf(s: any): [number, number] {
    if (s.start_period !== null && s.start_period !== undefined && grid[s.start_period]) {
      return [s.start_period, s.start_period + Math.max(1, s.period_count ?? 1) - 1];
    }
    const st = String(s.starts_at ?? "").slice(0, 5), en = String(s.ends_at ?? "").slice(0, 5);
    let a = grid.findIndex(p => st >= p.start && st < p.end);
    if (a < 0) a = 0;
    let b = grid.findIndex(p => en > p.start && en <= p.end);
    if (b < 0) b = grid.length - 1;
    return [Math.max(0, a), Math.max(a, b)];
  }
  function timesOf(startIdx: number, count: number): [string, string] {
    const g = grid[startIdx];
    const l = grid[Math.min(grid.length - 1, startIdx + Math.max(1, count) - 1)];
    return [g?.start ?? "09:00", l?.end ?? g?.end ?? "09:40"];
  }
  function cellSlots(day: number, pi: number) {
    return slots.filter(s => s.day === day && (() => { const [a, b] = spanOf(s); return pi >= a && pi <= b; })());
  }
  function slotLabel(s: any) {
    const c = courses.find(x => x.id === s.course_id);
    const prof = profs.find((p: any) => p.id === (s.instructor_id ?? s.professor_id));
    return {
      course: c ? `${c.code}` : (s.course_id ?? "").slice(0, 8),
      instructor: s.instructor_name || (prof ? (prof as any).email.split("@")[0] : ""),
      room: (rooms.find((r: any) => r.id === s.room_id)?.name_ar) ?? ""
    };
  }

  function openCreate(day: number, start: number, count = 1) {
    setClashWarn([]);
    setForm({ course_id: "", newCourse: "", session_type: "lecture", instructor_id: "", instructor_name: "", newInstructor: "", newInstructorTitle: "Dr", room_id: "" });
    setPop({ mode: "create", day, start, count });
  }
  function openEdit(slot: any) {
    const [a, b] = spanOf(slot);
    setClashWarn([]);
    setForm({
      course_id: slot.course_id ?? "", newCourse: "",
      session_type: slot.session_type ?? "lecture",
      instructor_id: slot.instructor_id ?? slot.professor_id ?? "",
      instructor_name: slot.instructor_name ?? "", newInstructor: "", newInstructorTitle: "Dr",
      room_id: slot.room_id ?? ""
    });
    setPop({ mode: "edit", day: slot.day, start: a, count: b - a + 1, slot });
  }

  function candidateSlot() {
    if (!pop) return null;
    const [st, en] = timesOf(pop.start, pop.count);
    return {
      day: pop.day, starts_at: st, ends_at: en,
      room_id: form.room_id || null,
      professor_id: form.instructor_id || null,
      section: "x", course_id: form.course_id || "new"
    };
  }
  function checkClash() {
    const cand = candidateSlot();
    if (!cand) return [];
    const others = slots.filter(s => !(pop?.mode === "edit" && pop.slot && s.id === pop.slot.id)).map(s => {
      const [a, b] = spanOf(s);
      const [st, en] = timesOf(a, b - a + 1);
      return { day: s.day, starts_at: st, ends_at: en, room_id: s.room_id, professor_id: s.instructor_id ?? s.professor_id, section: `${s.level_id ?? ""}/${s.group_id ?? ""}`, course_id: s.course_id };
    });
    // clash util import is static; use dynamic shape compatible with Slot
    return detectClashes([...others, cand as any]);
  }

  async function saveSlot(confirmed = false) {
    if (!pop) return;
    setMsg("");
    if (!form.course_id && !form.newCourse.trim()) { setMsg("course required"); return; }
    if (!sem) { setMsg("pick a semester"); return; }
    if (!confirmed) {
      const cl = checkClash();
      setClashWarn(cl);
      if (cl.length) return; // show, require explicit confirm
    }
    let courseId = form.course_id;
    if (!courseId && form.newCourse.trim()) {
      const code = form.newCourse.trim().split(/\s+/).slice(0, 2).join(" ").toUpperCase().slice(0, 12);
      const cr = await fetch("/api/console/courses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name_ar: form.newCourse.trim(), name_en: form.newCourse.trim(), program_id: prog || null, semester_id: sem, section: "A" })
      }).then(x => x.json());
      if (!cr.row) { setMsg(cr.error ?? "course create failed"); return; }
      courseId = cr.row.id;
      const cc = await fetch("/api/console/courses?perPage=500").then(x => x.json());
      setCourses(cc.rows ?? []);
    }
    let instructorId = form.instructor_id || null;
    let instructorName = form.instructor_name || "";
    if (!instructorId && form.newInstructor.trim()) {
      const nm = form.newInstructor.trim();
      const ir = await fetch("/api/console/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: nm, title: form.newInstructorTitle || "Dr", program_id: prog || null })
      }).then(x => x.json()).catch(() => ({}));
      if (!ir.ok) { setMsg(ir.error ?? "invite failed"); return; }
      instructorName = `${form.newInstructorTitle || "Dr"}. ${nm}`;
    } else if (instructorId) {
      const p = profs.find((x: any) => x.id === instructorId);
      instructorName = (p as any)?.email?.split("@")[0] ?? instructorName;
    }
    if (!instructorId && !instructorName.trim()) { setMsg("instructor required"); return; }
    const [st, en] = timesOf(pop.start, pop.count);
    const payload: any = {
      semester_id: sem, course_id: courseId,
      professor_id: instructorId, instructor_id: instructorId, instructor_name: instructorName || null,
      session_type: form.session_type, room_id: form.room_id || null,
      program_id: prog || null, level_id: level || null, group_id: group || null,
      day: pop.day, start_period: pop.start, period_count: pop.count,
      starts_at: st, ends_at: en,
      section: "A", group_name: group ? (groups.find(g => g.id === group)?.name ?? "") : ""
    };
    const r = pop.mode === "edit"
      ? await fetch("/api/console/timetable", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pop.slot.id, ...payload }) })
      : await fetch("/api/console/timetable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    const savedId = pop.mode === "edit" ? pop.slot.id : j.row?.id;
    setPop(null); setClashWarn([]);
    loadSlots();
    if (savedId) setRegenAsk([savedId]);
  }

  async function delSlot(id?: string) {
    const target = id ?? pop?.slot?.id;
    if (!target) return;
    const r = await fetch("/api/console/timetable", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [target] })
    });
    if (!r.ok) { setMsg("delete failed"); return; }
    setPop(null);
    loadSlots();
    setRegenAsk([target]);
  }

  async function doRegen(ids: string[]) {
    const r = await fetch("/api/console/timetable", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semester_id: sem, slot_ids: ids })
    });
    const j = await r.json();
    setMsg(r.ok ? `✓ +${j.created} −${j.removed} (${j.skipped} kept)` : j.error);
    setRegenAsk(null);
  }

  async function duplicateToGroup() {
    if (!copyForm.group_id || !pop?.slot) return;
    const s = pop.slot;
    const g = groups.find(x => x.id === copyForm.group_id);
    const r = await fetch("/api/console/timetable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        semester_id: sem, course_id: s.course_id,
        professor_id: s.instructor_id ?? s.professor_id, instructor_id: s.instructor_id ?? null,
        instructor_name: s.instructor_name ?? null, session_type: s.session_type ?? "lecture",
        room_id: s.room_id, program_id: s.program_id ?? prog ?? null,
        level_id: s.level_id ?? level ?? null, group_id: copyForm.group_id,
        day: s.day, start_period: s.start_period ?? null, period_count: s.period_count ?? 1,
        starts_at: String(s.starts_at).slice(0, 5), ends_at: String(s.ends_at).slice(0, 5),
        section: s.section ?? "A", group_name: g?.name ?? s.group_name ?? ""
      })
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    setCopyOpen(false);
    loadSlots();
    if (j.row?.id) setRegenAsk([j.row.id]);
  }

  async function copyGroup() {
    if (!copyForm.group_id) return;
    const targetProg = copyForm.program_id || prog;
    // copy all currently listed slots to target group (+program)
    let n = 0;
    for (const s of slots) {
      const g = groups.find(x => x.id === copyForm.group_id);
      const r = await fetch("/api/console/timetable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester_id: sem, course_id: s.course_id,
          professor_id: s.instructor_id ?? s.professor_id, instructor_id: s.instructor_id ?? null,
          instructor_name: s.instructor_name ?? null, session_type: s.session_type ?? "lecture",
          room_id: s.room_id, program_id: targetProg || s.program_id || null,
          level_id: s.level_id ?? level ?? null, group_id: copyForm.group_id,
          day: s.day, start_period: s.start_period ?? null, period_count: s.period_count ?? 1,
          starts_at: String(s.starts_at).slice(0, 5), ends_at: String(s.ends_at).slice(0, 5),
          section: s.section ?? "A", group_name: g?.name ?? ""
        })
      });
      if (r.ok) n++;
    }
    setMsg(`✓ copied ${n}`);
    setCopyOpen(false);
    loadSlots();
  }

  const days_ = dayNums;
  const rows = !flip ? grid.map((_, i) => i) : days_;
  const cols = !flip ? days_ : grid.map((_, i) => i);
  const dayLabel = (d: number) => (t as any)[["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d]] ?? `d${d}`;
  const covered = new Set<string>();
  function cellAt(day: number, pi: number) {
    const key = `${day}:${pi}`;
    if (covered.has(key)) return null;
    const hit = slots.find(s => {
      if (s.day !== day) return false;
      const [a, b] = spanOf(s);
      return pi >= a && pi <= b;
    });
    if (hit) {
      const [a, b] = spanOf(hit);
      for (let i = a; i <= b; i++) covered.add(`${day}:${i}`);
      return { slot: hit, span: b - a + 1 };
    }
    return { slot: null, span: 1 };
  }
  covered.clear();
  const gridCells: Record<string, { slot: any; span: number } | null> = {};
  for (const d of days_) for (let pi = 0; pi < grid.length; pi++) gridCells[`${d}:${pi}`] = cellAt(d, pi);

  function onCellDown(day: number, pi: number) {
    if (cellAt(day, pi)?.slot) return;
    setDragSel({ day, start: pi });
  }
  function onCellUp(day: number, pi: number) {
    if (!dragSel) return;
    if (dragSel.day !== day) { setDragSel(null); return; }
    const a = Math.min(dragSel.start, pi), b = Math.max(dragSel.start, pi);
    setDragSel(null);
    openCreate(day, a, b - a + 1);
  }

  const progObj = allPrograms.find(p => p.id === prog);
  const semObj = sems.find(s => s.id === sem);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <h1 className="font-display text-3xl font-bold">{t.timetable}</h1>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-md2 border border-black/15 dark:border-white/20">
            <button onClick={() => setView("grid")} className={`min-h-[48px] px-4 text-sm font-bold ${view === "grid" ? "bg-register text-white" : ""}`}>{t.weeklyView}</button>
            <button onClick={() => setView("list")} className={`min-h-[48px] px-4 text-sm font-bold ${view === "list" ? "bg-register text-white" : ""}`}>{t.listView}</button>
          </div>
          <Button variant="outline" onClick={() => setFlip(f => !f)}>{flip ? "⇄ days × periods" : "⇄ periods × days"}</Button>
          <Link href="/admin/timetable/import"><Button variant="outline"><Upload size={18} strokeWidth={2} /> {t.importPdf}</Button></Link>
          <Button variant="outline" onClick={() => window.print()}><Printer size={18} strokeWidth={2} /> {t.printTimetable}</Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
        <div><Label>{t.programs}</Label>
          <Select value={prog} onChange={e => { setProg(e.target.value); }}>
            {isAdmin && <option value="">{t.allPrograms}</option>}
            {allPrograms.map(p => <option key={p.id} value={p.id}>{p.type === "partner" ? "★ " : ""}{p.code}</option>)}
          </Select>
        </div>
        <div><Label>{t.levelName}</Label>
          <Select value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">—</option>
            {levels.filter(l => !prog || l.program_id === prog).map(l => <option key={l.id} value={l.id}>{l.name_ar}</option>)}
          </Select>
        </div>
        <div><Label>{t.group}</Label>
          <Select value={group} onChange={e => setGroup(e.target.value)}>
            <option value="">—</option>
            {groups.filter(g => !level || g.level_id === level).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>
        <div><Label>Semester</Label>
          <Select value={sem} onChange={e => setSem(e.target.value)}>
            {sems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setCopyOpen(true)}><Copy size={17} strokeWidth={2} /> {t.copyTimetable}</Button>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status" dir="auto">{msg}</p>}

      {view === "grid" && grid.length > 0 && (
        <div className="mt-3 overflow-auto rounded-md2 border border-black/10 print:hidden dark:border-white/15">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="sticky top-0 bg-chalk dark:bg-ink">
              <tr className="border-b-2 border-black/15 dark:border-white/20">
                <th className="w-24 px-2 py-2 text-start font-display text-xs font-bold"></th>
                {cols.map(c => (
                  <th key={String(c)} className="px-2 py-2 text-start font-display text-xs font-bold">
                    {!flip ? dayLabel(c as number) : `${grid[c as number]?.start}–${grid[c as number]?.end}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={String(r)} className="border-b border-black/10 last:border-0 dark:border-white/10">
                  <td className="tnum bg-chalk/60 px-2 py-2 align-top text-xs font-bold dark:bg-white/5">
                    {!flip ? `${grid[r as number]?.start}–${grid[r as number]?.end}` : dayLabel(r as number)}
                  </td>
                  {cols.map(c => {
                    const day = (!flip ? c : r) as number;
                    const pi = (!flip ? r : c) as number;
                    const cell = gridCells[`${day}:${pi}`];
                    if (!cell) return <td key={String(c)} className="bg-black/[0.04] px-1 py-1 dark:bg-white/5" />;
                    if (!cell.slot) {
                      return (
                        <td key={String(c)} className="px-1 py-1">
                          <button
                            onMouseDown={() => onCellDown(day, pi)} onMouseUp={() => onCellUp(day, pi)}
                            onClick={() => openCreate(day, pi, 1)}
                            aria-label={`add ${dayLabel(day)} ${grid[pi]?.start}`}
                            className="grid min-h-[52px] w-full place-items-center rounded-md2 border border-dashed border-black/15 text-lg text-neutral-300 hover:border-register hover:text-register dark:border-white/15"
                          >+</button>
                        </td>
                      );
                    }
                    const L = slotLabel(cell.slot);
                    const progC = allPrograms.find(p => p.id === (cell.slot.program_id ?? courses.find(x => x.id === cell.slot.course_id)?.program_id));
                    return (
                      <td key={String(c)} rowSpan={!flip ? cell.span : undefined} colSpan={flip ? cell.span : undefined}
                        className="border border-black/10 p-1 align-top dark:border-white/10"
                        style={{ borderInlineStart: `4px solid ${progC?.color ?? "#2F5D8A"}` }}>
                        <button
                          draggable onDragStart={e => e.dataTransfer.setData("text/slot", cell.slot.id)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            const id = e.dataTransfer.getData("text/slot");
                            const s = slots.find(x => x.id === id);
                            if (s && (s.day !== day || !spanOf(s).includes(pi))) moveSlot(s, day, pi);
                          }}
                          onClick={() => openEdit(cell.slot)}
                          className="block w-full rounded-md2 bg-register-light/60 p-1.5 text-start hover:bg-register-light dark:bg-register/15"
                        >
                          <span className="tnum block text-xs font-bold">{L.course} · {cell.slot.session_type === "section" ? t.section : t.lecture}</span>
                          <span className="block truncate text-xs text-neutral-600 dark:text-neutral-300" dir="auto">{L.instructor || "—"}</span>
                          <span className="tnum block text-[11px] text-neutral-500">{L.room}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "list" && (
        <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 print:hidden dark:divide-white/10 dark:border-white/15">
          {slots.map(s => {
            const L = slotLabel(s);
            const [a, b] = spanOf(s);
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span><b>{dayLabel(s.day)}</b> <span className="tnum">{grid[a]?.start ?? String(s.starts_at).slice(0, 5)}–{grid[b]?.end ?? String(s.ends_at).slice(0, 5)}</span> · <b className="tnum">{L.course}</b> · {s.session_type ?? "—"} · <span dir="auto">{L.instructor || "—"}</span> · {L.room}</span>
                <span className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="min-h-[40px] rounded px-2 text-sm font-semibold text-register hover:underline">Edit</button>
                  <button onClick={() => delSlot(s.id)} className="min-h-[40px] rounded px-2 text-sm font-semibold text-brick hover:underline">Del</button>
                </span>
              </div>
            );
          })}
          {slots.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        </div>
      )}

      {/* print view */}
      <div className="hidden print:block">
        <h1 className="font-display text-2xl font-bold">{college || "Faculty of Industry"}</h1>
        <p>{semObjName()} · {progObjName()} · {levelObjName()} · {groupObjName()}</p>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead><tr><th></th>{dayNums.map(d => <th key={d} className="border px-1 py-1">{dayLabel(d)}</th>)}</tr></thead>
          <tbody>
            {grid.map((p, pi) => (
              <tr key={pi}>
                <td className="tnum border px-1 py-1 font-bold">{p.start}–{p.end}</td>
                {dayNums.map(d => {
                  const hit = slots.find(s => s.day === d && (() => { const [a, b] = spanOf(s); return pi >= a && pi <= b; })());
                  if (!hit) return <td key={d} className="border px-1 py-1" />;
                  if (pi !== spanOf(hit)[0]) return null;
                  const L = slotLabel(hit);
                  const [a, b] = spanOf(hit);
                  return <td key={d} rowSpan={b - a + 1} className="border px-1 py-1"><b>{L.course}</b> {hit.session_type} {L.instructor} {L.room}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* slot popup */}
      {pop && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-ink/50 p-4 print:hidden" onClick={() => { setPop(null); setClashWarn([]); }}>
          <div className="w-full max-w-md rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold">
              {pop.mode === "edit" ? "Edit slot" : t.addSlot} · {dayLabel(pop.day)} · {timesOf(pop.start, pop.count).join("–")}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <Label>{t.sessionType}</Label>
              {(["lecture", "section"] as const).map(v => (
                <button key={v} type="button" onClick={() => setForm({ ...form, session_type: v })}
                  className={cn("min-h-[44px] rounded-md2 border-2 px-3 text-sm font-bold", form.session_type === v ? "border-register bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200" : "border-black/15 dark:border-white/20")}>
                  {v === "lecture" ? t.lecture : t.section}
                </button>
              ))}
              <Label>Periods</Label>
              <div className="flex items-center gap-1">
                <button onClick={() => setPop({ ...pop, count: Math.max(1, pop.count - 1) })} className="grid h-11 w-9 place-items-center rounded-md2 border border-black/15 dark:border-white/20">−</button>
                <span className="tnum w-6 text-center font-bold">{pop.count}</span>
                <button onClick={() => setPop({ ...pop, count: Math.min(12, pop.count + 1) })} className="grid h-11 w-9 place-items-center rounded-md2 border border-black/15 dark:border-white/20">+</button>
              </div>
            </div>
            <div className="mt-2 grid gap-2">
              <div><Label>{t.course}</Label>
                <Select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value, newCourse: "" })}>
                  <option value="">— {t.createNew}</option>
                  {coursesInProg.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
                </Select>
                {!form.course_id && (
                  <Input value={form.newCourse} onChange={e => setForm({ ...form, newCourse: e.target.value })} placeholder={`${t.createNew}: course name`} dir="auto" />
                )}
              </div>
              <div><Label>{t.addInstructor}</Label>
                <Select value={form.instructor_id} onChange={e => setForm({ ...form, instructor_id: e.target.value, instructor_name: "", newInstructor: "" })}>
                  <option value="">— {t.createNew}</option>
                  {profs.map((p: any) => <option key={p.id} value={p.id}>{p.email}</option>)}
                </Select>
                {!form.instructor_id && (
                  <div className="mt-1 flex gap-1.5">
                    <div className="flex rounded-md2 border-2 border-black/15 dark:border-white/20">
                      {(["Dr", "Eng"] as const).map(v => (
                        <button key={v} type="button" onClick={() => setForm({ ...form, newInstructorTitle: v })}
                          className={cn("min-h-[44px] px-3 text-sm font-bold", (form.newInstructorTitle || "Dr") === v ? "bg-register text-white" : "")}>{v}</button>
                      ))}
                    </div>
                    <Input value={form.newInstructor} onChange={e => setForm({ ...form, newInstructor: e.target.value })} placeholder={t.fullName} dir="auto" />
                  </div>
                )}
              </div>
              <div><Label>{t.rooms}</Label>
                <Select value={form.room_id} onChange={e => setForm({ ...form, room_id: e.target.value })}>
                  <option value="">—</option>{rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                </Select>
              </div>
            </div>
            {clashWarn.length > 0 && (
              <div className="mt-2 rounded-md2 border-2 border-hi/60 bg-hi-light/60 p-3 text-sm dark:bg-hi/10" role="alert">
                <p className="font-bold">{t.clash} ({clashWarn.length})</p>
                {clashWarn.slice(0, 6).map((c: any, i: number) => (
                  <p key={i} className="tnum" dir="auto">{c.type}: {(c.slotA as any)?.course_id === form.course_id || (c.slotB as any)?.course_id === form.course_id ? "" : ""}{JSON.stringify({ a: (c.slotA as any)?.course_id, b: (c.slotB as any)?.course_id }).slice(0, 60)}</p>
                ))}
                <p className="mt-1">Save anyway?</p>
              </div>
            )}
            {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
            <div className="mt-3 flex gap-2">
              {pop.mode === "edit" && <Button variant="brick" onClick={() => delSlot()}>Del</Button>}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => { setPop(null); setClashWarn([]); }}>Cancel</Button>
              <Button onClick={() => saveSlot(clashWarn.length > 0)}>{clashWarn.length ? "Save anyway" : t.save}</Button>
            </div>
            {pop.mode === "edit" && (
              <Button variant="outline" className="mt-2 w-full" onClick={() => { setCopyForm({ group_id: "", program_id: "" }); setCopyOpen(true); setCopyMode("slot"); }}>
                <Copy size={17} strokeWidth={2} /> {t.duplicateSlot}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* copy / duplicate dialog */}
      {copyOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 print:hidden" onClick={() => setCopyOpen(false)}>
          <div className="w-full max-w-md rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold">{copyMode === "slot" ? t.duplicateSlot : t.copyTimetable}</h2>
            <div className="mt-2 grid gap-2">
              {copyMode === "timetable" && (
                <div><Label>{t.programs}</Label>
                  <Select value={copyForm.program_id} onChange={e => setCopyForm({ ...copyForm, program_id: e.target.value })}>
                    <option value="">— ({t.myProgram}: current)</option>
                    {allPrograms.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                  </Select>
                </div>
              )}
              <div><Label>{t.group}</Label>
                <Select value={copyForm.group_id} onChange={e => setCopyForm({ ...copyForm, group_id: e.target.value })}>
                  <option value="">—</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCopyOpen(false)}>Cancel</Button>
                <Button className="flex-1" disabled={!copyForm.group_id} onClick={copyMode === "slot" ? duplicateToGroup : copyGroup}>{t.copyTimetable}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* regenerate confirm */}
      <ConfirmDialog
        open={regenAsk !== null}
        title={t.regenerateSessions}
        impact="Future unstarted occurrences of the changed slot(s) will be rebuilt. Started sessions and records are never touched."
        confirmLabel={t.regenerateSessions}
        onCancel={() => setRegenAsk(null)}
        onConfirm={() => regenAsk && doRegen(regenAsk)}
      />

      <div className="mt-4 print:hidden">
        <Button variant="outline" onClick={() => setGen({ ...gen, open: !gen.open })}>
          <CalendarPlus size={18} strokeWidth={2} /> {t.generateSessions}
        </Button>
        {gen.open && (
          <div className="mt-2 grid gap-2 rounded-md2 border border-black/10 p-3 sm:grid-cols-4 dark:border-white/15">
            <div><Label>{t.from}</Label><Input type="date" value={gen.from} onChange={e => setGen({ ...gen, from: e.target.value })} /></div>
            <div><Label>{t.to}</Label><Input type="date" value={gen.to} onChange={e => setGen({ ...gen, to: e.target.value })} /></div>
            <div><Label>{t.course}</Label>
              <Select value={gen.course_id} onChange={e => setGen({ ...gen, course_id: e.target.value })}>
                <option value="">All</option>{coursesInProg.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </Select>
            </div>
            <div className="flex items-end"><Button className="w-full" onClick={generate}>{t.generateSessions}</Button></div>
          </div>
        )}
      </div>
    </div>
  );

  // ---- helpers used above (hoisted consts would re-render; defined inline) ----
  function semObjName() { return sems.find(s => s.id === sem)?.name ?? ""; }
  function progObjName() {
    const p = allPrograms.find(x => x.id === prog);
    return p ? `${p.code} · ${p.name_ar}` : t.allPrograms;
  }
  function levelObjName() { return levels.find((l: any) => l.id === level)?.name_ar ?? ""; }
  function groupObjName() { return groups.find((g: any) => g.id === group)?.name ?? ""; }
  async function moveSlot(s: any, day: number, pi: number) {
    const [st, en] = timesOf(pi, Math.max(1, (spanOf(s)[1] - spanOf(s)[0] + 1)));
    const r = await fetch("/api/console/timetable", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, day, start_period: pi, starts_at: st, ends_at: en })
    });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else { loadSlots(); setRegenAsk([s.id]); }
  }
  async function generate() {
    const r = await fetch("/api/console/timetable", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semester_id: sem, from: gen.from || undefined, to: gen.to || undefined, course_id: gen.course_id || undefined })
    });
    const j = await r.json();
    setMsg(r.ok ? `✓ +${j.created} −${j.removed} (${j.skipped} kept)` : j.error);
    setGen({ ...gen, open: false });
  }
}
