"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { useMyProgram, orderPrograms } from "@/lib/programs";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";
import { Trash2, UserPlus } from "lucide-react";

export default function EnrollmentsPage() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [progs, setProgs] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const [add, setAdd] = useState({ refs: "", section: "A", prog: "", level: "" });
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [pickQ, setPickQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const { programId, programs, isAdmin } = useMyProgram();
  const [progFilter, setProgFilter] = useState("");

  useEffect(() => { if (programId && !isAdmin) setProgFilter(programId); }, [programId, isAdmin]);
  const visibleCourses = progFilter ? courses.filter(c => (c as any).program_id === progFilter) : courses;
  useEffect(() => {
    if (progFilter && course && !visibleCourses.some(c => c.id === course)) {
      setCourse(visibleCourses[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progFilter]);

  useEffect(() => {
    (async () => {
      const [c, p, l] = await Promise.all([
        fetch("/api/console/courses?perPage=500").then(r => r.json()),
        fetch("/api/console/programs?perPage=500").then(r => r.json()),
        fetch("/api/console/levels?perPage=500").then(r => r.json())
      ]);
      setCourses(c.rows ?? []);
      setProgs(orderPrograms(p.rows ?? []));
      setLevels(l.rows ?? []);
      if ((c.rows ?? [])[0]) setCourse(c.rows[0].id);
    })();
  }, []);

  async function load() {
    if (!course) return;
    const p = new URLSearchParams({ course_id: course, section, perPage: "500" });
    const r = await fetch(`/api/console/enrollments?${p}`);
    const j = await r.json();
    if (r.ok) { setRows(j.rows); setTotal(j.total); }
    else setMsg(j.error);
    setSelected([]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [course, section]);

  // all students NOT on this course, for pick-from-list enrolling
  async function loadCandidates() {
    const r = await fetch("/api/console/users-manage?role=student&perPage=200").then(x => x.json()).catch(() => ({ rows: [] }));
    const enrolledIds = new Set(rows.map(x => x.student_id));
    setCandidates(((r.rows ?? []) as any[]).filter(u => !enrolledIds.has(u.id)));
  }
  useEffect(() => { loadCandidates(); /* eslint-disable-next-line */ }, [course, rows.length]);

  async function doAdd() {
    setMsg(""); setConflicts([]);
    const refs = [...picked, ...add.refs.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)];
    const r = await fetch("/api/console/enrollments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: course, refs, section: add.section,
        bulk: { program_id: add.prog || undefined, level_id: add.level || undefined }
      })
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    setMsg(`✓ enrolled ${j.enrolled.length}${j.missing.length ? `, missing: ${j.missing.slice(0, 5).join("; ")}` : ""}`);
    setConflicts(j.conflicts ?? []);
    setAdd({ refs: "", section: "A", prog: "", level: "" });
    setPicked([]);
    setPickQ("");
    load();
    loadCandidates();
  }
  async function doRemove() {
    const r = await fetch("/api/console/enrollments", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: course, student_ids: selected })
    });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else { setConfirm(false); load(); }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.enrollments}</h1>
      {(isAdmin || programs.length > 1) && (
        <div className="mt-3 max-w-sm"><Label>{t.myProgram}</Label>
          <Select value={progFilter} onChange={e => setProgFilter(e.target.value)}>
            {isAdmin && <option value="">{t.allPrograms}</option>}
            {programs.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name_ar}</option>)}
          </Select>
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div><Label>{t.course}</Label>
          <Select value={course} onChange={e => setCourse(e.target.value)}>
            {visibleCourses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
          </Select>
        </div>
        <div><Label>{t.section}</Label>
          <Select value={section} onChange={e => setSection(e.target.value)}>
            <option value="">All</option>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </Select>
        </div>
        <div className="flex items-end"><p className="tnum pb-3 text-sm text-neutral-500">{t.totalStudents}: {total}</p></div>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold" role="status" dir="auto">{msg}</p>}
      {conflicts.length > 0 && (
        <div className="mt-2 rounded-md2 border-2 border-hi/60 bg-hi-light/60 p-3 dark:bg-hi/10" role="alert">
          <p className="font-bold">{t.clash} ({conflicts.length})</p>
          {conflicts.slice(0, 10).map((c: any, i: number) => (
            <p key={i} className="tnum text-sm" dir="auto">{c.student.slice(0, 8)} ↔ {(c.with ?? []).join(", ")}</p>
          ))}
        </div>
      )}

      <div className="mt-3 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
        <table className="w-full border-collapse text-start text-[15px]">
          <thead className="sticky top-0 bg-chalk dark:bg-ink">
            <tr className="border-b-2 border-black/15 dark:border-white/20">
              <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all" className="h-5 w-5 accent-[#2F5D8A]"
                checked={rows.length > 0 && rows.every(r => selected.includes(r.student_id))}
                onChange={() => setSelected(rows.every(r => selected.includes(r.student_id)) ? [] : rows.map(r => r.student_id))} /></th>
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.name}</th>
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.universityId}</th>
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.section}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                <td className="px-4 py-2.5"><input type="checkbox" aria-label="Select" className="h-5 w-5 accent-[#2F5D8A]"
                  checked={selected.includes(r.student_id)}
                  onChange={() => setSelected(selected.includes(r.student_id) ? selected.filter(x => x !== r.student_id) : [...selected, r.student_id])} /></td>
                <td className="px-4 py-2.5 font-medium" dir="auto">{r.details?.full_name_ar ?? "—"}</td>
                <td className="tnum px-4 py-2.5">{r.details?.university_id ?? ""}</td>
                <td className="px-4 py-2.5">{r.section}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-neutral-500">—</p>}
      </div>
      {selected.length > 0 && (
        <div className="sticky bottom-4 mt-2 flex items-center gap-2 rounded-md2 border-2 border-ink/20 bg-paper px-3 py-2 shadow-xl dark:border-white/25 dark:bg-inksurface">
          <span className="tnum text-sm font-bold">{selected.length} selected</span>
          <Button variant="brick" className="!min-h-[44px]" onClick={() => setConfirm(true)}>
            <Trash2 size={17} strokeWidth={2} /> Remove
          </Button>
        </div>
      )}

      <div className="mt-6 border-t-2 border-ink/15 pt-4 dark:border-white/20">
        <h2 className="font-display flex items-center gap-2 text-xl font-bold"><UserPlus size={20} strokeWidth={2} /> {t.enrollStudents}</h2>
        <div className="mt-2 rounded-md2 border border-black/10 p-3 dark:border-white/15">
          <div className="flex items-center justify-between gap-2">
            <Label>{t.pickStudents} ({candidates.length})</Label>
            {picked.length > 0 && <span className="tnum text-sm font-bold text-register">✓ {picked.length}</span>}
          </div>
          <Input value={pickQ} onChange={e => setPickQ(e.target.value)} placeholder={`${t.search}…`} dir="auto" />
          <div className="mt-2 max-h-56 divide-y divide-black/10 overflow-auto rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
            {candidates
              .filter(u => {
                if (!pickQ.trim()) return true;
                const s = pickQ.trim().toLowerCase();
                return `${u.details?.full_name_ar ?? ""} ${u.details?.full_name_en ?? ""} ${u.details?.university_id ?? ""} ${u.email ?? ""}`.toLowerCase().includes(s);
              })
              .slice(0, 100)
              .map(u => {
                const on = picked.includes(u.id);
                const label = u.details?.full_name_ar || u.details?.full_name_en || u.email;
                return (
                  <button key={u.id} type="button" onClick={() => setPicked(on ? picked.filter(x => x !== u.id) : [...picked, u.id])}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${on ? "bg-register-light/60 dark:bg-register/20" : ""}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 font-bold ${on ? "border-register bg-register text-white" : "border-black/20 text-transparent dark:border-white/25"}`}>✓</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold" dir="auto">{label}</span>
                      <span className="tnum block truncate text-xs text-neutral-500" dir="auto">{u.details?.university_id ?? ""}{u.details?.university_id && u.email ? " · " : ""}{u.email ?? ""}</span>
                    </span>
                  </button>
                );
              })}
          </div>
          <p className="mt-1 text-xs text-neutral-500">{t.pickStudentsHint}</p>
        </div>
        <div className="mt-2 grid gap-2">
          <div><Label>Email / {t.universityId} (one per line)</Label>
            <textarea value={add.refs} onChange={e => setAdd({ ...add, refs: e.target.value })} rows={4} dir="auto"
              className="min-h-[80px] w-full rounded-md2 border-2 border-black/15 bg-paper px-3 py-2 outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>{t.section}</Label>
              <Select value={add.section} onChange={e => setAdd({ ...add, section: e.target.value })}>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option>
              </Select>
            </div>
            <div><Label>{t.programs}</Label>
              <Select value={add.prog} onChange={e => setAdd({ ...add, prog: e.target.value })}>
                <option value="">—</option>{progs.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name_ar}</option>)}
              </Select>
            </div>
            <div><Label>Level</Label>
              <Select value={add.level} onChange={e => setAdd({ ...add, level: e.target.value })}>
                <option value="">—</option>{levels.map(l => <option key={l.id} value={l.id}>{l.name_ar}</option>)}
              </Select>
            </div>
          </div>
          <Button onClick={doAdd}>{t.enrollStudents}</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={`Remove ${selected.length} student(s)?`}
        impact="They lose access to sessions and history of this course stays but they cannot scan again."
        confirmLabel="Remove"
        onCancel={() => setConfirm(false)}
        onConfirm={doRemove}
      />
    </div>
  );
}
