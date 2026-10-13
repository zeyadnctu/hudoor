"use client";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button, Input, Select, Label, FieldError } from "@/components/ui";
import { X, Save } from "lucide-react";
import type { FieldDef } from "@/lib/resources";

/** Schema-driven create/edit modal.
 *  Esc asks when dirty, Cmd/Ctrl+Enter saves, zod inline errors. */
export function ResourceForm({
  open, title, fields, initial, options, onClose, onSave, busy
}: {
  open: boolean;
  title: string;
  fields: FieldDef[];
  initial: Record<string, any>;
  options: Record<string, { value: string; label: string }[]>;
  onClose: () => void;
  onSave: (values: Record<string, any>) => Promise<void>;
  busy?: boolean;
}) {
  const schema = useMemo(() => {
    const shape: Record<string, any> = {};
    for (const f of fields) {
      if (f.readOnly && initial[f.key] !== undefined) continue;
      let s: any =
        f.type === "number" ? z.coerce.number()
        : f.type === "boolean" ? z.coerce.boolean()
        : f.type === "multiselect" ? z.array(z.string()).default([])
        : z.string();
      if (f.type === "uuid" && f.required) s = z.string().uuid();
      else if (f.required && f.type !== "boolean" && f.type !== "number" && f.type !== "multiselect")
        s = (s as any).min(1);
      else if (!f.required) s = (s as any).optional().nullable();
      shape[f.key] = s;
    }
    return z.object(shape);
  }, [fields, initial]);

  const [values, setValues] = useState<Record<string, any>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => {
    if (open) { setValues(initial); setErrors({}); setDirty(false); setConfirmClose(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  if (!open) return null;
  const set = (k: string, v: any) => { setValues(s => ({ ...s, [k]: v })); setDirty(true); };
  function askClose() {
    if (dirty && !confirmClose) { setConfirmClose(true); return; }
    onClose();
  }
  async function save() {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0])] = i.message;
      setErrors(e);
      return;
    }
    setErrors({});
    await onSave(parsed.data);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={askClose}>
      <div
        className="w-full max-w-lg rounded-lg2 border border-black/10 bg-paper p-5 dark:border-white/15 dark:bg-inksurface"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === "Escape") askClose();
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={askClose} aria-label="Close" className="grid min-h-[44px] min-w-[44px] place-items-center rounded-md2 hover:bg-black/5 dark:hover:bg-white/10">
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        {confirmClose && (
          <p className="mt-2 rounded-md2 bg-hi-light px-3 py-2 text-sm font-medium text-hi-dark dark:bg-hi/15 dark:text-amber-200">
            Unsaved changes. Press close again to discard.
          </p>
        )}
        <div className="mt-3 grid gap-3">
          {fields.map(f => {
            if (f.readOnly && initial[f.key] !== undefined)
              return <p key={f.key} className="text-sm text-neutral-500">{f.label}: <bdi className="tnum font-semibold text-ink dark:text-neutral-100">{String(initial[f.key])}</bdi></p>;
            const opts = f.options ?? options[f.key] ?? [];
            return (
              <div key={f.key}>
                <Label>{f.label}{f.required ? " *" : ""}</Label>
                {f.type === "textarea" ? (
                  <textarea value={values[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} rows={3} dir="auto"
                    className="min-h-[48px] w-full rounded-md2 border-2 border-black/15 bg-paper px-4 py-2 outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
                ) : f.type === "select" ? (
                  <Select value={values[f.key] ?? ""} onChange={e => set(f.key, e.target.value)}>
                    <option value="">—</option>
                    {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                ) : f.type === "boolean" ? (
                  <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
                    <input type="checkbox" className="h-6 w-6 accent-[#2F5D8A]" checked={!!values[f.key]} onChange={e => set(f.key, e.target.checked)} />
                    <span className="font-medium">{f.label}</span>
                  </label>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "datetime" ? "datetime-local" : "text"}
                    value={values[f.key] ?? ""} onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder} dir="auto"
                  />
                )}
                <FieldError msg={errors[f.key]} />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={askClose}>Cancel</Button>
          <Button className="flex-[2]" disabled={busy} onClick={save}>
            <Save size={18} strokeWidth={2} /> Save
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Esc closes · Ctrl/⌘+Enter saves</p>
      </div>
    </div>
  );
}
