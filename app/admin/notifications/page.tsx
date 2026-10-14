"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Button, Input, Label } from "@/components/ui";
import { orderPrograms } from "@/lib/programs";

export default function NotificationsPage() {
  const { t } = useApp();
  const [courses, setCourses] = useState<any[]>([]);
  const [progs, setProgs] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [f, setF] = useState({
    title_ar: "", title_en: "", body_ar: "", body_en: "",
    roles: [] as string[], course_ids: [] as string[], program_ids: [] as string[], department_ids: [] as string[]
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [c, p, s] = await Promise.all([
        fetch("/api/console/courses?perPage=500").then(r => r.json()),
        fetch("/api/console/programs?perPage=500").then(r => r.json()),
        fetch("/api/console/notifications").then(r => r.json()).catch(() => ({ rows: [] }))
      ]);
      setCourses(c.rows ?? []); setProgs(orderPrograms(p.rows ?? [])); setSent(s.rows ?? []);
    })();
  }, []);

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter(x => x !== v) : [...list, v];
  }

  async function send() {
    setMsg("");
    if (!f.title_ar || !f.body_ar) { setMsg("Title + body (AR) required"); return; }
    const r = await fetch("/api/console/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title_ar: f.title_ar, title_en: f.title_en || f.title_ar,
        body_ar: f.body_ar, body_en: f.body_en || f.body_ar,
        audience: { roles: f.roles, course_ids: f.course_ids, program_ids: f.program_ids, department_ids: [], sections: [] }
      })
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    setMsg(`✓ ${t.createdOk}`);
    setF({ title_ar: "", title_en: "", body_ar: "", body_en: "", roles: [], course_ids: [], program_ids: [], department_ids: [] });
    const s = await fetch("/api/console/notifications").then(x => x.json()).catch(() => ({ rows: [] }));
    setSent(s.rows ?? []);
  }

  const chip = (on: boolean) =>
    `min-h-[44px] rounded-full border-2 px-3 text-sm font-semibold ${on ? "border-register bg-register-light text-register-dark dark:bg-register/25 dark:text-sky-200" : "border-black/15 dark:border-white/20"}`;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t.notifications}</h1>
      <div className="mt-3 rounded-md2 border border-black/10 p-4 dark:border-white/15">
        <h2 className="font-display text-xl font-bold">{t.sendTo}</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><Label>{t.announceTitle} (AR)</Label><Input value={f.title_ar} onChange={e => setF({ ...f, title_ar: e.target.value })} dir="auto" /></div>
          <div><Label>{t.announceTitle} (EN)</Label><Input value={f.title_en} onChange={e => setF({ ...f, title_en: e.target.value })} dir="auto" /></div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><Label>{t.announceBody} (AR)</Label>
            <textarea value={f.body_ar} onChange={e => setF({ ...f, body_ar: e.target.value })} rows={3} dir="auto"
              className="min-h-[72px] w-full rounded-md2 border-2 border-black/15 bg-paper px-3 py-2 outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
          </div>
          <div><Label>{t.announceBody} (EN)</Label>
            <textarea value={f.body_en} onChange={e => setF({ ...f, body_en: e.target.value })} rows={3} dir="auto"
              className="min-h-[72px] w-full rounded-md2 border-2 border-black/15 bg-paper px-3 py-2 outline-none focus:border-register dark:border-white/20 dark:bg-white/5" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div><p className="mb-1 text-sm font-semibold">{t.targetRoles} (empty = all)</p>
            <div className="flex flex-wrap gap-1.5">
              {["student", "professor"].map(r => (
                <button key={r} type="button" aria-pressed={f.roles.includes(r)} onClick={() => setF({ ...f, roles: toggle(f.roles, r) })} className={chip(f.roles.includes(r))}>{r}</button>
              ))}
            </div>
          </div>
          <div><p className="mb-1 text-sm font-semibold">{t.targetCourses}</p>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-auto">
              {courses.map(c => (
                <button key={c.id} type="button" aria-pressed={f.course_ids.includes(c.id)} onClick={() => setF({ ...f, course_ids: toggle(f.course_ids, c.id) })} className={chip(f.course_ids.includes(c.id))}>{c.code}</button>
              ))}
            </div>
          </div>
          <div><p className="mb-1 text-sm font-semibold">{t.programs}</p>
            <div className="flex flex-wrap gap-1.5">
              {progs.map(p => (
                <button key={p.id} type="button" aria-pressed={f.program_ids.includes(p.id)} onClick={() => setF({ ...f, program_ids: toggle(f.program_ids, p.id) })} className={chip(f.program_ids.includes(p.id))}>
                  <span className="me-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color || "#2F5D8A" }} />{p.code}
                </button>
              ))}
            </div>
          </div>
        </div>
        {msg && <p className="mt-2 text-sm font-semibold" role="status">{msg}</p>}
        <Button className="mt-3 w-full !min-h-[52px]" onClick={send}>{t.sendNotice}</Button>
      </div>

      <h2 className="font-display mt-6 text-xl font-bold">{t.history}</h2>
      <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
        {sent.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        {sent.map((a: any) => (
          <div key={a.id} className="px-4 py-3">
            <p className="font-bold" dir="auto">{a.title_ar}</p>
            <p className="text-sm text-neutral-500" dir="auto">{a.body_ar.slice(0, 140)}</p>
            <p className="tnum mt-1 text-xs text-neutral-400">{new Date(a.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
