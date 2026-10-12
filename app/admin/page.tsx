"use client";
import { useEffect, useMemo, useState } from "react";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import {
  Button, Input, Select, Label, StatusPill, StatNumber,
  DataTable, THead, Th, Td, SkeletonRows, EmptyState
} from "@/components/ui";
import { AdminManage } from "@/components/admin-manage";
import {
  FileDown, Search, Users, CalendarCheck, ClipboardCheck, Flag, Inbox, ShieldCheck
} from "lucide-react";

type Row = {
  id: string; scanned_at: string; method: string; status: string; student_id: string;
  course_code: string; course_id: string; name_ar: string; name_en: string; university_id: string;
};

export default function Admin() {
  const { t } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ course: "", from: "", to: "", status: "", q: "" });

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const sb = browserSupabase();
    const { data: cs } = await sb.from("courses").select("id,code,name_ar,name_en").order("code");
    setCourses(cs ?? []);
    const { data: rec } = await sb.from("attendance_records")
      .select("id,scanned_at,method,status,student_id,attendance_sessions!inner(course_id,courses(code,name_ar,name_en))")
      .order("scanned_at", { ascending: false }).limit(1000);
    const sids = [...new Set(((rec ?? []) as any[]).map(r => r.student_id))];
    let byUser: Record<string, any> = {};
    if (sids.length) {
      const { data: dets } = await sb.from("student_details").select("user_id,full_name_ar,full_name_en,university_id").in("user_id", sids);
      (dets ?? []).forEach((d: any) => { byUser[d.user_id] = d; });
    }
    setRows(((rec ?? []) as any[]).map(r => ({
      id: r.id, scanned_at: r.scanned_at, method: r.method, status: r.status, student_id: r.student_id,
      course_id: r.attendance_sessions.course_id,
      course_code: r.attendance_sessions.courses.code,
      name_ar: byUser[r.student_id]?.full_name_ar ?? "",
      name_en: byUser[r.student_id]?.full_name_en ?? "",
      university_id: byUser[r.student_id]?.university_id ?? ""
    })));
    const { data: p } = await sb.from("profiles").select("id,email,role,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50);
    setPending(p ?? []);
    const { data: fl } = await sb.from("flagged_attempts").select("id,reason,ip,created_at,device_id").order("created_at", { ascending: false }).limit(50);
    setFlags(fl ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (f.course && r.course_id !== f.course) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.from && r.scanned_at < f.from) return false;
    if (f.to && r.scanned_at > f.to + "T23:59") return false;
    if (f.q && !`${r.name_ar} ${r.name_en} ${r.university_id}`.includes(f.q)) return false;
    return true;
  }), [rows, f]);

  async function approve(id: string, status: string) {
    const sb = browserSupabase();
    await sb.from("profiles").update({ status }).eq("id", id);
    load();
  }
  async function resetDevice(studentId: string) {
    const sb = browserSupabase();
    await sb.from("devices").delete().eq("student_id", studentId);
  }

  const counts = useMemo(() => ({
    students: new Set(rows.map(r => r.student_id)).size,
    sessions: 0,
    records: rows.length,
    flags: flags.length
  }), [rows, flags]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.dashboard}</h1>
          <p className="text-neutral-500">{t.attendanceTable}</p>
        </div>
        <a href={`/api/reports/export?course_id=${f.course}&from=${f.from}&to=${f.to}&status=${f.status}`}>
          <Button variant="outline"><FileDown size={18} strokeWidth={2} /> {t.exportCsv}</Button>
        </a>
      </div>

      {/* stat numbers with hairline separators, not cards */}
      <section className="mt-5 grid grid-cols-2 gap-6 border-y-2 border-ink/15 py-5 sm:grid-cols-4 dark:border-white/20" aria-label="stats">
        <StatNumber value={counts.students} label={t.student} />
        <StatNumber value={counts.records} label={t.recentScans} />
        <StatNumber value={counts.flags} label={t.flagged} />
        <StatNumber value={pending.length} label={t.approvals} />
      </section>

      {/* filters: one row, keyboard friendly */}
      <section className="mt-5" aria-label={t.filters}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div><Label>{t.course}</Label>
            <Select value={f.course} onChange={e => setF({ ...f, course: e.target.value })}>
              <option value="">{t.all}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
            </Select>
          </div>
          <div><Label>{t.from}</Label><Input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
          <div><Label>{t.to}</Label><Input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
          <div><Label>{t.status}</Label>
            <Select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
              <option value="">{t.all}</option>
              <option value="present">present</option>
              <option value="late">late</option>
              <option value="absent">absent</option>
              <option value="excused">excused</option>
            </Select>
          </div>
          <div className="col-span-2"><Label>{t.search}</Label>
            <div className="relative">
              <Search size={18} strokeWidth={2} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input className="!ps-10" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder={t.search} />
            </div>
          </div>
        </div>
      </section>

      {/* attendance table */}
      <section className="mt-4" aria-label={t.attendanceTable}>
        <DataTable>
          <THead>
            <Th>{t.name}</Th><Th>{t.universityId}</Th><Th>{t.course}</Th><Th>{t.time}</Th><Th>{t.status}</Th><Th>{t.method}</Th><Th><span className="sr-only">actions</span></Th>
          </THead>
          <tbody>
            {loading && <SkeletonRows rows={8} cols={7} />}
            {!loading && filtered.map(r => (
              <tr key={r.id} className="border-b border-black/10 last:border-0 hover:bg-chalk/60 dark:border-white/10 dark:hover:bg-white/5">
                <Td className="font-medium">{r.name_ar || r.name_en}</Td>
                <Td className="tnum">{r.university_id}</Td>
                <Td className="tnum font-semibold">{r.course_code}</Td>
                <Td className="tnum whitespace-nowrap">{new Date(r.scanned_at).toLocaleString()}</Td>
                <Td><StatusPill status={r.status} /></Td>
                <Td>{r.method === "manual" ? t.manualMethod : t.scanMethod}</Td>
                <Td className="whitespace-nowrap"><button className="font-semibold text-register underline-offset-4 hover:underline" onClick={() => resetDevice(r.student_id)}>{t.resetDevice}</button></Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {!loading && filtered.length === 0 && (
          <div className="rounded-md2 border border-black/10 dark:border-white/15">
            <EmptyState icon={<Inbox size={28} strokeWidth={1.75} />} title={t.nothingYet} hint={t.noSessionsHint} />
          </div>
        )}
        <p className="tnum mt-2 text-sm text-neutral-500">{filtered.length} / {rows.length}</p>
      </section>

      {/* approvals + flags */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-label={t.approvals}>
          <h2 className="font-display flex items-center gap-2 text-xl font-bold"><ShieldCheck size={20} strokeWidth={2} /> {t.approvals}</h2>
          <div className="mt-3 rounded-md2 border border-black/10 dark:border-white/15">
            {pending.length === 0 && <p className="p-4 text-neutral-500">—</p>}
            {pending.map(p => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 p-4 last:border-0 dark:border-white/10">
                <div><div className="font-medium">{p.email}</div><div className="text-sm text-neutral-500">{p.role}</div></div>
                <div className="flex gap-2">
                  <Button variant="stamp" className="!min-h-[44px]" onClick={() => approve(p.id, "approved")}>{t.approve}</Button>
                  <Button variant="brick" className="!min-h-[44px]" onClick={() => approve(p.id, "rejected")}>{t.reject}</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section aria-label={t.flagged}>
          <h2 className="font-display flex items-center gap-2 text-xl font-bold"><Flag size={20} strokeWidth={2} /> {t.flagged}</h2>
          <DataTable>
            <THead><Th>{t.time}</Th><Th>{t.status}</Th><Th>IP</Th></THead>
            <tbody>
              {flags.map(fl => (
                <tr key={fl.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                  <Td className="tnum whitespace-nowrap">{new Date(fl.created_at).toLocaleString()}</Td>
                  <Td><span className="rounded-full bg-brick-light px-3 py-1 text-sm font-semibold text-brick-dark dark:bg-brick/20 dark:text-red-300">{fl.reason}</span></Td>
                  <Td className="tnum">{fl.ip}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>
      </div>

      <AdminManage />

      <div className="mt-8 flex items-center gap-6 border-t-2 border-ink/15 pt-4 text-sm text-neutral-500 dark:border-white/20">
        <span className="flex items-center gap-1.5"><Users size={16} strokeWidth={2} /> RLS enforced</span>
        <span className="flex items-center gap-1.5"><CalendarCheck size={16} strokeWidth={2} /> server time</span>
        <span className="flex items-center gap-1.5"><ClipboardCheck size={16} strokeWidth={2} /> audit logged</span>
      </div>
    </main>
  );
}
