import { NextRequest, NextResponse } from "next/server";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Admin dashboard aggregates: live sessions, today's rate, low attendance, queues. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "users", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const today = new Date().toISOString().slice(0, 10);

  const { data: live } = await svc.from("attendance_sessions")
    .select("id,status,starts_at,course_id,courses(code,name_ar)").eq("status", "active")
    .order("starts_at", { ascending: false }).limit(20);

  const { data: todaySessions } = await svc.from("attendance_sessions")
    .select("id,course_id").gte("starts_at", today).lt("starts_at", today + "T23:59");
  const sessIds = ((todaySessions ?? []) as any[]).map(s => s.id);
  let rate = 0, present = 0, expected = 0;
  if (sessIds.length) {
    const courseIds = [...new Set(((todaySessions ?? []) as any[]).map(s => s.course_id))];
    const [{ data: enr }, { data: rec }] = await Promise.all([
      svc.from("enrollments").select("course_id").in("course_id", courseIds),
      svc.from("attendance_records").select("id").in("session_id", sessIds).in("status", ["present", "late"])
    ]);
    expected = (enr ?? []).length;
    present = (rec ?? []).length;
    rate = expected ? Math.round((present / expected) * 100) : 0;
  }

  // low attendance: students under min_pct in any course with >=3 sessions
  const { data: minRow } = await svc.from("app_settings").select("value").eq("scope_type", "global").eq("key", "min_pct_per_course").maybeSingle();
  const minPct = Number((minRow as any)?.value ?? 75);
  const { data: allRec } = await svc.from("attendance_records").select("student_id,status,session_id,attendance_sessions(course_id)").limit(5000);
  const perStudentCourse = new Map<string, { tot: number; ok: number }>();
  for (const r of (allRec ?? []) as any[]) {
    const k = `${r.student_id}:${r.attendance_sessions?.course_id}`;
    const e = perStudentCourse.get(k) ?? { tot: 0, ok: 0 };
    e.tot++;
    if (r.status === "present" || r.status === "late") e.ok++;
    perStudentCourse.set(k, e);
  }
  const lowKeys = [...perStudentCourse.entries()].filter(([, v]) => v.tot >= 3 && (v.ok / v.tot) * 100 < minPct).slice(0, 20);
  let low: any[] = [];
  if (lowKeys.length) {
    const sids = [...new Set(lowKeys.map(([k]) => k.split(":")[0]))];
    const { data: dets } = await svc.from("student_details").select("user_id,full_name_ar,university_id").in("user_id", sids);
    const byId = new Map(((dets ?? []) as any[]).map(d => [d.user_id, d]));
    low = lowKeys.map(([k, v]) => {
      const [sid, cid] = k.split(":");
      const d: any = byId.get(sid) ?? {};
      return { student_id: sid, course_id: cid, pct: Math.round((v.ok / v.tot) * 100), name: d.full_name_ar ?? sid.slice(0, 8), university_id: d.university_id ?? "" };
    });
  }

  const [pendProf, pendExc, pendDisp, pendSvc, flagCount] = await Promise.all([
    svc.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    svc.from("excuse_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    svc.from("disputes").select("id", { count: "exact", head: true }).eq("status", "pending"),
    svc.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    svc.from("flagged_attempts").select("id", { count: "exact", head: true })
  ]);
  const { data: flags } = await svc.from("flagged_attempts").select("id,reason,created_at").order("created_at", { ascending: false }).limit(8);

  return NextResponse.json({
    live: live ?? [],
    today: { rate, present, expected },
    low, minPct,
    queues: {
      profiles: pendProf.count ?? 0, excuses: pendExc.count ?? 0,
      disputes: pendDisp.count ?? 0, service: pendSvc.count ?? 0, flags: flagCount.count ?? 0
    },
    flags: flags ?? []
  });
}
