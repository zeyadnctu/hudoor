"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button, Select, EmptyState } from "@/components/ui";
import { ChevronRight, ChevronLeft, Clock, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Slot = {
  id: string;
  day: number;
  starts_at: string;
  ends_at: string;
  session_type: string | null;
  courses?: { code: string; name_ar: string; name_en: string } | null;
  rooms?: { name_ar: string; name_en: string } | null;
  instructor_name?: string | null;
  instructor_id?: string | null;
  professor_id?: string | null;
};

export default function StudentTimetable() {
  const { t, locale } = useApp();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [sem, setSem] = useState("");
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<any>(null);
  const days = [6, 0, 1, 2, 3, 4, 5];

  useEffect(() => {
    (async () => {
      const sb = browserSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;

      const [semRes, detRes] = await Promise.all([
        sb.from("semesters").select("id,name,starts_at,ends_at,is_current").order("starts_at", { ascending: false }).limit(10),
        sb.from("student_details").select("program_id,level_id,section_id").eq("user_id", user.id).maybeSingle(),
      ]);

      const sems = semRes.data ?? [];
      setSemesters(sems);
      const cur = sems.find((s: any) => s.is_current) ?? sems[0];
      if (cur) setSem(cur.id);

      if (detRes.data?.program_id) {
        const { data: prog } = await sb.from("programs").select("id,code,name_ar,name_en,color").eq("id", detRes.data.program_id).maybeSingle();
        setProgram(prog);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!sem) return;
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/student/timetable?semester_id=${sem}`).then(x => x.json()).catch(() => ({ rows: [] }));
      setSlots(r.rows ?? []);
      setLoading(false);
    })();
  }, [sem]);

  const byDay = (d: number) => slots.filter(s => s.day === d);
  const timeOf = (iso: string) => {
    const m = String(iso).match(/(\d{2}:\d{2})/);
    return m ? m[1] : iso;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.weeklyTimetable}</h1>
          {program && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ backgroundColor: (program.color ?? "#7C3AED") + "22", color: program.color ?? "#7C3AED" }}>
              {locale === "ar" ? program.name_ar : program.name_en} · {program.code}
            </span>
          )}
        </div>
        {semesters.length > 1 && (
          <div className="w-56">
            <Select value={sem} onChange={e => setSem(e.target.value)}>
              {semesters.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.is_current ? " ●" : ""}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-6 animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-md2 bg-black/5 dark:bg-white/5" />)}
        </div>
      ) : slots.length === 0 ? (
        <EmptyState icon={<Clock size={28} className="text-neutral-400" />} title={locale === "ar" ? "لا توجد حصص مجدولة بعد" : "No sessions scheduled yet"} hint={locale === "ar" ? "سيظهر جدولك هنا عندما يتم تسجيل الحصص" : "Your schedule will appear here once sessions are enrolled"} />
      ) : (
        <div className="mt-4 space-y-3">
          {days.map(d => {
            const daySlots = byDay(d);
            if (!daySlots.length) return null;
            return (
              <div key={d}>
                <h2 className="mb-1.5 font-display text-sm font-bold text-neutral-500">
                  {locale === "ar" ? DAY_NAMES_AR[d] : DAY_NAMES_EN[d]}
                  <span className="tnum ms-2 text-xs">({daySlots.length})</span>
                </h2>
                <div className="space-y-1.5">
                  {daySlots
                    .sort((a, b) => timeOf(a.starts_at).localeCompare(timeOf(b.starts_at)))
                    .map(s => {
                      const isNTG = program?.code === "NTG";
                      return (
                        <div key={s.id}
                          className={cn(
                            "flex items-center gap-3 rounded-md2 border p-3",
                            isNTG
                              ? "border-purple-200 bg-purple-50/60 dark:border-purple-800/50 dark:bg-purple-950/20"
                              : "border-black/10 dark:border-white/15"
                          )}>
                          <div className="tnum flex shrink-0 items-center gap-1 text-sm font-bold text-register">
                            <Clock size={14} strokeWidth={2} />
                            {timeOf(s.starts_at)}–{timeOf(s.ends_at)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold" dir="auto">
                              {s.courses?.code && <span className="tnum text-register">{s.courses.code} · </span>}
                              {locale === "ar" ? s.courses?.name_ar : s.courses?.name_en}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                              {s.instructor_name && (
                                <span className="flex items-center gap-1"><User size={12} /> {s.instructor_name}</span>
                              )}
                              {s.rooms && (
                                <span className="flex items-center gap-1"><MapPin size={12} /> {locale === "ar" ? s.rooms.name_ar : s.rooms.name_en}</span>
                              )}
                              {s.session_type && (
                                <span className="rounded-full bg-black/5 px-2 py-0.5 font-semibold dark:bg-white/10">
                                  {s.session_type === "lecture" ? (locale === "ar" ? "محاضرة" : "Lecture") : s.session_type === "section" ? (locale === "ar" ? "مجموعة" : "Section") : s.session_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Link href="/student">
          <Button variant="outline">
            <ChevronRight size={16} /> {locale === "ar" ? "رجوع" : "Back"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
