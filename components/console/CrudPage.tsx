"use client";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { Plus, Search, Undo2, RefreshCw } from "lucide-react";
import { RESOURCES } from "@/lib/resources";
import { useResource } from "./useResource";
import { ConsoleTable, type Column } from "./DataTable";
import { ResourceForm } from "./ResourceForm";
import { ConfirmDialog } from "./ConfirmDialog";

/** Full list + detail + create/edit/delete page from one resource name.
 *  Extra columns/actions inject per-page needs (counts, assign buttons). */
export function CrudPage({
  resource, columns, onNew, detail, extraActions, bulkBar, impactFor, filters
}: {
  resource: string;
  columns: Column<any>[];
  onNew?: () => Record<string, any>;
  detail?: (row: any, close: () => void) => React.ReactNode;
  extraActions?: (row: any) => React.ReactNode;
  bulkBar?: (ids: string[], clear: () => void) => React.ReactNode;
  impactFor?: (rows: any[]) => string;
  filters?: Record<string, string>;
}) {
  const def = RESOURCES[resource];
  const [search, setSearch] = useState("");
  const res = useResource<any>(resource, { sort: def.defaultSort });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [detailRow, setDetailRow] = useState<any | null>(null);
  const [confirm, setConfirm] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [options, setOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null);

  useEffect(() => {
    res.setQ(s => ({ ...s, search, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // external base filters (e.g. program_id for levels)
  useEffect(() => {
    if (filters) res.setQ(s => ({ ...s, filters: { ...filters }, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters ?? {})]);

  // option lists for select fields (optionsFrom)
  useEffect(() => {
    (async () => {
      const needs = [...new Set(def.fields.filter(f => f.optionsFrom).map(f => f.optionsFrom as string))];
      const out: Record<string, { value: string; label: string }[]> = {};
      for (const n of needs) {
        const d = RESOURCES[n];
        if (!d) continue;
        const r = await fetch(`/api/console/${n}?perPage=500`);
        const j = await r.json();
        const labelCol = def.fields.find(f => f.optionsFrom === n)?.optionLabel ?? "name_ar";
        out[n] = (j.rows ?? []).map((row: any) => ({ value: row.id, label: String(row[labelCol] ?? row.id) }));
      }
      setOptions(out);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);

  async function save(values: Record<string, any>) {
    const r = editing ? await res.update(editing.id, values) : await res.create(values);
    if (!r.ok) setNotice(`Save failed: ${r.error}`);
    else { setFormOpen(false); setEditing(null); }
  }
  async function doDelete(rows: any[]) {
    const r = await res.remove(rows.map(x => x.id));
    if (!r.ok) setNotice(`Delete failed: ${r.error}`);
    else {
      setConfirm(null); setSelected([]);
      setUndo({ ids: rows.map(x => x.id), label: `${rows.length} item(s) deleted` });
    }
  }
  async function undoDelete() {
    if (!undo) return;
    await fetch("/api/console/trash", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", items: undo.ids.map(id => ({ table: def.table, id })) })
    });
    setUndo(null);
    res.refresh();
  }

  const allCols: Column<any>[] = [
    ...columns,
    {
      key: "__ops", label: "", render: (row: any) => (
        <span className="flex justify-end gap-1">
          <button onClick={() => setDetailRow(row)} className="min-h-[40px] rounded-md2 px-2 text-sm font-semibold text-register hover:bg-register-light">Open</button>
          <button onClick={() => { setEditing(row); setFormOpen(true); }} className="min-h-[40px] rounded-md2 px-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">Edit</button>
          {extraActions?.(row)}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} strokeWidth={2} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input className="!ps-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" aria-label="Search" />
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={18} strokeWidth={2} /> New
        </Button>
        <Button variant="outline" onClick={() => res.refresh()} aria-label="Refresh">
          <RefreshCw size={18} strokeWidth={2} />
        </Button>
      </div>

      {notice && <p className="mb-2 rounded-md2 border border-brick/40 bg-brick-light/50 px-3 py-2 text-sm font-semibold text-brick-dark dark:bg-brick/10 dark:text-red-200" role="alert">{notice}</p>}
      {res.stale && (
        <button onClick={() => res.refresh()} className="mb-2 w-full rounded-md2 bg-hi-light px-3 py-2 text-sm font-semibold text-hi-dark dark:bg-hi/15 dark:text-amber-200">
          {res.stale} — tap to refresh
        </button>
      )}

      <ConsoleTable
        rows={res.rows} columns={allCols}
        total={res.total} page={res.q.page} perPage={res.q.perPage}
        sort={res.q.sort || def.defaultSort} order={res.q.order}
        onPage={p => res.setQ(s => ({ ...s, page: p }))}
        onSort={k => res.setQ(s => ({ ...s, sort: k, order: s.sort === k && s.order === "asc" ? "desc" : "asc" }))}
        selected={selected} onSelect={setSelected}
        onInlineSave={async (row, key, value) => {
          const r = await res.update(row.id, { [key]: value });
          if (!r.ok) setNotice(`Save failed: ${r.error}`);
        }}
        bulkActions={bulkBar ? bulkBar(selected, () => setSelected([])) : (
          <Button variant="brick" className="!min-h-[44px]" onClick={() => setConfirm(res.rows.filter(r => selected.includes(r.id)))}>
            Delete ({selected.length})
          </Button>
        )}
        empty={res.loading ? <p className="p-6 text-center text-neutral-500">Loading…</p> : undefined}
      />

      {undo && (
        <div className="fixed bottom-5 start-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-md2 border-2 border-ink/20 bg-paper px-4 py-3 shadow-2xl dark:border-white/25 dark:bg-inksurface" role="status">
          <span className="text-sm font-semibold">{undo.label}</span>
          <button onClick={undoDelete} className="flex min-h-[44px] items-center gap-1 rounded-md2 bg-ink px-3 text-sm font-bold text-chalk dark:bg-chalk dark:text-ink">
            <Undo2 size={16} strokeWidth={2} /> Undo
          </button>
          <button onClick={() => setUndo(null)} aria-label="Dismiss" className="min-h-[44px] px-2 text-sm text-neutral-500">✕</button>
        </div>
      )}

      <ResourceForm
        open={formOpen}
        title={editing ? `Edit ${def.labelAr}` : `New ${def.labelAr}`}
        fields={def.fields} initial={editing ?? onNew?.() ?? {}}
        options={Object.fromEntries(def.fields.filter(f => f.optionsFrom).map(f => [f.key, options[f.optionsFrom as string] ?? []]))}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={save}
      />

      <ConfirmDialog
        open={!!confirm}
        title={`Delete ${confirm?.length ?? 0} item(s)?`}
        impact={impactFor && confirm ? impactFor(confirm) : "Items move to Trash and can be restored within the retention period."}
        requireName={confirm && confirm.length >= 5 ? String(confirm.length) : null}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && doDelete(confirm)}
      />

      {detailRow && (
        <div className="fixed inset-y-0 end-0 z-40 w-full max-w-md overflow-auto border-s-2 border-ink/15 bg-paper p-5 shadow-2xl dark:border-white/20 dark:bg-inksurface" role="dialog" aria-modal="true">
          {detail ? detail(detailRow, () => setDetailRow(null)) : (
            <>
              <pre className="tnum whitespace-pre-wrap text-sm" dir="auto">{JSON.stringify(detailRow, null, 2)}</pre>
              <Button variant="outline" className="mt-4 w-full" onClick={() => setDetailRow(null)}>Close</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
