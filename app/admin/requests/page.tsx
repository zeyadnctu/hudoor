"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, StatusPill } from "@/components/ui";

type Item = any;

function DecideButtons({ onDecide }: { onDecide: (d: string) => void }) {
  const { t } = useApp();
  return (
    <div className="mt-2 flex gap-2">
      <Button variant="stamp" className="!min-h-[44px]" onClick={() => onDecide("approved")}>{t.approveIt}</Button>
      <Button variant="brick" className="!min-h-[44px]" onClick={() => onDecide("denied")}>{t.denyIt}</Button>
    </div>
  );
}

export default function RequestsPage() {
  const { t } = useApp();
  const [tab, setTab] = useState<"service" | "excuses" | "professors">("service");
  const [service, setService] = useState<Item[]>([]);
  const [excuses, setExcuses] = useState<Item[]>([]);
  const [profs, setProfs] = useState<Item[]>([]);

  async function load() {
    const [s, e, p] = await Promise.all([
      fetch("/api/console/service").then(r => r.json()).catch(() => ({ rows: [] })),
      fetch("/api/console/excuses").then(r => r.json()).catch(() => ({ rows: [] })),
      fetch("/api/console/users-manage?role=professor&status=pending&perPage=100").then(r => r.json()).catch(() => ({ rows: [] }))
    ]);
    setService(s.rows ?? []);
    setExcuses(e.rows ?? []);
    setProfs(p.rows ?? []);
  }
  useEffect(() => { load(); }, []);

  async function decide(kind: string, id: string, decision: string) {
    const comment = prompt(t.comment + ":") ?? "";
    const r = await fetch("/api/console/decisions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, decision, comment })
    });
    if (r.ok) load();
  }
  async function decideProfile(id: string, status: string) {
    const r = await fetch("/api/console/users-manage", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    });
    if (r.ok) load();
  }

  const pill = (s: string) => <StatusPill status={s === "pending" ? "late" : s === "approved" ? "present" : "absent"} />;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.requests}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {([["service", t.requests], ["excuses", t.excuses], ["professors", t.professor]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`min-h-[48px] rounded-md2 px-4 font-bold ${tab === k ? "bg-ink text-chalk dark:bg-chalk dark:text-ink" : "border border-black/15 dark:border-white/20"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "service" && (
        <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {service.length === 0 && <p className="p-4 text-neutral-500">—</p>}
          {service.map((s: any) => (
            <div key={s.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium" dir="auto">{s.type} · <span className="tnum text-sm text-neutral-500">{s.student_id?.slice(0, 8)}</span></p>
                {pill(s.status)}
              </div>
              {s.status === "pending" && <DecideButtons onDecide={d => decide("service", s.id, d)} />}
              {s.comment && <p className="mt-1 text-sm text-neutral-500" dir="auto">{s.comment}</p>}
            </div>
          ))}
        </div>
      )}
      {tab === "excuses" && (
        <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {excuses.length === 0 && <p className="p-4 text-neutral-500">—</p>}
          {excuses.map((e: any) => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium" dir="auto">{e.reason}</p>
                {pill(e.status)}
              </div>
              <p className="tnum text-sm text-neutral-500" dir="auto">{e.courses?.code ?? ""} · {new Date(e.created_at).toLocaleString()}</p>
              {e.status === "pending" && <DecideButtons onDecide={d => decide("excuse", e.id, d)} />}
              {e.comment && <p className="mt-1 text-sm text-neutral-500" dir="auto">{e.comment}</p>}
            </div>
          ))}
        </div>
      )}
      {tab === "professors" && (
        <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {profs.length === 0 && <p className="p-4 text-neutral-500">—</p>}
          {profs.map((p: any) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="font-medium" dir="ltr">{p.email}</p>
              <div className="flex gap-2">
                <Button variant="stamp" className="!min-h-[44px]" onClick={() => decideProfile(p.id, "approved")}>{t.approveIt}</Button>
                <Button variant="brick" className="!min-h-[44px]" onClick={() => decideProfile(p.id, "rejected")}>{t.denyIt}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
