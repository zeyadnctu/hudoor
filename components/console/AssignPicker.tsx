"use client";
import { useMemo, useState } from "react";
import { Button, Input } from "@/components/ui";
import { Search, X, GripVertical, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssignItem = { value: string; label: string; hint?: string };

/** Searchable multi-select with chips + drag-and-drop between lists.
 *  Shows the effect (counts) before the parent saves. */
export function AssignPicker({
  available, assigned, onChange
}: {
  available: AssignItem[];
  assigned: AssignItem[];
  onChange: (next: AssignItem[]) => void;
}) {
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<AssignItem | null>(null);
  const assignedSet = useMemo(() => new Set(assigned.map(a => a.value)), [assigned]);
  const filtered = available.filter(a =>
    !assignedSet.has(a.value) &&
    (!q || `${a.label} ${a.hint ?? ""}`.toLowerCase().includes(q.toLowerCase()))
  );

  function dropToAssigned() {
    if (!drag || assignedSet.has(drag.value)) return;
    onChange([...assigned, drag]);
    setDrag(null);
  }
  function dropToAvailable() {
    if (!drag) return;
    onChange(assigned.filter(a => a.value !== drag.value));
    setDrag(null);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" aria-live="polite">
        {assigned.map(a => (
          <span key={a.value} className="flex items-center gap-1 rounded-full bg-register-light px-3 py-1.5 text-sm font-semibold text-register-dark dark:bg-register/25 dark:text-sky-200">
            {a.label}
            <button onClick={() => onChange(assigned.filter(x => x.value !== a.value))} aria-label={`Remove ${a.label}`} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/15">
              <X size={14} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {assigned.length === 0 && <span className="text-sm text-neutral-500">None assigned yet</span>}
      </div>
      <div className="relative mt-2">
        <Search size={18} strokeWidth={2} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <Input className="!ps-10" value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" />
      </div>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <div
          className="min-h-[160px] rounded-md2 border-2 border-dashed border-black/15 p-2 dark:border-white/20"
          onDragOver={e => e.preventDefault()} onDrop={dropToAvailable}
          aria-label="Available"
        >
          <p className="px-2 py-1 text-sm font-semibold text-neutral-500">Available ({filtered.length})</p>
          {filtered.slice(0, 60).map(a => (
            <div
              key={a.value} draggable
              onDragStart={() => setDrag(a)}
              className="flex cursor-grab items-center gap-2 rounded-md2 px-2 py-2 hover:bg-black/5 active:cursor-grabbing dark:hover:bg-white/10"
            >
              <GripVertical size={16} strokeWidth={2} className="shrink-0 text-neutral-400" />
              <span className="flex-1 text-[15px]">{a.label}{a.hint && <span className="block text-xs text-neutral-500">{a.hint}</span>}</span>
              <button
                onClick={() => onChange([...assigned, a])}
                aria-label={`Assign ${a.label}`}
                className="grid h-9 w-9 place-items-center rounded-md2 border border-black/15 hover:border-register hover:text-register dark:border-white/20"
              ><Check size={16} strokeWidth={2.5} /></button>
            </div>
          ))}
        </div>
        <div
          className="min-h-[160px] rounded-md2 border-2 border-dashed border-register/50 bg-register-light/40 p-2 dark:bg-register/10"
          onDragOver={e => e.preventDefault()} onDrop={dropToAssigned}
          aria-label="Assigned"
        >
          <p className="px-2 py-1 text-sm font-semibold text-register-dark dark:text-sky-200">
            Assigned ({assigned.length}) — drag here or press +
          </p>
          {assigned.map(a => (
            <div
              key={a.value} draggable onDragStart={() => setDrag(a)}
              className="flex cursor-grab items-center gap-2 rounded-md2 bg-paper px-2 py-2 dark:bg-white/5"
            >
              <GripVertical size={16} strokeWidth={2} className="shrink-0 text-neutral-400" />
              <span className="flex-1 text-[15px] font-medium">{a.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Compact inline multi-select (chips only) for use inside drawers. */
export function ChipSelect({ all, value, onChange }: { all: AssignItem[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map(a => {
        const on = value.includes(a.value);
        return (
          <button
            key={a.value} type="button" aria-pressed={on}
            onClick={() => onChange(on ? value.filter(v => v !== a.value) : [...value, a.value])}
            className={cn(
              "min-h-[40px] rounded-full border-2 px-3 text-sm font-semibold transition-colors",
              on ? "border-register bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200"
                 : "border-black/15 hover:border-register/60 dark:border-white/20"
            )}
          >{a.label}</button>
        );
      })}
    </div>
  );
}
