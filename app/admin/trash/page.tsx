"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/console/ConfirmDialog";
import { RotateCcw, Trash2 } from "lucide-react";

export default function TrashPage() {
  const { t } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"restore" | "purge" | null>(null);
  const [retention, setRetention] = useState("30");

  async function load() {
    const r = await fetch("/api/console/trash");
    const j = await r.json();
    setRows(j.rows ?? []);
    setSelected([]);
    const s = await fetch("/api/console/settings").then(x => x.json()).catch(() => ({ effective: {} }));
    if (s.effective?.trash_retention_days) setRetention(String(s.effective.trash_retention_days));
  }
  useEffect(() => { load(); }, []);

  async function run() {
    if (!confirm) return;
    const items = rows.filter(r => selected.includes(`${r.table}:${r.id}`)).map(r => ({ table: r.table, id: r.id }));
    await fetch("/api/console/trash", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: confirm, items })
    });
    setConfirm(null);
    load();
  }

  const key = (r: any) => `${r.table}:${r.id}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.trash}</h1>
          <p className="text-sm text-neutral-500">{t.retentionDays}: {retention}</p>
        </div>
      </div>
      <div className="mt-3 overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
        <table className="w-full border-collapse text-start text-[15px]">
          <thead className="sticky top-0 bg-chalk dark:bg-ink">
            <tr className="border-b-2 border-black/15 dark:border-white/20">
              <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all" className="h-5 w-5 accent-[#2F5D8A]"
                checked={rows.length > 0 && rows.every(r => selected.includes(key(r)))}
                onChange={() => setSelected(rows.every(r => selected.includes(key(r))) ? [] : rows.map(key))} /></th>
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">Item</th>
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">Type</th>
              <th className="px-4 py-3 text-start font-display text-sm font-semibold">Deleted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={key(r)} className="border-b border-black/10 last:border-0 dark:border-white/10">
                <td className="px-4 py-2.5"><input type="checkbox" aria-label="Select" className="h-5 w-5 accent-[#2F5D8A]"
                  checked={selected.includes(key(r))}
                  onChange={() => setSelected(selected.includes(key(r)) ? selected.filter(x => x !== key(r)) : [...selected, key(r)])} /></td>
                <td className="px-4 py-2.5 font-medium" dir="auto">{r.label ?? r.id.slice(0, 8)}</td>
                <td className="px-4 py-2.5 text-neutral-500" dir="ltr">{r.table}</td>
                <td className="tnum whitespace-nowrap px-4 py-2.5 text-neutral-500">{new Date(r.deleted_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-neutral-500">Trash is empty.</p>}
      </div>
      {selected.length > 0 && (
        <div className="sticky bottom-4 mt-2 flex items-center gap-2 rounded-md2 border-2 border-ink/20 bg-paper px-3 py-2 shadow-xl dark:border-white/25 dark:bg-inksurface">
          <span className="tnum text-sm font-bold">{selected.length} selected</span>
          <Button variant="stamp" className="!min-h-[44px]" onClick={() => setConfirm("restore")}>
            <RotateCcw size={17} strokeWidth={2} /> {t.restore}
          </Button>
          <Button variant="brick" className="!min-h-[44px]" onClick={() => setConfirm("purge")}>
            <Trash2 size={17} strokeWidth={2} /> {t.purge}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm === "purge" ? t.purge : t.restore}
        impact={confirm === "purge" ? `${selected.length} item(s). ${t.purgeConfirm}.` : `Restore ${selected.length} item(s)?`}
        requireName={confirm === "purge" ? String(selected.length) : null}
        confirmLabel={confirm === "purge" ? t.purge : t.restore}
        onCancel={() => setConfirm(null)}
        onConfirm={run}
      />
    </div>
  );
}
