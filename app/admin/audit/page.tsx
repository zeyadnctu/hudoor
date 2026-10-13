"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Select, Label } from "@/components/ui";
import { Download } from "lucide-react";

export default function AuditPage() {
  const { t } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ action: "", entity: "", actor: "", from: "", to: "" });
  const [open, setOpen] = useState<any>(null);

  async function load(p = 1) {
    const q = new URLSearchParams({ page: String(p), perPage: "50", ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
    const r = await fetch(`/api/console/audit?${q}`);
    const j = await r.json();
    if (r.ok) { setRows(j.rows); setTotal(j.total); setPage(p); }
  }
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [f.action, f.entity, f.from, f.to]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t.audit}</h1>
        <a href="/api/console/audit?format=csv&perPage=500">
          <Button variant="outline"><Download size={18} strokeWidth={2} /> CSV</Button>
        </a>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div><Label>{t.actor} (uuid)</Label><Input value={f.actor} onChange={e => setF({ ...f, actor: e.target.value })} dir="ltr" /></div>
        <div><Label>Action</Label><Input value={f.action} onChange={e => setF({ ...f, action: e.target.value })} dir="ltr" placeholder="attendance.edit" /></div>
        <div><Label>{t.entity}</Label><Input value={f.entity} onChange={e => setF({ ...f, entity: e.target.value })} dir="ltr" /></div>
        <div><Label>{t.from}</Label><Input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
        <div><Label>{t.to}</Label><Input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
      </div>
      <div className="mt-3 hidden sm:block">
        <Button variant="outline" onClick={() => { setF({ action: "", entity: "", actor: "", from: "", to: "" }); }}>Reset</Button>
      </div>

      <div className="mt-3 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
        <table className="w-full border-collapse text-start text-sm">
          <thead className="sticky top-0 bg-chalk dark:bg-ink">
            <tr className="border-b-2 border-black/15 dark:border-white/20">
              <th className="px-4 py-3 text-start font-display font-semibold">{t.time}</th>
              <th className="px-4 py-3 text-start font-display font-semibold">{t.actor}</th>
              <th className="px-4 py-3 text-start font-display font-semibold">Action</th>
              <th className="px-4 py-3 text-start font-display font-semibold">{t.entity}</th>
              <th className="px-4 py-3 text-start font-display font-semibold">IP</th>
              <th className="px-4 py-3"><span className="sr-only">diff</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                <td className="tnum whitespace-nowrap px-4 py-2.5">{new Date(a.created_at).toLocaleString()}</td>
                <td className="max-w-[180px] truncate px-4 py-2.5" dir="ltr" title={a.actor_id}>{a.actor_email ?? a.actor_id?.slice(0, 8) ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-[13px]" dir="ltr">{a.action}</td>
                <td className="px-4 py-2.5" dir="ltr">{a.entity_type}{a.entity_id ? `/${a.entity_id.slice(0, 8)}` : ""}</td>
                <td className="tnum px-4 py-2.5">{a.ip ?? "—"}</td>
                <td className="px-4 py-2.5 text-end">
                  <button onClick={() => setOpen(a)} className="min-h-[40px] px-2 text-sm font-semibold text-register hover:underline">diff</button>
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

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setOpen(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold" dir="ltr">{open.action}</h2>
            <p className="tnum text-sm text-neutral-500">{new Date(open.created_at).toLocaleString()} · {open.ip ?? ""}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-sm font-bold">Before</p>
                <pre className="tnum max-h-64 overflow-auto rounded bg-black/5 p-2 text-xs dark:bg-white/10" dir="auto">{JSON.stringify(open.before_data ?? "—", null, 2)}</pre>
              </div>
              <div>
                <p className="text-sm font-bold">After</p>
                <pre className="tnum max-h-64 overflow-auto rounded bg-black/5 p-2 text-xs dark:bg-white/10" dir="auto">{JSON.stringify(open.after_data ?? open.metadata ?? "—", null, 2)}</pre>
              </div>
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
