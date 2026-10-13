"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { X, TriangleAlert } from "lucide-react";

/** ConfirmDialog: destructive actions state exactly what is affected.
 *  High-impact deletes require typing the item name. Esc closes. */
export function ConfirmDialog({
  open, title, impact, requireName, confirmLabel, onCancel, onConfirm, busy
}: {
  open: boolean;
  title: string;
  impact: string;
  requireName?: string | null;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const [typed, setTyped] = useState("");
  if (!open) return null;
  const needType = !!requireName;
  const ok = !needType || typed.trim() === requireName;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4"
      role="alertdialog" aria-modal="true" aria-label={title}
      onClick={onCancel}
      onKeyDown={e => { if (e.key === "Escape") onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-lg2 border-2 border-brick/50 bg-paper p-5 dark:bg-inksurface"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md2 bg-brick-light text-brick-dark dark:bg-brick/20 dark:text-red-300">
            <TriangleAlert size={22} strokeWidth={2} />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">{title}</h2>
            <p className="mt-1 text-[15px] text-neutral-600 dark:text-neutral-300">{impact}</p>
          </div>
        </div>
        {needType && (
          <div className="mt-3">
            <label className="mb-1 block text-sm font-semibold">
              Type <bdi className="tnum rounded bg-black/10 px-1.5 py-0.5 dark:bg-white/15">{requireName}</bdi> to confirm
            </label>
            <input
              value={typed} onChange={e => setTyped(e.target.value)} dir="auto"
              className="min-h-[48px] w-full rounded-md2 border-2 border-black/15 bg-paper px-4 outline-none focus:border-brick dark:border-white/20 dark:bg-white/5"
            />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            <X size={18} strokeWidth={2} /> Cancel
          </Button>
          <Button variant="brick" className="flex-[2]" disabled={!ok || busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
