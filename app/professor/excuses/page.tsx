"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Select, Label, StatusPill } from "@/components/ui";

export default function ProfExcusesPage() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [course, setCourse] = useState("");
  const [excuses, setExcuses] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { browserSupabase } = await import("@/lib/supabase");
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: cp } = await sb.from("course_professors").select("course_id,courses(id,code)").eq("professor_id", user.id);
      const cs = ((cp ?? []) as any[]).map(x => x.courses);
      setCourses(cs);
      if (cs[0]) setCourse(cs[0].id);
    })();
  }, []);
  async function load(cid: string) {
    if (!cid) return;
    const [e, d] = await Promise.all([
      fetch(`/api/console/excuses?course_id=${cid}`).then(r => r.json()).catch(() => ({ rows: [] })),
      fetch(`/api/console/disputes?course_id=${cid}`).then(r => r.json()).catch(() => ({ rows: [] }))
    ]);
    setExcuses(e.rows ?? []);
    setDisputes(d.rows ?? []);
  }
  useEffect(() => { load(course); /* eslint-disable-next-line */ }, [course]);

  async function decide(kind: string, id: string, decision: string) {
    const comment = prompt(t.comment + ":") ?? "";
    const r = await fetch("/api/console/decisions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, decision, comment })
    });
    if (r.ok) load(course);
  }

  const pill = (s: string) => <StatusPill status={s === "pending" ? "late" : s === "approved" ? "present" : "absent"} />;
  const list = (items: any[], kind: string) => (
    <div className="divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
      {items.length === 0 && <p className="p-4 text-neutral-500">—</p>}
      {items.map((x: any) => (
        <div key={x.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium" dir="auto">{x.reason}</p>
            {pill(x.status)}
          </div>
          <p className="tnum text-sm text-neutral-500">{new Date(x.created_at).toLocaleString()}</p>
          {x.status === "pending" && (
            <div className="mt-2 flex gap-2">
              <Button variant="stamp" className="!min-h-[44px]" onClick={() => decide(kind, x.id, "approved")}>{t.approveIt}</Button>
              <Button variant="brick" className="!min-h-[44px]" onClick={() => decide(kind, x.id, "denied")}>{t.denyIt}</Button>
            </div>
          )}
          {x.comment && <p className="mt-1 text-sm text-neutral-500" dir="auto">{x.comment}</p>}
        </div>
      ))}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6">
      <h1 className="font-display text-3xl font-bold">{t.excuses} / {t.disputes}</h1>
      <div className="mt-3 max-w-sm"><Label>{t.course}</Label>
        <Select value={course} onChange={e => setCourse(e.target.value)}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
      </div>
      <h2 className="font-display mt-5 text-xl font-bold">{t.excuses} ({excuses.filter(e => e.status === "pending").length})</h2>
      <div className="mt-2">{list(excuses, "excuse")}</div>
      <h2 className="font-display mt-5 text-xl font-bold">{t.disputes} ({disputes.filter(d => d.status === "pending").length})</h2>
      <div className="mt-2">{list(disputes, "dispute")}</div>
    </main>
  );
}
