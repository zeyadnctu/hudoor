import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase, serverSupabase } from "@/lib/supabase-server";
import { effective, asBool } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Session lifecycle + automatic absence marking.
 *
 * Auth: accepts `Authorization: Bearer $CRON_SECRET` (Vercel Cron), or — as a
 * fallback so the system still works without cron configured — any signed-in
 * console client ticking it from the dashboard (lazy tick).
 *
 * Absent marking is idempotent: rows are only inserted for students with no
 * record at all, guarded by ON CONFLICT DO NOTHING on the
 * (session_id, student_id) unique constraint, so concurrent ticks cannot
 * create duplicates.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  let svc;
  if (secret) {
    if (auth !== `Bearer ${secret}`)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    svc = serviceSupabase();
  } else {
    // No secret configured: require a signed-in session (lazy tick), so the
    // endpoint is never fully anonymous.
    svc = serverSupabase();
    const { data: ud } = await svc.auth.getUser();
    if (!ud.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // 1) Close sessions whose ends_at passed.
  const { data: ended, error: endErr } = await svc
    .from("attendance_sessions")
    .update({ status: "ended" })
    .eq("status", "active")
    .lt("ends_at", nowIso)
    .select("id, course_id");
  if (endErr) return NextResponse.json({ error: endErr.message }, { status: 500 });

  // 2) Mark no-shows absent for sessions that just ended (auto_absent on).
  const { data: settingsRows } = await svc.from("app_settings").select("*");
  const autoAbsent = asBool(effective((settingsRows ?? []) as never[], "auto_absent", true), true);

  let marked = 0;
  if (autoAbsent && ended?.length) {
    for (const s of ended as { id: string; course_id: string }[]) {
      // Who is enrolled in this course?
      const { data: r } = await svc
        .from("enrollments")
        .select("student_id")
        .eq("course_id", s.course_id);
      const enrolled = (r ?? []).map((x: { student_id: string }) => x.student_id);
      if (!enrolled.length) continue;
      // Who already has a record (present/late/excused/…)?
      const { data: have } = await svc
        .from("attendance_records")
        .select("student_id")
        .eq("session_id", s.id);
      const recorded = new Set((have ?? []).map((x: { student_id: string }) => x.student_id));
      const missing = enrolled.filter(id => !recorded.has(id));
      if (!missing.length) continue;
      const { error: insErr } = await svc.from("attendance_records").upsert(
        missing.map(student_id => ({
          session_id: s.id,
          student_id,
          status: "absent",
          method: "auto",
        })),
        { onConflict: "session_id,student_id", ignoreDuplicates: true }
      );
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      marked += missing.length;
    }
  }

  // 3) Refresh any session that is past its starts_at but still scheduled.
  const { error: startErr } = await svc
    .from("attendance_sessions")
    .update({ status: "active" })
    .eq("status", "scheduled")
    .lte("starts_at", nowIso);
  if (startErr) return NextResponse.json({ error: startErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, closed: ended?.length ?? 0, absent_marked: marked });
}
