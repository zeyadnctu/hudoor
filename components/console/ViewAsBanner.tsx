"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Eye } from "lucide-react";

/** Bannered, audit-logged view-as indicator. Mutating actions hide themselves
 *  when active (pages check /api/console/view-as or this component's event). */
export function ViewAsBanner() {
  const { t } = useApp();
  const [active, setActive] = useState<any>(null);
  useEffect(() => {
    fetch("/api/console/view-as").then(r => r.json()).then(j => {
      setActive(j.active ?? null);
      if (j.active) window.dispatchEvent(new CustomEvent("hudoor-viewas", { detail: j.active }));
    }).catch(() => {});
  }, []);
  if (!active) return null;
  async function stop() {
    await fetch("/api/console/view-as", { method: "DELETE" });
    location.href = "/admin";
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-hi px-4 py-2 text-sm font-bold text-ink" role="alert">
      <span className="flex items-center gap-2">
        <Eye size={17} strokeWidth={2} /> {t.viewAsBanner}: {active.email} ({active.role})
      </span>
      <button onClick={stop} className="min-h-[40px] rounded bg-ink px-3 font-bold text-chalk">{t.stopView}</button>
    </div>
  );
}

/** Hook: non-null while an admin previews this shell (hide mutating buttons). */
export function useViewAs() {
  const [active, setActive] = useState<any>(null);
  useEffect(() => {
    const load = () => fetch("/api/console/view-as").then(r => r.json()).then(j => setActive(j.active ?? null)).catch(() => {});
    load();
    const on = (e: any) => setActive(e.detail ?? null);
    window.addEventListener("hudoor-viewas", on);
    return () => window.removeEventListener("hudoor-viewas", on);
  }, []);
  return active;
}
