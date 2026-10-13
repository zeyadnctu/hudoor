"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Button, StatNumber } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase";
import { Radio, Plus, UserPlus, BookPlus, Megaphone, Flag } from "lucide-react";

export default function AdminDashboard() {
  const { t } = useApp();
  const [d, setD] = useState<any>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});

  async function load() {
    const r = await fetch("/api/console/dashboard");
    if (!r.ok) return;
    const j = await r.json();
    setD(j);
    const cids = [...new Set([...(j.live ?? []).map((s: any) => s.course_id), ...(j.low ?? []).map((l: any) => l.course_id)])];
    if (cids.length) {
      const sb = browserSupabase();
      const { data } = await sb.from("courses").select("id,code").in("id", cids);
      const m: Record<string, string> = {};
      for (const c of (data ?? []) as any[]) m[c.id] = c.code;
      setCodes(m);
    }
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    const sb = browserSupabase();
    const ch = sb.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_sessions" }, () => load())
      .subscribe();
    return () => { clearInterval(id); sb.removeChannel(ch); };
  }, []);

  if (!d) return <p className="p-6 text-neutral-500">Loading…</p>;

  const queues = [
    { n: d.queues.profiles, href: "/admin/requests", label: t.approvals },
    { n: d.queues.excuses, href: "/admin/requests", label: t.excuses },
    { n: d.queues.disputes, href: "/admin/attendance", label: t.disputes },
    { n: d.queues.service, href: "/admin/requests", label: t.requests },
    { n: d.queues.flags, href: "/admin/flagged", label: t.flagged }
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.dashboard}</h1>
          <p className="text-neutral-500">{t.overview}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/users"><Button variant="outline"><UserPlus size={18} strokeWidth={2} /> {t.newUser}</Button></Link>
          <Link href="/admin/courses"><Button variant="outline"><BookPlus size={18} strokeWidth={2} /> {t.newCourse}</Button></Link>
          <Link href="/admin/notifications"><Button variant="outline"><Megaphone size={18} strokeWidth={2} /> {t.sendNotice}</Button></Link>
        </div>
      </div>

      <section className="mt-5 grid grid-cols-2 gap-6 border-y-2 border-ink/15 py-5 sm:grid-cols-4 dark:border-white/20" aria-label="stats">
        <StatNumber value={d.live.length} label={t.liveNow} />
        <StatNumber value={`${d.today.rate}%`} label={t.todayRate} sub={`${d.today.present}/${d.today.expected}`} />
        <StatNumber value={d.low.length} label={t.lowAtt} sub={`< ${d.minPct}%`} />
        <StatNumber value={d.queues.flags} label={t.flagged} />
      </section>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <section aria-label={t.liveNow}>
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute h-full w-full animate-ping rounded-full bg-stamp" /><span className="h-2.5 w-2.5 rounded-full bg-stamp" /></span>
            {t.liveNow}
          </h2>
          <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
            {d.live.length === 0 && <p className="p-4 text-neutral-500">—</p>}
            {d.live.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div>
                  <span className="tnum font-display font-semibold">{codes[s.course_id] ?? s.course_id.slice(0, 8)}</span>
                  <span className="ms-2 text-sm text-neutral-500">{s.courses?.name_ar}</span>
                </div>
                <Link href={`/professor/session/${s.id}`} className="flex min-h-[44px] items-center gap-1 rounded-md2 bg-stamp-light px-3 text-sm font-bold text-stamp-dark dark:bg-stamp/20 dark:text-emerald-300">
                  <Radio size={16} strokeWidth={2} /> {t.liveNow}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section aria-label={t.lowAtt}>
          <h2 className="font-display text-xl font-bold">{t.lowAtt} (&lt; {d.minPct}%)</h2>
          <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
            {d.low.length === 0 && <p className="p-4 text-neutral-500">—</p>}
            {d.low.slice(0, 8).map((l: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-[15px]">
                <span className="font-medium">{l.name} <span className="tnum text-sm text-neutral-500">{l.university_id} · {codes[l.course_id] ?? ""}</span></span>
                <span className="tnum font-display text-lg font-bold text-hi-dark dark:text-amber-300">{l.pct}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6" aria-label={t.pendingDecisions}>
        <h2 className="font-display text-xl font-bold">{t.pendingDecisions}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {queues.map(q => (
            <Link key={q.label} href={q.href} className="rounded-md2 border border-black/10 px-4 py-3 transition-colors hover:border-register dark:border-white/15">
              <div className="tnum font-display text-3xl font-bold">{q.n}</div>
              <div className="text-sm font-medium text-neutral-500">{q.label}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-label={t.flagged}>
        <h2 className="font-display flex items-center gap-2 text-xl font-bold"><Flag size={20} strokeWidth={2} /> {t.flagged}</h2>
        <div className="mt-3 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
          {d.flags.length === 0 && <p className="p-4 text-neutral-500">—</p>}
          {d.flags.map((f: any) => (
            <div key={f.id} className="flex justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="rounded-full bg-brick-light px-2.5 py-0.5 text-xs font-bold text-brick-dark dark:bg-brick/20 dark:text-red-300">{f.reason}</span>
              <span className="tnum shrink-0 text-neutral-500">{new Date(f.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <Link href="/admin/flagged" className="mt-2 inline-block font-semibold text-register hover:underline">{t.flagged}</Link>
      </section>

      <div className="mt-6 flex items-center gap-2">
        <Plus size={18} strokeWidth={2} />
        <Link href="/admin/attendance" className="font-semibold text-register hover:underline">{t.explorer}</Link>
      </div>
    </div>
  );
}
