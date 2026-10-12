import * as React from "react";
import { cn } from "@/lib/utils";

/* Primary action = Register Blue. Meaning colors only: stamp / brick / ghost. */

type BtnVariant = "primary" | "stamp" | "brick" | "outline" | "ghost";

export function Button({
  variant = "primary", className, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-register text-white hover:bg-register-dark",
    stamp: "bg-stamp text-white hover:bg-stamp-dark",
    brick: "bg-brick text-white hover:bg-brick-dark",
    outline: "border-2 border-register text-register hover:bg-register-light dark:hover:bg-white/10",
    ghost: "text-register hover:bg-register-light dark:hover:bg-white/10"
  };
  return (
    <button
      {...p}
      className={cn(
        "min-h-[48px] rounded-md2 px-5 font-body text-base font-semibold",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className
      )}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(p, ref) {
  return (
    <input
      ref={ref}
      {...p}
      className="min-h-[48px] w-full rounded-md2 border-2 border-black/15 bg-paper px-4 text-base outline-none transition-colors placeholder:text-neutral-400 focus:border-register dark:border-white/20 dark:bg-white/5 dark:placeholder:text-neutral-500"
    />
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(p, ref) {
  return (
    <select
      ref={ref}
      {...p}
      className="min-h-[48px] w-full rounded-md2 border-2 border-black/15 bg-paper px-4 text-base outline-none focus:border-register dark:border-white/20 dark:bg-white/5"
    />
  );
});

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-neutral-600 dark:text-neutral-300">
      {children}
    </label>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-sm font-medium text-brick">{msg}</p>;
}

/* ===== status pill: color carries the meaning ===== */
const statusStyles: Record<string, string> = {
  present: "bg-stamp-light text-stamp-dark dark:bg-stamp/20 dark:text-emerald-300",
  late: "bg-hi-light text-hi-dark dark:bg-hi/20 dark:text-amber-300",
  absent: "bg-brick-light text-brick-dark dark:bg-brick/20 dark:text-red-300",
  excused: "bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-300",
  active: "bg-stamp-light text-stamp-dark dark:bg-stamp/20 dark:text-emerald-300",
  ended: "bg-black/10 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
  scheduled: "bg-hi-light text-hi-dark dark:bg-hi/20 dark:text-amber-300"
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-block rounded-full px-3 py-1 text-sm font-semibold", statusStyles[status] ?? statusStyles.ended)}>
      {status}
    </span>
  );
}

/* ===== big number: tabular, in place ===== */
export function StatNumber({ value, label, sub }: { value: React.ReactNode; label: string; sub?: string }) {
  return (
    <div>
      <div className="font-display tnum text-5xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-base font-medium text-neutral-600 dark:text-neutral-300">{label}</div>
      {sub && <div className="text-sm text-neutral-500">{sub}</div>}
    </div>
  );
}

/* ===== dense data table: sticky header, hairlines ===== */
export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-auto rounded-md2 border border-black/10 dark:border-white/15">
      <table className="w-full border-collapse bg-paper text-start text-[15px] dark:bg-inksurface">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 bg-chalk dark:bg-ink">
      <tr className="border-b-2 border-black/15 dark:border-white/20">{children}</tr>
    </thead>
  );
}
export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-start font-display text-sm font-semibold", className)}>{children}</th>;
}
export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("border-t border-black/10 px-4 py-3 align-top dark:border-white/10", className)}>{children}</td>;
}

/* ===== skeleton rows matching table layout ===== */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-black/10 dark:border-white/10">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="skeleton h-4 rounded bg-black/10 dark:bg-white/15" style={{ width: `${70 - ((r * 13 + c * 29) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ===== empty state: what to do next ===== */
export function EmptyState({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-black/5 text-neutral-500 dark:bg-white/10 dark:text-neutral-300">{icon}</div>
      <p className="mt-3 font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[15px] text-neutral-600 dark:text-neutral-300">{hint}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ===== the stamp: rotated bordered mark, pressed onto the page ===== */
export function Stamp({ top, bottom, tone = "stamp" }: { top: string; bottom: string; tone?: "stamp" | "brick" | "hi" }) {
  const tones = {
    stamp: "border-stamp text-stamp-dark dark:text-emerald-300",
    brick: "border-brick text-brick-dark dark:text-red-300",
    hi: "border-hi text-hi-dark dark:text-amber-300"
  };
  return (
    <div className="stamp-press inline-block" role="status">
      <div className={cn("rounded-frame border-4 px-8 py-4 text-center", tones[tone])}>
        <div className="font-display text-4xl font-bold leading-tight">{top}</div>
        <div className="tnum mt-1 font-display text-lg font-semibold tracking-wide">{bottom}</div>
      </div>
    </div>
  );
}

/* ===== QR frame whose border drains with the token TTL ===== */
export function QrFrame({ fraction, size = 320, children }: { fraction: number; size?: number; children: React.ReactNode }) {
  const w = size + 32;
  const per = 2 * (w + w);
  return (
    <div className="relative inline-block bg-paper p-4" style={{ width: w }}>
      <svg className="pointer-events-none absolute inset-0" width={w} height={w} aria-hidden="true">
        <rect x="3" y="3" width={w - 6} height={w - 6} fill="none" strokeWidth="6" className="stroke-black/10 dark:stroke-white/15" />
        <rect
          x="3" y="3" width={w - 6} height={w - 6} fill="none" strokeWidth="6"
          className="qr-drain stroke-register"
          strokeDasharray={per}
          strokeDashoffset={per * (1 - Math.max(0, Math.min(1, fraction)))}
          strokeLinecap="square"
        />
      </svg>
      {children}
    </div>
  );
}
