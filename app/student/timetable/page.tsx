"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui";
import { Clock, CalendarDays, List } from "lucide-react";
import { WeekGrid, WeekGridSkeleton, type WeekDay } from "@/components/hudoor/week-grid";
import { TimelineRow } from "@/components/hudoor/timeline-row";
import { SegmentedControl } from "@/components/hudoor/segmented-control";
import { EmptyState } from "@/components/hudoor/empty-state";

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
  const [view, setView] = useState<"weekly" | "list">("weekly");
  const dayOrder = [6, 0, 1, 2, 3, 4, 5]; // Saturday-first for the region

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

  const timeOf = (iso: string) => {
    const m = String(iso).match(/(\d{2}:\d{2})/);
    return m ? m[1] : iso;
  };

  const weekDays: WeekDay[] = useMemo(
    () =>
      dayOrder
        .map((d) => ({
          key: d,
          label: locale === "ar" ? DAY_NAMES_AR[d] : DAY_NAMES_EN[d],
          slots: slots
            .filter(s => s.day === d)
            .sort((a, b) => timeOf(a.starts_at).localeCompare(timeOf(b.starts_at)))
            .map(s => ({
              id: s.id,
              start: timeOf(s.starts_at),
              end: timeOf(s.ends_at),
              code: s.courses?.code,
              name: locale === "ar" ? (s.courses?.name_ar ?? "") : (s.courses?.name_en ?? ""),
              room: s.rooms ? (locale === "ar" ? s.rooms.name_ar : s.rooms.name_en) : undefined,
              instructor: s.instructor_name ?? undefined,
              type: s.session_type ?? undefined
            }))
        }))
        .filter(d => d.slots.length > 0),
    [slots, locale]
  );

  const flatList = useMemo(
    () =>
      weekDays.flatMap(d =>
        d.slots.map(s => ({ ...s, dayLabel: d.label }))
      ),
    [weekDays]
  );

  const todayIdx = new Date().getDay(); // 0=Sun; dayOrder maps 6 first

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.weeklyTimetable}</h1>
          {program && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {locale === "ar" ? program.name_ar : program.name_en} · {program.code}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {semesters.length > 1 && (
            <div className="w-44">
              <Select value={sem} onChange={e => setSem(e.target.value)}>
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.is_current ? " ●" : ""}</option>
                ))}
              </Select>
            </div>
          )}
          <SegmentedControl
            value={view}
            onValueChange={setView}
            ariaLabel={t.weeklyView}
            options={[
              { value: "weekly", label: t.weeklyView, icon: <CalendarDays size={14} /> },
              { value: "list", label: t.listView, icon: <List size={14} /> }
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-6"><WeekGridSkeleton /></div>
      ) : slots.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Clock size={28} />}
            title={locale === "ar" ? "لا توجد حصص مجدولة بعد" : "No sessions scheduled yet"}
            hint={locale === "ar" ? "سيظهر جدولك هنا عندما يتم تسجيل الحصص" : "Your schedule will appear here once sessions are enrolled"}
            withGrid
          />
        </div>
      ) : view === "weekly" ? (
        <div className="mt-4">
          <WeekGrid days={weekDays} todayKey={todayIdx} locale={locale} emptyHint={t.noSessionsToday} />
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border rounded-card border border-border bg-card">
          {flatList.map(s => (
            <TimelineRow
              key={s.id}
              startTime={s.start}
              endTime={s.end}
              courseCode={s.code}
              courseName={s.name}
              room={[s.dayLabel, s.room].filter(Boolean).join(" · ")}
              trailing={
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {s.type && (
                    <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-semibold">
                      {s.type === "lecture" ? (locale === "ar" ? "محاضرة" : "Lecture") : s.type === "section" ? (locale === "ar" ? "مجموعة" : "Section") : s.type}
                    </span>
                  )}
                  {s.instructor && <span className="text-xs text-muted-foreground">{s.instructor}</span>}
                </span>
              }
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Link href="/student">
          <Button variant="outline">{locale === "ar" ? "رجوع" : "Back"}</Button>
        </Link>
      </div>
    </div>
  );
}
