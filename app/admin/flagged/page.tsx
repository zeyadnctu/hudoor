"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";

export default function FlaggedPage() {
  const { t } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [act, setAct] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");

  async function load(p = 1) {
    const r = await fetch(`/api/console/flags?page=${p}&perPage=50`);
    const j = await r.json();
    if (r.ok) { setRows(j.rows); setTotal(j.total); setPage(p); }
  }
  useEffect(() => { load(1); }, []);

  async function run(action: string) {
    const r = await fetch("/api/console/flags", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: act.id, action, comment })
    });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else { setAct(null); setComment(""); load(page); }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.flagged}</h1>
      {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
      <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
        {rows.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        {rows.map(f => (
          <div key={f.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="rounded-full bg-brick-light px-2.5 py-0.5 text-xs font-bold text-brick-dark dark:bg-brick/20 dark:text-red-300">{f.reason}</span>
                <span className="ms-2 text-sm font-medium" dir="ltr">{f.user_email ?? f.user_id?.slice(0, 8) ?? "—"}</span>
              </p>
              <span className="tnum text-xs text-neutral-500">{new Date(f.created_at).toLocaleString()} · {f.ip}</span>
            </div>
            {f.metadata && <pre className="tnum mt-1 overflow-auto text-xs text-neutral-500" dir="auto">{JSON.stringify(f.metadata)}</pre>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" className="!min-h-[44px]" onClick={() => setAct({ ...f, mode: "warn" })}>{t.warnStudent}</Button>
              <Button variant="brick" className="!min-h-[44px]" onClick={() => setAct({ ...f, mode: "block" })}>Block user</Button>
              <Button variant="ghost" className="!min-h-[44px]" onClick={() => setAct({ ...f, mode: "clear" })}>Clear</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="min-h-[44px] rounded-md2 border border-black/15 px-4 text-sm font-semibold disabled:opacity-40 dark:border-white/20">‹ Prev</button>
          <button onClick={() => load(page + 1)} className="min-h-[44px] rounded-md2 border border-black/15 px-4 text-sm font-semibold dark:border-white/20">Next ›</button>
        </div>
        <p className="tnum text-sm text-neutral-500">{total}</p>
      </div>

      {act && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setAct(null)}>
          <div className="w-full max-w-md rounded-lg2 bg-paper p-5 dark:bg-inksurface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="font-display text-xl font-bold">{act.mode}: {act.reason}</h2>
            {act.mode !== "clear" && (
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} dir="auto" placeholder={t.comment}
                className="mt-2 min-h-[72px] w-full rounded-md2 border-2 border-black/15 bg-paper px-3 py-2 outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAct(null)}>Cancel</Button>
              <Button variant={act.mode === "clear" ? "outline" : "brick"} className="flex-[2]" onClick={() => run(act.mode)}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
