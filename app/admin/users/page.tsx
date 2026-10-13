"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label, StatusPill } from "@/components/ui";
import { ConsoleTable } from "@/components/console/DataTable";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";
import { UserPlus, Upload, Download, Eye, KeyRound, Smartphone, Trash2 } from "lucide-react";

type Row = any;

function UsersInner() {
  const { t } = useApp();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<{ row: Row; mode: "deactivate" | "delete" } | null>(null);

  // drawer state
  const [edit, setEdit] = useState<any>({});
  const [newPw, setNewPw] = useState("");
  const [csv, setCsv] = useState("");
  const [nu, setNu] = useState({ email: "", password: "", role: "student" });
  const [hist, setHist] = useState<any[]>([]);
  const [enr, setEnr] = useState<any[]>([]);

  async function load(p = page) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), perPage: "25", search: q, role, status });
    const r = await fetch(`/api/console/users-manage?${params}`);
    const j = await r.json();
    if (r.ok) { setRows(j.rows); setTotal(j.total); }
    else setNotice(j.error ?? "error");
    setLoading(false);
  }
  useEffect(() => { const id = setTimeout(() => { setPage(1); load(1); }, 300); return () => clearTimeout(id); /* eslint-disable-next-line */ }, [q, role, status]);
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  async function openDetail(row: Row) {
    setDetail(row);
    setEdit({ email: row.email, role: row.role, custom_role: row.custom_role ?? "", status: row.status, is_active: row.is_active });
    setNewPw(""); setHist([]); setEnr([]);
    const [h, e] = await Promise.all([
      fetch(`/api/console/audit?actor=${row.id}&perPage=20`).then(r => r.json()).catch(() => ({ rows: [] })),
      row.role === "student"
        ? fetch(`/api/console/enrollments?course_id=&perPage=1`).then(() => ({ rows: [] })).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] })
    ]);
    setHist(h.rows ?? []);
    void e;
    // enrollments of this student across courses (admin view)
    if (row.role === "student") {
      const { browserSupabase } = await import("@/lib/supabase");
      const sb = browserSupabase();
      const { data } = await sb.from("enrollments").select("course_id,courses(code)").eq("student_id", row.id).limit(50);
      setEnr((data ?? []) as any[]);
    }
  }

  async function saveEdit() {
    const r = await fetch("/api/console/users-manage", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: detail.id, ...edit, custom_role: edit.custom_role || null })
    });
    const j = await r.json();
    if (!r.ok) setNotice(j.error);
    else { setNotice("✓"); load(); openDetail({ ...detail, ...edit }); }
  }
  async function doConfirm() {
    if (!confirm) return;
    const r = await fetch(`/api/console/users-manage?id=${confirm.row.id}&mode=${confirm.mode}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) setNotice(j.error);
    else { setConfirm(null); setDetail(null); load(); }
  }
  async function resetPw() {
    const r = await fetch("/api/console/users-manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", id: detail.id })
    });
    const j = await r.json();
    if (!r.ok) setNotice(j.error);
    else setNewPw(j.password);
  }
  async function resetDevice() {
    const r = await fetch("/api/console/users-manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_device", id: detail.id })
    });
    setNotice(r.ok ? "✓" : "error");
  }
  async function impersonate() {
    const r = await fetch("/api/console/view-as", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: detail.id })
    });
    const j = await r.json();
    if (!r.ok) { setNotice(j.error); return; }
    location.href = detail.role === "professor" ? "/professor" : "/student";
  }
  async function create() {
    const r = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nu)
    });
    const j = await r.json();
    if (!r.ok) setNotice(j.error);
    else { setCreateOpen(false); setNu({ email: "", password: "", role: "student" }); load(); }
  }
  async function doImport() {
    const r = await fetch("/api/console/users-manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import_csv", csv })
    });
    const j = await r.json();
    setNotice(r.ok ? `Created ${j.created.length}, failed ${j.failed.length}${j.failed.length ? ": " + j.failed.slice(0, 5).join("; ") : ""}` : j.error);
    if (r.ok) { setImportOpen(false); setCsv(""); load(); }
  }
  async function doExport() {
    const r = await fetch("/api/console/users-manage?perPage=1000");
    const j = await r.json();
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csvOut = "﻿email,role,custom_role,status,active,university_id,name_ar\n" +
      (j.rows ?? []).map((u: any) => [u.email, u.role, u.custom_role ?? "", u.status, u.is_active, u.details?.university_id ?? "", esc(u.details?.full_name_ar ?? "")].join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csvOut], { type: "text/csv" }));
    a.download = "users.csv";
    a.click();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t.users}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload size={18} strokeWidth={2} /> {t.importCsv}</Button>
          <Button variant="outline" onClick={doExport}><Download size={18} strokeWidth={2} /> CSV</Button>
          <Button onClick={() => setCreateOpen(true)}><UserPlus size={18} strokeWidth={2} /> {t.newUser}</Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2"><Input value={q} onChange={e => setQ(e.target.value)} placeholder="email…" dir="ltr" aria-label="Search" /></div>
        <Select value={role} onChange={e => setRole(e.target.value)} aria-label="Role">
          <option value="">All roles</option>
          <option value="student">{t.student}</option>
          <option value="professor">{t.professor}</option>
          <option value="admin">{t.admin}</option>
        </Select>
        <Select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="suspended">suspended</option>
        </Select>
      </div>

      {notice && <p className="mt-2 text-sm font-semibold" role="status" dir="auto">{notice}</p>}

      <div className="mt-3">
        <ConsoleTable
          rows={rows}
          columns={[
            { key: "email", label: "Email", sortable: true, render: r => <span dir="ltr" className="font-medium">{r.email}</span> },
            { key: "name", label: t.name, render: r => <span dir="auto">{r.details?.full_name_ar ?? r.details?.full_name_en ?? "—"}</span> },
            { key: "role", label: "Role", render: r => <span>{r.role}{r.custom_role ? ` + ${r.custom_role}` : ""}{r.is_active === false ? " (off)" : ""}</span> },
            { key: "status", label: t.status, render: r => <StatusPill status={r.status === "approved" ? "present" : r.status === "pending" ? "late" : "absent"} /> },
            { key: "last", label: t.lastLogin, render: r => <span className="tnum text-sm text-neutral-500">{r.last_login_at ? new Date(r.last_login_at).toLocaleString() : "—"}</span> }
          ]}
          total={total} page={page} perPage={25} sort="created_at" order="desc"
          onPage={setPage} onSort={() => {}}
          selected={selected} onSelect={setSelected}
          rowActions={r => <button onClick={() => openDetail(r)} className="min-h-[40px] rounded-md2 px-2 text-sm font-semibold text-register hover:bg-register-light">Open</button>}
          empty={loading ? <p className="p-6 text-center text-neutral-500">Loading…</p> : undefined}
        />
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold">{t.newUser}</h2>
            <div className="mt-3 grid gap-2">
              <div><Label>{t.email}</Label><Input value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} dir="ltr" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t.password}</Label><Input type="password" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} dir="ltr" /></div>
                <div><Label>{t.status}</Label>
                  <Select value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value })}>
                    <option value="student">{t.student}</option>
                    <option value="professor">{t.professor}</option>
                    <option value="admin">{t.admin}</option>
                  </Select>
                </div>
              </div>
              <Button onClick={create}>{t.createAccount}</Button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setImportOpen(false)}>
          <div className="w-full max-w-md rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold">{t.importCsv}</h2>
            <p className="mt-1 text-sm text-neutral-500" dir="ltr">email,password,role — one per line</p>
            <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8} dir="ltr"
              className="mt-2 min-h-[120px] w-full rounded-md2 border-2 border-black/15 bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
            <Button className="mt-3 w-full" onClick={doImport}>{t.importCsv}</Button>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-y-0 end-0 z-40 w-full max-w-md overflow-auto border-s-2 border-ink/15 bg-paper p-5 shadow-2xl dark:border-white/20 dark:bg-inksurface" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between">
            <h2 className="font-display break-all text-xl font-bold" dir="ltr">{detail.email}</h2>
            <button onClick={() => setDetail(null)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-md2 hover:bg-black/5">✕</button>
          </div>
          <div className="mt-3 grid gap-2">
            <div><Label>{t.email}</Label><Input value={edit.email ?? ""} onChange={e => setEdit({ ...edit, email: e.target.value })} dir="ltr" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t.status}</Label>
                <Select value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })}>
                  <option value="student">{t.student}</option>
                  <option value="professor">{t.professor}</option>
                  <option value="admin">{t.admin}</option>
                </Select>
              </div>
              <div><Label>Custom role</Label>
                <Select value={edit.custom_role ?? ""} onChange={e => setEdit({ ...edit, custom_role: e.target.value })}>
                  <option value="">—</option>
                  <option value="ta">ta</option>
                  <option value="department_admin">department_admin</option>
                </Select>
              </div>
              <div><Label>Approval</Label>
                <Select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="suspended">suspended</option>
                </Select>
              </div>
              <label className="flex min-h-[48px] items-end gap-2 pb-2">
                <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={!!edit.is_active} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} />
                <span className="font-semibold">{t.activate}</span>
              </label>
            </div>
            <Button onClick={saveEdit}>{t.save}</Button>
            {detail.details && (
              <div className="rounded-md2 border border-black/10 p-3 text-sm dark:border-white/15" dir="auto">
                <p className="font-bold">{detail.details.full_name_ar} · {detail.details.full_name_en}</p>
                <p className="tnum">ID: {detail.details.university_id} · {detail.details.phone}</p>
                <p>Year {detail.details.level_year} · Group {detail.details.section_group}</p>
              </div>
            )}
            {enr.length > 0 && (
              <div className="text-sm"><p className="font-bold">{t.myCourses}</p>
                <p className="tnum">{enr.map((e: any) => e.courses?.code).join(", ")}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 border-t border-black/10 pt-3 dark:border-white/10">
              <Button variant="outline" onClick={resetPw}><KeyRound size={17} strokeWidth={2} /> {t.resetPassword}</Button>
              <Button variant="outline" onClick={resetDevice}><Smartphone size={17} strokeWidth={2} /> {t.resetDevice}</Button>
              {detail.role !== "admin" && (
                <Button variant="outline" onClick={impersonate} className="col-span-2"><Eye size={17} strokeWidth={2} /> {t.viewAs} (logged)</Button>
              )}
              <Button variant="outline" onClick={() => setConfirm({ row: detail, mode: "deactivate" })}>{t.deactivate}</Button>
              <Button variant="brick" onClick={() => setConfirm({ row: detail, mode: "delete" })}><Trash2 size={17} strokeWidth={2} /> Delete</Button>
            </div>
            {newPw && <p className="rounded-md2 bg-hi-light p-3 text-sm font-bold text-hi-dark dark:bg-hi/15 dark:text-amber-200" dir="ltr">{t.newPassword}: {newPw}</p>}
            <div className="mt-2">
              <p className="font-bold">{t.history}</p>
              {hist.map((h: any) => (
                <p key={h.id} className="tnum border-b border-black/10 py-1.5 text-sm last:border-0 dark:border-white/10" dir="auto">
                  {new Date(h.created_at).toLocaleString()} — {h.action} · {h.entity_type}
                </p>
              ))}
              {hist.length === 0 && <p className="text-sm text-neutral-500">—</p>}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.mode === "delete" ? "Delete user forever?" : "Deactivate user?"}
        impact={confirm?.mode === "delete"
          ? `Auth account + profile of ${confirm?.row.email} will be permanently deleted.`
          : `${confirm?.row.email} will be suspended and cannot log in. Restorable from Trash.`}
        requireName={confirm?.mode === "delete" ? confirm.row.email : null}
        confirmLabel={confirm?.mode === "delete" ? "Delete forever" : t.deactivate}
        onCancel={() => setConfirm(null)}
        onConfirm={doConfirm}
      />
    </div>
  );
}

export default function UsersPage() {
  return <Suspense><UsersInner /></Suspense>;
}
