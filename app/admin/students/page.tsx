"use client";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label, StatusPill } from "@/components/ui";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";
import { UserPlus, Download, CheckCircle, XCircle, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = any;

export default function StudentsPage() {
  const { t, locale } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [programId, setProgramId] = useState("");
  const [programs, setPrograms] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; ids: string[] } | null>(null);
  const [notice, setNotice] = useState("");
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false);
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [cols, setCols] = useState({ program: true, level: true, group: true, attendance: true, phone: true });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [rowHistory, setRowHistory] = useState<any[]>([]);
  const [rowCourses, setRowCourses] = useState<any[]>([]);

  async function load(p = page) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), perPage: "25", search: q, status });
    if (programId) params.set("program_id", programId);
    const r = await fetch(`/api/console/students?${params}`);
    const j = await r.json();
    if (r.ok) { setRows(j.rows); setTotal(j.total); }
    else setNotice(j.error ?? "error");
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/console/programs?perPage=200").then(r => r.json()).then(j => setPrograms(j.rows ?? [])).catch(() => {});
    fetch("/api/console/courses?perPage=200").then(r => r.json()).then(j => setCourses(j.rows ?? [])).catch(() => {});
  }, []);

  useEffect(() => { const id = setTimeout(() => { setPage(1); load(1); }, 300); return () => clearTimeout(id); /* eslint-disable-next-line */ }, [q, status, programId]);
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  async function openDetail(row: Row) {
    setDetail(row);
    const sb = (await import("@/lib/supabase")).browserSupabase();
    const [hist, enr] = await Promise.all([
      sb.from("attendance_records").select("id,status,scanned_at,attendance_sessions(course_id,courses(code))").eq("student_id", row.id).order("scanned_at", { ascending: false }).limit(50),
      sb.from("enrollments").select("course_id,courses(code,name_ar)").eq("student_id", row.id).limit(50),
    ]);
    setRowHistory(hist.data ?? []);
    setRowCourses(enr.data ?? []);
  }

  async function doBulk(action: string) {
    if (!confirm) return;
    const ids = confirm.ids;
    const r = await fetch("/api/console/students", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    const j = await r.json();
    if (!r.ok) setNotice(j.error);
    else {
      setNotice(`✓ ${action} ${ids.length}`);
      setSelected(new Set());
      load();
    }
    setConfirm(null);
  }

  async function doBulkEnroll() {
    if (!enrollCourseId || selected.size === 0) return;
    const r = await fetch("/api/console/students", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enroll", ids: [...selected], course_id: enrollCourseId }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setNotice(j.error);
    else { setNotice(`✓ enrolled ${selected.size}`); setBulkEnrollOpen(false); setEnrollCourseId(""); setSelected(new Set()); load(); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.id)));
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t.student}</h1>
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="outline" onClick={() => setConfirm({ action: "approve", ids: [...selected] })}><CheckCircle size={16} /> Approve ({selected.size})</Button>
              <Button variant="outline" onClick={() => setConfirm({ action: "reject", ids: [...selected] })}><XCircle size={16} /> Reject</Button>
              <Button variant="outline" onClick={() => setBulkEnrollOpen(true)}><BookOpen size={16} /> Enroll to course</Button>
              <Button variant="brick" onClick={() => setConfirm({ action: "deactivate", ids: [...selected] })}>Deactivate</Button>
            </>
          )}
        </div>
      </div>

      {/* filters */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2"><Input value={q} onChange={e => setQ(e.target.value)} placeholder="email or name…" dir="ltr" aria-label="Search" /></div>
        <Select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="suspended">suspended</option>
        </Select>
        <Select value={programId} onChange={e => setProgramId(e.target.value)} aria-label="Program">
          <option value="">All programs</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
        </Select>
      </div>

      {notice && <p className="mt-2 text-sm font-semibold" role="status" dir="auto">{notice}</p>}

      {/* column toggles */}
      <div className="mt-2 flex flex-wrap gap-2">
        {([["program", "Program"], ["level", "Level"], ["group", "Group"], ["attendance", "Attendance"], ["phone", "Phone"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setCols(c => ({ ...c, [key]: !c[key] }))}
            className={cn("min-h-[32px] rounded-full px-3 text-xs font-bold transition-colors",
              cols[key] ? "bg-ink text-chalk dark:bg-chalk dark:text-ink" : "border border-black/15 dark:border-white/20")}>
            {label}
          </button>
        ))}
      </div>

      {/* table */}
      <div className="mt-3 overflow-x-auto rounded-md2 border border-black/10 dark:border-white/15">
        <table className="w-full min-w-[640px] border-collapse text-start text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/15">
              <th className="px-3 py-2.5 text-start">
                <input type="checkbox" className="h-4 w-4 accent-[#2F5D8A]" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2.5 text-start font-semibold">Name</th>
              <th className="px-3 py-2.5 text-start font-semibold">Email</th>
              <th className="px-3 py-2.5 text-start font-semibold">ID</th>
              {cols.program && <th className="px-3 py-2.5 text-start font-semibold">Program</th>}
              {cols.level && <th className="px-3 py-2.5 text-start font-semibold">Level</th>}
              {cols.group && <th className="px-3 py-2.5 text-start font-semibold">Group</th>}
              {cols.attendance && <th className="px-3 py-2.5 text-start font-semibold">Attendance</th>}
              {cols.phone && <th className="px-3 py-2.5 text-start font-semibold">Phone</th>}
              <th className="px-3 py-2.5 text-start font-semibold">Status</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && [...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-black/5 dark:border-white/5">
                <td colSpan={10} className="px-3 py-3"><div className="skeleton h-5 w-full rounded bg-black/5 dark:bg-white/10" /></td>
              </tr>
            ))}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-b border-black/5 transition-colors hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]">
                <td className="px-3 py-2.5">
                  <input type="checkbox" className="h-4 w-4 accent-[#2F5D8A]" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.email}`} />
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => openDetail(r)} className="font-semibold text-register hover:underline" dir="auto">
                    {r.details?.full_name_ar || r.details?.full_name_en || "—"}
                  </button>
                </td>
                <td className="px-3 py-2.5" dir="ltr">{r.email}</td>
                <td className="tnum px-3 py-2.5">{r.details?.university_id ?? "—"}</td>
                {cols.program && <td className="px-3 py-2.5">{r.program?.code ?? "—"}</td>}
                {cols.level && <td className="px-3 py-2.5">{r.details?.level_year ?? "—"}</td>}
                {cols.group && <td className="px-3 py-2.5">{r.details?.section_group ?? "—"}</td>}
                {cols.attendance && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                        <div className={cn("h-full rounded-full", r.attendance.rate >= 75 ? "bg-emerald-500" : r.attendance.rate >= 50 ? "bg-amber-500" : "bg-red-500")}
                          style={{ width: `${r.attendance.rate}%` }} />
                      </div>
                      <span className="tnum text-xs font-bold">{r.attendance.rate}%</span>
                    </div>
                  </td>
                )}
                {cols.phone && <td className="tnum px-3 py-2.5" dir="ltr">{r.details?.phone ?? "—"}</td>}
                <td className="px-3 py-2.5">
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
                    r.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : r.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    : r.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300")}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)} className="min-h-[36px] rounded p-1 text-neutral-400 hover:text-register">
                    {expandedRow === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-neutral-500">No students found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="mt-3 flex items-center justify-between">
        <span className="tnum text-sm text-neutral-500">{total} students · page {page}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <Button variant="outline" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>

      {/* bulk enroll modal */}
      {bulkEnrollOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setBulkEnrollOpen(false)}>
          <div className="w-full max-w-md rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold">Enroll {selected.size} students to course</h2>
            <div className="mt-3 grid gap-2">
              <Select value={enrollCourseId} onChange={e => setEnrollCourseId(e.target.value)}>
                <option value="">— Select course —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name_ar}</option>)}
              </Select>
              <Button onClick={doBulkEnroll} disabled={!enrollCourseId}>Enroll</Button>
            </div>
          </div>
        </div>
      )}

      {/* detail drawer */}
      {detail && (
        <div className="fixed inset-y-0 end-0 z-40 w-full max-w-md overflow-auto border-s-2 border-ink/15 bg-paper p-5 shadow-2xl dark:border-white/20 dark:bg-inksurface" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold" dir="auto">{detail.details?.full_name_ar || detail.email}</h2>
            <button onClick={() => setDetail(null)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-md2 hover:bg-black/5">✕</button>
          </div>
          <div className="mt-3 grid gap-1.5 text-sm">
            <p dir="ltr">{detail.email}</p>
            <p className="tnum">ID: {detail.details?.university_id} · Phone: {detail.details?.phone ?? "—"}</p>
            <p>Program: {detail.program?.code ?? "—"} · Level {detail.details?.level_year ?? "—"} · Group {detail.details?.section_group ?? "—"}</p>
            <p className="tnum">Attendance: {detail.attendance.present + detail.attendance.late}/{detail.attendance.total} ({detail.attendance.rate}%)</p>
          </div>

          {/* per-course breakdown */}
          {rowCourses.length > 0 && (
            <div className="mt-4">
              <p className="font-bold">Enrolled courses</p>
              <div className="mt-1 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
                {rowCourses.map((e: any) => (
                  <div key={e.course_id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="tnum font-semibold">{e.courses?.code}</span>
                    <span dir="auto" className="text-neutral-500">{e.courses?.name_ar}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* attendance history */}
          <div className="mt-4">
            <p className="font-bold">Recent attendance</p>
            <div className="mt-1 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
              {rowHistory.slice(0, 15).map((h: any) => (
                <div key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="tnum text-neutral-500">{h.attendance_sessions?.courses?.code} · {new Date(h.scanned_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}</span>
                  <StatusPill status={h.status} />
                </div>
              ))}
              {rowHistory.length === 0 && <p className="p-3 text-sm text-neutral-500">—</p>}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.action === "approve" ? `Approve ${confirm?.ids.length} students?` : confirm?.action === "reject" ? `Reject ${confirm?.ids.length} students?` : `Deactivate ${confirm?.ids.length} students?`}
        impact={confirm?.action === "approve" ? "Students will be able to log in and scan." : confirm?.action === "reject" ? "Students will be marked as rejected." : "Students will be suspended and cannot log in."}
        confirmLabel={confirm?.action === "approve" ? "Approve" : confirm?.action === "reject" ? "Reject" : "Deactivate"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => doBulk(confirm?.action ?? "")}
      />
    </div>
  );
}
