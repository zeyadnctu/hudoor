"use client";
import { useState } from "react";
import { DataTable as Shell, THead, Th, Td } from "@/components/ui";
import { ArrowUpDown, Columns3Cog, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  editable?: boolean; // double-click to edit (text)
  hideable?: boolean;
  className?: string;
};

/** Generic table: sorting, column show/hide, bulk selection with sticky
 *  action bar, double-click inline editing, server-side pagination. */
export function ConsoleTable<T extends { id: string }>({
  rows, columns, total, page, perPage, sort, order,
  onPage, onSort, selected, onSelect,
  bulkActions, onInlineSave, rowActions, empty
}: {
  rows: T[];
  columns: Column<T>[];
  total: number;
  page: number; perPage: number;
  sort: string; order: "asc" | "desc";
  onPage: (p: number) => void;
  onSort: (key: string) => void;
  selected: string[];
  onSelect: (ids: string[]) => void;
  bulkActions?: React.ReactNode;
  onInlineSave?: (row: T, key: string, value: string) => Promise<void>;
  rowActions?: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [showCols, setShowCols] = useState(false);
  const [editing, setEditing] = useState<{ id: string; key: string; value: string } | null>(null);
  const visible = columns.filter(c => !hidden.includes(c.key));
  const pages = Math.max(1, Math.ceil(total / perPage));
  const all = rows.length > 0 && rows.every(r => selected.includes(r.id));

  function toggleAll() {
    onSelect(all ? selected.filter(id => !rows.some(r => r.id === id)) : [...new Set([...selected, ...rows.map(r => r.id)])]);
  }
  async function commitInline(row: T) {
    if (!editing || !onInlineSave) { setEditing(null); return; }
    await onInlineSave(row, editing.key, editing.value);
    setEditing(null);
  }

  const val = (row: T, key: string) => (row as any)[key];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="tnum text-sm text-neutral-500">
          {total} rows · page {page}/{pages}
        </p>
        <div className="relative">
          <button
            onClick={() => setShowCols(s => !s)} aria-expanded={showCols}
            className="flex min-h-[44px] items-center gap-1.5 rounded-md2 border border-black/15 px-3 text-sm font-semibold dark:border-white/20"
          >
            <Columns3Cog size={17} strokeWidth={2} /> Columns
          </button>
          {showCols && (
            <div className="absolute end-0 z-30 mt-1 w-52 rounded-md2 border border-black/10 bg-paper p-2 shadow-xl dark:border-white/15 dark:bg-inksurface">
              {columns.filter(c => c.hideable !== false).map(c => (
                <label key={c.key} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded px-2 hover:bg-black/5 dark:hover:bg-white/10">
                  <input
                    type="checkbox" className="h-5 w-5 accent-[#2F5D8A]"
                    checked={!hidden.includes(c.key)}
                    onChange={() => setHidden(h => h.includes(c.key) ? h.filter(x => x !== c.key) : [...h, c.key])}
                  />
                  <span className="text-sm font-medium">{c.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <Shell>
        <THead>
          <Th className="w-10">
            <input type="checkbox" aria-label="Select all" className="h-5 w-5 accent-[#2F5D8A]" checked={all} onChange={toggleAll} />
          </Th>
          {visible.map(c => (
            <Th key={c.key} className={c.className}>
              {c.sortable ? (
                <button onClick={() => onSort(c.key)} className="flex items-center gap-1 font-display text-sm font-semibold hover:text-register">
                  {c.label}
                  <ArrowUpDown size={14} strokeWidth={2} className={cn(sort === c.key && "text-register")} />
                  {sort === c.key && <span className="tnum text-xs">{order === "asc" ? "▲" : "▼"}</span>}
                </button>
              ) : c.label}
            </Th>
          ))}
          {rowActions && <Th><span className="sr-only">actions</span></Th>}
        </THead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className={cn("border-b border-black/10 last:border-0 dark:border-white/10", selected.includes(row.id) && "bg-register-light/50 dark:bg-register/15")}>
              <Td>
                <input
                  type="checkbox" aria-label="Select row" className="h-5 w-5 accent-[#2F5D8A]"
                  checked={selected.includes(row.id)}
                  onChange={() => onSelect(selected.includes(row.id) ? selected.filter(i => i !== row.id) : [...selected, row.id])}
                />
              </Td>
              {visible.map(c => (
                <td
                  key={c.key}
                  className={cn("border-t border-black/10 px-4 py-3 align-top dark:border-white/10", c.className)}
                  onDoubleClick={() => c.editable && onInlineSave && setEditing({ id: row.id, key: c.key, value: String(val(row, c.key) ?? "") })}
                  title={c.editable ? "Double-click to edit" : undefined}
                >
                  {editing?.id === row.id && editing.key === c.key ? (
                    <span className="flex items-center gap-1">
                      <input
                        autoFocus value={editing.value} dir="auto"
                        onChange={e => setEditing({ ...editing, value: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter") commitInline(row);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="min-h-[40px] w-full min-w-[120px] rounded border-2 border-register bg-paper px-2 outline-none dark:bg-white/5"
                      />
                      <button onClick={() => commitInline(row)} aria-label="Save" className="grid h-10 w-10 shrink-0 place-items-center rounded text-stamp-dark hover:bg-black/5"><Check size={17} strokeWidth={2.5} /></button>
                      <button onClick={() => setEditing(null)} aria-label="Cancel" className="grid h-10 w-10 shrink-0 place-items-center rounded hover:bg-black/5"><X size={17} strokeWidth={2} /></button>
                    </span>
                  ) : c.render ? c.render(row) : <span dir="auto">{String(val(row, c.key) ?? "—")}</span>}
                </td>
              ))}
              {rowActions && <Td className="whitespace-nowrap text-end">{rowActions(row)}</Td>}
            </tr>
          ))}
        </tbody>
      </Shell>
      {rows.length === 0 && (empty ?? <p className="p-6 text-center text-neutral-500">No rows. Create the first one above.</p>)}

      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="min-h-[44px] rounded-md2 border border-black/15 px-4 text-sm font-semibold disabled:opacity-40 dark:border-white/20">‹ Prev</button>
          <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="min-h-[44px] rounded-md2 border border-black/15 px-4 text-sm font-semibold disabled:opacity-40 dark:border-white/20">Next ›</button>
        </div>
        {selected.length > 0 && (
          <div className="sticky bottom-4 flex items-center gap-2 rounded-md2 border-2 border-ink/20 bg-paper px-3 py-2 shadow-xl dark:border-white/25 dark:bg-inksurface" role="toolbar" aria-label="Bulk actions">
            <span className="tnum text-sm font-bold">{selected.length} selected</span>
            {bulkActions}
            <button onClick={() => onSelect([])} className="min-h-[44px] px-2 text-sm font-semibold text-neutral-500">Clear</button>
          </div>
        )}
      </div>
    </div>
  );
}
