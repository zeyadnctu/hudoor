"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { browserSupabase } from "@/lib/supabase";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default function ProfSchedulePage() {
  const { t } = useApp();
  const [slots, setSlots] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: cp } = await sb.from("course_professors").select("course_id").eq("professor_id", user.id);
      const cids = ((cp ?? []) as any[]).map(x => x.course_id);
      if (!cids.length) return;
      const { data: sl } = await sb.from("timetable_slots").select("*,courses(code)").in("course_id", cids).is("deleted_at", null).order("day").order("starts_at");
      setSlots((sl ?? []) as any[]);
      const { data: se } = await sb.from("attendance_sessions").select("id,status,starts_at,course_id,courses(code)").eq("professor_id", user.id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(20);
      setSessions((se ?? []) as any[]);
    })();
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-6">
      <h1 className="font-display text-3xl font-bold">{t.mySchedule}</h1>
      <h2 className="font-display mt-4 text-xl font-bold">{t.upcoming}</h2>
      <div className="mt-2 divide-y divide-black/10 rounded-md2 border border-black/10 dark:divide-white/10 dark:border-white/15">
        {sessions.length === 0 && <p className="p-4 text-neutral-500">—</p>}
        {sessions.map(s => (
          <Link key={s.id} href={`/professor/session/${s.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[15px] hover:bg-black/[0.03] dark:hover:bg-white/5">
            <span className="tnum font-semibold">{s.courses?.code} · {new Date(s.starts_at).toLocaleString()}</span>
            <span className="text-sm text-neutral-500">{s.status}</span>
          </Link>
        ))}
      </div>
      <h2 className="font-display mt-6 text-xl font-bold">{t.timetable}</h2>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {DAYS.map((d, di) => (
          <div key={d} className="rounded-md2 border border-black/10 p-2 dark:border-white/15">
            <p className="font-display px-1 py-1 text-sm font-bold">{(t as any)[d]}</p>
            {slots.filter(s => s.day === di).map(s => (
              <p key={s.id} className="tnum px-1 py-1 text-sm" dir="auto">
                {s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)} · <b>{s.courses?.code}</b> · {s.section}
              </p>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
