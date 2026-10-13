"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label, StatusPill } from "@/components/ui";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";

export default function AttendancePage() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [f, setF] = useState({ course_id: "", from: "", to: "", status: "", session_id: "" });
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [newStatus, setNewStatus] = useState("present");
  const [bulk, setBulk] = useState<null | { mode: "mark" | "unmark" | "status" }>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [tab, setTab] = useState<"records" | "disputes">("records");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/console/courses?perPage=500").then(r => r.json()).then(j => setCourses(j.rows ?? []));
  }, []);
  async function load(p = 1) {
    const q = new URLSearchParams({ page: String(p), perPage: "50", ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
    const r = await fetch(`/api/console/attendance?${q}`);
    const j = await r.json();
    if (r.ok) { setRows(j.rows); setTotal(j.total); setPage(p); }
    setSelected([]);
  }
  async function loadDisputes() {
    const r = await fetch("/api/console/disputes");
    const j = await r.json();
    if (r.ok) setDisputes(j.rows ?? []);
  }
  useEffect(() => { load(1); loadDisputes(); /* eslint-disable-next-line */ }, [f.course_id, f.status, f.from, f.to]);

  async function saveEdit() {
    if (reason.trim().length < 3) { setMsg(t.manualReason); return; }
    const r = await fetch("/api/console/attendance", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: edit.id, status: newStatus, reason })
    });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else { setEdit(null); setReason(""); load(page); loadDisputes(); }
  }
  async function doBulk() {
    if (!bulk || reason.trim().length < 3) { setMsg(t.manualReason); return; }
    const body: any = { reason, session_id: f.session_id || undefined };
    if (bulk.mode === "mark") { body.mark_all_present = true; }
    else if (bulk.mode === "unmark") { body.record_ids = selected; body.unmark = true; }
    else { body.record_ids = selected; body.status = newStatus; }
    const r = await fetch("/api/console/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else { setBulk(null); setReason(""); load(1); }
  }
  async function decide(kind: string, id: string, decision: string) {
    const comment = prompt(t.comment + ":") ?? "";
    const r = await fetch("/api/console/decisions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, decision, comment })
    });
    if (r.ok) { loadDisputes(); load(page); }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={() => setTab("records")} className={`min-h-[48px] rounded-md2 px-4 font-bold ${tab === "records" ? "bg-ink text-chalk dark:bg-chalk dark:text-ink" : "border border-black/15 dark:border-white/20"}`}>{t.explorer}</button>
        <button onClick={() => setTab("disputes")} className={`min-h-[48px] rounded-md2 px-4 font-bold ${tab === "disputes" ? "bg-ink text-chalk dark:bg-chalk dark:text-ink" : "border border-black/15 dark:border-white/20"}`}>
          {t.disputes} ({disputes.filter(d => d.status === "pending").length})
        </button>
      </div>

      {tab === "records" ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div><Label>{t.course}</Label>
              <Select value={f.course_id} onChange={e => setF({ ...f, course_id: e.target.value })}>
                <option value="">{t.all}</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </Select>
            </div>
            <div><Label>{t.from}</Label><Input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
            <div><Label>{t.to}</Label><Input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
            <div><Label>{t.status}</Label>
              <Select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
                <option value="">{t.all}</option>
                <option value="present">present</option><option value="late">late</option>
                <option value="absent">absent</option><option value="excused">excused</option>
              </Select>
            </div>
            <div><Label>Session</Label><Input value={f.session_id} onChange={e => setF({ ...f, session_id: e.target.value })} placeholder="uuid" dir="ltr" /></div>
          </div>
          {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}

          <div className="mt-3 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
            <table className="w-full border-collapse text-start text-[15px]">
              <thead className="sticky top-0 bg-chalk dark:bg-ink">
                <tr className="border-b-2 border-black/15 dark:border-white/20">
                  <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all" className="h-5 w-5 accent-[#2F5D8A]"
                    checked={rows.length > 0 && rows.every(r => selected.includes(r.id))}
                    onChange={() => setSelected(rows.every(r => selected.includes(r.id)) ? [] : rows.map(r => r.id))} /></th>
                  <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.name}</th>
                  <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.course}</th>
                  <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.time}</th>
                  <th className="px-4 py-3 text-start font-display text-sm font-semibold">{t.status}</th>
                  <th className="px-4 py-3"><span className="sr-only">ops</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                    <td className="px-4 py-2.5"><input type="checkbox" aria-label="Select" className="h-5 w-5 accent-[#2F5D8A]"
                      checked={selected.includes(r.id)}
                      onChange={() => setSelected(selected.includes(r.id) ? selected.filter(x => x !== r.id) : [...selected, r.id])} /></td>
                    <td className="px-4 py-2.5 font-medium" dir="auto">{r.who?.full_name_ar ?? r.student_id.slice(0, 8)}</td>
                    <td className="tnum px-4 py-2.5 font-semibold">{r.course_code}</td>
                    <td className="tnum whitespace-nowrap px-4 py-2.5">{new Date(r.scanned_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end">
                      <button onClick={() => { setEdit(r); setNewStatus(r.status); setReason(""); }} className="min-h-[40px] px-2 text-sm font-semibold text-register hover:underline">{t.editRecord}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-6 text-center text-neutral-500">—</p>}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => load(page - 1)} className="min-h-[44px] rounded-md2 border border-black/15 px-4 text-sm font-semibold disabled:opacity-40 dark:border-white/20">‹ Prev</button>
              <button onClick={() => load(page + 1)} className="min-h-[44px] rounded-md2 border border-black/15 px-4 text-sm font-semibold dark:border-white/20">Next ›</button>
            </div>
            <p className="tnum text-sm text-neutral-500">{total}</p>
          </div>
          {selected.length > 0 && (
            <div className="sticky bottom-4 mt-2 flex flex-wrap items-center gap-2 rounded-md2 border-2 border-ink/20 bg-paper px-3 py-2 shadow-xl dark:border-white/25 dark:bg-inksurface">
              <span className="tnum text-sm font-bold">{selected.length} selected</span>
              <Button className="!min-h-[44px]" onClick={() => setBulk({ mode: "status" })}>{t.bulkMark}</Button>
              <Button variant="brick" className="!min-h-[44px]" onClick={() => setBulk({ mode: "unmark" })}>{t.bulkUnmark}</Button>
            </div>
          )}
          {f.session_id && (
            <Button variant="outline" className="mt-2" onClick={() => setBulk({ mode: "mark" })}>Mark whole session present</Button>
          )}
        </>
      ) : (
        <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {disputes.length === 0 && <p className="p-4 text-neutral-500">—</p>}
          {disputes.map(d => (
            <div key={d.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium" dir="auto">{d.reason}</p>
                <StatusPill status={d.status === "pending" ? "late" : d.status === "approved" ? "present" : "absent"} />
              </div>
              <p className="tnum mt-1 text-sm text-neutral-500" dir="auto">
                {d.attendance_records?.attendance_sessions?.courses?.code ?? ""} · {d.attendance_records?.status} · {d.attendance_records?.scanned_at ? new Date(d.attendance_records.scanned_at).toLocaleString() : ""}
              </p>
              {d.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <Button variant="stamp" className="!min-h-[44px]" onClick={() => decide("dispute", d.id, "approved")}>{t.approveIt}</Button>
                  <Button variant="brick" className="!min-h-[44px]" onClick={() => decide("dispute", d.id, "denied")}>{t.denyIt}</Button>
                </div>
              )}
              {d.comment && <p className="mt-1 text-sm text-neutral-500" dir="auto">{t.comment}: {d.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {(edit || bulk) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => { setEdit(null); setBulk(null); }}>
          <div className="w-full max-w-md rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold">{edit ? t.editRecord : bulk?.mode === "mark" ? t.bulkMark : bulk?.mode === "unmark" ? t.bulkUnmark : t.bulkMark}</h2>
            {(edit || bulk?.mode === "status") && (
              <div className="mt-2"><Label>{t.status}</Label>
                <Select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="present">present</option><option value="late">late</option>
                  <option value="absent">absent</option><option value="excused">excused</option>
                </Select>
              </div>
            )}
            <div className="mt-2"><Label>{t.manualReason} *</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} dir="auto" />
            </div>
            <Button className="mt-3 w-full" onClick={edit ? saveEdit : doBulk}>{t.save}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
