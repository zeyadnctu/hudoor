"use client";
import { Input, Select, Label } from "@/components/ui";
import { RotateCcw } from "lucide-react";

export type SettingSpec = {
  key: string;
  label: string; labelAr?: string;
  type: "number" | "text" | "boolean" | "select";
  options?: { value: string; label: string }[];
  min?: number; max?: number;
  hint?: string;
};

/** Schema-driven setting input with scope badge + reset-to-inherited. */
export function SettingsField({
  spec, value, inherited, scopeLabel, onChange, onReset
}: {
  spec: SettingSpec;
  value: any;
  inherited: { value: any; from: string } | null;
  scopeLabel: string;
  onChange: (v: any) => void;
  onReset: () => void;
}) {
  const overridden = value !== undefined && value !== null && value !== "";
  return (
    <div className="border-b border-black/10 py-3 last:border-0 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <Label>{spec.labelAr ?? spec.label}</Label>
        <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
          {overridden ? scopeLabel : `inherited · ${inherited?.from ?? "default"}`}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex-1">
          {spec.type === "boolean" ? (
            <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
              <input
                type="checkbox" className="h-6 w-6 accent-[#2F5D8A]"
                checked={value === true || value === "true"}
                onChange={e => onChange(e.target.checked)}
              />
              <span className="font-medium">{value ? "On" : "Off"}</span>
            </label>
          ) : spec.type === "select" ? (
            <Select value={String(value ?? "")} onChange={e => onChange(e.target.value)}>
              <option value="">—</option>
              {(spec.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : (
            <Input
              type={spec.type === "number" ? "number" : "text"}
              min={spec.min} max={spec.max}
              value={value ?? ""} onChange={e => onChange(spec.type === "number" ? Number(e.target.value) : e.target.value)}
              dir="auto"
            />
          )}
        </div>
        {overridden && (
          <button
            onClick={onReset} title="Reset to inherited"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-md2 border border-black/15 hover:border-register hover:text-register dark:border-white/20"
          >
            <RotateCcw size={18} strokeWidth={2} />
          </button>
        )}
      </div>
      {spec.hint && <p className="mt-1 text-sm text-neutral-500">{spec.hint}</p>}
      {inherited && !overridden && (
        <p className="tnum mt-1 text-sm text-neutral-500">Current value: <bdi className="font-semibold">{String(inherited.value)}</bdi></p>
      )}
    </div>
  );
}
